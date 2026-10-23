// DB-free tests for the per-workspace Gmail / Microsoft 365 email integration.
// Run: node --test tests/
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";
delete process.env.MICROSOFT_CLIENT_ID;

const svc = await import("../services/emailOAuth.service.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: User } = await import("../models/User.js");
const { default: router } = await import("../routes/email.routes.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const ADMIN_A = "64b0000000000000000000c3";

/* ---- in-memory EmailConnection keyed by workspace ---- */
let store, calls;
const doc = (ws) => {
  const d = store.get(ws);
  if (!d) return null;
  return Object.assign(d, { save: async () => store.set(ws, d) });
};
const q = (v) => ({ select() { return this; }, lean: async () => v, then: (a, b) => Promise.resolve(v).then(a, b) });
beforeEach(() => {
  store = new Map();
  calls = [];
  EmailConnection.findOne = (f) => q(doc(String(f.workspace)));
  EmailConnection.findOneAndUpdate = async (f, u) => store.set(String(f.workspace), { _id: "id-" + f.workspace, ...u.$set });
  EmailConnection.updateOne = async (f, u) => { const d = store.get(String(f.workspace)); if (d) Object.assign(d, u.$set); };
  EmailConnection.deleteOne = async (f) => store.delete(String(f.workspace));
  User.findById = () => q({ _id: ADMIN_A, role: "admin", workspace: WS_A });
});

const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });
const mockFetch = (routes) => {
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
    return hit ? hit[1](opts) : json(404, {});
  };
};
const handler = (method, path) => router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
const res = () => { const r = { statusCode: 200 }; r.status = (c) => ((r.statusCode = c), r); r.json = (b) => ((r.body = b), r); r.redirect = (u) => (r.redirectUrl = u); return r; };

const connectA = async () => {
  mockFetch({
    "oauth2.googleapis.com/token": () => json(200, { access_token: "AT1", refresh_token: "RT1", expires_in: 3600 }),
    userinfo: () => json(200, { email: "Owner@A.com" }),
  });
  const url = new URL(svc.buildAuthUrl({ provider: "google", userId: ADMIN_A, workspaceId: WS_A }));
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "google" }, query: { code: "c", state: url.searchParams.get("state") } }, r);
  return r;
};

test("OAuth callback stores encrypted tokens for the initiating workspace only", async () => {
  const r = await connectA();
  assert.match(r.redirectUrl, /connected=1/);
  const saved = store.get(WS_A);
  assert.equal(saved.email, "Owner@A.com");
  assert.notEqual(saved.accessToken, "AT1");
  assert.notEqual(saved.refreshToken, "RT1");
  assert.equal(store.has(WS_B), false);
});

test("callback rejects state when the user is not admin of that workspace", async () => {
  User.findById = () => q({ _id: ADMIN_A, role: "admin", workspace: WS_B });
  const r = await connectA();
  assert.match(r.redirectUrl, /connected=0/);
  assert.equal(store.size, 0);
});

test("callback with tampered state shows a friendly message", async () => {
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "google" }, query: { code: "c", state: "bad" } }, r);
  assert.match(new URL(r.redirectUrl).searchParams.get("message"), /expired — please click Connect again/);
});

test("expired access token is refreshed and re-encrypted", async () => {
  await connectA();
  store.get(WS_A).expiresAt = new Date(Date.now() - 1000);
  mockFetch({ "oauth2.googleapis.com/token": (o) => (assert.match(String(o.body), /refresh_token=RT1/), json(200, { access_token: "AT2", expires_in: 3600 })) });
  const { token } = await svc.getAccessToken(WS_A);
  assert.equal(token, "AT2");
  assert.equal(store.get(WS_A).status, "connected");
});

test("revoked refresh token marks connection as needing reconnect", async () => {
  await connectA();
  store.get(WS_A).expiresAt = new Date(0);
  mockFetch({ "oauth2.googleapis.com/token": () => json(400, { error: "invalid_grant" }) });
  await assert.rejects(svc.getAccessToken(WS_A));
  assert.equal(store.get(WS_A).status, "error");
});

test("sends via Gmail for the connected workspace; other workspace falls back (null)", async () => {
  await connectA();
  mockFetch({ "gmail/v1/users/me/messages/send": () => json(200, { id: "m1" }) });
  const sent = await svc.sendViaConnectedAccount(WS_A, { to: "lead@x.com", subject: "Hi", message: "Body" });
  assert.deepEqual(sent, { id: "m1", from: "Owner@A.com", provider: "google" });
  assert.equal(calls.at(-1).opts.headers.authorization, "Bearer AT1");
  assert.equal(await svc.sendViaConnectedAccount(WS_B, { to: "x@y.z", subject: "s", message: "m" }), null);
});

test("disconnect revokes at Google and deletes only this workspace", async () => {
  await connectA();
  store.set(WS_B, { provider: "google", email: "b@b.com" });
  mockFetch({ "oauth2.googleapis.com/revoke": () => json(200, {}) });
  const r = res();
  await handler("post", "/disconnect")({ workspace: WS_A }, r);
  assert.equal(r.body.success, true);
  assert.equal(r.body.data.revokeUrl, "https://myaccount.google.com/permissions");
  assert.ok(calls.some((c) => c.url.includes("/revoke")));
  assert.equal(store.has(WS_A), false);
  assert.equal(store.has(WS_B), true);
});

test("status never exposes tokens or env var names; setup status is admin-only", async () => {
  await connectA();
  mockFetch({});
  const member = res();
  await handler("get", "/status")({ workspace: WS_A, user: { role: "user" } }, member);
  const text = JSON.stringify(member.body);
  assert.doesNotMatch(text, /AT1|RT1|accessToken|refreshToken|MICROSOFT_|GOOGLE_|missingEnv/);
  assert.equal(member.body.data.providers.find((p) => p.id === "microsoft").available, false);
  assert.equal(member.body.data.providers[0].setupStatus, undefined);
  const admin = res();
  await handler("get", "/status")({ workspace: WS_A, user: { role: "admin" } }, admin);
  assert.ok(admin.body.data.providers.every((p) => p.setupStatus));
  const other = res();
  await handler("get", "/status")({ workspace: WS_B, user: { role: "admin" } }, other);
  assert.equal(other.body.data.connection, null);
});

test("connect URL for an unconfigured provider returns a friendly message", async () => {
  const r = res();
  handler("get", "/oauth/:provider/url")({ params: { provider: "microsoft" }, user: { _id: ADMIN_A }, workspace: WS_A }, r);
  assert.equal(r.statusCode, 400);
  assert.doesNotMatch(r.body.message, /MICROSOFT_|CLIENT_ID/);
});
