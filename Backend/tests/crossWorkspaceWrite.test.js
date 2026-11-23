// Regression tests for H3 — cross-workspace record injection.
// A client-supplied `workspace` must never reach a model; the workspace is
// derived only from the verified user. DB-free.
// Run: node --test tests/crossWorkspaceWrite.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";

process.env.JWT_SECRET = "test-jwt";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";

await import("../utils/workspaceScope.js");
const mongoose = (await import("mongoose")).default;
const ctx = await import("../utils/workspaceContext.js");
const { default: stripClientWorkspace, stripWorkspaceKeys } = await import("../middlewares/stripClientWorkspace.js");
const { default: Employee } = await import("../models/hr/Employee.js");
const { default: Client } = await import("../models/Client.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: User } = await import("../models/User.js");
const { default: AuditLog } = await import("../models/AuditLog.js");
const { createEmployee } = await import("../controllers/hr/employee.controller.js");
const { updateClient } = await import("../controllers/clients.controller.js");
const { createPublicLead } = await import("../controllers/leads.controller.js");

const VICTIM = "64b000000000000000000001"; // default workspace (platform admin)
const ATTACKER = "64b000000000000000000002"; // self-registered tenant
ctx.setDefaultWorkspaceId(VICTIM);

// Compiled after the plugin import → carries the real workspace plugin
const Probe = mongoose.model("H3Probe", new mongoose.Schema({ name: String }));

const resMock = () => {
  const res = { statusCode: 200 };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const restore = [];
const stub = (obj, name, fn) => {
  restore.push([obj, name, obj[name]]);
  obj[name] = fn;
};
beforeEach(() => {
  while (restore.length) {
    const [o, n, f] = restore.pop();
    o[n] = f;
  }
});

/* Same order as app.js: body parsers → stripClientWorkspace → auth → handler */
const runAs = (workspace, req, handler) =>
  new Promise((resolve, reject) =>
    stripClientWorkspace(req, null, () =>
      ctx.runWithWorkspace(workspace, () => Promise.resolve(handler(req)).then(resolve, reject))
    )
  );

/* ---------------- middleware ---------------- */
test("strips workspace at any depth, in arrays, update operators and dotted paths", () => {
  const body = {
    name: "Mallory",
    workspace: VICTIM,
    $set: { workspace: VICTIM, phone: "1" },
    "workspace.x": 1,
    "meta.workspace": VICTIM,
    items: [{ sku: "A", workspace: VICTIM }],
    nested: { deep: { workspace: VICTIM, keep: true } },
  };
  stripWorkspaceKeys(body);
  assert.deepEqual(body, {
    name: "Mallory",
    items: [{ sku: "A" }],
    nested: { deep: { keep: true } },
  });
});

test("app.js registers the strip middleware before every /api route", () => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const strip = src.indexOf("app.use(stripClientWorkspace)");
  assert.ok(strip > 0, "stripClientWorkspace is not registered");
  assert.ok(strip < src.indexOf('app.use("/api'), "must run before the first /api route");
  assert.ok(strip > src.indexOf("express.json("), "must run after the JSON body parser");
});

test("Mongo operator keys from clients are dropped (?status[$ne]=x)", () => {
  const query = { status: { $ne: "x" }, page: "1", filter: { $where: "1" }, list: [{ $gt: "" }] };
  stripWorkspaceKeys(query);
  assert.deepEqual(query, { status: {}, page: "1", filter: {}, list: [{}] });
});

test("HTTP: body and query workspace never reach the handler", async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(stripClientWorkspace);
  app.post("/x", (req, res) => res.json({ body: req.body, query: req.query }));
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const r = await fetch(`http://127.0.0.1:${port}/x?workspace=${VICTIM}&workspace[$ne]=1&q=ok`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mallory", workspace: VICTIM }),
    });
    const out = await r.json();
    assert.deepEqual(out.body, { name: "Mallory" });
    assert.deepEqual(out.query, { q: "ok" });
  } finally {
    server.close();
  }
});

/* ---------------- create path ---------------- */
test("a new record is saved in the caller's workspace, not the one in the body", async () => {
  const doc = await runAs(ATTACKER, { body: { name: "Planted", workspace: VICTIM } }, async (req) => {
    const d = new Probe(req.body);
    await Probe.schema.s.hooks.execPre("save", d, []);
    return d;
  });
  assert.equal(String(doc.workspace), ATTACKER);
});

test("POST /api/hr/employees cannot target another workspace", async () => {
  let created;
  stub(Employee, "create", async (data) => ((created = data), { _id: "e1", ...data }));
  const res = resMock();
  await runAs(ATTACKER, { body: { firstName: "Fake", bankDetails: { accountNumber: "1" }, workspace: VICTIM } }, (req) =>
    createEmployee(req, res)
  );
  assert.equal(res.statusCode, 201);
  assert.equal("workspace" in created, false);
});

/* ---------------- update path (moving a record) ---------------- */
test("PUT /api/clients/:id cannot move a record into another workspace", async () => {
  let update;
  stub(Client, "findByIdAndUpdate", async (id, u) => ((update = u), { _id: id, name: "C" }));
  const res = resMock();
  await runAs(ATTACKER, { params: { id: "c1" }, user: { _id: ATTACKER }, body: { name: "C", workspace: VICTIM, $set: { workspace: VICTIM } } }, (req) =>
    updateClient(req, res).catch(() => {})
  );
  assert.ok(update, "handler did not reach the update");
  assert.equal("workspace" in update, false);
  assert.equal("workspace" in (update.$set || {}), false);
});

/* ---------------- public lead form ---------------- */
test("public lead submission still works and does not expose owner/workspace ids", async () => {
  const owner = { _id: VICTIM, name: "Admin", email: "admin@example.test" };
  stub(User, "findOne", () => ({ select: async () => owner }));
  stub(Lead.prototype, "save", async function () { return this; });
  stub(AuditLog, "create", async () => ({}));
  stub(Lead, "findById", (id) => ({
    populate: async () => ({
      _id: id, name: "Visitor", email: "visitor@example.test", status: "New",
      createdAt: new Date(), owner, workspace: VICTIM,
      statusHistory: [{ status: "New", changedBy: VICTIM }],
    }),
  }));
  stub(global, "fetch", async () => new Response("{}", { status: 200 }));

  const res = resMock();
  await createPublicLead({ body: { name: "Visitor", email: "visitor@example.test", message: "hi", workspace: ATTACKER } }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.lead.name, "Visitor");
  const json = JSON.stringify(res.body);
  assert.ok(!json.includes(VICTIM), "admin / workspace id leaked");
  assert.ok(!json.includes(owner.email), "admin email leaked");
  for (const k of ["owner", "workspace", "statusHistory"]) assert.equal(k in res.body.lead, false);
});
