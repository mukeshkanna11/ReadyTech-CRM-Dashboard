// services/mail/gmailSync.service.js — inbox sync worker ("Replies + CRM contacts").
//
// Imports replies to ReadyTech conversations and mail from the workspace's
// Leads / Clients / Vendors (see inboxMatch.service.js) — never the rest of the
// user's inbox. Gmail is handled here; Outlook / Microsoft 365, Zoho Mail and
// custom-domain IMAP by providerSync.service.js under the same lease, cursor
// and status. Behind MAIL_INBOX_SYNC_ENABLED (or the older
// GMAIL_INBOX_SYNC_ENABLED; off by default) and only for mailboxes that
// granted read access (or have IMAP configured).
//
// Gmail mail outside known threads: only its headers are read
// (format=metadata) to decide; the body is downloaded only when it matches.
//
// Flow per mailbox: lease (no parallel runs) → token via emailOAuth.service
// (never leaves the server) → first run: re-read known threads + baseline
// historyId; later runs: users.history (messageAdded) filtered to known
// thread ids → messages.get → stored as inbound EmailMessage rows of the same
// conversation. Duplicates are impossible: unique (workspace, account,
// providerMessageId) + an existence check before fetching.
import crypto from "node:crypto";
import EmailConnection from "../../models/EmailConnection.js";
import EmailMessage from "../../models/EmailMessage.js";
import EmailAttachment from "../../models/EmailAttachment.js";
import EmailSyncState from "../../models/EmailSyncState.js";
import { getAccessToken, msHasRead } from "../emailOAuth.service.js";
import { FIRST_SYNC_DAYS, findContacts, resolveParent, alreadyImported } from "./inboxMatch.service.js";
import { ADAPTERS } from "./providerSync.service.js";
import { runWithWorkspace } from "../../utils/workspaceContext.js";
import { sanitizeHtml, htmlToText, LIMITS, cleanFilename, cleanType, isBlockedFilename } from "./mailbox.service.js";

export const READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const READ_CAPABLE = new Set([READ_SCOPE, "https://www.googleapis.com/auth/gmail.modify", "https://mail.google.com/"]);

export const inboxSyncEnabled = () => process.env.MAIL_INBOX_SYNC_ENABLED === "true" || process.env.GMAIL_INBOX_SYNC_ENABLED === "true";
export const hasReadScope = (scope) => String(scope || "").split(/[\s,]+/).some((s) => READ_CAPABLE.has(s));

/* Extra read-only scopes requested by "Enable inbox sync" (minimal per provider) */
export const READ_SCOPES = {
  google: [READ_SCOPE],
  microsoft: ["Mail.Read"],
  zoho: ["ZohoMail.messages.READ", "ZohoMail.folders.READ"],
};
const INBOX_PROVIDERS = new Set(["google", "microsoft", "zoho", "smtp"]);

/* Can this mailbox be read? (OAuth read scope granted / IMAP configured) */
export const hasInboxAccess = (c) => {
  const scope = String(c?.scope || "");
  switch (c?.provider) {
    case "google": return hasReadScope(scope);
    case "microsoft": return msHasRead(scope);
    case "zoho": return /zohomail\.messages\.(read|all)/i.test(scope) && /zohomail\.folders\.(read|all)/i.test(scope);
    case "smtp": return !!c.imap?.enabled && !!c.imap?.host;
    default: return false;
  }
};

export const SYNC = {
  intervalMs: 3 * 60_000, // per-mailbox auto sync cadence
  tickMs: 60_000, // worker wake-up
  lockMs: 5 * 60_000, // lease length
  maxImportPerRun: 50,
  maxChecksPerRun: 100, // messages outside known threads examined per run
  maxHistoryPages: 5,
  maxThreadsRescan: 50,
  rescanDays: 30,
  maxAccountsPerTick: 25,
  maxBackoffMs: 60 * 60_000,
};
const SKIP_LABELS = new Set(["SENT", "DRAFT", "SPAM", "TRASH", "CHAT"]);

/* ---------------- Gmail REST ---------------- */
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const gmail = async (token, path, params = {}) => {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || "";
  // Never include provider detail in anything user-facing
  return Promise.reject(Object.assign(new Error(`Gmail API ${res.status} ${reason}`.trim()), { gmailStatus: res.status, reason: String(reason) }));
};

/* ---------------- Message parsing ---------------- */
const b64url = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
const header = (headers, name) => (headers || []).find((h) => String(h.name).toLowerCase() === name)?.value || "";
const decodeWords = (s) =>
  String(s || "").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (m, cs, enc, data) => {
    try {
      const buf = enc.toLowerCase() === "b"
        ? Buffer.from(data, "base64")
        : Buffer.from(data.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
      return new TextDecoder(cs).decode(buf);
    } catch {
      return m;
    }
  });
const oneLine = (s, max) => decodeWords(s).replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const ADDR_RE = /[^\s<>,;:"'()[\]]+@[^\s<>,;:"'()[\]]+\.[a-z]{2,}/gi;
const addresses = (v) => [...new Set((String(v || "").match(ADDR_RE) || []).map((a) => a.toLowerCase()))].slice(0, 100);
const sender = (v) => {
  const s = oneLine(v, 300);
  const address = addresses(s)[0] || "";
  const name = s.replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
  return { address, name: name && name.toLowerCase() !== address ? name.slice(0, 100) : "" };
};
const decodeBody = (part) => {
  const buf = b64url(part.body?.data);
  const charset = /charset="?([^";\s]+)"?/i.exec(header(part.headers, "content-type"))?.[1] || "utf-8";
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
};

export const parseGmailMessage = (msg) => {
  const out = { html: "", text: "", attachments: [] };
  const walk = (part, depth = 0) => {
    if (!part || depth > 20) return;
    const mime = String(part.mimeType || "").toLowerCase();
    if (part.filename && (part.body?.attachmentId || part.body?.data)) {
      const inlineImage = /^inline/i.test(header(part.headers, "content-disposition")) && header(part.headers, "content-id") && mime.startsWith("image/");
      if (!inlineImage) {
        out.attachments.push({ filename: part.filename, contentType: mime, size: Number(part.body.size) || 0, attachmentId: part.body.attachmentId || null, data: part.body.attachmentId ? null : part.body.data });
      }
      return;
    }
    if (mime === "text/html" && !out.html && part.body?.data) out.html = decodeBody(part);
    else if (mime === "text/plain" && !out.text && part.body?.data) out.text = decodeBody(part);
    (part.parts || []).forEach((p) => walk(p, depth + 1));
  };
  walk(msg.payload);
  const h = msg.payload?.headers || [];
  const from = sender(header(h, "from"));
  return {
    ...out,
    from: from.address,
    fromName: from.name,
    to: addresses(header(h, "to")),
    cc: addresses(header(h, "cc")),
    subject: oneLine(header(h, "subject"), 300),
    messageIdHeader: oneLine(header(h, "message-id"), 300) || null,
    inReplyTo: oneLine(header(h, "in-reply-to"), 300) || null,
    references: oneLine(header(h, "references"), 4000) || null,
    date: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
  };
};

/* ---------------- Import ---------------- */
/* Conversation each known Gmail thread belongs to (this account only) */
const parentsFor = async (ctx, threadIds) => {
  const map = new Map();
  if (!threadIds.length) return map;
  const rows = await EmailMessage.find({
    workspace: ctx.ws, account: ctx.conn._id, direction: "outbound", status: { $in: ["sent", "sending"] },
    providerThreadId: { $in: threadIds },
  }).select("providerThreadId threadKey links createdBy createdAt").sort({ createdAt: 1 }).lean();
  for (const r of rows) if (!map.has(r.providerThreadId)) map.set(r.providerThreadId, r);
  return map;
};

const storeAttachments = async (ctx, gmailId, list) => {
  const metas = [];
  const created = [];
  let total = 0;
  for (const [i, a] of list.entries()) {
    const filename = cleanFilename(a.filename);
    const base = { filename, contentType: cleanType(a.contentType), size: a.size };
    if (i >= LIMITS.files) { metas.push({ ...base, attachment: null, unavailable: "limit" }); continue; }
    if (isBlockedFilename(filename)) { metas.push({ ...base, attachment: null, unavailable: "blocked" }); continue; }
    if (a.size > LIMITS.fileBytes || total + a.size > LIMITS.totalBytes) { metas.push({ ...base, attachment: null, unavailable: "too_large" }); continue; }
    const data = a.data
      ? b64url(a.data)
      : b64url((await gmail(ctx.token, `messages/${encodeURIComponent(gmailId)}/attachments/${encodeURIComponent(a.attachmentId)}`)).data);
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

/* "imported" | "duplicate" | "skipped" */
const importMessage = async (ctx, gmailId, parent) => {
  const exists = await EmailMessage.findOne({ workspace: ctx.ws, account: ctx.conn._id, providerMessageId: gmailId }).select("_id").lean();
  if (exists) return "duplicate";
  const msg = await gmail(ctx.token, `messages/${encodeURIComponent(gmailId)}`, { format: "full" });
  if ((msg.labelIds || []).some((l) => SKIP_LABELS.has(l))) return "skipped";
  const p = parseGmailMessage(msg);
  if (!p.from || p.from === String(ctx.conn.email).toLowerCase()) return "skipped"; // our own / malformed

  const cleanHtml = p.html ? sanitizeHtml(p.html) : "";
  const html = cleanHtml.length <= LIMITS.html ? cleanHtml : "";
  const text = (p.text || htmlToText(cleanHtml)).slice(0, LIMITS.html);
  const { metas, created } = await storeAttachments(ctx, gmailId, p.attachments);
  try {
    await EmailMessage.create({
      workspace: ctx.ws,
      account: ctx.conn._id, accountEmail: ctx.conn.email, provider: "google",
      direction: "inbound", status: "received",
      from: p.from, fromName: p.fromName, to: p.to, cc: p.cc,
      subject: p.subject, html, text, snippet: text.replace(/\s+/g, " ").trim().slice(0, 180),
      attachments: metas,
      threadKey: parent.threadKey, links: parent.links || [],
      messageIdHeader: p.messageIdHeader, inReplyTo: p.inReplyTo, references: p.references,
      providerMessageId: String(msg.id || gmailId), providerThreadId: msg.threadId || null,
      read: !(msg.labelIds || []).includes("UNREAD"),
      // Visible to whoever owns the conversation (members see their own threads)
      createdBy: parent.createdBy || null,
      sentAt: p.date,
    });
    return "imported";
  } catch (err) {
    if (created.length) await EmailAttachment.deleteMany({ workspace: ctx.ws, _id: { $in: created } });
    if (err?.code === 11000) return "duplicate";
    throw err;
  }
};

/* Inbox mail outside known ReadyTech threads: headers only → match → import.
   Returns { imported, complete } (complete = every message was examined). */
const GMAIL_META = ["From", "Subject", "In-Reply-To", "References"];
const importCandidates = async (ctx, list) => {
  const own = String(ctx.conn.email).toLowerCase();
  const heads = [];
  let complete = true;
  for (const m of list) {
    if (await alreadyImported(ctx, m.id)) continue;
    if (ctx.checks <= 0) { complete = false; break; }
    ctx.checks--;
    const meta = await gmail(ctx.token, `messages/${encodeURIComponent(m.id)}`, { format: "metadata", metadataHeaders: GMAIL_META }).catch((err) => {
      if (err.gmailStatus === 404) return null; // deleted meanwhile
      throw err;
    });
    if (!meta || (meta.labelIds || []).some((l) => SKIP_LABELS.has(l))) continue;
    const h = meta.payload?.headers || [];
    heads.push({
      id: meta.id || m.id, threadId: meta.threadId || m.threadId || null, from: sender(header(h, "from")).address,
      subject: oneLine(header(h, "subject"), 300), inReplyTo: header(h, "in-reply-to"), references: header(h, "references"),
    });
  }
  const contacts = await findContacts(ctx.ws, heads.map((x) => x.from));
  let imported = 0;
  for (const x of heads) {
    if (ctx.budget <= 0) { complete = false; break; }
    if (!x.from || x.from === own) continue;
    const parent = await resolveParent(ctx, { providerMessageId: x.id, providerThreadId: x.threadId, from: x.from, subject: x.subject, inReplyTo: x.inReplyTo, references: x.references }, contacts);
    if (parent && (await importMessage(ctx, x.id, parent)) === "imported") {
      imported++;
      ctx.budget--;
    }
  }
  return { imported, complete };
};

/* First run: recent inbox mail from CRM contacts (replies are covered above) */
const scanRecentInbox = async (ctx) => {
  const r = await gmail(ctx.token, "messages", { q: `in:inbox newer_than:${FIRST_SYNC_DAYS}d`, maxResults: SYNC.maxImportPerRun });
  return (await importCandidates(ctx, r.messages || [])).imported;
};

/* First run / history expired: re-read the recent threads ReadyTech sent */
const rescanKnownThreads = async (ctx) => {
  const since = new Date(Date.now() - SYNC.rescanDays * 864e5);
  const rows = await EmailMessage.find({
    workspace: ctx.ws, account: ctx.conn._id, direction: "outbound", status: "sent",
    providerThreadId: { $type: "string" }, sentAt: { $gte: since },
  }).select("providerThreadId").sort({ sentAt: -1 }).limit(500).lean();
  const ids = [...new Set(rows.map((r) => r.providerThreadId))].slice(0, SYNC.maxThreadsRescan);
  const parents = await parentsFor(ctx, ids);
  let imported = 0;
  for (const id of ids) {
    if (ctx.budget <= 0) break;
    const parent = parents.get(id);
    if (!parent) continue;
    const thread = await gmail(ctx.token, `threads/${encodeURIComponent(id)}`, { format: "minimal" }).catch((err) => {
      if (err.gmailStatus === 404) return null; // thread deleted in Gmail
      throw err;
    });
    for (const m of thread?.messages || []) {
      if (ctx.budget <= 0) break;
      if ((m.labelIds || []).some((l) => SKIP_LABELS.has(l))) continue;
      if ((await importMessage(ctx, m.id, parent)) === "imported") {
        imported++;
        ctx.budget--;
      }
    }
  }
  return imported;
};

/* Incremental: only messageAdded records in known threads are fetched */
const syncHistory = async (ctx, startHistoryId) => {
  let pageToken;
  let last = startHistoryId;
  let imported = 0;
  for (let page = 0; page < SYNC.maxHistoryPages; page++) {
    const r = await gmail(ctx.token, "history", { startHistoryId, historyTypes: "messageAdded", maxResults: 100, pageToken });
    const records = r.history || [];
    const threadIds = [...new Set(records.flatMap((h) => (h.messagesAdded || []).map((x) => x.message?.threadId)).filter(Boolean))];
    const parents = await parentsFor(ctx, threadIds);
    for (const rec of records) {
      // Budget used up: resume from the last fully processed record next run
      if (ctx.budget <= 0 || ctx.checks <= 0) return { imported, historyId: last };
      const others = [];
      for (const { message: m } of rec.messagesAdded || []) {
        if (!m || (m.labelIds || []).some((l) => SKIP_LABELS.has(l))) continue;
        const parent = parents.get(m.threadId);
        if (!parent) {
          if ((m.labelIds || []).includes("INBOX")) others.push(m);
          continue;
        }
        if ((await importMessage(ctx, m.id, parent)) === "imported") {
          imported++;
          ctx.budget--;
        }
      }
      if (others.length) {
        const r = await importCandidates(ctx, others);
        imported += r.imported;
        if (!r.complete) return { imported, historyId: last };
      }
      last = rec.id || last;
    }
    if (!r.nextPageToken) return { imported, historyId: r.historyId || last };
    pageToken = r.nextPageToken;
  }
  return { imported, historyId: last };
};

/* ---------------- One mailbox ---------------- */
const later = (ms) => new Date(Date.now() + ms);

export const syncAccount = async (workspaceId, accountId) => {
  if (!inboxSyncEnabled()) return { status: "disabled" };
  const ws = String(workspaceId);
  const now = new Date();
  const lockId = crypto.randomUUID();
  let state;
  try {
    state = await EmailSyncState.findOneAndUpdate(
      { workspace: ws, account: accountId, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      {
        $set: { lockedUntil: later(SYNC.lockMs), lockId, status: "syncing", lastSyncAt: now },
        $setOnInsert: { workspace: ws, account: accountId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (err) {
    if (err?.code === 11000) return { status: "busy" }; // another run holds the lease
    throw err;
  }
  const release = (set, inc) =>
    EmailSyncState.updateOne({ workspace: ws, account: accountId, lockId }, { $set: { ...set, lockedUntil: null, lockId: null }, ...(inc && { $inc: inc }) });

  try {
    const got = await getAccessToken(ws, accountId);
    const provider = got?.conn?.provider;
    if (!got?.conn || !INBOX_PROVIDERS.has(provider)) {
      await EmailSyncState.deleteOne({ workspace: ws, account: accountId });
      return { status: "gone" };
    }
    if (!hasInboxAccess(got.conn)) {
      await release({ provider, status: "needs_permission", lastError: provider === "smtp" ? "IMAP isn't set up for this mailbox" : "Read access isn't granted for this mailbox", nextRunAt: later(6 * 60 * 60_000) });
      return { status: "needs_permission" };
    }
    const ctx = { ws, conn: got.conn, token: got.token, budget: SYNC.maxImportPerRun, checks: SYNC.maxChecksPerRun, cursor: state.historyId || null };
    let imported = 0;
    let historyId = state.historyId;
    if (provider !== "google") {
      const r = await ADAPTERS[provider](ctx);
      imported = r.imported;
      historyId = r.cursor;
    } else {
      const baseline = async () => {
        const { historyId: current } = await gmail(ctx.token, "profile"); // taken first: nothing between is missed
        imported += await rescanKnownThreads(ctx);
        imported += await scanRecentInbox(ctx);
        return current;
      };
      if (!historyId) historyId = await baseline();
      else {
        try {
          const r = await syncHistory(ctx, historyId);
          imported += r.imported;
          historyId = r.historyId;
        } catch (err) {
          if (err.gmailStatus !== 404) throw err; // 404: startHistoryId too old
          historyId = await baseline();
        }
      }
    }
    await release(
      { provider, status: "idle", historyId: historyId ? String(historyId) : null, lastSuccessAt: new Date(), lastError: null, failures: 0, nextRunAt: later(SYNC.intervalMs), lastImported: imported },
      { totalImported: imported }
    );
    return { status: "ok", imported };
  } catch (err) {
    const needsPermission =
      (err.gmailStatus === 403 && /insufficient|scope|permission/i.test(`${err.reason} ${err.message}`)) ||
      err.providerStatus === 403 || /ErrorAccessDenied|INVALID_OAUTHSCOPE|OAUTH_SCOPE/i.test(String(err.reason || ""));
    const failures = (state.failures || 0) + 1;
    // Token problems come back from emailOAuth.service (409) and IMAP problems
    // from smtp.service (422) with a safe message
    const message = needsPermission
      ? "Read access was removed — enable inbox sync again"
      : err.status === 409 || err.status === 422
      ? err.message
      : "Couldn't check for new email right now — we'll retry automatically";
    if (!needsPermission && err.status !== 409 && err.status !== 422) console.error(`Inbox sync failed (account ${accountId}):`, err.message);
    await release({
      status: needsPermission ? "needs_permission" : "error",
      lastError: message,
      failures,
      nextRunAt: later(needsPermission ? 6 * 60 * 60_000 : Math.min(SYNC.intervalMs * 2 ** Math.min(failures, 5), SYNC.maxBackoffMs)),
    });
    return { status: needsPermission ? "needs_permission" : "error", error: message };
  }
};

/* ---------------- Workspace-level (manual Refresh, status) ---------------- */
const readableAccounts = (workspaceId) =>
  EmailConnection.find({ workspace: workspaceId, status: "connected" }).select("_id email provider scope imap").lean()
    .then((rows) => rows.filter(hasInboxAccess));

export const syncWorkspace = async (workspaceId) => {
  if (!inboxSyncEnabled()) return { enabled: false, results: [] };
  const results = [];
  for (const c of await readableAccounts(workspaceId)) {
    results.push({ accountId: String(c._id), email: c.email, ...(await syncAccount(workspaceId, c._id)) });
  }
  return { enabled: true, results, imported: results.reduce((n, r) => n + (r.imported || 0), 0) };
};

/* Per-account inbox access + sync status for the Mail UI (no secrets) */
export const inboxStatus = async (workspaceId) => {
  const enabled = inboxSyncEnabled();
  const conns = await EmailConnection.find({ workspace: workspaceId }).select("_id provider scope imap").lean();
  const states = enabled ? await EmailSyncState.find({ workspace: workspaceId }).lean() : [];
  const now = Date.now();
  const accounts = {};
  for (const c of conns) {
    const access = hasInboxAccess(c);
    const s = states.find((x) => String(x.account) === String(c._id));
    accounts[String(c._id)] = {
      access: enabled && access,
      canEnable: enabled && INBOX_PROVIDERS.has(c.provider) && !access,
      status: !enabled || !access ? null : s?.lockedUntil && new Date(s.lockedUntil).getTime() > now ? "syncing" : s?.status || "pending",
      lastSuccessAt: s?.lastSuccessAt || null,
      lastError: s?.lastError || null,
    };
  }
  return { enabled, accounts };
};

/* Look up the just-connected account and start its first sync (fire and forget) */
export const startInitialSync = async (workspaceId, provider, email) => {
  if (!inboxSyncEnabled() || !INBOX_PROVIDERS.has(provider)) return { granted: false };
  const acc = await EmailConnection.findOne({ workspace: workspaceId, provider, email: String(email).toLowerCase() }).select("_id provider scope imap").lean();
  const granted = !!acc && hasInboxAccess(acc);
  if (granted) runWithWorkspace(workspaceId, () => syncAccount(workspaceId, acc._id)).catch((err) => console.error("Inbox initial sync failed:", err.message));
  return { granted };
};

/* ---------------- Worker ---------------- */
const worker = { running: false, busy: false, lastRunAt: null, lastError: null };
export const mailSyncWorkerState = () => ({ ...worker });

/* One pass over every workspace's readable mailboxes that are due.
   Each mailbox runs inside its own workspace context. */
export const runSyncTick = async () => {
  if (!inboxSyncEnabled()) return 0;
  const conns = await EmailConnection.find({
    workspace: { $ne: null }, status: "connected",
    $or: [
      { provider: "google", scope: { $regex: "gmail\\.readonly|gmail\\.modify|mail\\.google\\.com" } },
      { provider: "microsoft", scope: { $regex: "mail\\.read", $options: "i" } },
      { provider: "zoho", scope: { $regex: "zohomail\\.messages", $options: "i" } },
      { provider: "smtp", "imap.enabled": true },
    ],
  }).select("_id workspace provider scope imap").limit(1000).lean();
  const readable = conns.filter(hasInboxAccess);
  if (!readable.length) return 0;
  const states = await EmailSyncState.find({ workspace: { $ne: null }, account: { $in: readable.map((c) => c._id) } }).select("account nextRunAt").lean();
  const now = Date.now();
  const due = readable
    .filter((c) => {
      const s = states.find((x) => String(x.account) === String(c._id));
      return !s?.nextRunAt || new Date(s.nextRunAt).getTime() <= now;
    })
    .slice(0, SYNC.maxAccountsPerTick);
  for (const c of due) {
    await runWithWorkspace(c.workspace, () => syncAccount(c.workspace, c._id)).catch((err) => console.error("Inbox sync error:", err.message));
  }
  return due.length;
};

export const startMailSyncWorker = () => {
  if (worker.running || !inboxSyncEnabled()) return;
  worker.running = true;
  const tick = async () => {
    if (worker.busy) return;
    worker.busy = true;
    try {
      await runSyncTick();
      worker.lastRunAt = new Date();
      worker.lastError = null;
    } catch (err) {
      worker.lastError = err.message;
      console.error("❌ Inbox sync run failed:", err.message);
    } finally {
      worker.busy = false;
    }
  };
  setTimeout(tick, 30_000).unref();
  setInterval(tick, SYNC.tickMs).unref();
  console.log("📬 Inbox sync worker started (replies + CRM contacts only)");
};
