// RTS AI Assistant: tool loop, navigation, permissions, workspace binding.
// DB-free. Run: node --test tests/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

await import("../utils/workspaceScope.js");
const { getWorkspaceId } = await import("../utils/workspaceContext.js");
const { makeRtsHelp } = await import("../controllers/rtsHelp.controller.js");
const tools = await import("../services/rtsAssistant/rtsTools.js");

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const say = (text) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });
const use = (name, input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name, input }] });

test("period ranges follow the user's timezone (IST)", () => {
  const now = new Date("2026-11-03T20:00:00Z"); // 04 Nov 01:30 IST
  const r = tools.periodRange("today", -330, now);
  assert.equal(r.from.toISOString(), "2026-11-03T18:30:00.000Z");
  const y = tools.periodRange("yesterday", -330, now);
  assert.equal(y.to.toISOString(), r.from.toISOString());
  assert.equal(tools.periodRange("this_month", -330, now).from.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(tools.periodRange("all_time", 0, now), null);
});

test("role permissions: clients admin-only, client role gets no data", async () => {
  assert.equal(tools.canAccessMetric("admin", "clients"), true);
  assert.equal(tools.canAccessMetric("employee", "clients"), false);
  assert.equal(tools.canAccessMetric("employee", "leads"), true);
  assert.equal(tools.canAccessMetric("client", "leads"), false);
  const out = await tools.runTool("get_business_data", { metric: "clients" }, { role: "employee" });
  assert.match(out.content.error, /PERMISSION_DENIED/);
  assert.equal(out.card, undefined);
});

test("navigate only allows implemented routes", async () => {
  const ok = await tools.runTool("navigate", { path: "/leads" });
  assert.deepEqual(ok.action, { type: "navigate", path: "/leads", label: "Leads" });
  const bad = await tools.runTool("navigate", { path: "https://evil.example" });
  assert.equal(bad.action, undefined);
});

test("tool loop: data read is bound to the caller's workspace and returned as a card", async () => {
  let seenWs;
  const fakeTools = {
    toolDefinitions: tools.toolDefinitions,
    runTool: async (name, input) => {
      seenWs = getWorkspaceId();
      return { content: { ok: true, metric: input.metric, summary: { total: 0 } }, card: { metric: input.metric, summary: { total: 0 } } };
    },
  };
  const replies = [use("get_business_data", { metric: "leads", period: "today" }), say("There are no leads today.")];
  let second;
  const handler = makeRtsHelp(async (args) => { if (replies.length === 1) second = args; return replies.shift(); }, fakeTools);
  const res = mockRes();
  await handler({ user: { role: "admin" }, workspace: "64b000000000000000000001", body: { page: "/dashboard", messages: [{ role: "user", text: "inniku evlo leads?" }] } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(String(seenWs), "64b000000000000000000001");
  assert.equal(res.body.data.text, "There are no leads today.");
  assert.equal(res.body.data.cards[0].metric, "leads");
  assert.equal(second.messages.at(-1).content[0].type, "tool_result");
});

test("no workspace → data tool refused; navigation action returned", async () => {
  let called = false;
  const fakeTools = { toolDefinitions: [], runTool: async (n, i) => { called = n === "get_business_data"; return tools.runTool(n, i); } };
  const r1 = [use("get_business_data", { metric: "leads" }), say("Unavailable.")];
  const res1 = mockRes();
  await makeRtsHelp(async () => r1.shift(), fakeTools)({ user: { role: "admin" }, body: { messages: [{ role: "user", text: "leads?" }] } }, res1);
  assert.equal(called, false);
  assert.deepEqual(res1.body.data.cards, []);

  const r2 = [use("navigate", { path: "/stocks/sales-orders" }), say("Opening Sales Orders.")];
  const res2 = mockRes();
  await makeRtsHelp(async () => r2.shift(), fakeTools)({ user: { role: "employee" }, workspace: "64b000000000000000000002", body: { messages: [{ role: "user", text: "go to sales orders" }] } }, res2);
  assert.equal(res2.body.data.actions[0].path, "/stocks/sales-orders");
});

test("Claude rate-limit/overload maps to 503 busy", async () => {
  const res = mockRes();
  await makeRtsHelp(async () => { const e = new Error("overloaded"); e.status = 529; throw e; })({ body: { messages: [{ role: "user", text: "hi" }] } }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /busy/);
});

test("data/record/navigation questions force a tool call; how-to questions do not", async () => {
  const { needsTool } = await import("../controllers/rtsHelp.controller.js");
  for (const q of ["Today's sales?", "go to invoice", "Open leads", "inniku evlo sales?", "இன்று விற்பனை எவ்வளவு?", "Find overdue payments", "show Ram's invoice", "what about yesterday?"]) {
    assert.equal(needsTool(q), true, q);
  }
  for (const q of ["How do I create an invoice?", "Explain this page", "invoice eppadi create pannanum?"]) {
    assert.equal(needsTool(q), false, q);
  }
  let first;
  await makeRtsHelp(async (args) => { first ||= args; return say("ok"); })({ body: { messages: [{ role: "user", text: "today's sales" }] } }, mockRes());
  assert.deepEqual(first.tool_choice, { type: "any" });
});

test("find_records: role-gated, escaped query, safe deep link", async () => {
  const denied = await tools.runTool("find_records", { entity: "client", query: "Ram" }, { role: "employee" });
  assert.match(denied.content.error, /PERMISSION_DENIED/);
  const none = await tools.runTool("find_records", { entity: "invoice" }, { role: "client" });
  assert.match(none.content.error, /PERMISSION_DENIED/);

  let filter;
  const orig = tools.ENTITIES.invoice.find;
  tools.ENTITIES.invoice.find = async (q, status) => ((filter = { q, status }), [{ invoiceNumber: "INV-1", _open: "/invoices/abc123" }]);
  try {
    const out = await tools.runTool("find_records", { entity: "invoice", query: "Ram.*(", status: "overdue", open: true }, { role: "employee" });
    assert.deepEqual(filter, { q: "Ram\\.\\*\\(", status: "Overdue" });
    assert.equal(out.action.path, "/invoices/abc123");
    assert.equal(out.card.records[0]._open, undefined);
  } finally { tools.ENTITIES.invoice.find = orig; }
});

test("explain-this-page context is page specific", async () => {
  const { buildSystemPrompt } = await import("../controllers/rtsHelp.controller.js");
  assert.match(buildSystemPrompt({ page: "/invoices" }), /About the current page \(Invoices\)/);
  assert.match(buildSystemPrompt({ page: "/invoices" }), /Profit is NOT calculated/);
});
