// DB-free tests for Outlook / Microsoft 365 mail: availability, company
// accounts, permissions, tenant, Entra errors, disconnect and isolation.
// (Callback + refresh rotation + Graph send: emailOAuth.test.js; Graph inbox
// sync: mailInboxSync.test.js.)  Run: node --test tests/microsoftMail.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";
const MS_ENV = {
  MICROSOFT_CLIENT_ID: "mid",
  MICROSOFT_CLIENT_SECRET: "msecret",
  MICROSOFT_OAUTH_REDIRECT_URI: "https://api.test/api/email/oauth/microsoft/callback",
};
const setEnv = (on) => Object.entries(MS_ENV).forEach(([k, v]) => (on ? (process.env[k] = v) : delete process.env[k]));

const { memModel } = await import("./helpers/memMongo.js");
const svc = await import("../services/emailOAuth.service.js");
const { default: router } = await import("../routes/email.routes.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailSyncState } = await import("../models/EmailSyncState.js");
const { default: User } = await import("../models/User.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const ADMIN_A = "64b0000000000000000000c3";

let conns, calls;
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });
const handler = (method, path) => router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
const res = () => {
  const r = { statusCode: 200 };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  r.redirect = (u) => (r.redirectUrl = u);
  return r;
};
const mockFetch = (routes) => {
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
    return hit ? hit[1](opts) : json(404, {});
  };
};
const callback = async (query) => {
  const r = res();
  await handler("get", "/oauth/:provider/callback")({ params: { provider: "microsoft" }, query, get: () => undefined }, r);
  return new URL(r.redirectUrl).searchParams;
};
const stateFor = (ws = WS_A) => new URL(svc.buildAuthUrl({ provider: "microsoft", userId: ADMIN_A, workspaceId: ws })).searchParams.get("state");

beforeEach(() => {
  setEnv(true);
  delete process.env.MICROSOFT_TENANT_ID;
  calls = [];
  conns = memModel(EmailConnection, { unique: [["workspace", "provider", "email"]] });
  memModel(EmailMessage);
  memModel(EmailSyncState, { unique: [["workspace", "account"]] });
  User.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id, role: "admin", workspace: WS_A, isActive: true }) }) });
});

test("availability: 'Continue with Microsoft' turns on only when all three Microsoft settings exist; env names never reach members", async () => {
  const status = async (role) => {
    const r = res();
    const verify = EmailConnection.find;
    await handler("get", "/status")({ workspace: WS_A, user: { _id: ADMIN_A, role } }, r);
    EmailConnection.find = verify;
    return r.body.data.providers.find((p) => p.id === "microsoft");
  };
  setEnv(false);
  assert.equal((await status("admin")).available, false);
  process.env.MICROSOFT_CLIENT_ID = "mid";
  assert.equal((await status("admin")).available, false, "a partial setup stays unavailable");
  setEnv(true);
  const ms = await status("admin");
  assert.deepEqual([ms.available, ms.setupStatus], [true, "Ready"]);
  const member = await status("member");
  assert.equal(member.setupStatus, undefined);
  assert.doesNotMatch(JSON.stringify(member), /MICROSOFT_|msecret/);
});

test("authorize URL: minimal Graph scopes, account picker, tenant from MICROSOFT_TENANT_ID (default common)", () => {
  let u = new URL(svc.buildAuthUrl({ provider: "microsoft", userId: ADMIN_A, workspaceId: WS_A }));
  assert.equal(u.origin + u.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(u.searchParams.get("scope"), "openid email offline_access User.Read Mail.Send");
  assert.equal(u.searchParams.get("prompt"), "select_account");
  assert.equal(u.searchParams.get("redirect_uri"), MS_ENV.MICROSOFT_OAUTH_REDIRECT_URI);
  process.env.MICROSOFT_TENANT_ID = "organizations";
  u = new URL(svc.buildAuthUrl({ provider: "microsoft", userId: ADMIN_A, workspaceId: WS_A }));
  assert.match(u.pathname, /^\/organizations\//);
});

test("company account without a mail attribute: userPrincipalName is used; tokens stored encrypted in this workspace only", async () => {
  mockFetch({
    "oauth2/v2.0/token": () => json(200, { access_token: "MAT", refresh_token: "MRT", expires_in: 3600, scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read openid email" }),
    "graph.microsoft.com/v1.0/me?": () => json(200, { mail: null, userPrincipalName: "Ravi.K@Contoso.onmicrosoft.com" }),
  });
  const p = await callback({ code: "c", state: stateFor() });
  assert.equal(p.get("connected"), "1");
  assert.equal(conns.length, 1);
  const c = conns[0];
  assert.deepEqual([String(c.workspace), c.provider, c.email], [WS_A, "microsoft", "ravi.k@contoso.onmicrosoft.com"]);
  assert.notEqual(c.accessToken, "MAT");
  assert.notEqual(c.refreshToken, "MRT");
  assert.doesNotMatch(JSON.stringify(await svc.listAccounts(WS_A)), /MAT|MRT|accessToken|refreshToken/);
  assert.deepEqual(await svc.listAccounts(WS_B), []);
});

test("Mail.Send not granted: nothing stored and a clear message", async () => {
  mockFetch({
    "oauth2/v2.0/token": () => json(200, { access_token: "MAT", refresh_token: "MRT", expires_in: 3600, scope: "User.Read openid email" }),
  });
  const p = await callback({ code: "c", state: stateFor() });
  assert.equal(p.get("connected"), "0");
  assert.match(p.get("message"), /Permission to send email was not granted/);
  assert.equal(conns.length, 0);
});

test("Entra errors map to safe messages (setup, admin consent, account type) and never echo raw AADSTS text", async () => {
  const cases = [
    ["invalid_request", "AADSTS50011: The redirect URI specified in the request does not match", /isn't set up correctly on ReadyTech's side/],
    ["invalid_request", "AADSTS50194: Application is not configured as a multi-tenant application", /isn't set up correctly/],
    ["consent_required", "AADSTS65001: The user or administrator has not consented", /administrator to approve/],
    ["invalid_request", "AADSTS50020: User account from identity provider does not exist in tenant", /company Outlook \/ Microsoft 365 account/],
  ];
  for (const [error, desc, re] of cases) {
    const p = await callback({ error, error_description: desc, state: stateFor() });
    assert.equal(p.get("connected"), "0");
    assert.match(p.get("message"), re);
    assert.doesNotMatch(p.get("message"), /AADSTS/);
  }
  assert.equal(conns.length, 0);
});

test("state from another workspace's admin can't connect a mailbox there", async () => {
  mockFetch({ "oauth2/v2.0/token": () => json(200, { access_token: "MAT", refresh_token: "MRT", expires_in: 3600 }) });
  const p = await callback({ code: "c", state: stateFor(WS_B) }); // user belongs to WS_A
  assert.equal(p.get("connected"), "0");
  assert.equal(conns.length, 0);
  assert.equal(calls.length, 0, "no token exchange happens");
});

test("Graph rejects the token (401): account marked for reconnect, safe message; other workspace untouched", async () => {
  const mk = (ws, email, token) => ({ _id: `64b00000000000000000${ws.slice(-2)}f9`, workspace: ws, provider: "microsoft", email, isDefault: true, status: "connected", scope: "Mail.Send User.Read",
    accessToken: svc.encrypt(token), refreshToken: svc.encrypt(`R-${token}`), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date() });
  conns.push(mk(WS_A, "a@contoso.com", "AT-A"), mk(WS_B, "b@fabrikam.com", "AT-B"));
  mockFetch({ "me/sendMail": () => json(401, { error: { code: "InvalidAuthenticationToken", message: "secret detail" } }) });
  await assert.rejects(svc.sendViaConnectedAccount(WS_A, { to: "x@y.z", subject: "s", message: "m" }), (e) => /reconnect the account/.test(e.message) && !/secret detail/.test(e.message));
  assert.equal(calls[0].opts.headers.authorization, "Bearer AT-A");
  assert.deepEqual(conns.map((c) => c.status), ["error", "connected"]);
});

test("disconnect: deletes only this workspace's Microsoft tokens, no network call, points to My Apps to revoke", async () => {
  const mk = (ws, email) => ({ _id: `64b00000000000000000${ws.slice(-2)}f8`, workspace: ws, provider: "microsoft", email, isDefault: true, status: "connected", scope: "Mail.Send",
    accessToken: svc.encrypt("AT"), refreshToken: svc.encrypt("RT"), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date() });
  conns.push(mk(WS_A, "a@contoso.com"), mk(WS_B, "b@fabrikam.com"));
  mockFetch({});
  const r = res();
  await handler("delete", "/accounts/:id")({ params: { id: conns[0]._id }, workspace: WS_A, user: { _id: ADMIN_A, role: "admin" } }, r);
  assert.equal(r.body.success, true);
  assert.equal(r.body.data.revokeUrl, "https://myapps.microsoft.com");
  assert.equal(calls.length, 0);
  assert.deepEqual(conns.map((c) => c.email), ["b@fabrikam.com"]);

  // Workspace B can't delete A's (now gone) or reach across by id
  const r2 = res();
  await handler("delete", "/accounts/:id")({ params: { id: conns[0]._id }, workspace: WS_A, user: { _id: ADMIN_A, role: "admin" } }, r2);
  assert.equal(r2.statusCode, 404);
  assert.equal(conns.length, 1);
});
