// RTS widget routing (Frontend/src/components/rtsAsk.js + RtsAssistantWidget.jsx):
// navigation stays on-device; other commands → /rts/command first; /ai/help only
// when unhandled; Claude unavailable → friendly reply, never a crash.
// Run: node --test tests/rtsAssistantRouting.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { askRts, isClaudeUnavailable } = await import("../../Frontend/src/components/rtsAsk.js");
const widget = fs.readFileSync(new URL("../../Frontend/src/components/RtsAssistantWidget.jsx", import.meta.url), "utf8");

const httpError = (status, body = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: body } });
/* Fake axios instance: routes[url] = response body or a function returning/throwing */
const fakeApi = (routes) => {
  const calls = [];
  return {
    calls,
    post: async (url, body, opts) => {
      calls.push({ url, body, opts });
      const r = routes[url];
      if (r === undefined) throw httpError(404);
      const out = typeof r === "function" ? r() : r;
      return { data: out };
    },
  };
};
const base = { question: "today's sales", history: [{ role: "user", text: "today's sales" }], product: "CRM", page: "/dashboard", tzOffset: -330 };

test("handled structured command: reply used as-is, /ai/help never called", async () => {
  const api = fakeApi({
    "/rts/command": { success: true, data: { handled: true, text: "Sales today: invoiced ₹500.", cards: [{ metric: "revenue" }], actions: [{ type: "navigate", path: "/invoices/abc", label: "Open invoice" }] } },
    "/ai/help": () => { throw new Error("must not be called"); },
  });
  const reply = await askRts({ api, ...base });
  assert.deepEqual(api.calls.map((c) => c.url), ["/rts/command"]);
  assert.deepEqual(api.calls[0].body, { text: "today's sales", tzOffset: -330 });
  assert.equal(api.calls[0].opts.silent, true);
  assert.deepEqual(reply, { role: "assistant", text: "Sales today: invoiced ₹500.", cards: [{ metric: "revenue" }], actions: [{ type: "navigate", path: "/invoices/abc", label: "Open invoice" }] });
});

test("handled load failure is marked as a retryable error", async () => {
  const api = fakeApi({ "/rts/command": { data: { handled: true, error: true, text: "The data could not be loaded right now." } } });
  const reply = await askRts({ api, ...base });
  assert.equal(reply.error, true);
  assert.equal(api.calls.length, 1);
});

test("unhandled → /ai/help with the existing payload when Claude is enabled", async () => {
  const api = fakeApi({
    "/rts/command": { data: { handled: false, text: "Sorry, I didn't understand that command." } },
    "/ai/help": { data: { text: "Steps: 1. Open Invoices…", cards: [], actions: [] } },
  });
  const reply = await askRts({ api, ...base, question: "how do I create an invoice?" });
  assert.deepEqual(api.calls.map((c) => c.url), ["/rts/command", "/ai/help"]);
  assert.deepEqual(api.calls[1].body, { product: "CRM", page: "/dashboard", tzOffset: -330, messages: base.history });
  assert.equal(api.calls[1].opts.timeout, 60000);
  assert.equal(reply.text, "Steps: 1. Open Invoices…");
  assert.equal(reply.error, undefined);
});

test("Claude disabled / not configured / failing → friendly unsupported reply (not an error)", async () => {
  for (const err of [httpError(403, { code: "AI_DISABLED" }), httpError(503, { code: "AI_NOT_CONFIGURED" }), httpError(502, { message: "RTS AI is unavailable" })]) {
    const api = fakeApi({
      "/rts/command": { data: { handled: false, text: "Sorry, I didn't understand that command. Try \"today's sales\"." } },
      "/ai/help": () => { throw err; },
    });
    const reply = await askRts({ api, ...base, question: "tell me a joke" });
    assert.equal(reply.error, undefined, err.message);
    assert.match(reply.text, /didn't understand/);
    assert.deepEqual(reply.cards, []);
  }
  // Tamil command with no server text → Tamil fallback
  const api = fakeApi({ "/ai/help": () => { throw httpError(403, { code: "AI_DISABLED" }); } });
  const reply = await askRts({ api, ...base, question: "ஏதோ ஒன்று" });
  assert.match(reply.text, /மன்னிக்கவும்/);
});

test("busy / timeout stay retryable errors; structured endpoint down still tries AI", async () => {
  assert.equal(isClaudeUnavailable(httpError(503, { message: "busy" })), false);
  const busy = await askRts({ api: fakeApi({ "/rts/command": { data: { handled: false } }, "/ai/help": () => { throw httpError(503, { message: "RTS AI is busy right now." }); } }), ...base });
  assert.deepEqual([busy.error, busy.text], [true, "RTS AI is busy right now."]);

  const api = fakeApi({ "/ai/help": { data: { text: "From AI" } } }); // /rts/command → 404
  const reply = await askRts({ api, ...base });
  assert.deepEqual(api.calls.map((c) => c.url), ["/rts/command", "/ai/help"]);
  assert.equal(reply.text, "From AI");
});

test("cancelled requests re-throw (widget drops them silently), on either call", async () => {
  const cancel = Object.assign(new Error("canceled"), { code: "ERR_CANCELED" });
  await assert.rejects(askRts({ api: fakeApi({ "/rts/command": () => { throw cancel; } }), ...base }), /canceled/);
  const ac = new AbortController();
  const api = fakeApi({ "/rts/command": { data: { handled: false } }, "/ai/help": () => { ac.abort(); throw new Error("aborted"); } });
  await assert.rejects(askRts({ api, ...base, signal: ac.signal }), /aborted/);
});

test("widget wiring: navigation first, then askRts; reply still spoken and actions executed", () => {
  const run = widget.slice(widget.indexOf("const runCommand"), widget.indexOf("const cancel"));
  assert.ok(run.indexOf("parseNavigation(text)") < run.indexOf("ask(text)"), "parseNavigation must run before the API path");
  assert.match(widget, /import \{ askRts, isCanceled \} from "\.\/rtsAsk"/);
  assert.match(widget, /reply = await askRts\(\{[\s\S]*api: API,[\s\S]*signal: controller\.signal/);
  assert.doesNotMatch(widget, /API\.post\(/); // all requests go through askRts
  assert.match(widget, /if \(isCanceled\(err, controller\.signal\)\) return;/);
  assert.match(widget, /if \(id !== reqId\.current\) return;/);
  assert.match(widget, /if \(!reply\.error\) voiceRef\.current\?\.speak\(reply\.text\);/);
  assert.match(widget, /const nav = reply\.actions\?\.find\(\(a\) => a\.type === "navigate"\);/);
});
