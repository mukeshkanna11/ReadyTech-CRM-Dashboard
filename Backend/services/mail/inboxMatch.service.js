// services/mail/inboxMatch.service.js — which received emails belong in the CRM
// ("Replies + CRM contacts") and how they are stored. Shared by every inbox
// sync (Gmail, Outlook / Microsoft 365, Zoho Mail, custom-domain IMAP).
//
// A received message is imported only when it
//   1. continues a conversation already in the CRM (same provider thread),
//   2. answers a message ReadyTech sent or imported (In-Reply-To / References),
//   3. is a "Re:" of a ReadyTech email, from someone that email was sent to, or
//   4. comes from a Lead, Client or Vendor of the same workspace.
// Anything else (personal mail, OTPs, newsletters) is never stored.
// Every query carries the owning workspace explicitly.
import crypto from "node:crypto";
import EmailMessage from "../../models/EmailMessage.js";
import EmailAttachment from "../../models/EmailAttachment.js";
import Lead from "../../models/Lead.js";
import Client from "../../models/Client.js";
import Vendor from "../../models/Vendor.model.js";
import { sanitizeHtml, htmlToText, LIMITS, cleanFilename, cleanType, isBlockedFilename, recordScope } from "./mailbox.service.js";

export const FIRST_SYNC_DAYS = 14; // first run looks back this far (contacts + replies)
const SUBJECT_MATCH_DAYS = 60;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ADDR_RE = /[^\s<>,;:"'()[\]]+@[^\s<>,;:"'()[\]]+\.[a-z]{2,}/gi;
export const addressesIn = (v) => [...new Set((String(v || "").match(ADDR_RE) || []).map((a) => a.toLowerCase()))].slice(0, 100);
export const messageIdsIn = (v) => [...new Set(String(v || "").match(/<[^<>\s]+>/g) || [])];

/* "Re: Fwd: Quote" → "quote" */
export const normSubject = (s) =>
  String(s || "").replace(/^\s*((re|fw|fwd|aw|sv|antw)\s*(\[\d+\])?\s*:\s*)+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const isReplySubject = (s) => /^\s*(re|aw|sv|antw)\s*(\[\d+\])?\s*:/i.test(String(s || ""));

/* Stable conversation key for a provider thread of one mailbox */
export const derivedThreadKey = (ws, account, key) =>
  crypto.createHash("sha256").update(`${ws}:${account}:${key}`).digest("hex").slice(0, 32);

/* ---------------- CRM contacts ---------------- */
const CONTACTS = [
  { type: "lead", model: () => Lead, select: "name email owner", label: (d) => d.name || d.email },
  { type: "client", model: () => Client, select: "companyName contactPerson email", label: (d) => d.companyName || d.contactPerson || d.email },
  { type: "vendor", model: () => Vendor, select: "name email", label: (d) => d.name || d.email },
];

/* email (lowercase) → { type, id, label, owner } for records of this workspace */
export const findContacts = async (ws, emails) => {
  const list = [...new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter((e) => e.includes("@")))].slice(0, 100);
  const out = new Map();
  if (!list.length) return out;
  const anyOf = list.map((e) => ({ email: new RegExp(`^\\s*${escapeRe(e)}\\s*$`, "i") }));
  for (const c of CONTACTS) {
    const docs = await c.model().find({ $and: [recordScope(ws), { $or: anyOf }] }).select(c.select).limit(200).lean();
    for (const d of docs) {
      const key = String(d.email || "").trim().toLowerCase();
      if (key && !out.has(key)) out.set(key, { type: c.type, id: d._id, label: String(c.label(d) || "").slice(0, 200), owner: d.owner || null });
    }
  }
  return out;
};

/* ---------------- Matching ---------------- */
const PARENT = "threadKey links createdBy";

/* cand: { providerMessageId, providerThreadId, from, subject, inReplyTo, references }
   → { threadKey, links, createdBy, via } or null (not imported) */
export const resolveParent = async (ctx, cand, contacts = new Map()) => {
  const account = ctx.conn._id;
  const from = String(cand.from || "").toLowerCase();

  if (cand.providerThreadId) {
    const r = await EmailMessage.findOne({ workspace: ctx.ws, account, providerThreadId: String(cand.providerThreadId), status: { $ne: "draft" } })
      .select(PARENT).sort({ createdAt: 1 }).lean();
    if (r) return { threadKey: r.threadKey, links: r.links || [], createdBy: r.createdBy || null, via: "thread" };
  }

  const ids = [...messageIdsIn(cand.inReplyTo), ...messageIdsIn(cand.references)].slice(-20);
  if (ids.length) {
    const r = await EmailMessage.findOne({ workspace: ctx.ws, messageIdHeader: { $in: ids }, status: { $ne: "draft" } }).select(PARENT).lean();
    if (r) return { threadKey: r.threadKey, links: r.links || [], createdBy: r.createdBy || null, via: "reply" };
  }

  // Some providers (Outlook) don't keep ReadyTech's Message-ID: same subject, and the sender was a recipient
  const subject = normSubject(cand.subject);
  if (from && subject && isReplySubject(cand.subject)) {
    const rows = await EmailMessage.find({
      workspace: ctx.ws, account, direction: "outbound", status: "sent", to: from,
      sentAt: { $gte: new Date(Date.now() - SUBJECT_MATCH_DAYS * 864e5) },
    }).select(`${PARENT} subject`).sort({ sentAt: -1 }).limit(20).lean();
    const hit = rows.find((r) => normSubject(r.subject) === subject);
    if (hit) return { threadKey: hit.threadKey, links: hit.links || [], createdBy: hit.createdBy || null, via: "subject" };
  }

  const contact = from && contacts.get(from);
  if (contact) {
    return {
      threadKey: derivedThreadKey(ctx.ws, account, cand.providerThreadId || cand.providerMessageId),
      links: [{ type: contact.type, id: contact.id, label: contact.label }],
      // Lead owner sees the enquiry; otherwise the admin who connected the mailbox
      createdBy: contact.owner || ctx.conn.connectedBy || null,
      via: "contact",
    };
  }
  return null;
};

export const alreadyImported = async (ctx, providerMessageId) =>
  !!(await EmailMessage.findOne({ workspace: ctx.ws, account: ctx.conn._id, providerMessageId: String(providerMessageId) }).select("_id").lean());

/* ---------------- Storage ---------------- */
/* files: [{ filename, contentType, size, inline?, load: async () => Buffer }] */
const storeFiles = async (ctx, files) => {
  const metas = [];
  const created = [];
  let total = 0;
  for (const [i, a] of files.entries()) {
    const filename = cleanFilename(a.filename);
    const base = { filename, contentType: cleanType(a.contentType), size: Number(a.size) || 0 };
    if (i >= LIMITS.files) { metas.push({ ...base, attachment: null, unavailable: "limit" }); continue; }
    if (isBlockedFilename(filename)) { metas.push({ ...base, attachment: null, unavailable: "blocked" }); continue; }
    if (base.size > LIMITS.fileBytes || total + base.size > LIMITS.totalBytes) { metas.push({ ...base, attachment: null, unavailable: "too_large" }); continue; }
    const data = Buffer.from(await a.load());
    if (data.length > LIMITS.fileBytes || total + data.length > LIMITS.totalBytes) { metas.push({ ...base, attachment: null, unavailable: "too_large" }); continue; }
    total += data.length;
    const doc = await EmailAttachment.create({
      workspace: ctx.ws, filename, contentType: base.contentType, size: data.length,
      sha256: crypto.createHash("sha256").update(data).digest("hex"), data, createdBy: null,
    });
    created.push(doc._id);
    metas.push({ ...base, size: data.length, attachment: doc._id, unavailable: null });
  }
  return { metas, created };
};

const oneLine = (s, max) => String(s || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

/* m: { providerMessageId, providerThreadId, from, fromName, to[], cc[], subject, html, text,
        messageIdHeader, inReplyTo, references, date, read, attachments[] }
   → "imported" | "duplicate" */
export const storeInbound = async (ctx, m, parent) => {
  if (await alreadyImported(ctx, m.providerMessageId)) return "duplicate";
  const cleanHtml = m.html ? sanitizeHtml(String(m.html)) : "";
  const html = cleanHtml.length <= LIMITS.html ? cleanHtml : "";
  const text = String(m.text || htmlToText(cleanHtml)).slice(0, LIMITS.html);
  const { metas, created } = await storeFiles(ctx, m.attachments || []);
  try {
    await EmailMessage.create({
      workspace: ctx.ws,
      account: ctx.conn._id, accountEmail: ctx.conn.email, provider: ctx.conn.provider,
      direction: "inbound", status: "received",
      from: String(m.from || "").toLowerCase(), fromName: oneLine(m.fromName, 100),
      to: (m.to || []).slice(0, 100), cc: (m.cc || []).slice(0, 100),
      subject: oneLine(m.subject, 300), html, text, snippet: text.replace(/\s+/g, " ").trim().slice(0, 180),
      attachments: metas,
      threadKey: parent.threadKey, links: parent.links || [],
      messageIdHeader: oneLine(m.messageIdHeader, 300) || null,
      inReplyTo: oneLine(m.inReplyTo, 300) || null,
      references: oneLine(m.references, 4000) || null,
      providerMessageId: String(m.providerMessageId), providerThreadId: m.providerThreadId ? String(m.providerThreadId) : null,
      read: !!m.read,
      createdBy: parent.createdBy || null,
      sentAt: m.date instanceof Date && !Number.isNaN(m.date.getTime()) ? m.date : new Date(),
    });
    return "imported";
  } catch (err) {
    if (created.length) await EmailAttachment.deleteMany({ workspace: ctx.ws, _id: { $in: created } });
    if (err?.code === 11000) return "duplicate";
    throw err;
  }
};
