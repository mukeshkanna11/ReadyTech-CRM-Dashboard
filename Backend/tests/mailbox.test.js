// DB-free tests for the Mail workspace (compose / drafts / threads / links /
// attachments) and the rich send path of emailOAuth.service.
// Run: node --test tests/mailbox.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://api/email/oauth/google/callback";

const { default: mongoose } = await import("mongoose");
const oauth = await import("../services/emailOAuth.service.js");
const smtp = await import("../services/mail/smtp.service.js");
const mb = await import("../services/mail/mailbox.service.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: EmailMessage } = await import("../models/EmailMessage.js");
const { default: EmailAttachment } = await import("../models/EmailAttachment.js");
const { default: Client } = await import("../models/Client.js");
const { default: Lead } = await import("../models/Lead.js");

const WS_A = "64b0000000000000000000a1";
const WS_B = "64b0000000000000000000b2";
const ADMIN_A = "64b0000000000000000000c3";
const MEMBER_A = "64b0000000000000000000c4";
const ADMIN_B = "64b0000000000000000000c5";
const ACC_A = "64b0000000000000000000e1";
const ACC_B = "64b0000000000000000000e2";
const CLIENT_A = "64b0000000000000000000d4";

const ctxA = { workspaceId: WS_A, userId: ADMIN_A, isAdmin: true };
const memberA = { workspaceId: WS_A, userId: MEMBER_A, isAdmin: false };
const ctxB = { workspaceId: WS_B, userId: ADMIN_B, isAdmin: true };

/* ---------------- tiny in-memory Mongo ---------------- */
const str = (v) => (v == null ? v : typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && v.toString ? String(v) : v);
const get = (doc, path) => path.split(".").reduce((vals, key) => vals.flatMap((v) => {
  if (v == null) return [undefined];
  if (Array.isArray(v)) return /^\d+$/.test(key) ? [v[key]] : v.map((x) => x?.[key]);
  return [v[key]];
}), [doc]);
const eq = (a, b) => (Array.isArray(a) ? a.some((x) => eq(x, b)) : String(str(a)) === String(str(b)) && !(a == null) === !(b == null)) || (a == null && b == null);
const cond = (vals, c) => {
  if (c instanceof RegExp) return vals.some((v) => (Array.isArray(v) ? v : [v]).some((x) => c.test(String(x ?? ""))));
  if (c && typeof c === "object" && !(c instanceof mongoose.Types.ObjectId) && !(c instanceof Date) && Object.keys(c).some((k) => k.startsWith("$"))) {
    return Object.entries(c).every(([op, arg]) => {
      if (op === "$in") return arg.some((x) => vals.some((v) => eq(v, x)));
      if (op === "$nin") return !arg.some((x) => vals.some((v) => eq(v, x)));
      if (op === "$ne") return !vals.some((v) => eq(v, arg));
      if (op === "$exists") return vals.some((v) => v !== undefined) === arg;
      if (op === "$type") return vals.some((v) => typeof v === arg);
      if (op === "$regex") return vals.some((v) => (Array.isArray(v) ? v : [v]).some((x) => new RegExp(arg, c.$options || "").test(String(x ?? ""))));
      if (op === "$options") return true;
      if (op === "$elemMatch") return vals.some((v) => Array.isArray(v) && v.some((el) => match(el, arg)));
      throw new Error(`unsupported ${op}`);
    });
  }
  return vals.some((v) => eq(v, c));
};
const match = (doc, f = {}) => Object.entries(f).every(([k, c]) => {
  if (k === "$or") return c.some((x) => match(doc, x));
  if (k === "$and") return c.every((x) => match(doc, x));
  return cond(get(doc, k), c);
});
const clone = (d) => {
  if (d == null || typeof d !== "object" || d instanceof mongoose.Types.ObjectId || d instanceof Date || Buffer.isBuffer(d)) return d;
  if (Array.isArray(d)) return d.map(clone);
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, clone(v)]));
};
const chain = (result) => {
  const p = { select: () => p, sort: () => p, skip: () => p, limit: () => p, lean: () => p, then: (a, b) => Promise.resolve(typeof result === "function" ? result() : result).then(a, b) };
  return p;
};
const memModel = (Model) => {
  const rows = [];
  let n = 0;
  const id = () => new mongoose.Types.ObjectId(`64c${String(++n).padStart(21, "0")}`);
  const norm = (d) => {
    const o = { ...d };
    for (const k of ["workspace", "createdBy", "account", "replyToMessage"]) if (o[k] != null) o[k] = String(o[k]);
    return o;
  };
  const view = (d) => clone(d);
  Model.find = (f) => chain(() => rows.filter((r) => match(r, f)).map(view));
  Model.findOne = (f) => chain(() => { const r = rows.find((x) => match(x, f)); return r ? view(r) : null; });
  Model.countDocuments = async (f) => rows.filter((r) => match(r, f)).length;
  Model.create = async (d) => {
    const r = norm({ read: false, starred: false, archived: false, trashed: false, links: [], attachments: [], to: [], cc: [], bcc: [], ...d, _id: id(), createdAt: new Date(), updatedAt: new Date() });
    rows.push(r);
    const out = view(r);
    out.toObject = () => view(r);
    return out;
  };
  Model.updateOne = async (f, u) => {
    const r = rows.find((x) => match(x, f));
    if (r) Object.assign(r, norm(u.$set || {}), { updatedAt: new Date() });
    return { matchedCount: r ? 1 : 0 };
  };
  Model.findOneAndUpdate = (f, u) => chain(() => {
    const r = rows.find((x) => match(x, f));
    if (!r) return null;
    Object.assign(r, norm(u.$set || {}), { updatedAt: new Date() });
    return view(r);
  });
  Model.deleteOne = async (f) => { const i = rows.findIndex((x) => match(x, f)); if (i >= 0) rows.splice(i, 1); };
  Model.deleteMany = async (f) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], f)) rows.splice(i, 1); };
  Model.distinct = async (path, f) => [...new Set(rows.filter((r) => match(r, f)).flatMap((r) => get(r, path)).filter(Boolean).map(String))];
  return rows;
};

let messages, files, conns, calls, clients;
const json = (status, body) => ({ ok: status < 300, status, statusText: "x", json: async () => body });
const mockFetch = (routes) => {
  calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts });
    const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
    return hit ? hit[1](opts) : json(404, {});
  };
};
const gmailOk = (id = "gm1", threadId = "th1") => mockFetch({ "messages/send": () => json(200, { id, threadId }) });

beforeEach(() => {
  calls = [];
  messages = memModel(EmailMessage);
  files = memModel(EmailAttachment);
  conns = [
    { _id: ACC_A, workspace: WS_A, provider: "google", email: "owner@a.com", isDefault: true, status: "connected",
      accessToken: oauth.encrypt("AT-A"), refreshToken: oauth.encrypt("RT-A"), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date() },
    { _id: ACC_B, workspace: WS_B, provider: "google", email: "owner@b.com", isDefault: true, status: "connected",
      accessToken: oauth.encrypt("AT-B"), refreshToken: oauth.encrypt("RT-B"), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date() },
  ];
  const connChain = (rows) => ({ select: () => connChain(rows), sort: () => connChain(rows), lean: () => connChain(rows), then: (a, b) => Promise.resolve(rows).then(a, b) });
  EmailConnection.find = (f) => connChain(conns.filter((c) => String(c.workspace) === String(f.workspace)).map((c) => ({ ...c })));
  EmailConnection.findOne = (f) => connChain(conns.find((c) => String(c.workspace) === String(f.workspace) && String(c._id) === String(f._id)) || null);
  EmailConnection.updateOne = async () => ({});
  clients = [{ _id: new mongoose.Types.ObjectId(CLIENT_A), workspace: WS_A, companyName: "Acme Pvt", email: "buyer@acme.in" }];
  Client.findOne = (f) => chain(() => clients.find((c) => match(c, f)) || null);
  Lead.findOne = () => chain(null);
});

/* ================= Input validation ================= */
test("addresses: names, separators, dedupe; invalid input is rejected", () => {
  assert.deepEqual(mb.parseAddresses("A <A@x.com>; b@y.io,\na@x.com", "To"), ["a@x.com", "b@y.io"]);
  assert.throws(() => mb.parseAddresses("not-an-email", "Cc"), (e) => e.status === 422 && /Cc/.test(e.message));
  assert.throws(() => mb.parseAddresses("a@x.com\r\nBcc: evil@x.com", "To"), (e) => e.status === 422);
});

test("HTML sanitiser strips scripts, handlers and script URLs but keeps normal content", () => {
  const out = mb.sanitizeHtml(`<p onclick="x()">Hi <b>there</b></p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="database.html">db</a><img src="data:image/png;base64,AAAA" onerror=alert(1)><iframe src="//e"></iframe>`);
  assert.doesNotMatch(out, /script|onclick|onerror|iframe|javascript:/i);
  assert.match(out, /<b>there<\/b>/);
  assert.match(out, /href="database.html"/);
  assert.match(out, /data:image\/png/);
  assert.equal(mb.htmlToText("<p>Hello&nbsp;<b>you</b></p><ul><li>one</li></ul>"), "Hello you\n• one");
});

test("attachments: executable types, bad base64, oversize and path tricks are refused", () => {
  const ok = mb.decodeUploads([{ filename: "../../etc/report.pdf", contentType: "application/pdf", data: Buffer.from("pdf").toString("base64") }]);
  assert.equal(ok[0].filename, "report.pdf");
  assert.equal(ok[0].content.toString(), "pdf");
  assert.equal(mb.decodeUploads([{ filename: "a.txt", contentType: "bad type\r\n", data: "YQ==" }])[0].contentType, "application/octet-stream");
  assert.throws(() => mb.decodeUploads([{ filename: "setup.EXE", data: "YQ==" }]), /blocked/);
  assert.throws(() => mb.decodeUploads([{ filename: "a.txt", data: "@@@" }]), /couldn't be read/);
  const big = Buffer.alloc(mb.LIMITS.fileBytes + 1).toString("base64");
  assert.throws(() => mb.decodeUploads([{ filename: "big.bin", data: big }]), /larger than/);
});

/* ================= MIME ================= */
test("MIME: cc/bcc, threading headers, html alternative and attachments; no header injection", () => {
  const mime = oauth.buildMime({
    from: "me@a.com", to: "x@y.com\r\nBcc: evil@e.com", cc: "c@y.com", bcc: "b@y.com", subject: "Héllo",
    text: "plain", html: "<p>rich</p>", messageId: "<m1@a.com>", inReplyTo: "<p0@a.com>", references: "<p0@a.com>",
    attachments: [{ filename: "naïve.pdf", contentType: "application/pdf", content: Buffer.from("PDFDATA") }],
  });
  const head = mime.split("\r\n\r\n")[0];
  assert.doesNotMatch(head, /^Bcc: evil/m);
  assert.match(head, /^Cc: c@y.com$/m);
  assert.match(head, /^Bcc: b@y.com$/m);
  assert.match(head, /^In-Reply-To: <p0@a.com>$/m);
  assert.match(head, /^Message-ID: <m1@a.com>$/m);
  assert.match(mime, /multipart\/mixed/);
  assert.match(mime, /multipart\/alternative/);
  assert.match(mime, /filename\*=UTF-8''na%C3%AFve\.pdf/);
  assert.ok(mime.includes(Buffer.from("PDFDATA").toString("base64")));
});

/* ================= Send ================= */
test("send: default mailbox of the same workspace, recorded as sent with provider ids", async () => {
  gmailOk("gm1", "th1");
  const { message } = await mb.sendMessage(ctxA, { to: "Buyer <buyer@acme.in>", cc: "boss@acme.in", subject: "Quote", html: "<p>Hello <b>Acme</b></p>", clientId: "client-0001" });
  assert.equal(message.status, "sent");
  assert.equal(message.from, "owner@a.com");
  assert.deepEqual(message.to, ["buyer@acme.in"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /gmail\/v1\/users\/me\/messages\/send$/);
  assert.equal(calls[0].opts.headers.authorization, "Bearer AT-A");
  const stored = messages[0];
  assert.equal(stored.workspace, WS_A);
  assert.equal(stored.providerMessageId, "gm1");
  assert.equal(stored.providerThreadId, "th1");
  assert.match(stored.messageIdHeader, /^<[0-9a-f-]+@a\.com>$/);
  assert.equal(stored.text, "Hello Acme");
  assert.doesNotMatch(JSON.stringify(message), /AT-A|RT-A|accessToken/);
});

test("send: the same clientId is never sent twice (double click / retry)", async () => {
  gmailOk();
  const body = { to: "x@y.com", subject: "Once", html: "<p>1</p>", clientId: "dup-key-123" };
  const first = await mb.sendMessage(ctxA, body);
  const second = await mb.sendMessage(ctxA, body);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(calls.length, 1);
  assert.equal(messages.length, 1);
});

test("send: reply stays in the Gmail thread with In-Reply-To / References; forward starts a new one", async () => {
  gmailOk("gm1", "th-original");
  const { message: first } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "Proposal", html: "<p>v1</p>" });
  gmailOk("gm2", "th-original");
  const { message: reply } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "Proposal", html: "<p>follow up</p>", replyTo: first.id, mode: "reply" });
  assert.equal(reply.subject, "Re: Proposal");
  assert.equal(reply.threadKey, first.threadKey);
  const sentBody = JSON.parse(calls[0].opts.body);
  assert.equal(sentBody.threadId, "th-original");
  const raw = Buffer.from(sentBody.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
  assert.match(raw, new RegExp(`In-Reply-To: ${messages[0].messageIdHeader}`));
  assert.match(raw, new RegExp(`References: ${messages[0].messageIdHeader}`));

  gmailOk("gm3", "th-new");
  const { message: fwd } = await mb.sendMessage(ctxA, { to: "z@y.com", subject: "Proposal", html: "<p>fyi</p>", replyTo: first.id, mode: "forward" });
  assert.equal(fwd.subject, "Fwd: Proposal");
  assert.notEqual(fwd.threadKey, first.threadKey);
  assert.equal(JSON.parse(calls[0].opts.body).threadId, undefined);

  const thread = await mb.getThread(ctxA, first.threadKey);
  assert.equal(thread.messages.length, 2);
  await assert.rejects(mb.getThread(ctxB, first.threadKey), (e) => e.status === 404);
});

test("send: attachments go through Gmail's upload endpoint and are downloadable only in-workspace", async () => {
  gmailOk();
  const data = Buffer.from("hello file").toString("base64");
  const { message } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "Files", html: "<p>see</p>", attachments: [{ filename: "notes.txt", contentType: "text/plain", data }] });
  assert.match(calls[0].url, /upload\/gmail\/v1\/users\/me\/messages\/send\?uploadType=multipart/);
  assert.match(calls[0].opts.headers["content-type"], /^multipart\/related; boundary=/);
  assert.ok(calls[0].opts.body.includes(data));
  const attId = message.attachments[0].id;
  const a = await mb.getAttachment(ctxA, attId);
  assert.equal(a.data.toString(), "hello file");
  await assert.rejects(mb.getAttachment(ctxB, attId), (e) => e.status === 404);
  await assert.rejects(mb.getAttachment(memberA, attId), (e) => e.status === 404); // not their message
});

test("send: provider failure keeps an editable failed draft with a safe message", async () => {
  mockFetch({ "messages/send": () => json(500, { error: { message: "backend secret-detail" } }) });
  await assert.rejects(mb.sendMessage(ctxA, { to: "x@y.com", subject: "S", html: "<p>b</p>", clientId: "retry-key-1" }), (e) => {
    assert.equal(e.status, 502);
    assert.doesNotMatch(e.message, /secret-detail/);
    assert.ok(e.messageId);
    return true;
  });
  assert.equal(messages[0].status, "failed");
  const drafts = await mb.listMessages(ctxA, { folder: "drafts" });
  assert.equal(drafts.total, 1);
  // Retrying the same compose (same clientId) is allowed after a failure
  gmailOk();
  const { message } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "S", html: "<p>b</p>", clientId: "retry-key-1", draftId: messages[0]._id.toString() });
  assert.equal(message.status, "sent");
  assert.equal(messages.length, 1);
});

test("send: Zoho attachments are refused up front; no mailbox → 409 (no shared-sender fallback)", async () => {
  conns[0].provider = "zoho";
  conns[0].providerData = { mailBase: "https://mail.zoho.com", accountId: "1" };
  await assert.rejects(mb.sendMessage(ctxA, { to: "x@y.com", subject: "S", attachments: [{ filename: "a.txt", data: "YQ==" }] }), /Attachments aren't supported/);
  assert.equal(calls.length, 0);
  conns = conns.filter((c) => c.workspace !== WS_A);
  await assert.rejects(mb.sendMessage(ctxA, { to: "x@y.com", subject: "S" }), (e) => e.status === 409);
});

/* ================= Isolation + access ================= */
test("isolation: other workspaces and other members never see or change a message", async () => {
  gmailOk();
  const { message } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "Private", html: "<p>p</p>" });
  assert.equal((await mb.listMessages(ctxB, { folder: "sent" })).total, 0);
  assert.equal((await mb.listMessages(memberA, { folder: "sent" })).total, 0);
  assert.equal((await mb.listMessages(ctxA, { folder: "sent" })).total, 1);
  await assert.rejects(mb.getMessage(ctxB, message.id), (e) => e.status === 404);
  await assert.rejects(mb.updateFlags(ctxB, message.id, { starred: true }), (e) => e.status === 404);
  await assert.rejects(mb.deleteMessage(memberA, message.id), (e) => e.status === 404);
  await assert.rejects(mb.sendMessage(ctxB, { to: "x@y.com", subject: "Re", replyTo: message.id }), (e) => e.status === 404);
  // B's send uses B's own mailbox only
  gmailOk();
  await mb.sendMessage(ctxB, { to: "x@y.com", subject: "B", html: "<p>b</p>" });
  assert.equal(calls[0].opts.headers.authorization, "Bearer AT-B");
});

/* ================= Folders, drafts, links ================= */
test("drafts: save, update (attachments kept / dropped), send from draft", async () => {
  const d = await mb.saveDraft(memberA, { to: "x@y.com", subject: "Draft", html: "<p>wip</p>", attachments: [{ filename: "a.txt", data: "YQ==" }, { filename: "b.txt", data: "Yg==" }] });
  assert.equal(d.status, "draft");
  assert.equal(files.length, 2);
  const keep = d.attachments.find((a) => a.filename === "a.txt").id;
  const d2 = await mb.saveDraft(memberA, { to: "x@y.com", subject: "Draft 2", html: "<p>wip</p>", attachmentIds: [keep] }, d.id);
  assert.equal(d2.attachments.length, 1);
  assert.equal(files.length, 1); // b.txt removed
  await assert.rejects(mb.saveDraft(memberA, { attachmentIds: ["64b0000000000000000000ff"] }, d.id), /Attachment not found/);
  gmailOk();
  const { message } = await mb.sendMessage(memberA, { draftId: d.id, to: "x@y.com", subject: "Draft 2", html: "<p>done</p>", attachmentIds: [keep] });
  assert.equal(message.id, d.id);
  assert.equal((await mb.listMessages(memberA, { folder: "drafts" })).total, 0);
  assert.equal((await mb.listMessages(memberA, { folder: "sent" })).total, 1);
});

test("flags + trash: star, archive, trash then permanent delete removes orphan files", async () => {
  gmailOk();
  const { message } = await mb.sendMessage(ctxA, { to: "x@y.com", subject: "F", html: "<p>f</p>", attachments: [{ filename: "a.txt", data: "YQ==" }] });
  await mb.updateFlags(ctxA, message.id, { starred: true, archived: true, bogus: 1 });
  assert.equal((await mb.listMessages(ctxA, { folder: "starred" })).total, 1);
  assert.equal((await mb.listMessages(ctxA, { folder: "archived" })).total, 1);
  assert.deepEqual(await mb.deleteMessage(ctxA, message.id), { trashed: true, deleted: false });
  assert.equal((await mb.listMessages(ctxA, { folder: "trash" })).total, 1);
  assert.deepEqual(await mb.deleteMessage(ctxA, message.id), { trashed: false, deleted: true });
  assert.equal(messages.length, 0);
  assert.equal(files.length, 0);
});

test("links: only records of the same workspace; record history filter", async () => {
  gmailOk();
  const { message } = await mb.sendMessage(ctxA, { to: "buyer@acme.in", subject: "PO", html: "<p>x</p>", links: [{ type: "client", id: CLIENT_A }] });
  assert.deepEqual(message.links, [{ type: "client", id: CLIENT_A, label: "Acme Pvt" }]);
  const history = await mb.listMessages(ctxA, { folder: "all", link: `client:${CLIENT_A}` });
  assert.equal(history.total, 1);
  await assert.rejects(mb.sendMessage(ctxB, { to: "x@y.com", subject: "S", links: [{ type: "client", id: CLIENT_A }] }), /Linked record not found/);
  await assert.rejects(mb.setLinks(ctxA, message.id, [{ type: "user", id: CLIENT_A }]), /Linked record not found/);
  assert.equal((await mb.listMessages(ctxB, { folder: "all", link: `client:${CLIENT_A}` })).total, 0);
});

test("summary: honest capabilities — Gmail inbox is not offered without read permission", async () => {
  const s = await mb.summary(ctxA);
  assert.equal(s.defaultAccount.email, "owner@a.com");
  assert.equal(s.inbox.available, false);
  assert.match(s.inbox.reason, /gmail\.readonly/);
  assert.doesNotMatch(JSON.stringify(s), /AT-A|RT-A|accessToken|refreshToken/);
});

/* ================= SMTP rich send ================= */
test("SMTP: cc/bcc/html/attachments/threading headers are passed to Nodemailer", async () => {
  const sent = [];
  smtp.__setSmtpTestHooks({
    lookup: async () => [{ address: "203.0.114.10", family: 4 }],
    createTransport: () => ({ verify: async () => true, sendMail: async (m) => (sent.push(m), { messageId: "<s1@x>" }), close() {} }),
  });
  conns[0] = { ...conns[0], provider: "smtp", smtp: { host: "smtp.hostinger.com", port: 465, security: "ssl", username: "owner@a.com" }, smtpPassword: oauth.encrypt("pw") };
  const { message } = await mb.sendMessage(ctxA, { to: "x@y.com", bcc: "b@y.com", subject: "S", html: "<p>h</p>", attachments: [{ filename: "a.txt", data: "YQ==" }] });
  assert.equal(message.status, "sent");
  assert.equal(sent[0].bcc, "b@y.com");
  assert.equal(sent[0].html, "<p>h</p>");
  assert.equal(sent[0].attachments[0].content.toString(), "a");
  assert.match(sent[0].messageId, /@a\.com>$/);
});
