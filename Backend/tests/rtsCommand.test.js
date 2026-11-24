// RTS structured commands without Claude: intent parsing, templates,
// role checks, workspace isolation. DB-free. Run: node --test tests/rtsCommand.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../utils/workspaceScope.js");
const { getWorkspaceId } = await import("../utils/workspaceContext.js");
const { parseIntent, detectLang, formatReply } = await import("../services/rtsAssistant/rtsIntent.js");
const { makeRtsCommand } = await import("../controllers/rtsCommand.controller.js");
const tools = await import("../services/rtsAssistant/rtsTools.js");

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const WS_A = "64b0000000000000000000aa";
const WS_B = "64b0000000000000000000bb";

test("metric intents: English, Tanglish, Tamil", () => {
  const cases = [
    ["Today's sales?", "revenue", "today"],
    ["How many leads this month", "leads", "this_month"],
    ["total revenue last month", "revenue", "last_month"],
    ["sales orders this week", "sales_orders", "this_week"],
    ["low stock", "inventory", "today"],
    ["pending payments", "payments", "today"],
    ["how many employees", "employees", "today"],
    ["expenses this year", "expenses", "this_year"],
    ["inniku evlo sales", "revenue", "today"],
    ["nethu ethana leads vandhuchu", "leads", "yesterday"],
    ["pona masam invoice evlo", "invoices", "last_month"],
    ["இன்று எத்தனை லீட்ஸ்", "leads", "today"],
    ["இந்த மாதம் விற்பனை எவ்வளவு", "revenue", "this_month"],
    ["நேற்று பில் எத்தனை", "invoices", "yesterday"],
  ];
  for (const [q, metric, period] of cases) {
    assert.deepEqual(parseIntent(q), { tool: "get_business_data", input: { metric, period } }, q);
  }
});

test("record-search intents", () => {
  assert.deepEqual(parseIntent("find invoice INV-001"), { tool: "find_records", input: { entity: "invoice", query: "inv-001", open: false } });
  assert.deepEqual(parseIntent("show Ram's invoice"), { tool: "find_records", input: { entity: "invoice", query: "ram", open: false } });
  assert.deepEqual(parseIntent("find overdue payments"), { tool: "find_records", input: { entity: "invoice", status: "Overdue", open: false } });
  assert.deepEqual(parseIntent("open customer Acme"), { tool: "find_records", input: { entity: "client", query: "acme", open: true } });
  assert.deepEqual(parseIntent("Ravi lead kaatu"), { tool: "find_records", input: { entity: "lead", query: "ravi", open: false } });
  assert.deepEqual(parseIntent("ராம் இன்வாய்ஸ் காட்டு"), { tool: "find_records", input: { entity: "invoice", query: "ராம்", open: false } });
  assert.deepEqual(parseIntent("show vendors"), { tool: "find_records", input: { entity: "vendor", open: false } });
  // "show" + metric with no name → figures, not a search
  assert.deepEqual(parseIntent("show today's leads"), { tool: "get_business_data", input: { metric: "leads", period: "today" } });
});

test("write / approval requests are blocked; how-to and unrelated text are not handled", () => {
  for (const q of ["create invoice for Ram", "delete lead Ravi", "approve leave", "update customer Acme", "lead convert pannu", "இன்வாய்ஸ் உருவாக்கு"]) {
    assert.deepEqual(parseIntent(q), { blocked: true }, q);
  }
  for (const q of ["", "how do I create an invoice?", "invoice eppadi create pannanum", "what is the weather", "hello", "x".repeat(250)]) {
    assert.equal(parseIntent(q), null, q);
  }
});

test("language detection and template replies", () => {
  assert.equal(detectLang("today's sales"), "en");
  assert.equal(detectLang("inniku evlo sales"), "tl");
  assert.equal(detectLang("இன்று விற்பனை"), "ta");

  const leads = { ok: true, metric: "leads", period: "today", summary: { total: 4 } };
  assert.equal(formatReply(leads, "en"), "Leads today: total 4.");
  assert.equal(formatReply(leads, "tl"), "Leads inniku: motham 4.");
  assert.equal(formatReply(leads, "ta"), "லீட்ஸ் இன்று: மொத்தம் 4.");
  assert.equal(formatReply({ ...leads, summary: { total: 0 } }, "en"), "There are no leads records today.");
  assert.match(formatReply({ ok: true, metric: "revenue", period: "this_month", summary: { invoicedAmount: 125000, invoices: 3 } }, "en"), /^Sales this month: invoiced ₹1,25,000, invoices 3/);
  assert.equal(
    formatReply({ ok: true, type: "records", entity: "invoice", count: 1, records: [{ invoiceNumber: "INV-1", customer: "Ram", paymentStatus: "Overdue", balanceDue: 500 }] }, "en"),
    "Found 1 invoice: INV-1, Ram, Overdue, balance ₹500."
  );
  assert.equal(formatReply({ ok: true, type: "records", entity: "lead", count: 0, records: [] }, "en"), "No matching lead records found.");
  assert.equal(formatReply({ ok: false, error: "PERMISSION_DENIED: x" }, "en"), "Your role cannot view this data.");
});

test("endpoint: runs the parsed read tool inside the caller's workspace", async () => {
  const calls = [];
  const fake = { runTool: async (name, input, ctx) => {
    calls.push({ name, input, ctx, ws: String(getWorkspaceId()) });
    return { content: { ok: true, metric: input.metric, period: input.period, summary: { total: 2 } }, card: { metric: input.metric } };
  } };
  const handler = makeRtsCommand(fake);

  const resA = mockRes();
  await handler({ user: { role: "employee" }, workspace: WS_A, body: { text: "how many leads today", tzOffset: -330 } }, resA);
  const resB = mockRes();
  await handler({ user: { role: "admin" }, workspace: WS_B, body: { text: "inniku evlo leads" } }, resB);

  assert.equal(resA.statusCode, 200);
  assert.equal(resA.body.data.handled, true);
  assert.equal(resA.body.data.text, "Leads today: total 2.");
  assert.equal(resB.body.data.text, "Leads inniku: motham 2.");
  assert.deepEqual(calls.map((c) => c.ws), [WS_A, WS_B]);
  assert.deepEqual(calls[0].ctx, { role: "employee", tzOffset: -330 });
  assert.deepEqual(resA.body.data.cards, [{ metric: "leads" }]);
});

test("endpoint: no workspace → refused, tool never runs", async () => {
  let called = false;
  const res = mockRes();
  await makeRtsCommand({ runTool: async () => { called = true; return { content: { ok: true } }; } })({ user: { role: "admin" }, body: { text: "today's sales" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test("endpoint: invalid, unsupported and write commands never reach a tool", async () => {
  let called = false;
  const handler = makeRtsCommand({ runTool: async () => { called = true; return { content: { ok: true } }; } });
  const req = (text) => ({ user: { role: "admin" }, workspace: WS_A, body: { text } });

  const empty = mockRes(); await handler(req("   "), empty);
  assert.equal(empty.statusCode, 400);
  const bad = mockRes(); await handler({ ...req(""), body: { text: { $gt: "" } } }, bad);
  assert.equal(bad.statusCode, 400);
  const unknown = mockRes(); await handler(req("tell me a joke"), unknown);
  assert.equal(unknown.body.data.handled, false);
  const write = mockRes(); await handler(req("delete invoice INV-1"), write);
  assert.equal(write.body.data.intent, "blocked");
  assert.match(write.body.data.text, /only read/);
  assert.equal(called, false);
});

test("endpoint + real runTool: role permissions enforced", async () => {
  const handler = makeRtsCommand();
  // employee: clients metric is admin-only
  const r1 = mockRes();
  await handler({ user: { role: "employee" }, workspace: WS_A, body: { text: "how many clients this month" } }, r1);
  assert.equal(r1.body.data.text, "Your role cannot view this data.");
  assert.equal(r1.body.data.error, true);
  // client role: no workspace records at all
  const r2 = mockRes();
  await handler({ user: { role: "client" }, workspace: WS_A, body: { text: "find invoice INV-1" } }, r2);
  assert.equal(r2.body.data.text, "Your role cannot view this data.");
  // Tamil reply for a denied Tamil command
  const r3 = mockRes();
  await handler({ user: { role: "employee" }, workspace: WS_A, body: { text: "இன்று எத்தனை வாடிக்கையாளர்" } }, r3);
  assert.match(r3.body.data.text, /அனுமதி இல்லை/);
});

test("endpoint + real runTool: record search is workspace-bound and escaped", async () => {
  const orig = tools.ENTITIES.invoice.find;
  let seen;
  tools.ENTITIES.invoice.find = async (q, status) => ((seen = { q, status, ws: String(getWorkspaceId()) }), [{ invoiceNumber: "INV-1", customer: "Ram", paymentStatus: "Overdue", balanceDue: 10, _open: "/invoices/abc" }]);
  try {
    const res = mockRes();
    await makeRtsCommand()({ user: { role: "employee" }, workspace: WS_B, body: { text: "open invoice INV-1.*" } }, res);
    assert.deepEqual(seen, { q: "inv-1", status: "", ws: WS_B });
    assert.equal(res.body.data.actions[0].path, "/invoices/abc");
    assert.equal(res.body.data.cards[0].records[0]._open, undefined);
    assert.match(res.body.data.text, /^Found 1 invoice: INV-1/);
  } finally { tools.ENTITIES.invoice.find = orig; }
});

test("route is authenticated, rate-limited and not behind requireClaudeAi", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /app\.use\("\/api\/rts", auth, rtsRoutes\)/);
  const routes = readFileSync(new URL("../routes/rts.routes.js", import.meta.url), "utf8");
  assert.doesNotMatch(routes, /import[^\n]*(aiSettings|claudeService|anthropic)/i);
  assert.match(routes, /router\.post\("\/command", rtsCommandLimiter, rtsCommand\)/);
  const ctrl = readFileSync(new URL("../controllers/rtsCommand.controller.js", import.meta.url), "utf8");
  assert.doesNotMatch(ctrl, /import[^\n]*(claudeService|anthropic)/i);
});
