// End-to-end (mocked Gmail API) for the real-world scenario:
//   ReadyTech sends to agriculturistmukesh11@gmail.com → recipient replies
//   "Received your mail." in Gmail → reply appears in the Mail Integration
//   conversation. Driven through the actual /api/email/mailbox route handlers.
// Run: node --test tests/gmailReplyFlow.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";
delete process.env.GMAIL_INBOX_SYNC_ENABLED;

const { memModel } = await import("./helpers/memMongo.js");
const oauth = await import("../services/emailOAuth.service.js");
const sync = await import("../services/mail/gmailSync.service.js");
const { default: mailbox } = await import("../routes/mailbox.routes.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailAttachment } = await import("../models/EmailAttachment.js");
const { default: EmailSyncState } = await import("../models/EmailSyncState.js");

const WS = "64b0000000000000000000a1";
const OTHER_WS = "64b0000000000000000000b2";
const ADMIN = "64b0000000000000000000c3";
const ACC = "64b0000000000000000000e1";
const OTHER_ACC = "64b0000000000000000000e2";
const RECIPIENT = "agriculturistmukesh11@gmail.com";
const SEND = "https://www.googleapis.com/auth/gmail.send";
const READ = "https://www.googleapis.com/auth/gmail.readonly";

let conns, messages, calls, gmailState;

/* ---------- route harness (the real handlers, after the auth middleware) ---------- */
const route = (method, path) => mailbox.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
const call = async (method, path, { ws = WS, user = { _id: ADMIN, role: "admin", email: "owner@readytech.in" }, params = {}, query = {}, body = {} } = {}) => {
  const r = { statusCode: 200 };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  await route(method, path)({ workspace: ws, user, params, query, body }, r);
  return r;
};

/* ---------- a tiny stateful Gmail: messages/send, history, messages.get ---------- */
const b64u = (s) => Buffer.from(s).toString("base64url");
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });
const fakeGmail = () => {
  gmailState = { historyId: 1000, history: [], messages: new Map(), sentRaw: [] };
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const path = u.pathname.replace(/^\/(upload\/)?gmail\/v1\/users\/me\//, "");
    calls.push({ path, auth: opts.headers?.authorization });
    if (path === "messages/send") {
      const body = JSON.parse(opts.body);
      gmailState.sentRaw.push({ raw: Buffer.from(body.raw, "base64url").toString(), threadId: body.threadId || null });
      const id = `g-sent-${gmailState.sentRaw.length}`;
      const threadId = body.threadId || "thr-777";
      gmailState.messages.set(id, { id, threadId, labelIds: ["SENT"] });
      gmailState.historyId += 1;
      gmailState.history.push({ id: String(gmailState.historyId), messagesAdded: [{ message: { id, threadId, labelIds: ["SENT"] } }] });
      return json(200, { id, threadId, labelIds: ["SENT"] });
    }
    if (path === "profile") return json(200, { emailAddress: "owner@readytech.in", historyId: String(gmailState.historyId) });
    if (path === "history") {
      const start = Number(u.searchParams.get("startHistoryId"));
      return json(200, { history: gmailState.history.filter((h) => Number(h.id) > start), historyId: String(gmailState.historyId) });
    }
    let m = /^threads\/(.+)$/.exec(path);
    if (m) return json(200, { id: m[1], messages: [...gmailState.messages.values()].filter((x) => x.threadId === m[1]).map(({ id, labelIds }) => ({ id, labelIds })) });
    m = /^messages\/([^/]+)$/.exec(path);
    if (m && gmailState.messages.has(m[1])) return json(200, gmailState.messages.get(m[1]));
    return json(404, { error: { code: 404 } });
  };
};

/* The recipient answers in Gmail: Gmail threads it into our sent thread */
const recipientReplies = (inReplyTo) => {
  const id = "g-reply-1";
  const html = `<div dir="ltr">Received your mail.</div><br><div class="gmail_quote"><div class="gmail_attr">On Thu, 5 Nov 2026 at 10:00, ReadyTech &lt;owner@readytech.in&gt; wrote:</div><blockquote class="gmail_quote">Please find our quotation.</blockquote></div>`;
  const text = "Received your mail.\r\n\r\nOn Thu, 5 Nov 2026 at 10:00, ReadyTech <owner@readytech.in> wrote:\r\n> Please find our quotation.";
  gmailState.messages.set(id, {
    id, threadId: "thr-777", labelIds: ["INBOX", "UNREAD", "CATEGORY_PERSONAL"], internalDate: String(Date.parse("2026-11-05T10:05:00Z")),
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "From", value: `Mukesh <${RECIPIENT}>` },
        { name: "To", value: "owner@readytech.in" },
        { name: "Subject", value: "Re: Quotation from ReadyTech" },
        { name: "Message-ID", value: "<CAF=reply1@mail.gmail.com>" },
        { name: "In-Reply-To", value: inReplyTo },
        { name: "References", value: inReplyTo },
      ],
      parts: [
        { mimeType: "text/plain", headers: [{ name: "Content-Type", value: 'text/plain; charset="UTF-8"' }], body: { data: b64u(text), size: text.length } },
        { mimeType: "text/html", headers: [{ name: "Content-Type", value: 'text/html; charset="UTF-8"' }], body: { data: b64u(html), size: html.length } },
      ],
    },
  });
  gmailState.historyId += 1;
  gmailState.history.push({ id: String(gmailState.historyId), messagesAdded: [{ message: { id, threadId: "thr-777", labelIds: ["INBOX", "UNREAD"] } }] });
};

const account = (id, ws, email, token, scope) => ({
  _id: id, workspace: ws, provider: "google", email, isDefault: true, status: "connected", scope,
  accessToken: oauth.encrypt(token), refreshToken: oauth.encrypt(`R-${token}`), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date(),
});

beforeEach(() => {
  delete process.env.GMAIL_INBOX_SYNC_ENABLED;
  calls = [];
  conns = memModel(EmailConnection, { unique: [["workspace", "provider", "email"]] });
  messages = memModel(EmailMessage, {
    unique: [["workspace", "account", "providerMessageId"], ["workspace", "clientId"]],
    defaults: { links: [], attachments: [], to: [], cc: [], bcc: [], read: false, starred: false, archived: false, trashed: false },
  });
  memModel(EmailAttachment);
  memModel(EmailSyncState, { unique: [["workspace", "account"]], defaults: { failures: 0, totalImported: 0, historyId: null, lockedUntil: null } });
  fakeGmail();
});

const sendQuotation = async () => {
  const r = await call("post", "/send", { body: { to: RECIPIENT, subject: "Quotation from ReadyTech", html: "<p>Please find our quotation.</p>", clientId: "real-world-test-1" } });
  assert.equal(r.statusCode, 200, r.body?.message);
  return r.body.data;
};

test("today (flag OFF, send-only grant): email is sent, but the reply cannot be read — matches the real-world observation", async () => {
  conns.push(account(ACC, WS, "owner@readytech.in", "AT-WS", `openid email ${SEND}`));
  const sent = await sendQuotation();
  assert.equal(sent.status, "sent");
  recipientReplies(messages[0].messageIdHeader);

  const s = await call("post", "/sync");
  assert.deepEqual(s.body.data, { enabled: false, imported: 0, results: [] });
  assert.equal(calls.filter((c) => c.path !== "messages/send").length, 0, "nothing may read Gmail while the flag is off");
  const inbox = await call("get", "/messages", { query: { folder: "inbox" } });
  assert.equal(inbox.body.data.total, 0);
  const summary = await call("get", "/summary");
  assert.equal(summary.body.data.inbox.available, false);
});

test("Phase A (flag ON + gmail.readonly): sent email → external reply 'Received your mail.' → same CRM conversation", async () => {
  process.env.GMAIL_INBOX_SYNC_ENABLED = "true";
  conns.push(account(ACC, WS, "owner@readytech.in", "AT-WS", `openid email ${SEND} ${READ}`));
  conns.push(account(OTHER_ACC, OTHER_WS, "owner@other.in", "AT-OTHER", `openid email ${SEND} ${READ}`));

  // 1. ReadyTech sends the email (existing gmail.send path, unchanged)
  const sent = await sendQuotation();
  assert.equal(sent.status, "sent");
  assert.deepEqual(sent.to, [RECIPIENT]);
  assert.match(gmailState.sentRaw[0].raw, new RegExp(`^To: ${RECIPIENT}$`, "m"));
  const stored = messages[0];
  assert.equal(stored.providerThreadId, "thr-777"); // Gmail thread id recorded at send time
  assert.ok(stored.messageIdHeader);

  // 2. Sync is enabled → baseline (nothing new yet)
  let r = await call("post", "/sync");
  assert.equal(r.body.data.imported, 0);

  // 3. Recipient replies in Gmail
  recipientReplies(stored.messageIdHeader);

  // 4. Manual Refresh imports it — once
  r = await call("post", "/sync");
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body.data.results.map((x) => [x.email, x.status, x.imported]), [["owner@readytech.in", "ok", 1]]);
  r = await call("post", "/sync");
  assert.equal(r.body.data.imported, 0, "no duplicate on the next refresh");
  // the background worker sees nothing new either
  await sync.runSyncTick();
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 1);

  // 5. It is in Inbox (unread) with sender, recipient, subject, message and time
  const inbox = await call("get", "/messages", { query: { folder: "inbox" } });
  assert.equal(inbox.body.data.total, 1);
  const item = inbox.body.data.items[0];
  assert.equal(item.from, RECIPIENT);
  assert.equal(item.fromName, "Mukesh");
  assert.deepEqual(item.to, ["owner@readytech.in"]);
  assert.equal(item.subject, "Re: Quotation from ReadyTech");
  assert.match(item.snippet, /^Received your mail\./);
  assert.equal(new Date(item.date).toISOString(), "2026-11-05T10:05:00.000Z");
  assert.equal(item.read, false);
  assert.equal((await call("get", "/summary")).body.data.counts.inboxUnread, 1);

  // 6. …and in the same conversation as the sent email
  const convs = await call("get", "/conversations");
  assert.equal(convs.body.data.total, 1);
  const conv = convs.body.data.items[0];
  assert.equal(conv.count, 2);
  assert.equal(conv.unread, 1);
  assert.equal(conv.threadKey, sent.threadKey);
  const thread = await call("get", "/conversations/:threadKey", { params: { threadKey: sent.threadKey } });
  assert.deepEqual(thread.body.data.messages.map((m) => [m.direction, m.from]), [["outbound", "owner@readytech.in"], ["inbound", RECIPIENT]]);
  const replyView = thread.body.data.messages[1];
  assert.match(replyView.text, /^Received your mail\./);
  assert.match(replyView.html, /Received your mail\./);

  // 7. Opening it marks it read
  await call("get", "/messages/:id", { params: { id: replyView.id } });
  assert.equal((await call("get", "/summary")).body.data.counts.inboxUnread, 0);

  // 8. Answering from ReadyTech continues the same Gmail thread
  r = await call("post", "/send", { body: { to: RECIPIENT, subject: "Re: Quotation from ReadyTech", html: "<p>Thank you!</p>", replyTo: replyView.id, mode: "reply" } });
  assert.equal(r.statusCode, 200, r.body?.message);
  assert.equal(gmailState.sentRaw[1].threadId, "thr-777");
  assert.match(gmailState.sentRaw[1].raw, /In-Reply-To: <CAF=reply1@mail\.gmail\.com>/);
  assert.equal(r.body.data.threadKey, sent.threadKey);

  // 9. Isolation: the other workspace sees none of it and its mailbox token was never used
  const otherInbox = await call("get", "/messages", { ws: OTHER_WS, query: { folder: "inbox" } });
  assert.equal(otherInbox.body.data.total, 0);
  const otherThread = await call("get", "/conversations/:threadKey", { ws: OTHER_WS, params: { threadKey: sent.threadKey } });
  assert.equal(otherThread.statusCode, 404);
  assert.ok(calls.filter((c) => c.auth).every((c) => c.auth === "Bearer AT-WS" || c.auth === "Bearer AT-OTHER"));
  assert.ok(messages.every((m) => m.workspace === WS));
});
