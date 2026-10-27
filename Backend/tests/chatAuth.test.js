// Support-chat admin routes: authentication, admin role and workspace isolation.
// Through the real app.js; no database (queries run their scope hooks, then fail).
// Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "test@test.dev",
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || "company@test.dev",
});

const app = (await import("../app.js")).default;
const ctx = await import("../utils/workspaceContext.js");
const User = (await import("../models/User.js")).default;
const ChatConversation = (await import("../models/ChatConversation.js")).default;

const WS_A = new mongoose.Types.ObjectId();
const WS_DEFAULT = new mongoose.Types.ObjectId();
const CHAT_ID = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: String(WS_A) }, "test-jwt");

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const chain = (value) => {
  const q = { then: (res, rej) => Promise.resolve(value).then(res, rej) };
  for (const m of ["select", "lean", "sort", "skip", "limit", "populate"]) q[m] = () => q;
  return q;
};
const asUser = (user) => stub(User, "findById", () => chain(user));
const admin = { _id: WS_A, role: "admin", isActive: true, workspace: null };

let server;
let base;
before(async () => {
  ctx.setDefaultWorkspaceId(WS_DEFAULT);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/chat`;
});
after(() => server.close());
afterEach(() => {
  while (restore.length) restore.pop()();
});

const call = (method, path, headers = {}) =>
  fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: method === "GET" || method === "DELETE" ? undefined : "{}" });

const ADMIN_ROUTES = [
  ["GET", ""],
  ["GET", "/conversations"],
  ["GET", `/${CHAT_ID}`],
  ["PATCH", `/${CHAT_ID}/status`],
  ["PATCH", `/${CHAT_ID}/assign`],
  ["POST", `/${CHAT_ID}/note`],
  ["PATCH", `/${CHAT_ID}/read`],
  ["DELETE", `/${CHAT_ID}`],
];

test("every admin chat route rejects unauthenticated requests (401)", async () => {
  for (const [method, path] of ADMIN_ROUTES) {
    const res = await call(method, path);
    assert.equal(res.status, 401, `${method} /api/chat${path}`);
  }
});

test("signed-in non-admins are refused (403)", async () => {
  asUser({ _id: new mongoose.Types.ObjectId(), role: "employee", isActive: true, workspace: WS_A });
  for (const [method, path] of ADMIN_ROUTES) {
    const res = await call(method, path, { authorization: `Bearer ${token}` });
    assert.equal(res.status, 403, `${method} /api/chat${path}`);
  }
});

test("admin can list conversations; the request runs in the admin's workspace", async () => {
  asUser(admin);
  let workspaceDuringQuery;
  stub(ChatConversation, "countDocuments", async () => ((workspaceDuringQuery = ctx.getWorkspaceId()), 1));
  stub(ChatConversation, "find", () => chain([{ _id: "c1", sessionId: "s1" }]));
  const res = await call("GET", "/conversations", { authorization: `Bearer ${token}` });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.equal(workspaceDuringQuery, String(WS_A));
});

test("admin chat queries are scoped to the admin's workspace by the scope plugin", async () => {
  asUser(admin);
  const queries = [];
  const exec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = function (...args) {
    if (["Chat", "ChatConversation"].includes(this.model?.modelName)) queries.push(this);
    return exec.apply(this, args);
  };
  mongoose.set("bufferCommands", false);
  const error = console.error;
  console.error = () => {}; // controllers log the expected "no database" failure
  try {
    await call("GET", "/conversations", { authorization: `Bearer ${token}` });
    await call("GET", `/${CHAT_ID}`, { authorization: `Bearer ${token}` });
  } finally {
    mongoose.Query.prototype.exec = exec;
    mongoose.set("bufferCommands", true);
    console.error = error;
  }
  const models = new Set(queries.map((q) => q.model.modelName));
  assert.ok(models.has("Chat") && models.has("ChatConversation"));
  for (const q of queries) {
    const filter = JSON.stringify(q.getFilter());
    assert.match(filter, new RegExp(String(WS_A)), `${q.model.modelName} query scoped to the admin's workspace`);
    assert.doesNotMatch(filter, new RegExp(String(WS_DEFAULT)));
  }
});

test("public widget routes stay public", async () => {
  const faqs = await call("GET", "/faqs");
  assert.notEqual(faqs.status, 401);
  assert.notEqual(faqs.status, 403);
  const submit = await call("POST", "");
  assert.notEqual(submit.status, 401); // validation may reject an empty body, auth must not
  assert.notEqual(submit.status, 403);
});
