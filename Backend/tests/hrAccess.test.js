// Regression tests for H1 — HR / payroll admin-only, employee self-service
// pinned to the caller's own Employee record. DB-free.
// Run: node --test tests/hrAccess.test.js
import { test, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";

process.env.JWT_SECRET = "test-jwt";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";

await import("../utils/workspaceScope.js");
const { default: hrAccess } = await import("../middlewares/hrAccess.js");
const { default: hrRouter } = await import("../routes/hr/index.js");
const { default: Employee } = await import("../models/hr/Employee.js");
const { default: Leave } = await import("../models/hr/Leave.js");
const { default: EmployeeExpense } = await import("../models/hr/EmployeeExpense.js");
const { default: Payslip } = await import("../models/hr/Payslip.js");
const { default: Attendance } = await import("../models/hr/Attendance.js");

const ME_USER = "64b0000000000000000000a1";
const ME_EMP = "64b0000000000000000000e1";
const OTHER_EMP = "64b0000000000000000000e2";
const MINE = "64b0000000000000000000f1";
const THEIRS = "64b0000000000000000000f2";

const q = (v) => ({ select() { return this; }, lean: async () => v });
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
  stub(Employee, "findOne", (f) => q(String(f.user) === ME_USER ? { _id: ME_EMP } : null));
  for (const M of [Leave, EmployeeExpense, Payslip, Attendance]) {
    stub(M, "findById", (id) => q(id === MINE ? { employee: ME_EMP } : id === THEIRS ? { employee: OTHER_EMP } : null));
  }
});

/* Fake auth → hrAccess → sink that echoes what a handler would receive */
let server, base, currentUser;
before(() => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => ((req.user = currentUser), next()));
  app.use("/api/hr", hrAccess, (req, res) => res.json({ reached: true, query: req.query, body: req.body }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api/hr`;
});
after(() => server.close());

const call = async (role, method, path, body) => {
  currentUser = role ? { _id: role === "employee-unlinked" ? "64b0000000000000000000a9" : ME_USER, role: role.replace("-unlinked", "") } : undefined;
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: r.status, body: await r.json() };
};

/* ---------------- admin ---------------- */
test("admin keeps full HR / payroll access", async () => {
  for (const [m, p] of [
    ["GET", "/employees"], ["POST", "/payroll/process"], ["PATCH", `/payroll/${THEIRS}/approve`],
    ["PATCH", `/expenses/${THEIRS}/approve`], ["PUT", `/leaves/${THEIRS}/approve`], ["DELETE", `/employees/${OTHER_EMP}`],
    ["GET", "/salary-structures"], ["GET", "/reports/payroll"],
  ]) {
    const r = await call("admin", m, p);
    assert.equal(r.status, 200, `${m} ${p}`);
  }
});

test("admin list queries are not rewritten", async () => {
  const r = await call("admin", "GET", `/leaves?employee=${OTHER_EMP}&search=x`);
  assert.deepEqual(r.body.query, { employee: OTHER_EMP, search: "x" });
});

/* ---------------- employee: admin-only routes ---------------- */
test("employee is blocked from payroll, salaries, approvals, reports and employee management", async () => {
  for (const [m, p] of [
    ["GET", "/employees"], ["POST", "/employees"], ["PUT", `/employees/${ME_EMP}`], ["DELETE", `/employees/${OTHER_EMP}`],
    ["GET", "/payroll"], ["POST", "/payroll/process"], ["PATCH", `/payroll/${MINE}/approve`], ["PATCH", `/payroll/${MINE}/mark-paid`],
    ["GET", "/salary-structures"], ["GET", "/shifts"], ["GET", "/performance"],
    ["PATCH", `/expenses/${MINE}/approve`], ["PATCH", `/expenses/${MINE}/reimburse`], ["PATCH", `/expenses/${MINE}/paid`],
    ["PUT", `/leaves/${MINE}/approve`], ["PUT", `/leaves/${MINE}/status`], ["DELETE", `/leaves/${MINE}`],
    ["POST", "/payslips"], ["PATCH", `/payslips/${MINE}/status`],
    ["POST", "/attendance"], ["PUT", `/attendance/${MINE}`], ["GET", "/attendance/today"],
    ["POST", "/holidays"], ["GET", "/reports/dashboard"], ["GET", "/reports/payroll"],
  ]) {
    const r = await call("employee", m, p);
    assert.equal(r.status, 403, `${m} ${p}`);
  }
});

test("client role and unauthenticated requests get nothing", async () => {
  for (const p of ["/holidays", "/leaves", "/payslips", `/employees/${ME_EMP}`]) {
    assert.equal((await call("client", "GET", p)).status, 403, p);
    assert.equal((await call(null, "GET", p)).status, 403, p);
  }
});

test("employee without a linked Employee profile gets no self-service", async () => {
  assert.equal((await call("employee-unlinked", "GET", "/leaves")).status, 403);
});

/* ---------------- employee: self-service, own records only ---------------- */
test("list endpoints are pinned to the caller and search cannot widen them", async () => {
  for (const p of ["/leaves", "/expenses", "/payslips", "/attendance"]) {
    const r = await call("employee", "GET", `${p}?employee=${OTHER_EMP}&search=a&status=Pending`);
    assert.equal(r.status, 200, p);
    assert.deepEqual(r.body.query, { employee: ME_EMP, status: "Pending" }, p);
  }
});

test("own record by id is allowed, another employee's is denied", async () => {
  for (const [m, p] of [
    ["GET", "/leaves/ID"], ["PUT", "/leaves/ID/cancel"],
    ["GET", "/expenses/ID"], ["PUT", "/expenses/ID"], ["PATCH", "/expenses/ID/submit"],
    ["GET", "/payslips/ID"], ["GET", "/attendance/ID"],
  ]) {
    assert.equal((await call("employee", m, p.replace("ID", MINE))).status, 200, `${m} ${p} mine`);
    assert.equal((await call("employee", m, p.replace("ID", THEIRS))).status, 403, `${m} ${p} theirs`);
  }
});

test("per-employee routes only accept the caller's own employee id", async () => {
  for (const p of ["/leaves/summary/ID", "/payslips/employee/ID", "/attendance/employee/ID/summary", "/employees/ID"]) {
    assert.equal((await call("employee", "GET", p.replace("ID", ME_EMP))).status, 200, p);
    assert.equal((await call("employee", "GET", p.replace("ID", OTHER_EMP))).status, 403, p);
  }
});

test("apply leave / create expense always file for the caller", async () => {
  for (const p of ["/leaves", "/expenses"]) {
    const r = await call("employee", "POST", p, { employee: OTHER_EMP, title: "x" });
    assert.equal(r.status, 200, p);
    assert.equal(r.body.body.employee, ME_EMP, p);
  }
});

test("holiday calendar stays readable for employees", async () => {
  for (const p of ["/holidays", "/holidays/year/2026", `/holidays/${MINE}`]) {
    assert.equal((await call("employee", "GET", p)).status, 200, p);
  }
});

/* ---------------- wiring ---------------- */
test("hrAccess runs before every HR sub-router", () => {
  assert.equal(hrRouter.stack[0].handle, hrAccess);
});

test("the separate /api/hr/reports mount is admin-only", () => {
  const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(src, /app\.use\("\/api\/hr\/reports", auth, role\("admin"\), hrReportRoutes\)/);
  assert.match(src, /app\.use\("\/api\/hr", auth, hrRoutes\)/);
});
