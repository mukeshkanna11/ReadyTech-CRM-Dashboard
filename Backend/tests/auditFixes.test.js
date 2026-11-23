// Regression tests for audit fixes H2, H4, M1, M2, M3, M4 (H1/H3 have their own files).
// Drives the real app.js with a stubbed user lookup; only exercises guard
// denials and limiters, so no handler ever touches the database.
// Run: node --test tests/auditFixes.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-jwt";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { escapeRegex } = await import("../utils/escapeRegex.js");

const IDS = { admin: "64b0000000000000000000a1", employee: "64b0000000000000000000a2", client: "64b0000000000000000000a3" };
const ROLE_OF = Object.fromEntries(Object.entries(IDS).map(([r, id]) => [id, r]));
const ANY = "64b0000000000000000000ff";

let server, base;
before(() => {
  User.findById = (id) => {
    const user = ROLE_OF[String(id)] ? { _id: String(id), role: ROLE_OF[String(id)], isActive: true } : null;
    return { select() { return this; }, lean: async () => user };
  };
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });

const call = async (role, method, path, body) => {
  const headers = { "Content-Type": "application/json" };
  if (role) headers.Authorization = `Bearer ${jwt.sign({ id: IDS[role] }, process.env.JWT_SECRET)}`;
  const r = await fetch(base + path, { method, headers, signal: AbortSignal.timeout(3000), ...(body && { body: JSON.stringify(body) }) });
  return r.status;
};

/* ---------------- H2: CRM / ERP role checks ---------------- */
test("H2: client role is blocked from every CRM / ERP module", async () => {
  for (const p of ["/api/inventory", "/api/vendors", "/api/purchase", "/api/sales", "/api/warehouses",
    "/api/opportunities", "/api/activities", "/api/invoices", "/api/leads", "/api/automations"]) {
    assert.equal(await call("client", "GET", p), 403, p);
  }
});

test("H2: employees cannot delete, take payments, approve/cancel, adjust stock or change automations", async () => {
  for (const [m, p] of [
    ["PUT", `/api/invoices/${ANY}/payment`], ["PUT", `/api/invoices/${ANY}/status`], ["DELETE", `/api/invoices/${ANY}`],
    ["POST", `/api/sales/${ANY}/approve`], ["POST", `/api/sales/${ANY}/cancel`], ["DELETE", `/api/sales/${ANY}`],
    ["DELETE", `/api/purchase/${ANY}`], ["DELETE", `/api/vendors/${ANY}`], ["DELETE", `/api/warehouses/${ANY}`],
    ["POST", "/api/inventory/adjust"], ["DELETE", `/api/leads/${ANY}`], ["DELETE", `/api/opportunities/${ANY}`],
    ["DELETE", `/api/activities/${ANY}`], ["POST", "/api/automations"], ["PUT", `/api/automations/${ANY}`],
    ["POST", `/api/automations/${ANY}/activate`], ["DELETE", `/api/automations/${ANY}`],
  ]) {
    assert.equal(await call("employee", m, p), 403, `${m} ${p}`);
  }
});

test("H2: unauthenticated requests still get 401", async () => {
  for (const p of ["/api/invoices", "/api/leads", "/api/automations", "/api/sales"]) {
    assert.equal(await call(null, "GET", p), 401, p);
  }
});

/* ---------------- M1: VoIP token ---------------- */
test("M1: client role cannot get a Twilio voice token", async () => {
  assert.equal(await call("client", "GET", "/api/voip/token"), 403);
});

/* ---------------- M2 / M3 / H4: rate limits ---------------- */
const burst = async (n, method, path, body) => {
  const statuses = [];
  for (let i = 0; i < n; i++) statuses.push(await call(null, method, path, body));
  return statuses;
};

test("M3: public lead form is rate-limited per IP", async () => {
  const s = await burst(11, "POST", "/api/leads/public", {}); // invalid body → 400, no DB
  assert.ok(s.slice(0, 10).every((c) => c === 400), s.join());
  assert.equal(s[10], 429);
});

test("M2: public website chat is rate-limited per IP", async () => {
  const s = await burst(31, "POST", "/api/chat", { name: "A", email: "" });
  assert.ok(s.slice(0, 30).every((c) => c === 400), s.join());
  assert.equal(s[30], 429);
});

test("H4: password sign-in is rate-limited after repeated failures", async () => {
  const s = await burst(11, "POST", "/api/auth/login", {}); // missing credentials → 400
  assert.ok(s.slice(0, 10).every((c) => c === 400), s.join());
  assert.equal(s[10], 429);
});

/* ---------------- H4: no well-known seed password ---------------- */
test("H4: super admin is not seeded without SUPER_ADMIN_PASSWORD", async () => {
  const origFindOne = User.findOne;
  const origSave = User.prototype.save;
  let saved = 0;
  User.findOne = async () => null;
  User.prototype.save = async function () { saved++; return this; };
  try {
    delete process.env.SUPER_ADMIN_PASSWORD;
    await User.createAdminIfNotExists();
    process.env.SUPER_ADMIN_PASSWORD = "short";
    await User.createAdminIfNotExists();
    assert.equal(saved, 0);

    process.env.SUPER_ADMIN_PASSWORD = "a-strong-test-passphrase";
    await User.createAdminIfNotExists();
    assert.equal(saved, 1);
  } finally {
    User.findOne = origFindOne;
    User.prototype.save = origSave;
    delete process.env.SUPER_ADMIN_PASSWORD;
  }
});

/* ---------------- M4: regex escaping ---------------- */
test("M4: search text is matched literally", () => {
  const evil = "(a+)+$";
  const rx = new RegExp(escapeRegex(evil), "i");
  assert.ok(rx.test("x(a+)+$y"));
  assert.ok(!rx.test("aaaa"));
  assert.equal(escapeRegex(".*"), "\\.\\*");
  assert.equal(escapeRegex(undefined), "");
});

/* ---------------- employee workflows still pass every guard ---------------- */
test("employee day-to-day CRM / ERP / HR self-service routes are not blocked", async () => {
  const mongoose = (await import("mongoose")).default;
  const { default: Employee } = await import("../models/hr/Employee.js");
  mongoose.set("bufferCommands", false);           // DB calls fail fast; we only check the guards
  for (const m of Object.values(mongoose.models)) m.collection.buffer = false;
  const origEmpFindOne = Employee.findOne;
  Employee.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: ANY }) });
  try {
    for (const [m, p] of [
      ["GET", "/api/leads"], ["POST", "/api/leads"], ["PUT", `/api/leads/${ANY}`], ["POST", `/api/leads/${ANY}/convert`],
      ["GET", "/api/opportunities"], ["POST", "/api/opportunities"], ["GET", "/api/activities"], ["POST", "/api/activities"],
      ["GET", "/api/invoices"], ["POST", "/api/invoices"], ["GET", `/api/invoices/${ANY}/pdf`],
      ["GET", "/api/sales"], ["POST", "/api/sales"],
      ["GET", "/api/purchase"], ["POST", `/api/purchase/${ANY}/receive`], ["GET", "/api/warehouses"],
      ["GET", "/api/inventory"], ["POST", "/api/inventory/stock-in"], ["POST", "/api/inventory/transfer"],
      ["GET", "/api/automations"], ["GET", "/api/voip/token"],
      ["GET", "/api/hr/leaves"], ["POST", "/api/hr/leaves"], ["GET", "/api/hr/payslips"], ["GET", "/api/hr/holidays"],
    ]) {
      const s = await call("employee", m, p, m === "GET" ? undefined : {}).catch((e) => `hang:${e.name}`);
      if (process.env.SHOW_STATUS) console.log(`STATUS ${m} ${p} ${s}`);
      // Guards answer immediately; a timeout means the handler is already waiting on the
      // (absent) database, i.e. the request got past every guard.
      assert.ok(s === "hang:TimeoutError" || (typeof s === "number" && ![401, 403, 429].includes(s)), `${m} ${p} → ${s}`);
    }
  } finally {
    Employee.findOne = origEmpFindOne;
  }
});

/* Handlers that open a DB session can't run without a database, so check their guards statically */
test("employee can still deliver sales orders and list vendors (no admin-only guard)", async () => {
  const fs = await import("node:fs");
  const read = (f) => fs.readFileSync(new URL(f, import.meta.url), "utf8");
  assert.match(read("../routes/sales.routes.js"), /router\.post\("\/:id\/deliver", auth, deliverSalesOrder\)/);
  assert.match(read("../routes/vendors.routes.js"), /router\.get\("\/", auth, getVendors\)/);
  assert.match(read("../app.js"), /app\.use\("\/api\/(sales|vendors)", auth, role\("admin", "employee"\)/);
});
