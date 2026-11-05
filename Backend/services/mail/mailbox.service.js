// services/mail/mailbox.service.js — Mail workspace: compose / send, drafts,
// conversations, flags, attachments and CRM / ERP record links. Sending always
// goes through emailOAuth.service (the workspace's own connected mailbox);
// this module only stores and organises messages.
//
// Isolation: every query carries the owning workspace explicitly. Admins see
// every message of their workspace, other members only the ones they created.
import crypto from "node:crypto";
import mongoose from "mongoose";
import EmailMessage, { EMAIL_LINK_TYPES } from "../../models/EmailMessage.js";
import EmailAttachment from "../../models/EmailAttachment.js";
import Lead from "../../models/Lead.js";
import Client from "../../models/Client.js";
import Vendor from "../../models/Vendor.model.js";
import SalesOrder from "../../models/SalesOrder.model.js";
import PurchaseOrder from "../../models/PurchaseOrder.model.js";
import { getDefaultWorkspaceId } from "../../utils/workspaceContext.js";
import { sendViaConnectedAccount, resolveSendingAccount, listAccounts } from "../emailOAuth.service.js";

/* ---------------- Limits ---------------- */
export const LIMITS = {
  recipients: 50,
  subject: 250,
  html: 512 * 1024,
  files: 10,
  fileBytes: 5 * 1024 * 1024,
  totalBytes: 7 * 1024 * 1024, // fits the 10 MB JSON body limit after base64
  pageSize: 30,
};
// Executable / script types that mail providers reject (and we never relay)
const BLOCKED_EXT = new Set([
  "ade", "adp", "apk", "app", "appx", "bat", "cab", "chm", "cmd", "com", "cpl", "dll", "dmg", "exe", "hta", "ins",
  "iso", "isp", "jar", "js", "jse", "lib", "lnk", "mde", "msc", "msi", "msix", "msp", "mst", "nsh", "pif", "ps1",
  "reg", "scr", "sct", "shb", "sys", "vb", "vbe", "vbs", "vxd", "wsc", "wsf", "wsh",
]);

/* Which providers can do what today (no over-promising in the UI) */
export const CAPABILITIES = {
  google: { send: true, attachments: true, inbox: false, inboxReason: "Reading your Gmail inbox needs an additional Google permission (gmail.readonly) that ReadyTech is getting verified. Sending, drafts and sent conversations work now." },
  microsoft: { send: true, attachments: true, inbox: false, inboxReason: "Outlook / Microsoft 365 inbox access isn't available yet." },
  zoho: { send: true, attachments: false, inbox: false, inboxReason: "Zoho Mail inbox access isn't available yet. Sending works now." },
  smtp: { send: true, attachments: true, inbox: false, inboxReason: "SMTP can only send email. Receiving needs IMAP, which isn't available yet." },
};

/* Lean Buffer fields come back as BSON Binary; never use a Buffer's pooled .buffer */
const toBuffer = (d) => (Buffer.isBuffer(d) ? d : d?._bsontype === "Binary" ? Buffer.from(d.buffer) : Buffer.from(d));
const fail = (message, status = 422) => Object.assign(new Error(message), { status });
const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------- Access scope ---------------- */
export const mailCtx = (req) => ({
  workspaceId: String(req.workspace),
  userId: String(req.user?._id),
  isAdmin: req.user?.role === "admin",
});
const scoped = (ctx, extra = {}) => ({
  workspace: ctx.workspaceId,
  ...(ctx.isAdmin ? {} : { createdBy: ctx.userId }),
  ...extra,
});

/* ---------------- Input normalisation ---------------- */
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

export const parseAddresses = (value, label) => {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[,;\n]+/);
  const out = [];
  for (const item of raw) {
    const s = String(item || "").replace(/[\r\n]+/g, " ").trim();
    if (!s) continue;
    const address = (/<([^<>]+)>\s*$/.exec(s)?.[1] || s).trim().toLowerCase();
    if (address.length > 254 || !EMAIL_RE.test(address)) throw fail(`${label}: "${s.slice(0, 80)}" isn't a valid email address`);
    if (!out.includes(address)) out.push(address);
  }
  return out;
};

/* Defence in depth only — the UI renders email HTML in a sandboxed iframe
   (no scripts, no same-origin), and recipients' mail clients sanitise too. */
export const sanitizeHtml = (html) =>
  String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|frame|frameset|applet|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|iframe|object|embed|frame|frameset|applet|form|input|button|textarea|select|option|link|meta|base|svg|math)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src|action|formaction|xlink:href)\s*=\s*("|')?\s*(javascript:|vbscript:|data:(?!image\/(png|gif|jpe?g|webp);))[^"'\s>]*\2?/gi, "")
    .replace(/expression\s*\(/gi, "");

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
export const htmlToText = (html) =>
  String(html || "")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/blockquote)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const snippetOf = (text) => String(text || "").replace(/\s+/g, " ").trim().slice(0, 180);
const cleanSubject = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, LIMITS.subject);

const cleanFilename = (name) =>
  String(name || "")
    .split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "_")
    .trim()
    .slice(0, 150) || "attachment";
const cleanType = (t) => (/^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/i.test(String(t || "")) ? String(t).toLowerCase() : "application/octet-stream");
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/* New uploads: [{ filename, contentType, data: base64 }] → validated buffers */
export const decodeUploads = (list) => {
  if (list == null) return [];
  if (!Array.isArray(list)) throw fail("Attachments must be a list");
  return list.map((a) => {
    const filename = cleanFilename(a?.filename);
    const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "";
    if (BLOCKED_EXT.has(ext)) throw fail(`"${filename}" can't be attached — executable and script files are blocked by mail providers`);
    const b64 = String(a?.data || "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (!b64 || b64.length % 4 !== 0 || !B64_RE.test(b64)) throw fail(`"${filename}" couldn't be read — please attach it again`);
    const content = Buffer.from(b64, "base64");
    if (!content.length) throw fail(`"${filename}" is empty`);
    if (content.length > LIMITS.fileBytes) throw fail(`"${filename}" is larger than ${LIMITS.fileBytes / 1024 / 1024} MB`);
    return { filename, contentType: cleanType(a?.contentType), content };
  });
};

/* ---------------- Record links (CRM + ERP) ---------------- */
const LINK_MODELS = {
  lead: { model: () => Lead, select: "name email", label: (d) => d.name || d.email, search: ["name", "email"], email: (d) => d.email },
  client: { model: () => Client, select: "companyName contactPerson email", label: (d) => d.companyName || d.contactPerson || d.email, search: ["companyName", "contactPerson", "email"], email: (d) => d.email },
  vendor: { model: () => Vendor, select: "name email", label: (d) => d.name || d.email, search: ["name", "email"], email: (d) => d.email },
  salesOrder: { model: () => SalesOrder, select: "soNumber", label: (d) => d.soNumber, search: ["soNumber"] },
  purchaseOrder: { model: () => PurchaseOrder, select: "poNumber", label: (d) => d.poNumber, search: ["poNumber"] },
};

/* Records of this workspace; the default workspace also owns pre-isolation
   records that have no workspace field (same rule as the scope plugin). */
const recordScope = (ws) =>
  String(ws) === String(getDefaultWorkspaceId() || "")
    ? { $or: [{ workspace: ws }, { workspace: null }, { workspace: { $exists: false } }] }
    : { workspace: ws };

export const validateLinks = async (ctx, links) => {
  if (links == null) return [];
  if (!Array.isArray(links) || links.length > 10) throw fail("Up to 10 linked records are allowed");
  const out = [];
  for (const l of links) {
    const cfg = LINK_MODELS[l?.type];
    if (!cfg || !EMAIL_LINK_TYPES.includes(l.type) || !isId(l.id)) throw fail("Linked record not found");
    if (out.some((o) => o.type === l.type && String(o.id) === String(l.id))) continue;
    const doc = await cfg.model().findOne({ _id: l.id, ...recordScope(ctx.workspaceId) }).select(cfg.select).lean();
    if (!doc) throw fail("Linked record not found");
    out.push({ type: l.type, id: doc._id, label: String(cfg.label(doc) || "").slice(0, 200) });
  }
  return out;
};

export const searchLinkTargets = async (ctx, type, q) => {
  const cfg = LINK_MODELS[type];
  if (!cfg) throw fail("Unknown record type");
  const term = String(q || "").trim().slice(0, 80);
  const filter = { ...recordScope(ctx.workspaceId) };
  if (term) filter.$and = [{ $or: cfg.search.map((f) => ({ [f]: { $regex: escapeRe(term), $options: "i" } })) }];
  const docs = await cfg.model().find(filter).select(cfg.select).sort({ updatedAt: -1 }).limit(10).lean();
  return docs.map((d) => ({ type, id: String(d._id), label: cfg.label(d) || "(unnamed)", email: cfg.email?.(d) || null }));
};

/* ---------------- Views ---------------- */
const listView = (m) => ({
  id: String(m._id),
  status: m.status,
  direction: m.direction,
  from: m.from,
  to: m.to,
  cc: m.cc,
  subject: m.subject,
  snippet: m.snippet,
  date: m.sentAt || m.updatedAt || m.createdAt,
  read: !!m.read,
  starred: !!m.starred,
  archived: !!m.archived,
  trashed: !!m.trashed,
  attachmentCount: m.attachments?.length || 0,
  links: (m.links || []).map((l) => ({ type: l.type, id: String(l.id), label: l.label })),
  threadKey: m.threadKey,
  accountEmail: m.accountEmail,
  provider: m.provider,
  error: m.error,
});
const fullView = (m) => ({
  ...listView(m),
  bcc: m.direction === "outbound" ? m.bcc : [],
  html: m.html,
  text: m.text,
  replyMode: m.replyMode,
  replyToMessage: m.replyToMessage ? String(m.replyToMessage) : null,
  account: m.account ? String(m.account) : null,
  attachments: (m.attachments || []).map((a) => ({ id: String(a.attachment), filename: a.filename, contentType: a.contentType, size: a.size })),
});

/* ---------------- Folders, lists, conversations ---------------- */
const FOLDERS = {
  inbox: { direction: "inbound", archived: false, trashed: false },
  sent: { direction: "outbound", status: { $in: ["sent", "sending"] }, trashed: false },
  drafts: { status: { $in: ["draft", "failed"] }, trashed: false },
  starred: { starred: true, trashed: false, status: { $ne: "draft" } },
  archived: { archived: true, trashed: false, status: { $ne: "draft" } },
  trash: { trashed: true },
  all: { trashed: false, status: { $nin: ["draft"] } },
};

const searchFilter = (q) => {
  const term = String(q || "").trim().slice(0, 100);
  if (!term) return {};
  const re = { $regex: escapeRe(term), $options: "i" };
  return { $or: [{ subject: re }, { snippet: re }, { from: re }, { to: re }, { cc: re }, { "links.label": re }] };
};

const pageOf = (p) => Math.max(1, Math.min(1000, Number.parseInt(p, 10) || 1));

export const listMessages = async (ctx, { folder = "sent", q, page, link, unread, attachments } = {}) => {
  const base = FOLDERS[folder];
  if (!base) throw fail("Unknown folder");
  const filter = scoped(ctx, { ...base, ...searchFilter(q) });
  if (link) {
    const [type, id] = String(link).split(":");
    if (!EMAIL_LINK_TYPES.includes(type) || !isId(id)) throw fail("Linked record not found");
    filter.links = { $elemMatch: { type, id: new mongoose.Types.ObjectId(id) } };
  }
  if (unread === "1" || unread === true) filter.read = false;
  if (attachments === "1" || attachments === true) filter["attachments.0"] = { $exists: true };
  const p = pageOf(page);
  const [rows, total] = await Promise.all([
    EmailMessage.find(filter).select("-html -text -bcc").sort({ sentAt: -1, updatedAt: -1 }).skip((p - 1) * LIMITS.pageSize).limit(LIMITS.pageSize).lean(),
    EmailMessage.countDocuments(filter),
  ]);
  return { items: rows.map(listView), page: p, pageSize: LIMITS.pageSize, total };
};

export const listConversations = async (ctx, { q, page } = {}) => {
  const p = pageOf(page);
  const match = scoped(ctx, { trashed: false, status: { $nin: ["draft"] }, ...searchFilter(q) });
  match.workspace = new mongoose.Types.ObjectId(ctx.workspaceId);
  if (match.createdBy) match.createdBy = new mongoose.Types.ObjectId(match.createdBy);
  const [res] = await EmailMessage.aggregate([
    { $match: match },
    { $addFields: { _date: { $ifNull: ["$sentAt", "$updatedAt"] } } },
    { $sort: { _date: -1 } },
    {
      $group: {
        _id: "$threadKey",
        latest: { $first: "$$ROOT" },
        count: { $sum: 1 },
        unread: { $sum: { $cond: ["$read", 0, 1] } },
        starred: { $max: "$starred" },
        participants: { $addToSet: "$from" },
        recipients: { $push: "$to" },
      },
    },
    { $sort: { "latest._date": -1 } },
    { $facet: { items: [{ $skip: (p - 1) * LIMITS.pageSize }, { $limit: LIMITS.pageSize }], total: [{ $count: "n" }] } },
  ]);
  const items = (res?.items || []).map((g) => ({
    threadKey: g._id,
    count: g.count,
    unread: g.unread,
    starred: !!g.starred,
    participants: [...new Set([...g.participants, ...g.recipients.flat()])].filter(Boolean).slice(0, 10),
    latest: listView(g.latest),
  }));
  return { items, page: p, pageSize: LIMITS.pageSize, total: res?.total?.[0]?.n || 0 };
};

export const getThread = async (ctx, threadKey) => {
  const key = String(threadKey || "");
  if (!/^[\w-]{8,64}$/.test(key)) throw fail("Conversation not found", 404);
  const rows = await EmailMessage.find(scoped(ctx, { threadKey: key, trashed: false, status: { $ne: "draft" } })).sort({ createdAt: 1 }).lean();
  if (!rows.length) throw fail("Conversation not found", 404);
  return { threadKey: key, subject: rows[0].subject, messages: rows.map(fullView) };
};

const loadOwn = async (ctx, id, extra = {}) => {
  if (!isId(id)) throw fail("Email not found", 404);
  const m = await EmailMessage.findOne(scoped(ctx, { _id: id, ...extra }));
  if (!m) throw fail("Email not found", 404);
  return m;
};

export const getMessage = async (ctx, id, { markRead = true } = {}) => {
  const m = await loadOwn(ctx, id);
  if (markRead && !m.read) {
    m.read = true;
    await EmailMessage.updateOne({ _id: m._id, workspace: ctx.workspaceId }, { $set: { read: true } });
  }
  return fullView(m.toObject ? m.toObject() : m);
};

export const summary = async (ctx) => {
  const count = (folder, extra = {}) => EmailMessage.countDocuments(scoped(ctx, { ...FOLDERS[folder], ...extra }));
  const [accounts, drafts, starred, archived, trash, sent, failed, inboxUnread] = await Promise.all([
    listAccounts(ctx.workspaceId),
    count("drafts"), count("starred"), count("archived"), count("trash"), count("sent"),
    EmailMessage.countDocuments(scoped(ctx, { status: "failed", trashed: false })),
    count("inbox", { read: false }),
  ]);
  const def = accounts.find((a) => a.isDefault) || null;
  const caps = accounts.map((a) => ({ accountId: a.id, ...CAPABILITIES[a.provider] }));
  const inboxAvailable = caps.some((c) => c.inbox);
  return {
    accounts,
    defaultAccount: def,
    capabilities: caps,
    inbox: {
      available: inboxAvailable,
      reason: inboxAvailable ? null : def ? CAPABILITIES[def.provider]?.inboxReason : "Connect a mailbox in Email Settings to start.",
    },
    counts: { inboxUnread, drafts, starred, archived, trash, sent, failed },
    limits: { files: LIMITS.files, fileBytes: LIMITS.fileBytes, totalBytes: LIMITS.totalBytes, recipients: LIMITS.recipients },
  };
};

/* ---------------- Flags, delete, links ---------------- */
export const updateFlags = async (ctx, id, body = {}) => {
  const m = await loadOwn(ctx, id);
  const set = {};
  for (const k of ["starred", "archived", "read", "trashed"]) {
    if (typeof body[k] === "boolean") set[k] = body[k];
  }
  if (!Object.keys(set).length) throw fail("Nothing to update");
  if (m.status === "draft" && (set.archived || set.starred)) throw fail("Drafts can't be starred or archived");
  await EmailMessage.updateOne({ _id: m._id, workspace: ctx.workspaceId }, { $set: set });
  return listView({ ...(m.toObject ? m.toObject() : m), ...set });
};

/* Attachment rows no remaining message refers to (forwards share rows) */
const dropOrphanAttachments = async (ctx, ids) => {
  if (!ids.length) return;
  const stillUsed = await EmailMessage.distinct("attachments.attachment", { workspace: ctx.workspaceId, "attachments.attachment": { $in: ids } });
  const used = new Set(stillUsed.map(String));
  const orphans = ids.filter((i) => !used.has(String(i)));
  if (orphans.length) await EmailAttachment.deleteMany({ workspace: ctx.workspaceId, _id: { $in: orphans } });
};

/* Trash first; drafts, failed sends and trashed mail are deleted for good */
export const deleteMessage = async (ctx, id) => {
  const m = await loadOwn(ctx, id);
  if (m.status === "sending") throw fail("This email is still being sent", 409);
  if (!m.trashed && !["draft", "failed"].includes(m.status)) {
    await EmailMessage.updateOne({ _id: m._id, workspace: ctx.workspaceId }, { $set: { trashed: true } });
    return { trashed: true, deleted: false };
  }
  await EmailMessage.deleteOne({ _id: m._id, workspace: ctx.workspaceId });
  await dropOrphanAttachments(ctx, (m.attachments || []).map((a) => a.attachment));
  return { trashed: false, deleted: true };
};

export const setLinks = async (ctx, id, links) => {
  const m = await loadOwn(ctx, id);
  const valid = await validateLinks(ctx, links);
  await EmailMessage.updateOne({ _id: m._id, workspace: ctx.workspaceId }, { $set: { links: valid } });
  return valid.map((l) => ({ type: l.type, id: String(l.id), label: l.label }));
};

/* Attachment download — only through a message this user can see */
export const getAttachment = async (ctx, attachmentId) => {
  if (!isId(attachmentId)) throw fail("Attachment not found", 404);
  const owner = await EmailMessage.findOne(scoped(ctx, { "attachments.attachment": attachmentId })).select("_id").lean();
  if (!owner) throw fail("Attachment not found", 404);
  const a = await EmailAttachment.findOne({ _id: attachmentId, workspace: ctx.workspaceId }).select("+data").lean();
  if (!a) throw fail("Attachment not found", 404);
  return { filename: a.filename, contentType: a.contentType, data: toBuffer(a.data) };
};

/* ---------------- Compose: drafts + send ---------------- */
const storeUploads = async (ctx, uploads) => {
  const metas = [];
  for (const u of uploads) {
    const doc = await EmailAttachment.create({
      workspace: ctx.workspaceId, filename: u.filename, contentType: u.contentType, size: u.content.length,
      sha256: crypto.createHash("sha256").update(u.content).digest("hex"), data: u.content, createdBy: ctx.userId,
    });
    metas.push({ attachment: doc._id, filename: doc.filename, contentType: doc.contentType, size: doc.size });
  }
  return metas;
};

/* Existing attachments may only be reused from the draft being edited or the
   message being forwarded — never by id from elsewhere */
const keepAttachments = (ids, ...sources) => {
  if (ids == null) return [];
  if (!Array.isArray(ids)) throw fail("Attachments must be a list");
  const pool = sources.flatMap((s) => s?.attachments || []);
  return ids.map((id) => {
    const meta = pool.find((a) => String(a.attachment) === String(id));
    if (!meta) throw fail("Attachment not found");
    return { attachment: meta.attachment, filename: meta.filename, contentType: meta.contentType, size: meta.size };
  });
};

const composeFields = (body, { strict }) => {
  const to = parseAddresses(body.to, "To");
  const cc = parseAddresses(body.cc, "Cc");
  const bcc = parseAddresses(body.bcc, "Bcc");
  if (strict && !to.length) throw fail("Add at least one recipient");
  if (to.length + cc.length + bcc.length > LIMITS.recipients) throw fail(`Up to ${LIMITS.recipients} recipients per email`);
  if (String(body.subject || "").length > LIMITS.subject) throw fail(`Subject must be ${LIMITS.subject} characters or fewer`);
  const rawHtml = String(body.html ?? "");
  if (rawHtml.length > LIMITS.html) throw fail("The message is too long");
  const html = sanitizeHtml(rawHtml);
  const text = html ? htmlToText(html) : String(body.text || "").slice(0, LIMITS.html);
  return { to, cc, bcc, subject: cleanSubject(body.subject), html, text, snippet: snippetOf(text) };
};

const checkTotal = (metas, uploads) => {
  if (metas.length + uploads.length > LIMITS.files) throw fail(`Up to ${LIMITS.files} attachments per email`);
  const total = metas.reduce((n, a) => n + (a.size || 0), 0) + uploads.reduce((n, u) => n + u.content.length, 0);
  if (total > LIMITS.totalBytes) throw fail(`Attachments are limited to ${LIMITS.totalBytes / 1024 / 1024} MB in total`);
};

const newThreadKey = () => crypto.randomUUID().replace(/-/g, "");
const prefixed = (prefix, subject) => (new RegExp(`^${prefix}:`, "i").test(subject) ? subject : `${prefix}: ${subject}`.trim());

/* Reply / reply all / forward context from the original message */
const replyContext = async (ctx, body) => {
  if (!body.replyTo) return null;
  const mode = ["reply", "replyAll", "forward"].includes(body.mode) ? body.mode : "reply";
  const original = await loadOwn(ctx, body.replyTo, { trashed: false });
  if (original.status === "draft") throw fail("Email not found", 404);
  return { mode, original };
};

const applyReply = (fields, reply) => {
  if (!reply) return { threadKey: newThreadKey() };
  const o = reply.original;
  if (reply.mode === "forward") {
    return { threadKey: newThreadKey(), replyMode: "forward", replyToMessage: o._id, subject: prefixed("Fwd", fields.subject || o.subject) };
  }
  const refs = [o.references, o.messageIdHeader].filter(Boolean).join(" ").split(/\s+/).filter(Boolean).slice(-20).join(" ");
  return {
    threadKey: o.threadKey,
    replyMode: reply.mode,
    replyToMessage: o._id,
    inReplyTo: o.messageIdHeader || null,
    references: refs || null,
    subject: prefixed("Re", fields.subject || o.subject),
  };
};

export const saveDraft = async (ctx, body = {}, draftId) => {
  const existing = draftId ? await loadOwn(ctx, draftId, { status: { $in: ["draft", "failed"] } }) : null;
  const fields = composeFields(body, { strict: false });
  const reply = await replyContext(ctx, body);
  const uploads = decodeUploads(body.attachments);
  const kept = keepAttachments(body.attachmentIds, existing, reply?.mode === "forward" ? reply.original : null);
  checkTotal(kept, uploads);
  const links = body.links !== undefined ? await validateLinks(ctx, body.links) : existing?.links || (reply ? reply.original.links : []);
  const threading = existing && !reply ? {} : applyReply(fields, reply);
  const attachments = [...kept, ...(await storeUploads(ctx, uploads))];
  const account = body.accountId ? await resolveSendingAccount(ctx.workspaceId, body.accountId) : null;
  if (body.accountId && !account) throw fail("Email account not found", 404);

  const doc = {
    ...fields, ...threading, subject: threading.subject || fields.subject, attachments, links,
    status: "draft", error: null, direction: "outbound",
    ...(account && { account: account.id, accountEmail: account.email, provider: account.provider }),
  };
  let saved;
  if (existing) {
    const dropped = (existing.attachments || []).map((a) => a.attachment).filter((id) => !attachments.some((a) => String(a.attachment) === String(id)));
    saved = await EmailMessage.findOneAndUpdate({ _id: existing._id, workspace: ctx.workspaceId }, { $set: doc }, { new: true }).lean();
    await dropOrphanAttachments(ctx, dropped);
  } else {
    saved = (await EmailMessage.create({ ...doc, workspace: ctx.workspaceId, createdBy: ctx.userId, read: true })).toObject();
  }
  return fullView(saved);
};

const CLIENT_ID_RE = /^[\w-]{8,64}$/;

/* Sends through the workspace's default (or chosen) connected mailbox and
   records the result. Never falls back to another workspace or the shared
   ReadyTech sender — replies must reach the workspace's own mailbox. */
export const sendMessage = async (ctx, body = {}) => {
  const clientId = CLIENT_ID_RE.test(String(body.clientId || "")) ? String(body.clientId) : null;
  if (clientId) {
    const prior = await EmailMessage.findOne({ workspace: ctx.workspaceId, clientId }).lean();
    if (prior && ["sending", "sent"].includes(prior.status)) return { duplicate: true, message: fullView(prior) };
  }

  const draft = body.draftId ? await loadOwn(ctx, body.draftId, { status: { $in: ["draft", "failed"] } }) : null;
  const fields = composeFields(body, { strict: true });
  const reply = await replyContext(ctx, body);
  const uploads = decodeUploads(body.attachments);
  const forwardSource = reply?.mode === "forward" ? reply.original : draft?.replyMode === "forward" && draft.replyToMessage
    ? await EmailMessage.findOne(scoped(ctx, { _id: draft.replyToMessage })).lean()
    : null;
  const kept = keepAttachments(body.attachmentIds, draft, forwardSource);
  checkTotal(kept, uploads);
  const links = body.links !== undefined ? await validateLinks(ctx, body.links) : draft?.links || (reply ? reply.original.links : []);

  const account = body.accountId
    ? await resolveSendingAccount(ctx.workspaceId, body.accountId)
    : (draft?.account && (await resolveSendingAccount(ctx.workspaceId, draft.account))) || (await resolveSendingAccount(ctx.workspaceId));
  if (!account) throw fail(body.accountId ? "Email account not found" : "Connect a mailbox in Email Settings before sending", body.accountId ? 404 : 409);
  if (uploads.length + kept.length && CAPABILITIES[account.provider]?.attachments === false) {
    throw fail(`Attachments aren't supported for ${account.providerName} yet — remove them or choose another mailbox`);
  }

  // A draft that was itself a reply keeps its thread
  const threading = reply
    ? applyReply(fields, reply)
    : draft
    ? { threadKey: draft.threadKey, replyMode: draft.replyMode, replyToMessage: draft.replyToMessage, inReplyTo: draft.inReplyTo, references: draft.references }
    : { threadKey: newThreadKey() };
  // Gmail threads a reply only within the same mailbox
  let providerThreadId = null;
  const parentId = threading.replyToMessage;
  if (parentId && threading.replyMode !== "forward") {
    const parent = reply?.original || (await EmailMessage.findOne({ _id: parentId, workspace: ctx.workspaceId }).select("account providerThreadId").lean());
    if (parent && String(parent.account) === String(account.id)) providerThreadId = parent.providerThreadId || null;
  }

  const domain = account.email.split("@")[1] || "readytech.local";
  const messageIdHeader = `<${crypto.randomUUID()}@${domain}>`;
  const attachments = [...kept, ...(await storeUploads(ctx, uploads))];
  const doc = {
    ...fields, ...threading, subject: threading.subject || fields.subject, attachments, links,
    direction: "outbound", status: "sending", error: null, read: true,
    account: account.id, accountEmail: account.email, provider: account.provider, from: account.email,
    messageIdHeader, clientId, providerThreadId,
  };

  let row;
  try {
    row = draft
      ? await EmailMessage.findOneAndUpdate({ _id: draft._id, workspace: ctx.workspaceId, status: { $in: ["draft", "failed"] } }, { $set: doc }, { new: true })
      : await EmailMessage.create({ ...doc, workspace: ctx.workspaceId, createdBy: ctx.userId });
  } catch (err) {
    if (err?.code === 11000 && clientId) {
      const prior = await EmailMessage.findOne({ workspace: ctx.workspaceId, clientId }).lean();
      if (prior) return { duplicate: true, message: fullView(prior) };
    }
    throw err;
  }
  if (!row) throw fail("This draft is already being sent", 409);

  try {
    const files = attachments.length
      ? await EmailAttachment.find({ workspace: ctx.workspaceId, _id: { $in: attachments.map((a) => a.attachment) } }).select("+data").lean()
      : [];
    const payload = attachments.map((a) => {
      const f = files.find((x) => String(x._id) === String(a.attachment));
      if (!f) throw fail(`Attachment "${a.filename}" is no longer available — remove it and attach it again`);
      return { filename: a.filename, contentType: a.contentType, content: toBuffer(f.data) };
    });

    const sent = await sendViaConnectedAccount(ctx.workspaceId, {
      to: doc.to.join(", "), cc: doc.cc.join(", "), bcc: doc.bcc.join(", "),
      subject: doc.subject, message: doc.text, html: doc.html || undefined, attachments: payload,
      messageId: messageIdHeader, inReplyTo: doc.inReplyTo || undefined, references: doc.references || undefined,
      threadId: providerThreadId || undefined,
    }, { accountId: account.id });
    if (!sent) throw fail("Connect a mailbox in Email Settings before sending", 409);

    const done = {
      status: "sent", sentAt: new Date(), error: null,
      providerMessageId: sent.id ? String(sent.id) : null,
      providerThreadId: sent.threadId || providerThreadId || null,
    };
    await EmailMessage.updateOne({ _id: row._id, workspace: ctx.workspaceId }, { $set: done });
    return { duplicate: false, message: fullView({ ...(row.toObject ? row.toObject() : row), ...done }) };
  } catch (err) {
    const message = err.status ? err.message : "The email couldn't be sent. Please try again.";
    if (!err.status) console.error("Mailbox send error:", err.message);
    // Kept as an editable draft (status failed) so nothing the user wrote is lost
    await EmailMessage.updateOne({ _id: row._id, workspace: ctx.workspaceId }, { $set: { status: "failed", error: message, clientId: null } });
    throw Object.assign(new Error(message), { status: err.status && err.status < 500 ? err.status : 502, messageId: String(row._id) });
  }
};
