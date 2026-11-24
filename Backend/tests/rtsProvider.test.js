// RTS Assistant provider interface: selection, Claude + local adapters,
// tool-call conversion, safe failures, /help gate. DB-free, no network.
// Run: node --test tests/rtsProvider.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

await import("../utils/workspaceScope.js");
const { getWorkspaceId } = await import("../utils/workspaceContext.js");
const provider = await import("../services/llm/rtsProvider.js");
const local = await import("../services/llm/localOpenAiAdapter.js");
const { makeRtsHelp } = await import("../controllers/rtsHelp.controller.js");
const { requireRtsAi } = await import("../utils/aiSettings.js");
const { toolDefinitions } = await import("../services/rtsAssistant/rtsTools.js");

const LOCAL_ENV = { LLM_PROVIDER: "local", LOCAL_LLM_BASE_URL: "http://llm.internal:8000/v1/", LOCAL_LLM_MODEL: "qwen-test" };

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const jsonResponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const withEnv = async (vars, fn) => {
  const keys = ["LLM_PROVIDER", "LOCAL_LLM_BASE_URL", "LOCAL_LLM_MODEL", "LOCAL_LLM_API_KEY", "CLAUDE_API_KEY"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  keys.forEach((k) => delete process.env[k]);
  Object.assign(process.env, vars);
  try { return await fn(); } finally {
    keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  }
};

/* ---------- selection ---------- */
test("provider selection: Claude by default, local only when selected, unknown never Claude", async () => {
  const calls = [];
  const adapters = { claude: async (p) => (calls.push(["claude", p]), "C"), local: async (p) => (calls.push(["local", p]), "L") };

  assert.equal(provider.getRtsProviderName({}), "claude");
  assert.equal(provider.getRtsProviderName({ LLM_PROVIDER: " Local " }), "local");
  assert.equal(await provider.selectRtsProvider({}, adapters)({ a: 1 }), "C");
  assert.equal(await provider.selectRtsProvider({ LLM_PROVIDER: "claude" }, adapters)({}), "C");
  assert.equal(await provider.selectRtsProvider({ LLM_PROVIDER: "local" }, adapters)({}), "L");
  assert.deepEqual(calls[0], ["claude", { a: 1 }]); // Claude adapter receives params unchanged

  calls.length = 0;
  await assert.rejects(provider.selectRtsProvider({ LLM_PROVIDER: "openai" }, adapters)({}), { code: "LLM_NOT_CONFIGURED" });
  assert.deepEqual(calls, []);
});

test("provider configured: claude needs its key; local needs URL + model, ignores Claude key", () => {
  assert.equal(provider.isRtsProviderConfigured({}), false);
  assert.equal(provider.isRtsProviderConfigured({ CLAUDE_API_KEY: "k" }), true);
  assert.equal(provider.isRtsProviderConfigured(LOCAL_ENV), true);
  assert.equal(provider.isRtsProviderConfigured({ ...LOCAL_ENV, LOCAL_LLM_MODEL: "" }), false);
  assert.equal(provider.isRtsProviderConfigured({ ...LOCAL_ENV, LOCAL_LLM_BASE_URL: "llm:8000" }), false);
  assert.equal(provider.isRtsProviderConfigured({ LLM_PROVIDER: "local", CLAUDE_API_KEY: "k" }), false);
  assert.equal(provider.isRtsProviderConfigured({ LLM_PROVIDER: "bogus", CLAUDE_API_KEY: "k" }), false);
});

test("rtsHelp is wired to the provider interface, not Claude directly", () => {
  const ctl = fs.readFileSync(new URL("../controllers/rtsHelp.controller.js", import.meta.url), "utf8");
  assert.match(ctl, /makeRtsHelp\(createRtsMessage\)/);
  assert.doesNotMatch(ctl, /claudeService/);
  const routes = fs.readFileSync(new URL("../routes/ai.routes.js", import.meta.url), "utf8");
  assert.match(routes, /req\.path === "\/help"\) return requireRtsAi/);
  assert.match(routes, /router\.post\("\/help", rtsHelpLimiter, rtsHelp\)/); // rate limit unchanged
});

/* ---------- local adapter: conversion ---------- */
test("request conversion: system, tools, forced tool choice, tool_use/tool_result round trip", () => {
  const body = local.toOpenAiRequest({
    system: "SYS",
    max_tokens: 1024,
    tools: toolDefinitions,
    tool_choice: { type: "any" },
    messages: [
      { role: "user", content: "inniku evlo leads?" },
      { role: "assistant", content: [{ type: "text", text: "Checking" }, { type: "tool_use", id: "t1", name: "get_business_data", input: { metric: "leads", period: "today" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{\"ok\":true}" }] },
    ],
  }, "qwen-test");

  assert.equal(body.model, "qwen-test");
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.tool_choice, "required");
  assert.deepEqual(body.messages[0], { role: "system", content: "SYS" });
  assert.deepEqual(body.messages[1], { role: "user", content: "inniku evlo leads?" });
  assert.deepEqual(body.messages[2], {
    role: "assistant", content: "Checking",
    tool_calls: [{ id: "t1", type: "function", function: { name: "get_business_data", arguments: "{\"metric\":\"leads\",\"period\":\"today\"}" } }],
  });
  assert.deepEqual(body.messages[3], { role: "tool", tool_call_id: "t1", content: "{\"ok\":true}" });
  assert.deepEqual(body.tools.map((t) => t.function.name), ["navigate", "get_business_data", "find_records"]);
  assert.deepEqual(body.tools[1].function.parameters, toolDefinitions[1].input_schema);

  assert.equal(local.toOpenAiRequest({ messages: [], tools: toolDefinitions }, "m").tool_choice, undefined);
  assert.equal(local.toOpenAiRequest({ messages: [] }, "m").tools, undefined);
});

test("response conversion: tool_calls → tool_use, bad args safe, ids generated, stop reasons", () => {
  const r = local.fromOpenAiResponse({
    model: "qwen-test",
    choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [
      { id: "c1", type: "function", function: { name: "get_business_data", arguments: "{\"metric\":\"revenue\"}" } },
      { type: "function", function: { name: "find_records", arguments: "not json" } },
    ] } }],
  });
  assert.equal(r.stop_reason, "tool_use");
  assert.deepEqual(r.content[0], { type: "tool_use", id: "c1", name: "get_business_data", input: { metric: "revenue" } });
  assert.equal(r.content[1].name, "find_records");
  assert.deepEqual(r.content[1].input, {});
  assert.match(r.content[1].id, /^call_local_/);

  const t = local.fromOpenAiResponse({ choices: [{ finish_reason: "stop", message: { content: "Sales today: ₹0." } }] });
  assert.deepEqual(t.content, [{ type: "text", text: "Sales today: ₹0." }]);
  assert.equal(t.stop_reason, "end_turn");
  assert.equal(local.fromOpenAiResponse({ choices: [{ finish_reason: "length", message: { content: "x" } }] }).stop_reason, "max_tokens");
  assert.throws(() => local.fromOpenAiResponse({ choices: [] }), { status: 502 });
});

/* ---------- local adapter: HTTP ---------- */
test("local call: endpoint, auth header, body; failures mapped to safe statuses", async () => {
  let seen;
  const ok = local.makeLocalMessage({
    env: { ...LOCAL_ENV, LOCAL_LLM_API_KEY: "inference-secret" },
    fetchImpl: async (url, init) => ((seen = { url, init }), jsonResponse(200, { choices: [{ finish_reason: "stop", message: { content: "hi" } }] })),
  });
  const out = await ok({ system: "S", messages: [{ role: "user", content: "hello" }], max_tokens: 10 });
  assert.equal(seen.url, "http://llm.internal:8000/v1/chat/completions");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, "Bearer inference-secret");
  assert.ok(seen.init.signal);
  assert.equal(JSON.parse(seen.init.body).model, "qwen-test");
  assert.equal(out.content[0].text, "hi");

  const call = (fetchImpl, env = LOCAL_ENV) => local.makeLocalMessage({ env, fetchImpl })({ messages: [{ role: "user", content: "x" }] });
  await assert.rejects(call(async () => { throw new Error("should not fetch"); }, { LLM_PROVIDER: "local" }), { code: "LLM_NOT_CONFIGURED" });
  await assert.rejects(call(async () => { const e = new Error("connect ECONNREFUSED 10.0.0.5"); throw e; }), (e) => e.status === 502 && !/10\.0\.0\.5/.test(e.message));
  await assert.rejects(call(async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; }), { status: 502, message: "Local LLM timed out" });
  await assert.rejects(call(async () => jsonResponse(429, {})), { status: 429 });
  await assert.rejects(call(async () => jsonResponse(503, {})), { status: 429 });
  await assert.rejects(call(async () => jsonResponse(500, {})), { status: 502 });
  await assert.rejects(call(async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError("x"); } })), { status: 502 });
});

/* ---------- end-to-end through the existing RTS help loop ---------- */
test("RTS help loop runs on the local adapter: tool call → workspace-bound tool → final text", async () => {
  const bodies = [];
  const replies = [
    { choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "get_business_data", arguments: "{\"metric\":\"leads\",\"period\":\"today\"}" } }] } }] },
    { choices: [{ finish_reason: "stop", message: { content: "Inniku 3 leads vandhuchu." } }] },
  ];
  const createMessage = local.makeLocalMessage({ env: LOCAL_ENV, fetchImpl: async (_u, init) => (bodies.push(JSON.parse(init.body)), jsonResponse(200, replies.shift())) });

  let toolCall;
  const fakeTools = {
    toolDefinitions,
    runTool: async (name, input, ctx) => {
      toolCall = { name, input, ctx, ws: String(getWorkspaceId()) };
      return { content: { ok: true, metric: "leads", summary: { total: 3 } }, card: { metric: "leads" } };
    },
  };
  const res = mockRes();
  await makeRtsHelp(createMessage, fakeTools)({
    user: { role: "employee" }, workspace: "64b0000000000000000000cc",
    body: { page: "/leads", tzOffset: -330, messages: [{ role: "user", text: "inniku evlo leads?" }] },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: { role: "assistant", text: "Inniku 3 leads vandhuchu.", cards: [{ metric: "leads" }], actions: [] } });
  assert.deepEqual(toolCall, { name: "get_business_data", input: { metric: "leads", period: "today" }, ctx: { role: "employee", tzOffset: -330 }, ws: "64b0000000000000000000cc" });
  assert.equal(bodies[0].tool_choice, "required"); // data question forces a tool, as with Claude
  assert.deepEqual(bodies[1].messages.slice(-2).map((m) => m.role), ["assistant", "tool"]);
  assert.equal(bodies[1].messages.at(-1).tool_call_id, "c1");
});

test("RTS help on local adapter: unreachable → 502, busy → 503, existing messages, no detail leak", async () => {
  const run = async (fetchImpl) => {
    const res = mockRes();
    await makeRtsHelp(local.makeLocalMessage({ env: LOCAL_ENV, fetchImpl }))({ body: { messages: [{ role: "user", text: "explain this page" }] } }, res);
    return res;
  };
  const down = await run(async () => { throw new Error("connect ECONNREFUSED llm.internal"); });
  assert.equal(down.statusCode, 502);
  assert.match(down.body.message, /RTS AI is unavailable right now/);
  assert.doesNotMatch(JSON.stringify(down.body), /llm\.internal|ECONNREFUSED/);

  const busy = await run(async () => jsonResponse(429, {}));
  assert.equal(busy.statusCode, 503);
  assert.match(busy.body.message, /busy/);
});

test("local mode never calls Claude, even when a Claude key exists", async () => {
  await withEnv({ LLM_PROVIDER: "local", CLAUDE_API_KEY: "sk-ant-test" }, async () => {
    // Local unconfigured: the real createRtsMessage must fail without contacting Anthropic
    await assert.rejects(provider.createRtsMessage({ messages: [{ role: "user", content: "x" }] }), { code: "LLM_NOT_CONFIGURED" });
  });
});

/* ---------- /help gate ---------- */
test("requireRtsAi: checks the selected provider, keeps existing codes", async () => {
  const gate = async () => {
    const res = mockRes();
    let passed = false;
    await requireRtsAi({ workspace: undefined }, res, () => { passed = true; });
    return { passed, res };
  };
  await withEnv({ ...LOCAL_ENV }, async () => assert.equal((await gate()).passed, true)); // no Claude key needed
  await withEnv({ LLM_PROVIDER: "local", CLAUDE_API_KEY: "k" }, async () => {
    const { passed, res } = await gate();
    assert.equal(passed, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "AI_NOT_CONFIGURED");
  });
  await withEnv({ CLAUDE_API_KEY: "k" }, async () => assert.equal((await gate()).passed, true)); // default Claude unchanged
  await withEnv({}, async () => assert.equal((await gate()).res.body.code, "AI_NOT_CONFIGURED"));
});
