// Regression: Sreeni's 403 on /api/admin/users and /api/products.
// DB-free. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

const ctx = await import("../utils/workspaceContext.js");
const role = (await import("../middlewares/role.js")).default;

const SIVA = "698c286f0abdcd27b456f764"; // default (platform) workspace
const SREENI = "6ad1ff727d6e116311927ffa";
ctx.setDefaultWorkspaceId(SIVA);

const users = [
  { _id: SIVA, role: "admin", workspace: null },
  { _id: "sivaEmp", role: "employee", workspace: SIVA },
  { _id: "legacyClient", role: "client", workspace: null },
];

// Minimal matcher for the filters userWorkspaceFilter emits
const matches = (u, f) =>
  f.$or
    ? f.$or.some((c) => matches(u, c))
    : Object.entries(f).every(([k, v]) =>
        v && v.$ne !== undefined ? u[k] !== v.$ne : String(u[k] ?? null) === String(v ?? null)
      );
const visible = (ws, list) => list.filter((u) => matches(u, ctx.userWorkspaceFilter(ws))).map((u) => u._id);

const runRole = (user) => {
  let status = 200;
  const res = { status: (s) => ((status = s), { json: () => {} }) };
  role("admin")({ user }, res, () => {});
  return status;
};
const workspaceOf = (u) => String(u.workspace || u._id); // same rule as middlewares/auth.js

test("as provisioned (client in Siva's workspace) → admin routes 403", () => {
  const sreeni = { _id: SREENI, role: "client", workspace: SIVA, isActive: true };
  assert.equal(runRole(sreeni), 403);
  // and it is Siva's workspace, so loosening role checks would leak Siva's data
  assert.equal(workspaceOf(sreeni), SIVA);
});

test("client role stays denied (no permission loosening)", () => {
  assert.equal(runRole({ _id: "x", role: "client", workspace: null, isActive: true }), 403);
  assert.equal(runRole({ _id: "x", role: "employee", workspace: SIVA, isActive: true }), 403);
});

test("re-provisioned client admin: allowed, own workspace only", () => {
  const sreeni = { _id: SREENI, role: "admin", workspace: null, isActive: true };
  const sreeniEmp = { _id: "sreeniEmp", role: "employee", workspace: SREENI };
  const all = [...users, sreeni, sreeniEmp];

  assert.equal(runRole(sreeni), 200);
  assert.equal(workspaceOf(sreeni), SREENI);
  assert.deepEqual(visible(SREENI, all).sort(), [SREENI, "sreeniEmp"].sort());
});

test("cross-workspace denial both ways; Siva's access preserved", () => {
  const sreeni = { _id: SREENI, role: "admin", workspace: null };
  const all = [...users, sreeni, { _id: "sreeniEmp", role: "employee", workspace: SREENI }];

  assert.deepEqual(visible(SIVA, all).sort(), [SIVA, "legacyClient", "sivaEmp"].sort());
  assert.ok(!visible(SREENI, all).includes("sivaEmp"));
  assert.ok(!visible(SREENI, all).includes(SIVA));
});
