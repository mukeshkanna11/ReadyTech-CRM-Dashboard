// DB-free tests for Gmail reply sync (Replies only, behind GMAIL_INBOX_SYNC_ENABLED).
// Run: node --test tests/gmailSync.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";
delete process.env.GMAIL_INBOX_SYNC_ENABLED;

const { default: jwt } = await import("jsonwebtoken");
const { memModel } = await import("./helpers/memMongo.js");
const oauth = await import("../services/emailOAuth.service.js");
const sync = await import("../services/mail/gmailSync.service.js");
const mb = await import("../services/mail/mailbox.service.js");
const { default: router } = await import("../routes/email.routes.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailAttachment } = await import("../models/EmailAttachment.js");
const { default: EmailSyncState } = await import("../models/EmailSyncState.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const ADMIN_A = "64b0000000000000000000c3";
const MEMBER_A = "64b0000000000000000000c4";
const ADMIN_B = "64b0000000000000000000c5";
const ACC_A = "64b0000000000000000000e1";
const ACC_A2 = "64b0000000000000000000e3";
const ACC_B = "64b0000000000000000000e2";
const CLIENT_A = "64b0000000000000000000d4";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const READ = "https://www.googleapis.com/auth/gmail.readonly";

const ctxA = { workspaceId: WS_A, userId: ADMIN_A, isAdmin: true };
const memberA = { workspaceId: WS_A, userId: MEMBER_A, isAdmin: false };
const ctxB = { workspaceId: WS_B, userId: ADMIN_B, isAdmin: true };
const on = () => { process.env.GMAIL_INBOX_SYNC_ENABLED = "true"; };
const off = () => { delete process.env.GMAIL_INBOX_SYNC_ENABLED; };

let conns, messages, files, states, calls;

/* ---------------- Gmail API mock ---------------- */
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });
const b64u = (s) => Buffer.from(s).toString("base64url");
const gmailMock = (routes) => {
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const path = u.pathname.replace(/^\/(upload\/)?gmail\/v1\/users\/me\//, "");
    calls.push({ path, auth: opts.headers?.authorization, params: Object.fromEntries(u.searchParams), opts });
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) {
        const out = fn(m, u.searchParams, opts);
        return out?.__status ? json(out.__status, out.body || {}) : json(200, out);
      }
    }
    return json(404, { error: { code: 404 } });
  };
};
const gmailCalls = (re) => calls.filter((c) => re.test(c.path));

const gmailMsg = ({ id, threadId = "t1", from = "Buyer Person <buyer@acme.in>", labels = ["INBOX", "UNREAD"], html = "<p>Yes <b>please</b></p><script>steal()</script>", text = "Yes please", attachments = [] }) => ({
  id, threadId, labelIds: labels, internalDate: String(Date.parse("2026-11-05T10:00:00Z")),
  payload: {
    mimeType: "multipart/mixed",
    headers: [
      { name: "From", value: from }, { name: "To", value: "Owner <owner@a.com>" }, { name: "Cc", value: '"Doe, Jane" <jane@acme.in>' },
      { name: "Subject", value: "Re: Quote" }, { name: "Message-ID", value: `<${id}@acme.in>` },
      { name: "In-Reply-To", value: "<orig@a.com>" }, { name: "References", value: "<orig@a.com>" },
    ],
    parts: [
      { mimeType: "multipart/alternative", parts: [
        { mimeType: "text/plain", headers: [{ name: "Content-Type", value: 'text/plain; charset="UTF-8"' }], body: { data: b64u(text), size: text.length } },
        { mimeType: "text/html", headers: [], body: { data: b64u(html) } },
      ] },
      ...attachments,
    ],
  },
});
const pdfPart = { mimeType: "application/pdf", filename: "po.pdf", headers: [{ name: "Content-Disposition", value: "attachment" }], body: { attachmentId: "att1", size: 7 } };

/* Gmail account fixtures */
const gconn = (id, ws, email, token, scope, extra = {}) => ({
  _id: id, workspace: ws, provider: "google", email, isDefault: true, status: "connected", scope,
  accessToken: oauth.encrypt(token), refreshToken: oauth.encrypt(`R-${token}`), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date(), ...extra,
});
const sentRow = (ws, account, threadId, extra = {}) => ({
  workspace: ws, account, accountEmail: "owner@a.com", provider: "google", direction: "outbound", status: "sent",
  from: "owner@a.com", to: ["buyer@acme.in"], subject: "Quote", html: "<p>Quote</p>", text: "Quote",
  providerMessageId: `sent-${threadId}-${ws.slice(-2)}`, providerThreadId: threadId, messageIdHeader: "<orig@a.com>",
  threadKey: `threadkey${ws.slice(-2)}${threadId}`, links: [{ type: "client", id: CLIENT_A, label: "Acme Pvt" }],
  createdBy: MEMBER_A, sentAt: new Date(), read: true, ...extra,
});

beforeEach(async () => {
  off();
  calls = [];
  conns = memModel(EmailConnection, { unique: [["workspace", "provider", "email"]] });
  messages = memModel(EmailMessage, {
    unique: [["workspace", "account", "providerMessageId"], ["workspace", "clientId"]],
    defaults: { links: [], attachments: [], to: [], cc: [], bcc: [], read: false, starred: false, archived: false, trashed: false },
  });
  files = memModel(EmailAttachment);
  states = memModel(EmailSyncState, { unique: [["workspace", "account"]], defaults: { failures: 0, totalImported: 0, historyId: null, lockedUntil: null } });
  conns.push(
    gconn(ACC_A, WS_A, "owner@a.com", "AT-A", `openid email ${SEND} ${READ}`),
    gconn(ACC_A2, WS_A, "sales@a.com", "AT-A2", `openid email ${SEND}`, { isDefault: false }),
    gconn(ACC_B, WS_B, "owner@b.com", "AT-B", `openid email ${SEND} ${READ}`),
  );
  await EmailMessage.create(sentRow(WS_A, ACC_A, "t1"));
});

const firstSyncRoutes = (extra = []) => [
  ...extra,
  [/^profile$/, () => ({ historyId: "500" })],
  [/^threads\/t1$/, () => ({ id: "t1", messages: [{ id: "sent-t1-a1", labelIds: ["SENT"] }, { id: "r1", labelIds: ["INBOX", "UNREAD"] }] })],
  [/^messages\/r1\/attachments\/att1$/, () => ({ data: b64u("PDFDATA") })],
  [/^messages\/r1$/, () => gmailMsg({ id: "r1", attachments: [pdfPart] })],
];

/* ---------------- Flag off: nothing changes ---------------- */
const handler = (method, path) => router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
const res = () => { const r = { statusCode: 200 }; r.status = (c) => ((r.statusCode = c), r); r.json = (b) => ((r.body = b), r); r.redirect = (u) => (r.redirectUrl = u); return r; };
const urlReq = (query) => ({ params: { provider: "google" }, query, user: { _id: ADMIN_A, role: "admin" }, workspace: WS_A, get: () => undefined });

test("flag OFF: Google scope is exactly the existing send-only scope; no sync, no Gmail calls", async () => {
  const scope = new URL(oauth.buildAuthUrl({ provider: "google", userId: ADMIN_A, workspaceId: WS_A })).searchParams.get("scope");
  assert.equal(scope, `openid email ${SEND}`);
  const r = res();
  handler("get", "/oauth/:provider/url")(urlReq({ inbox: "1" }), r);
  assert.equal(r.statusCode, 400);
  assert.equal(r.body.code, "INBOX_SYNC_UNAVAILABLE");
  const plain = res();
  handler("get", "/oauth/:provider/url")(urlReq({}), plain);
  assert.equal(new URL(plain.body.data.url).searchParams.get("scope"), `openid email ${SEND}`);

  gmailMock(firstSyncRoutes());
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A), { status: "disabled" });
  assert.equal(await sync.runSyncTick(), 0);
  assert.equal((await sync.syncWorkspace(WS_A)).enabled, false);
  assert.equal(calls.length, 0);
  const s = await mb.summary(ctxA);
  assert.equal(s.inboxSync.enabled, false);
  assert.equal(s.inbox.available, false);
});

test("flag ON: only 'Enable inbox sync' adds gmail.readonly (send scope kept); other providers refused", () => {
  on();
  const r = res();
  handler("get", "/oauth/:provider/url")(urlReq({ inbox: "1" }), r);
  const url = new URL(r.body.data.url);
  assert.deepEqual(url.searchParams.get("scope").split(" "), ["openid", "email", SEND, READ]);
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(jwt.verify(url.searchParams.get("state"), "test-jwt").inbox, true);
  const normal = res();
  handler("get", "/oauth/:provider/url")(urlReq({}), normal);
  assert.equal(new URL(normal.body.data.url).searchParams.get("scope"), `openid email ${SEND}`);
  const zoho = res();
  process.env.ZOHO_CLIENT_ID = "z"; process.env.ZOHO_CLIENT_SECRET = "z"; process.env.ZOHO_OAUTH_REDIRECT_URI = "http://z";
  handler("get", "/oauth/:provider/url")({ ...urlReq({ inbox: "1" }), params: { provider: "zoho" } }, zoho);
  assert.equal(zoho.statusCode, 400);
});

/* ---------------- Sync ---------------- */
test("first sync: imports the reply in the ReadyTech thread with sender, recipients, body and attachment", async () => {
  on();
  gmailMock(firstSyncRoutes());
  const out = await sync.syncAccount(WS_A, ACC_A);
  assert.deepEqual(out, { status: "ok", imported: 1 });
  assert.ok(calls.every((c) => c.auth === "Bearer AT-A"));
  assert.equal(gmailCalls(/^messages\/sent-/).length, 0); // our own sent copy is never fetched

  const reply = messages.find((m) => m.direction === "inbound");
  const parent = messages.find((m) => m.direction === "outbound");
  assert.equal(reply.workspace, WS_A);
  assert.equal(reply.threadKey, parent.threadKey);
  assert.equal(reply.providerThreadId, "t1");
  assert.equal(reply.providerMessageId, "r1");
  assert.equal(reply.status, "received");
  assert.equal(reply.read, false);
  assert.equal(reply.from, "buyer@acme.in");
  assert.equal(reply.fromName, "Buyer Person");
  assert.deepEqual(reply.to, ["owner@a.com"]);
  assert.deepEqual(reply.cc, ["jane@acme.in"]);
  assert.equal(reply.subject, "Re: Quote");
  assert.equal(reply.text, "Yes please");
  assert.doesNotMatch(reply.html, /script|steal/);
  assert.match(reply.html, /<b>please<\/b>/);
  assert.equal(reply.messageIdHeader, "<r1@acme.in>");
  assert.equal(reply.createdBy, MEMBER_A); // the member who started the conversation sees it
  assert.deepEqual(reply.links.map((l) => l.label), ["Acme Pvt"]);

  const state = states[0];
  assert.deepEqual([state.historyId, state.status, state.lockedUntil, state.lockId], ["500", "idle", null, null]);

  // Same Mail workspace: Inbox, conversation and attachment download
  assert.equal((await mb.listMessages(memberA, { folder: "inbox" })).total, 1);
  const thread = await mb.getThread(memberA, parent.threadKey);
  assert.deepEqual(thread.messages.map((m) => m.direction), ["outbound", "inbound"]);
  const att = thread.messages[1].attachments[0];
  assert.equal(att.downloadable, true);
  assert.equal((await mb.getAttachment(memberA, att.id)).data.toString(), "PDFDATA");
  await assert.rejects(mb.getAttachment(ctxB, att.id), (e) => e.status === 404);
  assert.equal((await mb.summary(memberA)).counts.inboxUnread, 1);
});

test("incremental sync: only known threads are read; unrelated mail is never fetched; no duplicates", async () => {
  on();
  gmailMock(firstSyncRoutes());
  await sync.syncAccount(WS_A, ACC_A);
  calls = [];
  const starts = [];
  gmailMock([
    [/^history$/, (m, q) => {
      starts.push([q.get("startHistoryId"), q.get("historyTypes")]);
      return {
        history: [
          { id: "501", messagesAdded: [{ message: { id: "r2", threadId: "t1", labelIds: ["INBOX"] } }] },
          { id: "502", messagesAdded: [{ message: { id: "u1", threadId: "t-personal", labelIds: ["INBOX", "UNREAD"] } }] },
          { id: "503", messagesAdded: [{ message: { id: "r1", threadId: "t1", labelIds: ["INBOX"] } }] },
          { id: "504", messagesAdded: [{ message: { id: "x1", threadId: "t1", labelIds: ["SPAM"] } }] },
        ],
        historyId: "510",
      };
    }],
    [/^messages\/r2$/, () => gmailMsg({ id: "r2", labels: ["INBOX"], text: "Second reply", html: "" })],
  ]);
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A), { status: "ok", imported: 1 });
  assert.equal(gmailCalls(/^messages\/u1/).length, 0, "unrelated personal mail must not be read");
  assert.equal(gmailCalls(/^messages\/r1/).length, 0, "already-synced message must not be refetched");
  assert.equal(gmailCalls(/^messages\/x1/).length, 0);
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 2);
  assert.equal(messages.find((m) => m.providerMessageId === "r2").read, true);
  assert.equal(states[0].historyId, "510");
  assert.deepEqual(starts, [["500", "messageAdded"]]);

  // Running the same history again changes nothing
  calls = [];
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A), { status: "ok", imported: 0 });
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 2);
  assert.equal(starts[1][0], "510"); // cursor advanced
});

test("lease: a mailbox already being synced is skipped (no parallel runs)", async () => {
  on();
  await EmailSyncState.create({ workspace: WS_A, account: ACC_A, historyId: "500", lockedUntil: new Date(Date.now() + 60_000), lockId: "other" });
  gmailMock(firstSyncRoutes());
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A), { status: "busy" });
  assert.equal(calls.length, 0);
  // An expired lease is taken over
  states[0].lockedUntil = new Date(Date.now() - 1000);
  gmailMock([[/^history$/, () => ({ historyId: "520" })]]);
  assert.equal((await sync.syncAccount(WS_A, ACC_A)).status, "ok");
});

test("expired history (404): re-reads known threads and sets a fresh baseline", async () => {
  on();
  gmailMock(firstSyncRoutes());
  await sync.syncAccount(WS_A, ACC_A);
  gmailMock([
    [/^history$/, () => ({ __status: 404, body: { error: { code: 404 } } })],
    [/^profile$/, () => ({ historyId: "900" })],
    [/^threads\/t1$/, () => ({ messages: [{ id: "r1", labelIds: ["INBOX"] }, { id: "r3", labelIds: ["INBOX"] }] })],
    [/^messages\/r3$/, () => gmailMsg({ id: "r3", labels: ["INBOX"] })],
  ]);
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A), { status: "ok", imported: 1 });
  assert.equal(states[0].historyId, "900");
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 2);
});

test("isolation: each workspace syncs only its own mailbox with its own token", async () => {
  on();
  // Workspace B also has a ReadyTech thread with the same Gmail thread id string
  await EmailMessage.create(sentRow(WS_B, ACC_B, "t1", { accountEmail: "owner@b.com", from: "owner@b.com", createdBy: ADMIN_B }));
  gmailMock(firstSyncRoutes());
  await sync.syncAccount(WS_A, ACC_A);
  assert.equal(messages.filter((m) => m.workspace === WS_B && m.direction === "inbound").length, 0);
  assert.equal((await mb.listMessages(ctxB, { folder: "inbox" })).total, 0);

  calls = [];
  gmailMock(firstSyncRoutes());
  const r = await sync.syncWorkspace(WS_B);
  assert.deepEqual(r.results.map((x) => x.accountId), [ACC_B]);
  assert.ok(calls.length > 0 && calls.every((c) => c.auth === "Bearer AT-B"));
  const bReply = messages.find((m) => m.workspace === WS_B && m.direction === "inbound");
  assert.equal(bReply.account, ACC_B);
  assert.equal(bReply.threadKey, `threadkeyb2t1`);
  assert.equal((await mb.listMessages(ctxA, { folder: "inbox" })).total, 1); // still only A's own

  // Worker: every due mailbox, each with its own token
  states.length = 0;
  calls = [];
  gmailMock([[/^profile$/, () => ({ historyId: "1" })], [/^threads\//, () => ({ messages: [] })]]);
  assert.equal(await sync.runSyncTick(), 2); // ACC_A + ACC_B (ACC_A2 has no read access)
  assert.deepEqual([...new Set(calls.map((c) => c.auth))].sort(), ["Bearer AT-A", "Bearer AT-B"]);
});

test("permissions: no read scope → needs_permission without any Gmail call; a 403 keeps sending working", async () => {
  on();
  gmailMock(firstSyncRoutes());
  assert.deepEqual(await sync.syncAccount(WS_A, ACC_A2), { status: "needs_permission" });
  assert.equal(calls.length, 0);

  gmailMock([[/^profile$/, () => ({ __status: 403, body: { error: { errors: [{ reason: "insufficientPermissions" }] } } })]]);
  const r = await sync.syncAccount(WS_A, ACC_A);
  assert.equal(r.status, "needs_permission");
  assert.doesNotMatch(r.error, /insufficientPermissions|AT-A/);
  assert.equal(conns.find((c) => c._id === ACC_A).status, "connected"); // sending is unaffected
  assert.equal(states.find((s) => s.account === ACC_A).status, "needs_permission");

  // Transient Gmail failure: safe message + backoff, lease released
  gmailMock([[/^profile$/, () => ({ __status: 500, body: { error: { message: "backend secret" } } })]]);
  states.length = 0;
  const e = await sync.syncAccount(WS_A, ACC_A);
  assert.equal(e.status, "error");
  assert.doesNotMatch(e.error, /secret/);
  assert.equal(states[0].lockedUntil, null);
  assert.ok(states[0].nextRunAt > new Date());
});

test("attachments: oversized and executable files are listed but never downloaded or forwarded", async () => {
  on();
  gmailMock([
    [/^profile$/, () => ({ historyId: "500" })],
    [/^threads\/t1$/, () => ({ messages: [{ id: "r1", labelIds: ["INBOX"] }] })],
    [/^messages\/r1\/attachments\//, () => { throw new Error("must not download"); }],
    [/^messages\/r1$/, () => gmailMsg({ id: "r1", attachments: [
      { mimeType: "application/zip", filename: "big.zip", headers: [], body: { attachmentId: "big", size: 6 * 1024 * 1024 } },
      { mimeType: "application/octet-stream", filename: "run.exe", headers: [], body: { attachmentId: "exe", size: 10 } },
    ] })],
  ]);
  assert.equal((await sync.syncAccount(WS_A, ACC_A)).imported, 1);
  const reply = messages.find((m) => m.direction === "inbound");
  assert.deepEqual(reply.attachments.map((a) => [a.filename, a.attachment, a.unavailable]), [["big.zip", null, "too_large"], ["run.exe", null, "blocked"]]);
  assert.equal(files.length, 0);
  const view = await mb.getMessage(ctxA, String(reply._id));
  assert.deepEqual(view.attachments.map((a) => a.downloadable), [false, false]);
});

test("replying to a received message stays in the Gmail thread and quotes its Message-ID", async () => {
  on();
  gmailMock(firstSyncRoutes());
  await sync.syncAccount(WS_A, ACC_A);
  const reply = messages.find((m) => m.direction === "inbound");
  let sent;
  gmailMock([[/^messages\/send$/, (m, q, opts) => { sent = JSON.parse(opts.body); return { id: "s2", threadId: "t1" }; }]]);
  const { message } = await mb.sendMessage(ctxA, { to: "buyer@acme.in", subject: "Re: Quote", html: "<p>Great</p>", replyTo: String(reply._id), mode: "reply" });
  assert.equal(message.status, "sent");
  assert.equal(message.threadKey, reply.threadKey);
  assert.equal(sent.threadId, "t1");
  const raw = Buffer.from(sent.raw, "base64url").toString();
  assert.match(raw, /In-Reply-To: <r1@acme\.in>/);
  assert.match(raw, /References: <orig@a\.com> <r1@acme\.in>/);
  assert.equal(calls[0].auth, "Bearer AT-A");
});

test("summary + initial sync: per-account status, enable option, and no secrets", async () => {
  on();
  gmailMock(firstSyncRoutes());
  assert.deepEqual(await sync.startInitialSync(WS_A, "google", "sales@a.com"), { granted: false });
  assert.deepEqual(await sync.startInitialSync(WS_A, "google", "OWNER@a.com"), { granted: true });
  await new Promise((r) => setTimeout(r, 20)); // fire-and-forget first sync
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 1);

  const s = await mb.summary(ctxA);
  assert.equal(s.inboxSync.enabled, true);
  assert.equal(s.inboxSync.mode, "replies");
  assert.equal(s.inbox.available, true);
  const a = s.capabilities.find((c) => c.accountId === ACC_A);
  const a2 = s.capabilities.find((c) => c.accountId === ACC_A2);
  assert.equal(a.inbox, true);
  assert.equal(a.sync.status, "idle");
  assert.ok(a.sync.lastSuccessAt);
  assert.equal(a2.inbox, false);
  assert.equal(a2.sync.canEnable, true);
  assert.doesNotMatch(JSON.stringify(s), /AT-A|R-AT|accessToken|refreshToken|historyId|lockId/);
});
