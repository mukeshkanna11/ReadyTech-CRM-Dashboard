// DB-free tests for inbox sync beyond Gmail replies: CRM-contact matching,
// Outlook / Microsoft 365 (Graph), Zoho Mail, custom-domain IMAP, presets,
// token refresh scope and workspace isolation.
// Run: node --test tests/mailInboxSync.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.MICROSOFT_CLIENT_ID = "mid";
process.env.MICROSOFT_CLIENT_SECRET = "msecret";
process.env.MICROSOFT_OAUTH_REDIRECT_URI = "http://api/email/oauth/microsoft/callback";
process.env.ZOHO_CLIENT_ID = "zid";
process.env.ZOHO_CLIENT_SECRET = "zsecret";
process.env.ZOHO_OAUTH_REDIRECT_URI = "http://api/email/oauth/zoho/callback";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";
delete process.env.GMAIL_INBOX_SYNC_ENABLED;

const { default: dnsPromises } = await import("node:dns/promises");
const { memModel } = await import("./helpers/memMongo.js");
const oauth = await import("../services/emailOAuth.service.js");
const smtp = await import("../services/mail/smtp.service.js");
const sync = await import("../services/mail/gmailSync.service.js");
const mb = await import("../services/mail/mailbox.service.js");
const { default: router } = await import("../routes/email.routes.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailAttachment } = await import("../models/EmailAttachment.js");
const { default: EmailSyncState } = await import("../models/EmailSyncState.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: Client } = await import("../models/Client.js");
const { default: Vendor } = await import("../models/Vendor.model.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const ADMIN_A = "64b0000000000000000000c3";
const OWNER_A = "64b0000000000000000000c7";
const LEAD_A = "64b0000000000000000000d1";
const LEAD_B = "64b0000000000000000000d2";
const MS_A = "64b0000000000000000000e1";
const MS_B = "64b0000000000000000000e2";
const ZO_A = "64b0000000000000000000e3";
const IM_A = "64b0000000000000000000e4";
const MS_NOREAD = "64b0000000000000000000e5";
const ctxA = { workspaceId: WS_A, userId: ADMIN_A, isAdmin: true };

let conns, messages, files, states, leads, calls;
const on = () => { process.env.MAIL_INBOX_SYNC_ENABLED = "true"; };
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });

const oconn = (id, ws, provider, email, token, scope, extra = {}) => ({
  _id: id, workspace: ws, provider, email, isDefault: true, status: "connected", scope, connectedBy: ADMIN_A,
  accessToken: oauth.encrypt(token), refreshToken: oauth.encrypt(`R-${token}`), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date(), ...extra,
});
const MS_SCOPE = "openid email offline_access User.Read Mail.Send Mail.Read";
const ZO_SCOPE = "ZohoMail.messages.CREATE,ZohoMail.accounts.READ,ZohoMail.messages.READ,ZohoMail.folders.READ";

/* A quotation ReadyTech sent from each mailbox (reply targets) */
const sentRow = (account, email, provider) => ({
  workspace: WS_A, account, accountEmail: email, provider, direction: "outbound", status: "sent",
  from: email, to: ["buyer@acme.in"], subject: "Quote 42", text: "Quote", html: "",
  messageIdHeader: `<crm-${provider}@a.com>`, providerMessageId: null, providerThreadId: null,
  threadKey: `crmthread${provider}`, links: [{ type: "client", id: "64b0000000000000000000f1", label: "Acme Pvt" }],
  createdBy: ADMIN_A, sentAt: new Date(), read: true,
});

beforeEach(async () => {
  delete process.env.MAIL_INBOX_SYNC_ENABLED;
  calls = [];
  conns = memModel(EmailConnection, { unique: [["workspace", "provider", "email"]] });
  messages = memModel(EmailMessage, {
    unique: [["workspace", "account", "providerMessageId"], ["workspace", "clientId"]],
    defaults: { links: [], attachments: [], to: [], cc: [], bcc: [], read: false, starred: false, archived: false, trashed: false },
  });
  files = memModel(EmailAttachment);
  states = memModel(EmailSyncState, { unique: [["workspace", "account"]], defaults: { failures: 0, totalImported: 0, historyId: null, lockedUntil: null } });
  leads = memModel(Lead);
  memModel(Client);
  memModel(Vendor);
  leads.push(
    { _id: LEAD_A, workspace: WS_A, name: "Lead Person", email: "Lead.Person@Acme.in ", owner: OWNER_A },
    { _id: LEAD_B, workspace: WS_B, name: "B's lead", email: "stranger@x.com", owner: ADMIN_A },
  );
  conns.push(
    oconn(MS_A, WS_A, "microsoft", "owner@a.com", "AT-MS", MS_SCOPE),
    oconn(MS_B, WS_B, "microsoft", "owner@b.com", "AT-MSB", MS_SCOPE),
    oconn(ZO_A, WS_A, "zoho", "sales@a.com", "AT-ZO", ZO_SCOPE, { isDefault: false, providerData: { accountsServer: "https://accounts.zoho.in", mailBase: "https://mail.zoho.in", accountId: "77" } }),
  );
  await EmailMessage.create(sentRow(MS_A, "owner@a.com", "microsoft"));
  await EmailMessage.create(sentRow(ZO_A, "sales@a.com", "zoho"));
});

/* ---------------- Microsoft Graph ---------------- */
const graphMsg = (id, from, subject, conversationId, at, extra = {}) => ({
  id, conversationId, internetMessageId: `<${id}@mail>`, subject, from: { emailAddress: { name: "Sender", address: from } },
  toRecipients: [{ emailAddress: { address: "owner@a.com" } }], ccRecipients: [], receivedDateTime: at, isRead: false, hasAttachments: false, ...extra,
});
const graphMock = (inbox) => {
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    calls.push({ url: u, auth: opts.headers?.authorization });
    if (u.pathname === "/v1.0/me/mailFolders/inbox/messages") return json(200, { value: inbox });
    let m = /^\/v1\.0\/me\/messages\/([^/]+)\/attachments\/([^/]+)$/.exec(u.pathname);
    if (m) return json(200, { contentBytes: Buffer.from("PDFDATA").toString("base64") });
    m = /^\/v1\.0\/me\/messages\/([^/]+)\/attachments$/.exec(u.pathname);
    if (m) return json(200, { value: [
      { "@odata.type": "#microsoft.graph.fileAttachment", id: "a1", name: "po.pdf", contentType: "application/pdf", size: 7, isInline: false },
      { "@odata.type": "#microsoft.graph.fileAttachment", id: "a2", name: "logo.png", contentType: "image/png", size: 5, isInline: true },
    ] });
    m = /^\/v1\.0\/me\/messages\/([^/]+)$/.exec(u.pathname);
    if (m) return json(200, { body: { contentType: "html", content: `<p>Body of ${m[1]}</p><script>x()</script>` }, internetMessageHeaders: [{ name: "In-Reply-To", value: "<unknown@x>" }] });
    return json(404, { error: { code: "ErrorItemNotFound" } });
  };
};
const detailFetches = (id) => calls.filter((c) => c.url.pathname.includes(`/messages/${id}`));

test("Outlook: replies (no headers needed) and CRM-contact mail imported; other mail never downloaded; workspace token only", async () => {
  on();
  graphMock([
    graphMsg("m1", "buyer@acme.in", "RE: Quote 42", "C1", "2026-11-10T10:00:00Z"),
    graphMsg("m2", "lead.person@acme.in", "New enquiry", "C2", "2026-11-10T11:00:00Z", { hasAttachments: true }),
    graphMsg("m3", "news@shop.com", "Big sale", "C3", "2026-11-10T12:00:00Z"),
    graphMsg("m4", "stranger@x.com", "Hello", "C4", "2026-11-10T13:00:00Z"), // a Lead of workspace B only
  ]);
  assert.deepEqual(await sync.syncAccount(WS_A, MS_A), { status: "ok", imported: 2 });

  const reply = messages.find((m) => m.providerMessageId === "m1");
  assert.equal(reply.threadKey, "crmthreadmicrosoft", "joins the ReadyTech conversation");
  assert.equal(reply.direction, "inbound");
  assert.equal(reply.provider, "microsoft");
  assert.doesNotMatch(reply.html, /script/);
  assert.equal(reply.providerThreadId, "C1");

  const enquiry = messages.find((m) => m.providerMessageId === "m2");
  assert.deepEqual(enquiry.links.map((l) => [l.type, String(l.id)]), [["lead", LEAD_A]]);
  assert.equal(String(enquiry.createdBy), OWNER_A, "the lead owner sees it");
  assert.deepEqual(enquiry.attachments.map((a) => a.filename), ["po.pdf"]);
  assert.equal(files.length, 1);

  assert.equal(detailFetches("m3").length, 0, "unrelated mail is never downloaded");
  assert.equal(detailFetches("m4").length, 0, "another workspace's lead never matches");
  assert.ok(calls.every((c) => c.auth === "Bearer AT-MS"));
  const list = calls.find((c) => c.url.pathname.endsWith("/inbox/messages"));
  assert.match(list.url.searchParams.get("$filter"), /^receivedDateTime ge /);
  assert.equal(list.url.searchParams.get("$orderby"), "receivedDateTime asc");
  assert.equal(states[0].historyId, "2026-11-10T13:00:00Z");
  assert.equal(states[0].provider, "microsoft");

  // Same page again: nothing duplicated, nothing re-downloaded
  calls = [];
  assert.deepEqual(await sync.syncAccount(WS_A, MS_A), { status: "ok", imported: 0 });
  assert.equal(calls.filter((c) => /\/messages\/m\d/.test(c.url.pathname)).length, 0);
  assert.equal(messages.filter((m) => m.direction === "inbound").length, 2);

  // A colleague answers in the lead's conversation: same provider thread → same CRM conversation
  graphMock([graphMsg("m5", "colleague@acme.in", "Re: New enquiry", "C2", "2026-11-10T14:00:00Z")]);
  assert.equal((await sync.syncAccount(WS_A, MS_A)).imported, 1);
  assert.equal(messages.find((m) => m.providerMessageId === "m5").threadKey, enquiry.threadKey);
});

test("Outlook isolation: workspace B syncs its own mailbox with its own token into its own workspace", async () => {
  on();
  graphMock([graphMsg("b1", "stranger@x.com", "Hello", "CB", "2026-11-10T10:00:00Z")]);
  assert.equal((await sync.syncAccount(WS_B, MS_B)).imported, 1);
  const row = messages.find((m) => m.providerMessageId === "b1");
  assert.equal(String(row.workspace), WS_B);
  assert.deepEqual(row.links.map((l) => String(l.id)), [LEAD_B]);
  assert.ok(calls.every((c) => c.auth === "Bearer AT-MSB"));
  // Workspace A can't run workspace B's mailbox
  assert.equal((await sync.syncAccount(WS_A, MS_B)).status, "gone");
});

test("Outlook: a mailbox without Mail.Read is never read; summary offers Enable inbox sync", async () => {
  on();
  conns.push(oconn(MS_NOREAD, WS_A, "microsoft", "ops@a.com", "AT-NR", "openid email offline_access User.Read Mail.Send", { isDefault: false }));
  graphMock([]);
  assert.equal((await sync.syncAccount(WS_A, MS_NOREAD)).status, "needs_permission");
  assert.equal(calls.length, 0);
  const s = await mb.summary(ctxA);
  const cap = s.capabilities.find((c) => c.accountId === MS_NOREAD);
  assert.equal(cap.inbox, false);
  assert.equal(cap.sync.canEnable, true);
  assert.equal(s.capabilities.find((c) => c.accountId === MS_A).inbox, true);
});

test("Microsoft: Enable inbox sync asks only for Mail.Read; refresh keeps Mail.Read", async () => {
  on();
  const handler = router.stack.find((l) => l.route?.path === "/oauth/:provider/url" && l.route.methods.get).route.stack.at(-1).handle;
  const r = { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  handler({ params: { provider: "microsoft" }, query: { inbox: "1" }, user: { _id: ADMIN_A, role: "admin" }, workspace: WS_A, get: () => undefined }, r);
  assert.equal(new URL(r.body.data.url).searchParams.get("scope"), "openid email offline_access User.Read Mail.Send Mail.Read");

  assert.equal(oauth.msHasRead("https://graph.microsoft.com/Mail.Read User.Read"), true);
  assert.equal(oauth.msHasRead("Mail.ReadBasic Mail.Send"), false);

  // Expired token: the refresh request keeps Mail.Read (otherwise inbox sync would silently lose access)
  const row = conns.find((c) => c._id === MS_A);
  row.expiresAt = new Date(Date.now() - 1000);
  const findOne = EmailConnection.findOne;
  EmailConnection.findOne = (f) => ({ select: async () => (findOne(f).then((d) => d && Object.assign(d, { save: async () => d }))) });
  let body;
  global.fetch = async (url, opts) => { body = new URLSearchParams(String(opts.body)); return json(200, { access_token: "NEW", expires_in: 3600 }); };
  try {
    const got = await oauth.getAccessToken(WS_A, MS_A);
    assert.equal(got.token, "NEW");
    assert.equal(body.get("scope"), "openid email offline_access User.Read Mail.Send Mail.Read");
  } finally {
    EmailConnection.findOne = findOne;
  }
});

/* ---------------- Zoho Mail ---------------- */
test("Zoho: Inbox folder, newest-first paging to the cursor; matched mail imported with headers; others never opened", async () => {
  on();
  const now = Date.now();
  const list = [
    { messageId: "z3", folderId: "9", threadId: "T3", subject: "Weekly digest", fromAddress: "news@shop.com", sender: "Shop", toAddress: "&lt;sales@a.com&gt;", receivedTime: String(now - 1000) },
    { messageId: "z2", folderId: "9", threadId: "T2", subject: "Re: Quote 42", fromAddress: "buyer@acme.in", sender: "Buyer", toAddress: "&lt;sales@a.com&gt;", ccAddress: "", receivedTime: String(now - 2000) },
    { messageId: "z1", folderId: "9", threadId: "T1", subject: "Hi", fromAddress: "lead.person@acme.in", sender: "Lead", toAddress: "&lt;sales@a.com&gt;", receivedTime: String(now - 30 * 864e5) }, // older than the first-sync window
  ];
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    calls.push({ url: u, auth: opts.headers?.authorization });
    const p = u.pathname.replace("/api/accounts/77/", "");
    if (p === "folders") return json(200, { status: { code: 200 }, data: [{ folderId: "1", folderType: "Sent" }, { folderId: "9", folderType: "Inbox" }] });
    if (p === "messages/view") return json(200, { status: { code: 200 }, data: list });
    if (p === "folders/9/messages/z2/content") return json(200, { status: { code: 200 }, data: { content: "<div>Accepted</div>" } });
    if (p === "folders/9/messages/z2/header") return json(200, { status: { code: 200 }, data: { headerContent: { "Message-Id": ["<z2@acme.in>"], "In-Reply-To": ["<crm-zoho@a.com>"] } } });
    return json(404, { status: { code: 404 }, data: { errorCode: "NOT_FOUND" } });
  };
  assert.deepEqual(await sync.syncAccount(WS_A, ZO_A), { status: "ok", imported: 1 });
  const row = messages.find((m) => m.providerMessageId === "z2");
  assert.equal(row.threadKey, "crmthreadzoho");
  assert.equal(row.messageIdHeader, "<z2@acme.in>");
  assert.equal(row.inReplyTo, "<crm-zoho@a.com>");
  assert.match(row.html, /Accepted/);
  assert.deepEqual(row.to, ["sales@a.com"]);
  const view = calls.find((c) => c.url.pathname.endsWith("/messages/view"));
  assert.equal(view.url.searchParams.get("folderId"), "9");
  assert.equal(calls.filter((c) => /z3|z1/.test(c.url.pathname)).length, 0, "unmatched / out-of-window mail never opened");
  assert.ok(calls.every((c) => c.auth === "Zoho-oauthtoken AT-ZO"));
  assert.ok(calls.every((c) => c.url.origin === "https://mail.zoho.in"));
  assert.equal(states[0].historyId, String(now - 1000));
});

/* ---------------- Custom domain: SMTP + IMAP ---------------- */
let imapClients;
const SRC = {
  10: ["From: Buyer <buyer@acme.in>", "To: info@acme.in", "Subject: Re: Quote", "Message-ID: <r10@acme.in>", "In-Reply-To: <crm-smtp@a.com>", "References: <crm-smtp@a.com>", "Content-Type: text/plain; charset=utf-8", "", "Accepted, thanks"].join("\r\n"),
  12: [
    "From: Lead <lead.person@acme.in>", "To: info@acme.in", "Subject: Need pricing", "Message-ID: <r12@acme.in>", "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="b1"', "", "--b1", "Content-Type: text/html; charset=utf-8", "", "<p>Please send <b>pricing</b></p>",
    "--b1", 'Content-Type: application/pdf; name="rfq.pdf"', 'Content-Disposition: attachment; filename="rfq.pdf"', "Content-Transfer-Encoding: base64", "",
    Buffer.from("RFQDATA").toString("base64"), "--b1--", "",
  ].join("\r\n"),
};
const ENVELOPES = {
  10: { from: [{ address: "buyer@acme.in" }], subject: "Re: Quote", messageId: "<r10@acme.in>", inReplyTo: "<crm-smtp@a.com>", refs: "<crm-smtp@a.com>" },
  11: { from: [{ address: "news@shop.com" }], subject: "Newsletter", messageId: "<n11@shop.com>" },
  12: { from: [{ address: "lead.person@acme.in" }], subject: "Need pricing", messageId: "<r12@acme.in>" },
};
const fakeImap = ({ authFail = false, uids = [10, 11, 12] } = {}) => (opts) => {
  const client = {
    opts, locks: [], searches: [], fetchedSources: [], loggedOut: false, mailbox: { uidValidity: 7n },
    on() {},
    async connect() { if (authFail) throw Object.assign(new Error("Command failed"), { authenticationFailed: true }); },
    async getMailboxLock(path, o) { client.locks.push([path, o]); return { release() {} }; },
    async search(q) { client.searches.push(q); return q.uid ? uids.filter((u) => u >= Number(String(q.uid).split(":")[0])).concat(uids.slice(-1)) : uids; },
    async *fetch(range) {
      for (const uid of String(range).split(",").map(Number)) {
        const e = ENVELOPES[uid];
        yield { uid, size: 1000, flags: new Set(), envelope: e, headers: Buffer.from(e.refs ? `References: ${e.refs}\r\n` : "") };
      }
    },
    async fetchOne(uid) { client.fetchedSources.push(Number(uid)); return { source: Buffer.from(SRC[uid]) }; },
    async logout() { client.loggedOut = true; },
  };
  imapClients.push(client);
  return client;
};
const SMTP_BODY = {
  email: "info@acme.in", displayName: "Acme", host: "smtp.hostinger.com", security: "ssl", port: 465, username: "info@acme.in", password: "p@ss",
  imap: { enabled: true, host: "imap.hostinger.com", security: "ssl", port: 993 },
};
const hooks = ({ ip = "203.0.114.10", authFail = false } = {}) => {
  imapClients = [];
  smtp.__setSmtpTestHooks({
    lookup: async () => [{ address: ip }],
    createTransport: () => ({ verify: async () => true, close() {} }),
    createImapClient: fakeImap({ authFail }),
  });
};

test("SMTP + IMAP setup: IMAP login verified on the pinned public IP with TLS hostname; settings stored; password stays secret", async () => {
  hooks();
  const acc = await oauth.saveSmtpAccount(WS_A, ADMIN_A, SMTP_BODY);
  assert.deepEqual(acc.imap, { enabled: true, host: "imap.hostinger.com", port: 993, security: "ssl" });
  assert.doesNotMatch(JSON.stringify(acc), /p@ss|smtpPassword/);
  const o = imapClients[0].opts;
  assert.deepEqual([o.host, o.port, o.secure, o.servername, o.tls.servername, o.tls.rejectUnauthorized, o.auth.user], ["203.0.114.10", 993, true, "imap.hostinger.com", "imap.hostinger.com", true, "info@acme.in"]);
  assert.ok(imapClients[0].loggedOut);
  const row = conns.find((c) => c.provider === "smtp");
  assert.notEqual(row.smtpPassword, "p@ss");

  // Updating without `imap` keeps the IMAP settings
  await oauth.saveSmtpAccount(WS_A, ADMIN_A, { ...SMTP_BODY, imap: undefined, password: "" }, row._id);
  assert.equal(conns.find((c) => c.provider === "smtp").imap.enabled, true);
});

test("SMTP + IMAP setup: private IMAP host, bad port and wrong password are refused; nothing stored", async () => {
  hooks({ ip: "10.0.0.5" });
  await assert.rejects(oauth.saveSmtpAccount(WS_A, ADMIN_A, SMTP_BODY), (e) => e.status === 422);
  hooks();
  await assert.rejects(oauth.saveSmtpAccount(WS_A, ADMIN_A, { ...SMTP_BODY, imap: { ...SMTP_BODY.imap, port: 143 } }), /IMAP over SSL uses port 993/);
  hooks({ authFail: true });
  await assert.rejects(oauth.saveSmtpAccount(WS_A, ADMIN_A, SMTP_BODY), (e) => e.authFailed && /IMAP server rejected/.test(e.message));
  assert.equal(conns.filter((c) => c.provider === "smtp").length, 0);
});

test("IMAP sync: read-only INBOX; reply joins the CRM thread via In-Reply-To; contact mail with attachment; others never downloaded; cursor", async () => {
  on();
  hooks();
  await oauth.saveSmtpAccount(WS_A, ADMIN_A, SMTP_BODY);
  const acc = conns.find((c) => c.provider === "smtp");
  await EmailMessage.create(sentRow(acc._id, "info@acme.in", "smtp"));
  imapClients = [];

  assert.deepEqual(await sync.syncAccount(WS_A, acc._id), { status: "ok", imported: 2 });
  const c = imapClients[0];
  assert.deepEqual(c.locks, [["INBOX", { readOnly: true }]]);
  assert.deepEqual(c.fetchedSources, [10, 12], "the newsletter (uid 11) is never downloaded");
  assert.ok(c.loggedOut);

  const reply = messages.find((m) => m.providerMessageId === "7:10");
  assert.equal(reply.threadKey, "crmthreadsmtp");
  assert.equal(reply.providerThreadId, "<crm-smtp@a.com>");
  assert.match(reply.text, /Accepted/);
  const lead = messages.find((m) => m.providerMessageId === "7:12");
  assert.deepEqual(lead.links.map((l) => String(l.id)), [LEAD_A]);
  assert.match(lead.html, /pricing/);
  assert.deepEqual(lead.attachments.map((a) => a.filename), ["rfq.pdf"]);
  assert.equal(states.find((s) => String(s.account) === String(acc._id)).historyId, "7:12");

  // Next run asks only for newer UIDs (servers return the last one for "N:*") → nothing new
  imapClients = [];
  assert.deepEqual(await sync.syncAccount(WS_A, acc._id), { status: "ok", imported: 0 });
  assert.deepEqual(imapClients[0].searches, [{ uid: "13:*" }]);
  assert.deepEqual(imapClients[0].fetchedSources, []);
});

test("IMAP status: SMTP without IMAP offers to add it; worker only picks readable mailboxes of every provider", async () => {
  on();
  hooks();
  await oauth.saveSmtpAccount(WS_A, ADMIN_A, { ...SMTP_BODY, imap: { enabled: false } });
  const st = await sync.inboxStatus(WS_A);
  const smtpAcc = conns.find((c) => c.provider === "smtp");
  assert.deepEqual([st.accounts[smtpAcc._id].access, st.accounts[smtpAcc._id].canEnable], [false, true]);
  assert.equal(st.accounts[MS_A].access, true);
  assert.equal(st.accounts[ZO_A].access, true);

  global.fetch = async (url) => (String(url).includes("zoho") ? json(200, { status: { code: 200 }, data: [{ folderId: "9", folderType: "Inbox" }] }) : json(200, { value: [] }));
  assert.equal(await sync.runSyncTick(), 3, "two Outlook mailboxes (A, B) + Zoho; SMTP without IMAP skipped");
});

/* ---------------- Detection ---------------- */
test("custom-domain detection suggests SMTP + IMAP for Hostinger, GoDaddy, Titan and cPanel", async () => {
  const orig = dnsPromises.resolveMx;
  const mx = { "a.in": "mx1.hostinger.com", "b.in": "smtp.secureserver.net", "c.in": "mx1.titan.email", "d.in": "mail.d.in" };
  dnsPromises.resolveMx = async (d) => [{ exchange: mx[d], priority: 10 }];
  try {
    assert.deepEqual(await oauth.detectMailSettings("sales@a.in"), { preset: "hostinger", label: "Hostinger", smtp: { host: "smtp.hostinger.com", port: 465, security: "ssl" }, imap: { host: "imap.hostinger.com", port: 993, security: "ssl" } });
    assert.equal((await oauth.detectMailSettings("x@b.in")).imap.host, "imap.secureserver.net");
    assert.equal((await oauth.detectMailSettings("x@c.in")).smtp.host, "smtp.titan.email");
    const cp = await oauth.detectMailSettings("x@d.in");
    assert.deepEqual([cp.preset, cp.smtp.host, cp.imap.host], ["cpanel", "mail.d.in", "mail.d.in"]);
    assert.equal(await oauth.detectMailSettings("not-an-email"), null);
  } finally {
    dnsPromises.resolveMx = orig;
  }
});

test("flag OFF: no provider is synced and no mailbox is contacted", async () => {
  graphMock([graphMsg("m1", "buyer@acme.in", "RE: Quote 42", "C1", "2026-11-10T10:00:00Z")]);
  assert.deepEqual(await sync.syncAccount(WS_A, MS_A), { status: "disabled" });
  assert.equal(await sync.runSyncTick(), 0);
  assert.equal(calls.length, 0);
});
