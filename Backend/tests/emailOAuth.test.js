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

/* ---- in-memory EmailConnection: many accounts per workspace ---- */
const { default: mongoose } = await import("mongoose");
let rows, calls;
const same = (a, b) => String(a) === String(b);
const matches = (d, f = {}) => Object.entries(f).every(([k, v]) => same(d[k], v));
const live = (d) => Object.assign(d, { save: async () => d });
const inWs = (ws) => rows.filter((d) => same(d.workspace, ws));
// Legacy helpers: store.get(ws) → that workspace's default sender
const store = {
  get: (ws) => { const a = inWs(ws); return a.find((d) => d.isDefault) || a[0]; },
  has: (ws) => inWs(ws).length > 0,
  set: (ws, d) => rows.push(live({ _id: new mongoose.Types.ObjectId().toString(), workspace: ws, createdAt: new Date(), ...d })),
  get size() { return rows.length; },
};
const q = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v, then: (a, b) => Promise.resolve(v).then(a, b) });
beforeEach(() => {
  rows = [];
  calls = [];
  EmailConnection.find = (f) => q(rows.filter((d) => matches(d, f)));
  EmailConnection.findOne = (f) => q(rows.find((d) => matches(d, f)) || null);
  EmailConnection.findOneAndUpdate = async (f, u, o = {}) => {
    let d = rows.find((x) => matches(x, f));
    if (!d && !o.upsert) return null;
    if (!d) rows.push((d = live({ _id: new mongoose.Types.ObjectId().toString(), createdAt: new Date(), ...f })));
    return Object.assign(d, u.$set);
  };
  EmailConnection.updateOne = async (f, u) => { const d = rows.find((x) => matches(x, f)); if (d) Object.assign(d, u.$set); };
  EmailConnection.updateMany = async (f, u) => rows.filter((x) => matches(x, f)).forEach((d) => Object.assign(d, u.$set));
  EmailConnection.deleteOne = async (f) => { rows = rows.filter((x) => !matches(x, f)); };
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
  assert.equal(saved.email, "owner@a.com");
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
  assert.deepEqual(sent, { id: "m1", from: "owner@a.com", provider: "google" });
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
  assert.equal(ok.body.data.from, "owner@a.com");
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

test("second Google account is added next to the first; reconnecting the same account updates it", async () => {
  await connectGoogle(WS_A, "old@gmail.com", ["AT1", "RT_OLD"]);
  await connectGoogle(WS_A, "old@gmail.com", ["AT2", "RT_SAME"]);
  assert.equal(inWs(WS_A).length, 1);
  await connectGoogle(WS_A, "new@gmail.com", ["AT3", "RT_NEW"]);
  assert.ok(!calls.some((c) => c.url.includes("/revoke")));
  assert.deepEqual(inWs(WS_A).map((d) => [d.email, d.isDefault]), [["old@gmail.com", true], ["new@gmail.com", false]]);
});

/* ================= Zoho Mail ================= */
const smtp = await import("../services/mail/smtp.service.js");
const withZoho = async (fn) => {
  Object.assign(process.env, { ZOHO_CLIENT_ID: "zid", ZOHO_CLIENT_SECRET: "zsecret", ZOHO_OAUTH_REDIRECT_URI: "http://api/email/oauth/zoho/callback" });
  try { await fn(); } finally { delete process.env.ZOHO_CLIENT_ID; }
};
const zohoCallback = async (ws, query) => {
  User.findById = () => q({ _id: ADMIN_A, role: "admin", workspace: ws });
  const url = new URL(svc.buildAuthUrl({ provider: "zoho", userId: ADMIN_A, workspaceId: ws }));
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "zoho" }, query: { code: "c", state: url.searchParams.get("state"), ...query } }, r);
  return { r, url };
};

test("Zoho: data-centre callback, account lookup and send for workspace B only", () =>
  withZoho(async () => {
    mockFetch({
      "accounts.zoho.in/oauth/v2/token": () => json(200, { access_token: "ZAT", refresh_token: "ZRT", expires_in: 3600 }),
      "mail.zoho.in/api/accounts": () => json(200, { data: [{ accountId: "991", primaryEmailAddress: "Sales@B.in" }] }),
    });
    const { r, url } = await zohoCallback(WS_B, { "accounts-server": "https://accounts.zoho.in" });
    assert.equal(url.origin, "https://accounts.zoho.com");
    assert.equal(url.searchParams.get("scope"), "ZohoMail.messages.CREATE,ZohoMail.accounts.READ");
    assert.match(r.redirectUrl, /connected=1/);
    const saved = store.get(WS_B);
    assert.deepEqual([saved.email, saved.providerData.accountId, saved.providerData.mailBase], ["sales@b.in", "991", "https://mail.zoho.in"]);
    assert.notEqual(saved.accessToken, "ZAT");
    assert.equal(store.has(WS_A), false);

    mockFetch({ "mail.zoho.in/api/accounts/991/messages": () => json(200, { status: { code: 200 }, data: { messageId: "z1" } }) });
    const sent = await svc.sendViaConnectedAccount(WS_B, { to: "lead@x.com", subject: "Hi", message: "Body" });
    assert.deepEqual(sent, { id: "z1", from: "sales@b.in", provider: "zoho" });
    assert.equal(calls.at(-1).opts.headers.authorization, "Zoho-oauthtoken ZAT");
    assert.equal(await svc.sendViaConnectedAccount(WS_A, { to: "x@y.z", subject: "s", message: "m" }), null);
  }));

test("Zoho: a forged accounts-server never receives the client secret", () =>
  withZoho(async () => {
    const err = console.error; console.error = () => {};
    mockFetch({});
    const { r } = await zohoCallback(WS_A, { "accounts-server": "https://accounts.zoho.evil.com" });
    console.error = err;
    assert.match(r.redirectUrl, /connected=0/);
    assert.equal(calls.length, 0);
    assert.equal(store.size, 0);
  }));

test("Zoho: refresh rejected with HTTP 200 + error marks reconnect needed", () =>
  withZoho(async () => {
    store.set(WS_A, { provider: "zoho", email: "z@a.com", accessToken: svc.encrypt("old"), refreshToken: svc.encrypt("ZRT"), expiresAt: new Date(0), status: "connected", providerData: { accountsServer: "https://accounts.zoho.eu", mailBase: "https://mail.zoho.eu", accountId: "1" } });
    const err = console.error; console.error = () => {};
    mockFetch({ "accounts.zoho.eu/oauth/v2/token": () => json(200, { error: "invalid_code" }) });
    await assert.rejects(svc.getAccessToken(WS_A));
    console.error = err;
    assert.equal(store.get(WS_A).status, "error");
    assert.match(store.get(WS_A).lastError, /reconnect/);
  }));

/* ================= Custom-domain SMTP ================= */
let transports;
const smtpHooks = ({ ip = "203.0.114.10", verify = async () => true } = {}) => {
  transports = [];
  smtp.__setSmtpTestHooks({
    lookup: async () => [{ address: ip, family: 4 }],
    createTransport: (opts) => {
      const t = { opts, sent: [], verify, sendMail: async (m) => (t.sent.push(m), { messageId: "<s1@x>" }), close() {} };
      transports.push(t);
      return t;
    },
  });
};
const SMTP_BODY = { email: "Info@Acme.in", host: "smtp.hostinger.com", port: 465, security: "ssl", password: "p@ss", displayName: "Acme Sales" };
const admin = (ws, extra = {}) => ({ workspace: ws, user: { _id: ADMIN_A, email: "admin@acme.in", role: "admin" }, params: {}, body: {}, ...extra });

test("SMTP: verified login, pinned public IP + TLS hostname, encrypted password, send", async () => {
  smtpHooks();
  const r = res();
  await handler("post", "/smtp")(admin(WS_A, { body: SMTP_BODY }), r);
  assert.equal(r.body.success, true, r.body.message);
  assert.equal(r.body.data.email, "info@acme.in");
  assert.equal(r.body.data.isDefault, true);
  assert.doesNotMatch(JSON.stringify(r.body), /p@ss|smtpPassword/);
  const t = transports[0].opts;
  assert.deepEqual([t.host, t.servername, t.tls.servername, t.secure, t.tls.rejectUnauthorized], ["203.0.114.10", "smtp.hostinger.com", "smtp.hostinger.com", true, true]);
  assert.ok(t.connectionTimeout && t.socketTimeout);
  const saved = store.get(WS_A);
  assert.notEqual(saved.smtpPassword, "p@ss");
  assert.equal(saved.smtp.username, "info@acme.in");

  const sent = await svc.sendViaConnectedAccount(WS_A, { to: "lead@x.com", subject: "Hi\r\nBcc: evil@x.com", message: "Body" });
  assert.deepEqual(sent, { id: "<s1@x>", from: "info@acme.in", provider: "smtp" });
  const m = transports.at(-1).sent[0];
  assert.deepEqual(m.from, { name: "Acme Sales", address: "info@acme.in" });
  assert.doesNotMatch(m.subject, /\r|\n/);
  assert.equal(transports.at(-1).opts.auth.pass, "p@ss");
  assert.equal(await svc.sendViaConnectedAccount(WS_B, { to: "x@y.z", subject: "s", message: "m" }), null);
});

test("SMTP: private / internal addresses are refused before connecting (SSRF)", async () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
    smtpHooks({ ip });
    const r = res();
    await handler("post", "/smtp")(admin(WS_A, { body: SMTP_BODY }), r);
    assert.equal(r.statusCode, 422, ip);
    assert.match(r.body.message, /isn't allowed/);
    assert.equal(transports.length, 0);
  }
  assert.equal(store.size, 0);
});

test("SMTP: input validation (IP literal host, wrong port, missing password)", async () => {
  smtpHooks();
  for (const [body, msg] of [
    [{ ...SMTP_BODY, host: "127.0.0.1" }, /hostname/],
    [{ ...SMTP_BODY, port: 587 }, /SSL uses port 465/],
    [{ ...SMTP_BODY, security: "starttls", port: 8080 }, /STARTTLS uses port 587/],
    [{ ...SMTP_BODY, security: "none" }, /SSL or STARTTLS/],
    [{ ...SMTP_BODY, password: "" }, /password/],
    [{ ...SMTP_BODY, email: "nope" }, /valid email/],
  ]) {
    const r = res();
    await handler("post", "/smtp")(admin(WS_A, { body }), r);
    assert.equal(r.statusCode, 422);
    assert.match(r.body.message, msg);
  }
  assert.equal(transports.length, 0);
});

test("SMTP: wrong password is reported clearly and nothing is stored", async () => {
  smtpHooks({ verify: async () => { throw Object.assign(new Error("535 5.7.8 auth failed secret-detail"), { code: "EAUTH", responseCode: 535 }); } });
  const err = console.error; console.error = () => {};
  const r = res();
  await handler("post", "/smtp")(admin(WS_A, { body: SMTP_BODY }), r);
  console.error = err;
  assert.equal(r.statusCode, 422);
  assert.match(r.body.message, /username or password/);
  assert.doesNotMatch(r.body.message, /secret-detail/);
  assert.equal(store.size, 0);
});

test("SMTP: update keeps the saved password when left blank; other workspace can't update it", async () => {
  smtpHooks();
  await handler("post", "/smtp")(admin(WS_A, { body: SMTP_BODY }), res());
  const id = String(store.get(WS_A)._id);
  const r = res();
  await handler("put", "/accounts/:id/smtp")(admin(WS_A, { params: { id }, body: { ...SMTP_BODY, password: "", security: "starttls", port: 587 } }), r);
  assert.equal(r.body.success, true, r.body.message);
  assert.equal(transports.at(-1).opts.auth.pass, "p@ss");
  assert.equal(store.get(WS_A).smtp.port, 587);
  assert.equal(inWs(WS_A).length, 1);

  const other = res();
  await handler("put", "/accounts/:id/smtp")(admin(WS_B, { params: { id }, body: SMTP_BODY }), other);
  assert.equal(other.statusCode, 404);
});

/* ================= Multi-account management ================= */
test("multiple accounts: default sender switch, per-account test, delete promotes next; isolation by id", async () => {
  await connectGoogle(WS_A, "g@gmail.com", ["GAT", "GRT"]);
  smtpHooks();
  await handler("post", "/smtp")(admin(WS_A, { body: SMTP_BODY }), res());
  const [g, s] = inWs(WS_A);
  assert.deepEqual([g.isDefault, s.isDefault], [true, false]);

  const d = res();
  await handler("post", "/accounts/:id/default")(admin(WS_A, { params: { id: String(s._id) } }), d);
  assert.equal(d.body.success, true);
  assert.deepEqual([g.isDefault, s.isDefault], [false, true]);
  assert.equal((await svc.sendViaConnectedAccount(WS_A, { to: "l@x.com", subject: "s", message: "m" })).provider, "smtp");

  mockFetch({ "messages/send": () => json(200, { id: "g1" }) });
  const t = res();
  await handler("post", "/accounts/:id/test")(admin(WS_A, { params: { id: String(g._id) } }), t);
  assert.match(t.body.message, /from g@gmail.com/);
  assert.ok(g.lastTestedAt);

  for (const [method, path] of [["post", "/accounts/:id/default"], ["post", "/accounts/:id/test"], ["delete", "/accounts/:id"]]) {
    const x = res();
    await handler(method, path)(admin(WS_B, { params: { id: String(g._id) } }), x);
    assert.equal(x.statusCode, 404, `${method} ${path}`);
  }
  assert.equal(inWs(WS_A).length, 2);

  const del = res();
  await handler("delete", "/accounts/:id")(admin(WS_A, { params: { id: String(s._id) } }), del);
  assert.equal(del.body.success, true);
  assert.deepEqual(inWs(WS_A).map((a) => [a.email, a.isDefault]), [["g@gmail.com", true]]);

  const st = res();
  await handler("get", "/status")({ workspace: WS_A, user: { role: "user" } }, st);
  assert.equal(st.body.data.accounts.length, 1);
  assert.ok(st.body.data.providers.some((p) => p.id === "smtp" && p.available));
  assert.doesNotMatch(JSON.stringify(st.body), /GAT|GRT|accessToken|smtpPassword|ZOHO_/);
});

test("unreadable stored secrets (key changed): disconnect still works, send asks to reconnect", async () => {
  store.set(WS_A, { provider: "google", email: "k@gmail.com", accessToken: "bad.blob.x", refreshToken: "bad.blob.y", expiresAt: new Date(Date.now() + 3600e3), status: "connected" });
  const err = console.error; console.error = () => {};
  await assert.rejects(svc.sendViaConnectedAccount(WS_A, { to: "l@x.com", subject: "s", message: "m" }), /reconnect/);
  console.error = err;
  const r = res();
  await handler("post", "/disconnect")({ workspace: WS_A, body: {} }, r);
  assert.equal(r.body.success, true);
  assert.equal(store.size, 0);
});

test("isBlockedIp covers internal ranges and allows public addresses", () => {
  for (const ip of ["0.0.0.0", "100.64.0.1", "172.20.0.1", "224.0.0.1", "fe80::1", "64:ff9b::a00:1", "garbage"]) assert.equal(smtp.isBlockedIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "2a00:1450:4001::1", "::ffff:8.8.8.8"]) assert.equal(smtp.isBlockedIp(ip), false, ip);
});

test("detectProvider recognises Zoho domains", async () => {
  assert.equal(await svc.detectProvider("a@zohomail.in"), "zoho");
});

/* ---- Gmail: land back on the app host the admin started from ---- */
const gmailCallback = async (routes, { returnOrigin, query } = {}) => {
  mockFetch(routes);
  const url = new URL(svc.buildAuthUrl({ provider: "google", userId: ADMIN_A, workspaceId: WS_A, returnOrigin }));
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "google" }, query: { code: "c", state: url.searchParams.get("state"), ...query } }, r);
  return r;
};
const okGoogle = {
  "oauth2.googleapis.com/token": () => json(200, { access_token: "AT1", refresh_token: "RT1", expires_in: 3600, scope: "openid email https://www.googleapis.com/auth/gmail.send" }),
  userinfo: () => json(200, { email: "quries.readytechsolutions@gmail.com" }),
};

test("Gmail callback returns to the allow-listed origin the admin started from", async () => {
  const r = await gmailCallback(okGoogle, { returnOrigin: "https://readytechcrm.netlify.app" });
  assert.match(r.redirectUrl, /^https:\/\/readytechcrm\.netlify\.app\/integrations\/email\?connected=1/);
  assert.equal(store.get(WS_A).email, "quries.readytechsolutions@gmail.com");
  const denied = await gmailCallback(okGoogle, { returnOrigin: "https://readytechcrm.netlify.app", query: { code: undefined, error: "access_denied" } });
  assert.match(denied.redirectUrl, /^https:\/\/readytechcrm\.netlify\.app\/.*connected=0/);
});

test("Gmail callback never redirects to an unknown origin", async () => {
  const r = await gmailCallback(okGoogle, { returnOrigin: "https://evil.example" });
  assert.ok(!r.redirectUrl.includes("evil.example"));
  assert.match(r.redirectUrl, /connected=1/);
});

test("Gmail token exchange errors produce clear messages", async () => {
  const expired = await gmailCallback({ "oauth2.googleapis.com/token": () => json(400, { error: "invalid_grant", error_description: "Bad Request" }) });
  assert.match(new URL(expired.redirectUrl).searchParams.get("message"), /expired or was already used/);
  const mismatch = await gmailCallback({ "oauth2.googleapis.com/token": () => json(400, { error: "redirect_uri_mismatch", error_description: "Bad Request" }) });
  assert.match(new URL(mismatch.redirectUrl).searchParams.get("message"), /isn't set up correctly/);
  assert.equal(store.size, 0);
});

test("Gmail send with the Gmail API disabled keeps the account connected", async () => {
  await gmailCallback(okGoogle);
  mockFetch({ "gmail.googleapis.com": () => json(403, { error: { message: "Gmail API has not been used in project 123 before or it is disabled." } }) });
  await assert.rejects(svc.sendViaConnectedAccount(WS_A, { to: "x@y.com", subject: "s", message: "m" }), /API disabled/);
  assert.equal(store.get(WS_A).status, "connected");
});
