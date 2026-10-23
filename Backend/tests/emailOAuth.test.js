// DB-free tests for the per-workspace Gmail / Microsoft 365 email integration.
// Run: node --test tests/
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";
delete process.env.MICROSOFT_CLIENT_ID;
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";

const svc = await import("../services/emailOAuth.service.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: User } = await import("../models/User.js");
const { default: router } = await import("../routes/email.routes.js");
const { default: Client } = await import("../models/Client.js");
const CUST_A = "64b0000000000000000000d4";

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

const withMicrosoft = async (fn) => {
  Object.assign(process.env, { MICROSOFT_CLIENT_ID: "mid", MICROSOFT_CLIENT_SECRET: "msecret", MICROSOFT_OAUTH_REDIRECT_URI: "http://api/email/oauth/microsoft/callback" });
  try { await fn(); } finally { ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_OAUTH_REDIRECT_URI"].forEach((k) => delete process.env[k]); }
};

test("Microsoft: callback, rotated refresh token and Graph send for workspace B only", () =>
  withMicrosoft(async () => {
    User.findById = () => q({ _id: ADMIN_A, role: "admin", workspace: WS_B });
    mockFetch({
      "login.microsoftonline.com/common/oauth2/v2.0/token": () => json(200, { access_token: "MAT", refresh_token: "MRT", expires_in: 3600 }),
      "graph.microsoft.com/v1.0/me?": () => json(200, { mail: "sales@b.com" }),
    });
    const url = new URL(svc.buildAuthUrl({ provider: "microsoft", userId: ADMIN_A, workspaceId: WS_B, loginHint: "sales@b.com" }));
    assert.equal(url.searchParams.get("login_hint"), "sales@b.com");
    const r = res();
    await handler("get", "/oauth/:provider/callback")({ params: { provider: "microsoft" }, query: { code: "c", state: url.searchParams.get("state") } }, r);
    assert.match(r.redirectUrl, /connected=1/);
    assert.equal(store.has(WS_A), false);

    store.get(WS_B).expiresAt = new Date(0);
    mockFetch({
      "oauth2/v2.0/token": (o) => (assert.match(String(o.body), /refresh_token=MRT/), json(200, { access_token: "MAT2", refresh_token: "MRT2", expires_in: 3600 })),
      "me/sendMail": () => ({ ok: true, status: 202, json: async () => ({}) }),
    });
    const sent = await svc.sendViaConnectedAccount(WS_B, { to: "lead@x.com", subject: "Hi", message: "Body" });
    assert.deepEqual(sent, { id: null, from: "sales@b.com", provider: "microsoft" });
    assert.equal(calls.at(-1).opts.headers.authorization, "Bearer MAT2");
    assert.equal(await svc.sendViaConnectedAccount(WS_A, { to: "x@y.z", subject: "s", message: "m" }), null);
  }));

test("Microsoft unavailable: friendly message, setup steps only in server log", async () => {
  const warn = console.warn; let logged = "";
  console.warn = (m) => (logged += m);
  const r = res();
  handler("get", "/oauth/:provider/url")({ params: { provider: "microsoft" }, query: {}, user: { _id: ADMIN_A }, workspace: WS_A }, r);
  console.warn = warn;
  assert.match(r.body.message, /isn't available yet/);
  assert.match(logged, /MICROSOFT_CLIENT_ID.*Azure Portal/);
});

test("send/refresh failures never expose raw provider errors", async () => {
  await connectA();
  const err = console.error; console.error = () => {};
  mockFetch({ "messages/send": () => json(403, { error: { message: "Request had insufficient authentication scopes. secret-detail" } }) });
  const r = res();
  await handler("post", "/test")({ workspace: WS_A, user: { email: "a@a.com" } }, r);
  assert.equal(r.statusCode, 409);
  assert.doesNotMatch(r.body.message, /secret-detail|scopes/);
  assert.match(r.body.message, /reconnect/);
  assert.doesNotMatch(store.get(WS_A).lastError, /secret-detail/);

  store.get(WS_A).expiresAt = new Date(0);
  mockFetch({ "oauth2.googleapis.com/token": () => json(500, { error_description: "internal secret-detail" }) });
  await assert.rejects(svc.getAccessToken(WS_A), (e) => !/secret-detail/.test(e.message));
  console.error = err;
});

test("detectProvider maps consumer domains and rejects junk", async () => {
  assert.equal(await svc.detectProvider("a@gmail.com"), "google");
  assert.equal(await svc.detectProvider("a@Outlook.com"), "microsoft");
  assert.equal(await svc.detectProvider("a@hotmail.com"), "microsoft");
  assert.equal(await svc.detectProvider("not-an-email"), null);
});

test("ERP customer email: connected mailbox for own workspace; other workspace's customer not found", async () => {
  await connectA();
  Client.findOne = (f) => q(String(f._id) === CUST_A && String(f.workspace) === WS_A ? { companyName: "Acme", email: "buyer@acme.com" } : null);
  mockFetch({ "gmail/v1/users/me/messages/send": () => json(200, { id: "m9" }) });
  const ok = res();
  await handler("post", "/customers/:id")({ params: { id: CUST_A }, body: { subject: "Quote", message: "Hi" }, workspace: WS_A }, ok);
  assert.equal(ok.body.success, true);
  assert.equal(ok.body.data.from, "Owner@A.com");
  assert.equal(ok.body.data.provider, "google");

  const other = res();
  await handler("post", "/customers/:id")({ params: { id: CUST_A }, body: { subject: "s", message: "m" }, workspace: WS_B }, other);
  assert.equal(other.body.success, false);
  assert.match(other.body.message, /not found/);
});

test("ERP customer email: send failure is never reported as success and hides raw errors", async () => {
  await connectA();
  Client.findOne = () => q({ companyName: "Acme", email: "buyer@acme.com" });
  const err = console.error; console.error = () => {};
  mockFetch({ "messages/send": () => json(500, { error: { message: "backend secret-detail" } }) });
  const r = res();
  await handler("post", "/customers/:id")({ params: { id: CUST_A }, body: { subject: "s", message: "m" }, workspace: WS_A }, r);
  console.error = err;
  assert.equal(r.body.success, false);
  assert.doesNotMatch(r.body.message, /secret-detail/);
});

const connectGoogle = async (ws, email, tokens, scope = "openid email https://www.googleapis.com/auth/gmail.send") => {
  User.findById = () => q({ _id: ADMIN_A, role: "admin", workspace: ws });
  mockFetch({
    "oauth2.googleapis.com/token": () => json(200, { access_token: tokens[0], refresh_token: tokens[1], expires_in: 3600, scope }),
    "oauth2.googleapis.com/revoke": () => json(200, {}),
    userinfo: () => json(200, { email }),
  });
  const url = new URL(svc.buildAuthUrl({ provider: "google", userId: ADMIN_A, workspaceId: ws }));
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "google" }, query: { code: "c", state: url.searchParams.get("state") } }, r);
  return { r, url };
};

test("Google auth URL: account picker + consent, minimal scopes only", () => {
  const url = new URL(svc.buildAuthUrl({ provider: "google", userId: ADMIN_A, workspaceId: WS_A }));
  assert.equal(url.searchParams.get("prompt"), "select_account consent");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/gmail.send");
});

test("unticked 'send email' permission is rejected, revoked, and nothing stored", async () => {
  const err = console.error; console.error = () => {};
  const { r } = await connectGoogle(WS_A, "a@gmail.com", ["AT", "RT"], "openid email");
  console.error = err;
  assert.match(r.redirectUrl, /connected=0/);
  assert.match(new URL(r.redirectUrl).searchParams.get("message"), /Permission to send email was not granted/);
  assert.equal(store.size, 0);
  assert.ok(calls.some((c) => c.url.includes("/revoke") && String(c.opts.body).includes("token=RT")));
});

test("consent denied on Google's screen shows a friendly message", async () => {
  const warn = console.warn; console.warn = () => {};
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "google" }, query: { error: "access_denied" } }, r);
  console.warn = warn;
  assert.match(new URL(r.redirectUrl).searchParams.get("message"), /cancelled or permission wasn't granted/);
});

test("two workspaces, two Gmail accounts: each sends only with its own token", async () => {
  await connectGoogle(WS_A, "alice@gmail.com", ["AT_A", "RT_A"]);
  await connectGoogle(WS_B, "bob@gmail.com", ["AT_B", "RT_B"]);
  assert.equal(store.get(WS_A).email, "alice@gmail.com");
  assert.equal(store.get(WS_B).email, "bob@gmail.com");
  mockFetch({ "messages/send": () => json(200, { id: "x" }) });
  assert.equal((await svc.sendViaConnectedAccount(WS_A, { to: "l@x.com", subject: "s", message: "m" })).from, "alice@gmail.com");
  assert.equal(calls.at(-1).opts.headers.authorization, "Bearer AT_A");
  assert.equal((await svc.sendViaConnectedAccount(WS_B, { to: "l@x.com", subject: "s", message: "m" })).from, "bob@gmail.com");
  assert.equal(calls.at(-1).opts.headers.authorization, "Bearer AT_B");
  const s = res();
  await handler("get", "/status")({ workspace: WS_B, user: { role: "admin" } }, s);
  assert.equal(s.body.data.connection.email, "bob@gmail.com");
  assert.doesNotMatch(JSON.stringify(s.body), /AT_|RT_|alice/);
});

test("switching Google account revokes the old grant; reconnecting the same account does not", async () => {
  await connectGoogle(WS_A, "old@gmail.com", ["AT1", "RT_OLD"]);
  await connectGoogle(WS_A, "old@gmail.com", ["AT2", "RT_SAME"]);
  assert.ok(!calls.some((c) => c.url.includes("/revoke")));
  await connectGoogle(WS_A, "new@gmail.com", ["AT3", "RT_NEW"]);
  assert.ok(calls.some((c) => c.url.includes("/revoke") && String(c.opts.body).includes("token=RT_SAME")));
  assert.equal(store.get(WS_A).email, "new@gmail.com");
});
