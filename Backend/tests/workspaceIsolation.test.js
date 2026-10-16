// Focused, DB-free tests for workspace isolation (mocked model calls).
// Run: node --test tests/
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.META_APP_ID = "test-app";
process.env.META_APP_SECRET = "test-secret-test-secret-test-secret";
process.env.META_REDIRECT_URI = "http://localhost/cb";
process.env.JWT_SECRET = "test-jwt";
process.env.WHATSAPP_PHONE_NUMBER_ID = "SIVA_PN";
process.env.WHATSAPP_ACCESS_TOKEN = "SIVA_TOKEN";
process.env.WHATSAPP_VERIFY_TOKEN = "verify";

await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const { default: MetaConnection, metaKeyFor } = await import("../models/MetaConnection.js");
const { default: User } = await import("../models/User.js");
const admin = await import("../controllers/admin.controller.js");
const meta = await import("../services/meta/meta.service.js");
const wa = await import("../services/meta/whatsapp.service.js");
const ig = await import("../services/meta/instagram.service.js");

const SIVA = "64b000000000000000000001";
const SARA = "64b000000000000000000002";
ctx.setDefaultWorkspaceId(SIVA);

const resMock = () => {
  const res = { statusCode: 200 };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const chain = (value) => ({
  select() { return this; }, sort() { return this; }, lean: async () => value,
  then: (ok, fail) => Promise.resolve(value).then(ok, fail),
});
const orig = {};
const stub = (obj, name, fn) => {
  orig[`${obj.modelName}.${name}`] ??= [obj, name, obj[name]];
  obj[name] = fn;
};
beforeEach(() => {
  Object.values(orig).forEach(([o, n, f]) => (o[n] = f));
});

/* ---------------- MetaConnection ---------------- */
test("Siva and no-context webhooks resolve the existing default doc", async () => {
  assert.equal(metaKeyFor(), "default");
  await ctx.runWithWorkspace(SIVA, async () => assert.equal(metaKeyFor(), "default"));
});

test("getSingleton reuses Siva's doc and never creates/overwrites it", async () => {
  const sivaDoc = { key: "default", status: "connected" };
  const queried = [];
  let created = 0;
  stub(MetaConnection, "findOne", async (f) => (queried.push(f.key), f.key === "default" ? sivaDoc : null));
  stub(MetaConnection, "create", async (d) => (created++, d));

  await ctx.runWithWorkspace(SIVA, async () => {
    assert.equal(await MetaConnection.getSingleton(), sivaDoc);
  });
  assert.equal(created, 0);

  await ctx.runWithWorkspace(SARA, async () => {
    const doc = await MetaConnection.getSingleton();
    assert.equal(doc.key, SARA);
  });
  assert.equal(created, 1);
  assert.deepEqual(queried, ["default", SARA]);
});

test("getSingleton recovers from a concurrent-create duplicate key", async () => {
  let calls = 0;
  stub(MetaConnection, "findOne", async () => (calls++ ? { key: SARA } : null));
  stub(MetaConnection, "create", async () => { throw Object.assign(new Error("dup"), { code: 11000 }); });
  const doc = await MetaConnection.getSingleton(SARA);
  assert.equal(doc.key, SARA);
});

/* ---------------- OAuth callback ---------------- */
const mockGraph = () => {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({
      access_token: "tok", expires_in: 3600,
      data: [{ id: "P1", name: "Page", access_token: "pt", instagram_business_account: { id: "IG1" } }],
    }),
  });
};

test("OAuth callback saves into the connecting admin's workspace", async () => {
  mockGraph();
  const saved = [];
  stub(User, "findById", () => chain({ _id: SARA, workspace: null }));
  // String key = getSingleton lookup; { $ne } key = cross-workspace claim check
  stub(MetaConnection, "findOne", ({ key }) =>
    typeof key === "string"
      ? Promise.resolve({ key, save: async function () { saved.push(this.key); } })
      : chain(null));
  await meta.completeConnection({ code: "c", userId: SARA });
  assert.deepEqual(saved, [SARA]);
});

test("OAuth callback rejects unknown user instead of writing Siva's doc", async () => {
  mockGraph();
  let touched = false;
  stub(User, "findById", () => chain(null));
  stub(MetaConnection, "findOne", async () => ((touched = true), null));
  await assert.rejects(meta.completeConnection({ code: "c", userId: SARA }), /not found/);
  assert.equal(touched, false);
});

test("signed OAuth state round-trips the admin id", () => {
  assert.equal(String(meta.verifyOAuthState(meta.createOAuthState(SARA)).uid), SARA);
});

/* ---------------- WhatsApp ---------------- */
test("env WhatsApp number is only usable by the default workspace", async () => {
  assert.equal(wa.getWhatsAppConfig().phoneNumberId, "SIVA_PN"); // webhook context
  await ctx.runWithWorkspace(SIVA, async () => assert.equal(wa.getWhatsAppConfig().configured, true));
  await ctx.runWithWorkspace(SARA, async () => {
    const c = wa.getWhatsAppConfig();
    assert.equal(c.configured, false);
    assert.equal(c.accessToken, null);
    assert.ok(c.missing.includes("WHATSAPP_PHONE_NUMBER_ID"));
  });
});

/* ---------------- Instagram webhook ---------------- */
test("IG webhook drops unsigned entries for another workspace's account", async () => {
  stub(MetaConnection, "findOne", (f) => chain(f["instagram.id"] === "SARA_IG" ? { key: SARA } : null));
  const payload = {
    object: "instagram",
    entry: [{ id: "SARA_IG", messaging: [{ sender: { id: "1" }, message: { mid: "m", text: "hi" } }] }],
  };
  const r = await ig.processWebhookPayload(payload);
  assert.equal(r.ignored, 1);
  assert.equal(r.messages, 0);
});

/* ---------------- Users ---------------- */
test("user filter: Saravanan sees only own workspace; Siva also legacy non-admins", () => {
  assert.deepEqual(ctx.userWorkspaceFilter(SARA), { $or: [{ _id: SARA }, { workspace: SARA }] });
  assert.deepEqual(ctx.userWorkspaceFilter(SIVA).$or[2], { workspace: null, role: { $ne: "admin" } });
  assert.deepEqual(ctx.userWorkspaceFilter(undefined), { _id: null }, "missing workspace never returns all users");
});

test("listUsers / getUserById / update / delete are scoped", async () => {
  const filters = [];
  const cap = (v) => (f) => (filters.push(f), chain(v));
  stub(User, "find", cap([]));
  stub(User, "findOne", cap(null));
  stub(User, "findOneAndDelete", async (f) => (filters.push(f), null));

  const req = { workspace: SARA, params: { id: SIVA }, body: {} };
  await admin.listUsers(req, resMock());
  let res = await admin.getUserById(req, resMock());
  assert.equal(res.statusCode, 404);
  res = await admin.updateUser(req, resMock());
  assert.equal(res.statusCode, 404);
  res = await admin.deleteUser(req, resMock());
  assert.equal(res.statusCode, 404);

  for (const f of filters) assert.deepEqual(f.$or, [{ _id: SARA }, { workspace: SARA }]);
  assert.equal(filters.length, 4);
});

test("createUser: employees inherit; only Siva provisions new tenant admins", async () => {
  const saved = [];
  stub(User, "findOne", async () => null);
  const origSave = User.prototype.save;
  User.prototype.save = async function () { saved.push(this); return this; };
  try {
    const body = { name: "E", email: "e@x.io", password: "secret1", department: "Operations", designation: "Director" };
    await admin.createUser({ workspace: SARA, body: { ...body, role: "employee" } }, resMock());
    await admin.createUser({ workspace: SARA, body: { ...body, email: "a@x.io", role: "admin" } }, resMock());
    await admin.createUser({ workspace: SIVA, body: { ...body, email: "c@x.io", role: "admin" } }, resMock());
  } finally {
    User.prototype.save = origSave;
  }
  assert.equal(saved.length, 3, "all users reached save");
  assert.equal(String(saved[0].workspace), SARA, "employee -> Saravanan");
  assert.equal(String(saved[1].workspace), SARA, "tenant co-admin stays in tenant");
  assert.equal(saved[2].workspace, null, "Siva-provisioned client admin -> own new workspace");
});

/* ---------------- Default workspace resolution (root cause) ---------------- */
const mongoose = (await import("mongoose")).default;
const { resolveDefaultWorkspace } = await import("../config/db.js");

test("default workspace = seeded super admin, not oldest admin", async () => {
  const prevDb = mongoose.connection.db;
  const prevEnv = process.env.DEFAULT_WORKSPACE_ID;
  delete process.env.DEFAULT_WORKSPACE_ID;
  const queries = [];
  mongoose.connection.db = {
    collection: () => ({
      findOne: async (q) => (queries.push(q), q.email === "siva@readytechsolutions.in" ? { _id: SIVA } : { _id: SARA }),
    }),
  };
  try {
    await resolveDefaultWorkspace();
    assert.equal(ctx.getDefaultWorkspaceId(), SIVA);
    assert.equal(queries.length, 1, "oldest-admin fallback not used");

    // Super admin missing: no fallback to any other admin
    mongoose.connection.db = { collection: () => ({ findOne: async (q) => (q.email ? null : { _id: SARA }) }) };
    await resolveDefaultWorkspace();
    assert.equal(ctx.getDefaultWorkspaceId(), null);
  } finally {
    mongoose.connection.db = prevDb;
    if (prevEnv !== undefined) process.env.DEFAULT_WORKSPACE_ID = prevEnv;
    ctx.setDefaultWorkspaceId(SIVA);
  }
});

/* ---------------- User Directory scenario ---------------- */
// Minimal evaluator for the exact filter shapes userWorkspaceFilter emits
const matches = (u, f) =>
  f.$or.some((c) =>
    Object.entries(c).every(([k, v]) => {
      if (v === null) return u[k] == null;
      if (v?.$ne !== undefined) return u[k] !== v.$ne;
      return String(u[k] ?? "") === String(v);
    })
  );

test("User Directory: Saravanan sees only his workspace; Siva keeps legacy users", () => {
  const MUGI_NEW = "64b000000000000000000009";
  const users = [
    { _id: SIVA, name: "Siva", role: "admin" },                        // legacy, no workspace
    { _id: SARA, name: "Saravanan", role: "admin" },                   // legacy admin
    { _id: "m1", name: "Mugi", role: "employee" },                     // legacy employee
    { _id: "s1", name: "Siva-Shankar", role: "employee", workspace: null },
    { _id: MUGI_NEW, name: "Sara-Emp", role: "employee", workspace: SARA },
  ];
  const names = (ws) => users.filter((u) => matches(u, ctx.userWorkspaceFilter(ws))).map((u) => u.name);

  assert.deepEqual(names(SARA), ["Saravanan", "Sara-Emp"]);
  assert.deepEqual(names(SIVA), ["Siva", "Mugi", "Siva-Shankar"]);
});

/* ---------------- Tenant hardening ---------------- */
const CLIENT_B = "64b000000000000000000003";
for (const m of ["hr/Employee", "hr/Payslip", "hr/EmployeeExpense", "hr/Shift", "hr/Holiday", "Warehouse.model", "AuditLog"]) await import(`../models/${m}.js`);
const audit = await import("../controllers/audit.controller.js");
const twilioSvc = await import("../services/voip/twilio.service.js");
const { default: authRoutes } = await import("../routes/auth.routes.js");

// Probe model: receives the same global scope plugin as every module model
const Lead = mongoose.models.TenantProbe ||
  mongoose.model("TenantProbe", new mongoose.Schema({ name: String }));

// Run the scope plugin's registered pre hooks directly (no DB)
const runPres = (name, self) =>
  (Lead.schema.s.hooks._pres.get(name) || [])
    .filter((h) => /workspace/.test(String(h.fn)))
    .forEach((h) => h.fn.call(self, () => {}));

test("Siva + two clients: module reads and writes never cross workspaces", async () => {
  for (const [ws, expected] of [[SARA, SARA], [CLIENT_B, CLIENT_B]]) {
    await ctx.runWithWorkspace(ws, async () => {
      const lead = new Lead({ name: "x" });
      runPres("save", lead);
      assert.equal(String(lead.workspace), expected, "create stamps own workspace");
    });
  }
  // Read filter: client workspaces match only their id; Siva also legacy rows
  const filterFor = (ws) => ctx.runWithWorkspace(ws, () => {
    const q = Lead.find({});
    runPres("find", q);
    return JSON.stringify(q.getFilter());
  });
  const fa = await filterFor(SARA), fb = await filterFor(CLIENT_B), fs = await filterFor(SIVA);
  assert.ok(fa.includes(SARA) && !fa.includes(CLIENT_B) && !fa.includes("$exists"));
  assert.ok(fb.includes(CLIENT_B) && !fb.includes(SARA) && !fb.includes("$exists"));
  assert.ok(fs.includes(SIVA) && fs.includes("$exists"), "Siva keeps legacy rows");
});

test("platform credentials fail closed for tenants and unresolved default", async () => {
  assert.equal(ctx.usesPlatformCredentials(), true, "webhooks");
  await ctx.runWithWorkspace(SIVA, async () => assert.equal(ctx.usesPlatformCredentials(), true));
  await ctx.runWithWorkspace(SARA, async () => assert.equal(ctx.usesPlatformCredentials(), false));
  ctx.setDefaultWorkspaceId(null);
  try {
    await ctx.runWithWorkspace(SARA, async () => {
      assert.equal(ctx.usesPlatformCredentials(), false);
      assert.equal(metaKeyFor(), SARA, "never Siva's Meta doc");
    });
  } finally { ctx.setDefaultWorkspaceId(SIVA); }
});

test("Twilio env account/number unavailable to tenants", async () => {
  process.env.TWILIO_ACCOUNT_SID = "AC_SIVA"; process.env.TWILIO_CALLER_ID = "+910000";
  await ctx.runWithWorkspace(SIVA, async () => assert.equal(twilioSvc.getVoipConfig().callerId, "+910000"));
  await ctx.runWithWorkspace(SARA, async () => {
    const c = twilioSvc.getVoipConfig();
    assert.equal(c.accountSid, null); assert.equal(c.callerId, null); assert.equal(c.configured, false);
  });
});

test("owner lookups are workspace-scoped and fail closed", async () => {
  await ctx.runWithWorkspace(SARA, async () =>
    assert.deepEqual(ctx.activeUserScope(), ctx.userWorkspaceFilter(SARA)));
  ctx.setDefaultWorkspaceId(null);
  try { assert.deepEqual(ctx.activeUserScope(), { _id: null }); }
  finally { ctx.setDefaultWorkspaceId(SIVA); }
});

test("audit logs: only own workspace users; other user's logs 404", async () => {
  let auditFilter;
  stub(User, "find", () => ({ distinct: async () => [SARA] }));
  stub(AuditLogModel(), "find", (f) => ((auditFilter = f), { populate() { return this; }, sort: async () => [] }));
  await audit.getAllAuditLogs({ workspace: SARA }, resMock());
  assert.deepEqual(auditFilter.user.$in, [SARA]);
  const res = await audit.getAuditLogsByUser({ workspace: SARA, params: { userId: SIVA } }, resMock());
  assert.equal(res.statusCode, 404);
});
function AuditLogModel() { return mongoose.models.AuditLog; }

test("public register cannot create an admin", async () => {
  const layer = authRoutes.stack.find((l) => l.route?.path === "/register" && l.route.methods.post);
  const handler = layer.route.stack.at(-1).handle;
  const res = resMock();
  await handler({ body: { name: "X", email: "x@y.z", password: "p", role: "admin" } }, res);
  assert.equal(res.statusCode, 403);
});

test("per-workspace unique codes (no cross-tenant collisions)", () => {
  const uniq = (name) => mongoose.models[name].schema.indexes()
    .filter(([, o]) => o?.unique).map(([f]) => Object.keys(f).join(","));
  assert.ok(uniq("Employee").includes("workspace,employeeCode"));
  assert.ok(!uniq("Employee").includes("employeeCode"));
  assert.ok(uniq("Payslip").includes("workspace,payslipNumber"));
  assert.ok(uniq("EmployeeExpense").includes("workspace,expenseNumber"));
  assert.ok(uniq("Shift").includes("workspace,code"));
  assert.ok(uniq("Warehouse").includes("workspace,code"));
  assert.ok(uniq("Holiday").includes("workspace,organization,name,date"));
});
