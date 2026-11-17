// services/mail/providerSync.service.js — inbox sync adapters for Outlook /
// Microsoft 365 (Graph), Zoho Mail and custom-domain IMAP. Run by the sync
// worker in gmailSync.service.js (lease, cursor, status) inside the owning
// workspace. Read-only: nothing is marked read, moved or deleted at the provider.
//
// adapter(ctx) → { imported, cursor }
//   ctx: { ws, conn, token, cursor, budget (imports), checks (messages examined) }
// Only messages accepted by inboxMatch.resolveParent are downloaded and stored.
import { simpleParser } from "mailparser";
import { openImap } from "./smtp.service.js";
import { readSmtpPassword } from "../emailOAuth.service.js";
import {
  FIRST_SYNC_DAYS, addressesIn, messageIdsIn, findContacts, resolveParent, alreadyImported, storeInbound,
} from "./inboxMatch.service.js";

const MAX_PAGES = 4;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const since = (cursor) => cursor || new Date(Date.now() - FIRST_SYNC_DAYS * 864e5).toISOString();
const providerError = (what, status, reason) =>
  Object.assign(new Error(`${what} ${status} ${reason || ""}`.trim()), { providerStatus: status, reason: String(reason || "") });

/* ================= Microsoft Graph ================= */
const GRAPH = "https://graph.microsoft.com/v1.0/me";
const graph = async (token, url) => {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, prefer: 'outlook.body-content-type="html"' } });
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  throw providerError("Graph API", res.status, body?.error?.code);
};
const gAddr = (r) => String(r?.emailAddress?.address || "").trim().toLowerCase();
const gHeader = (headers, name) => (headers || []).find((h) => String(h.name).toLowerCase() === name)?.value || "";

export const syncGraph = async (ctx) => {
  const own = String(ctx.conn.email).toLowerCase();
  let cursor = since(ctx.cursor);
  let imported = 0;
  let url = `${GRAPH}/mailFolders/inbox/messages?${new URLSearchParams({
    $filter: `receivedDateTime ge ${cursor}`,
    $orderby: "receivedDateTime asc",
    $top: "50",
    $select: "id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments",
  })}`;

  for (let page = 0; page < MAX_PAGES && url; page++) {
    const r = await graph(ctx.token, url);
    const items = r.value || [];
    const contacts = await findContacts(ctx.ws, items.map((i) => gAddr(i.from)));
    for (const it of items) {
      if (ctx.budget <= 0 || ctx.checks <= 0) return { imported, cursor };
      ctx.checks--;
      const from = gAddr(it.from);
      if (from && from !== own && !(await alreadyImported(ctx, it.id))) {
        const parent = await resolveParent(ctx, { providerMessageId: it.id, providerThreadId: it.conversationId, from, subject: it.subject }, contacts);
        if (parent) {
          const id = encodeURIComponent(it.id);
          const full = await graph(ctx.token, `${GRAPH}/messages/${id}?$select=body,internetMessageHeaders`);
          const files = [];
          if (it.hasAttachments) {
            const list = await graph(ctx.token, `${GRAPH}/messages/${id}/attachments?$select=id,name,contentType,size,isInline`);
            for (const a of list.value || []) {
              if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || a.isInline) continue;
              files.push({
                filename: a.name, contentType: a.contentType, size: a.size,
                load: async () => Buffer.from((await graph(ctx.token, `${GRAPH}/messages/${id}/attachments/${encodeURIComponent(a.id)}`)).contentBytes || "", "base64"),
              });
            }
          }
          const isHtml = String(full.body?.contentType || "").toLowerCase() === "html";
          const out = await storeInbound(ctx, {
            providerMessageId: it.id, providerThreadId: it.conversationId,
            from, fromName: it.from?.emailAddress?.name || "",
            to: (it.toRecipients || []).map(gAddr).filter(Boolean), cc: (it.ccRecipients || []).map(gAddr).filter(Boolean),
            subject: it.subject, html: isHtml ? full.body?.content : "", text: isHtml ? "" : full.body?.content,
            messageIdHeader: it.internetMessageId,
            inReplyTo: gHeader(full.internetMessageHeaders, "in-reply-to"),
            references: gHeader(full.internetMessageHeaders, "references"),
            date: new Date(it.receivedDateTime), read: !!it.isRead, attachments: files,
          }, parent);
          if (out === "imported") { imported++; ctx.budget--; }
        }
      }
      cursor = it.receivedDateTime || cursor;
    }
    url = r["@odata.nextLink"] || null;
  }
  return { imported, cursor };
};

/* ================= Zoho Mail ================= */
const zoho = async (ctx, path, params = {}) => {
  const { mailBase, accountId } = ctx.conn.providerData || {};
  if (!mailBase || !accountId) throw providerError("Zoho Mail API", 400, "ACCOUNT_DATA_MISSING");
  const url = new URL(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { authorization: `Zoho-oauthtoken ${ctx.token}` } });
  const body = await res.json().catch(() => ({}));
  const code = Number(body?.status?.code) || res.status;
  if (!res.ok || code >= 300) throw providerError("Zoho Mail API", code, body?.data?.errorCode);
  return body.data;
};
const unescapeHtml = (s) => String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const zHeader = (headers, name) => {
  if (!headers || typeof headers !== "object") return "";
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? [].concat(headers[key]).join(" ") : "";
};

export const syncZoho = async (ctx) => {
  const own = String(ctx.conn.email).toLowerCase();
  const folders = await zoho(ctx, "folders");
  const inbox = (folders || []).find((f) => String(f.folderType || "").toLowerCase() === "inbox") ||
    (folders || []).find((f) => /^\/?inbox$/i.test(String(f.path || f.folderName || "")));
  if (!inbox?.folderId) throw providerError("Zoho Mail API", 404, "INBOX_NOT_FOUND");

  // Newest first, until the cursor is reached; then processed oldest → newest
  const after = Number(ctx.cursor) || Date.now() - FIRST_SYNC_DAYS * 864e5;
  const fresh = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await zoho(ctx, "messages/view", { folderId: inbox.folderId, start: page * 50 + 1, limit: 50, sortBy: "date", sortorder: false, includeto: true });
    const list = Array.isArray(rows) ? rows : [];
    let reached = false;
    for (const m of list) {
      if (Number(m.receivedTime) <= after) { reached = true; break; }
      fresh.push(m);
    }
    if (reached || list.length < 50) break;
  }
  fresh.reverse();

  let cursor = String(after);
  let imported = 0;
  const contacts = await findContacts(ctx.ws, fresh.map((m) => addressesIn(unescapeHtml(m.fromAddress))[0]));
  for (const m of fresh) {
    if (ctx.budget <= 0 || ctx.checks <= 0) break;
    ctx.checks--;
    const from = addressesIn(unescapeHtml(m.fromAddress))[0] || "";
    const id = String(m.messageId);
    if (from && from !== own && !(await alreadyImported(ctx, id))) {
      const parent = await resolveParent(ctx, { providerMessageId: id, providerThreadId: m.threadId || null, from, subject: m.subject }, contacts);
      if (parent) {
        const base = `folders/${encodeURIComponent(m.folderId || inbox.folderId)}/messages/${encodeURIComponent(id)}`;
        const content = await zoho(ctx, `${base}/content`);
        const head = await zoho(ctx, `${base}/header`, { raw: false }).catch(() => null);
        const h = head?.headerContent;
        const out = await storeInbound(ctx, {
          providerMessageId: id, providerThreadId: m.threadId || null,
          from, fromName: unescapeHtml(m.sender || ""),
          to: addressesIn(unescapeHtml(m.toAddress)), cc: addressesIn(unescapeHtml(m.ccAddress)),
          subject: unescapeHtml(m.subject), html: content?.content || "",
          messageIdHeader: messageIdsIn(zHeader(h, "message-id"))[0] || null,
          inReplyTo: zHeader(h, "in-reply-to"), references: zHeader(h, "references"),
          date: new Date(Number(m.receivedTime)), read: false, attachments: [],
        }, parent);
        if (out === "imported") { imported++; ctx.budget--; }
      }
    }
    cursor = String(Number(m.receivedTime) || cursor);
  }
  return { imported, cursor };
};

/* ================= Custom domain (IMAP) ================= */
const toList = (v) => (v?.value || []).map((a) => String(a.address || "").toLowerCase()).filter(Boolean);

export const syncImap = async (ctx) => {
  const password = readSmtpPassword(ctx.conn);
  if (!password) throw providerError("IMAP", 401, "CREDENTIALS_UNREADABLE");
  const own = String(ctx.conn.email).toLowerCase();
  const client = await openImap(ctx.conn.imap, ctx.conn.smtp?.username || ctx.conn.email, password);
  let imported = 0;
  let cursor = ctx.cursor || null;
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const validity = String(client.mailbox?.uidValidity ?? "");
      const [v, u] = String(ctx.cursor || "").split(":");
      const lastUid = v === validity ? Number(u) || 0 : 0; // UIDVALIDITY changed → start over (de-duplicated)
      const found = lastUid
        ? await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })
        : await client.search({ since: new Date(Date.now() - FIRST_SYNC_DAYS * 864e5) }, { uid: true });
      let uids = (found || []).filter((x) => x > lastUid).sort((a, b) => a - b);
      // First run: newest messages within the window; later runs: oldest first so the cursor advances
      uids = lastUid ? uids.slice(0, ctx.checks) : uids.slice(-ctx.checks);
      if (!uids.length) return { imported, cursor: cursor || `${validity}:${lastUid}` };

      const heads = [];
      for await (const msg of client.fetch(uids.join(","), { uid: true, envelope: true, flags: true, size: true, headers: ["in-reply-to", "references"] }, { uid: true })) {
        heads.push(msg);
      }
      heads.sort((a, b) => a.uid - b.uid);
      const fromOf = (m) => String(m.envelope?.from?.[0]?.address || "").toLowerCase();
      const contacts = await findContacts(ctx.ws, heads.map(fromOf));

      for (const m of heads) {
        if (ctx.budget <= 0 || ctx.checks <= 0) break;
        ctx.checks--;
        const id = `${validity}:${m.uid}`;
        const from = fromOf(m);
        const rawHeads = m.headers ? m.headers.toString("utf8") : "";
        const references = /^references:\s*([\s\S]*?)(?:\r?\n(?!\s)|$)/im.exec(rawHeads)?.[1]?.replace(/\s+/g, " ") || "";
        const inReplyTo = m.envelope?.inReplyTo || "";
        // IMAP has no thread id: the conversation's first Message-ID stands in for it
        const root = messageIdsIn(references)[0] || messageIdsIn(inReplyTo)[0] || m.envelope?.messageId || id;
        if (from && from !== own && !(await alreadyImported(ctx, id))) {
          const parent = await resolveParent(ctx, { providerMessageId: id, providerThreadId: root, from, subject: m.envelope?.subject, inReplyTo, references }, contacts);
          if (parent && (m.size || 0) <= MAX_SOURCE_BYTES) {
            const full = await client.fetchOne(String(m.uid), { source: true }, { uid: true });
            const p = await simpleParser(full.source, { skipImageLinks: true, skipTextToHtml: true });
            const files = (p.attachments || [])
              .filter((a) => !(a.related || (a.contentDisposition === "inline" && a.cid && String(a.contentType).startsWith("image/"))))
              .map((a) => ({ filename: a.filename || "attachment", contentType: a.contentType, size: a.size, load: async () => a.content }));
            const out = await storeInbound(ctx, {
              providerMessageId: id, providerThreadId: root,
              from, fromName: p.from?.value?.[0]?.name || "",
              to: toList(p.to), cc: toList(p.cc), subject: p.subject || m.envelope?.subject || "",
              html: typeof p.html === "string" ? p.html : "", text: p.text || "",
              messageIdHeader: p.messageId || m.envelope?.messageId || null,
              inReplyTo: p.inReplyTo || inReplyTo, references: [].concat(p.references || []).join(" ") || references,
              date: p.date || m.envelope?.date || new Date(), read: m.flags?.has?.("\\Seen") || false, attachments: files,
            }, parent);
            if (out === "imported") { imported++; ctx.budget--; }
          }
        }
        cursor = `${validity}:${m.uid}`;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  return { imported, cursor };
};

export const ADAPTERS = { microsoft: syncGraph, zoho: syncZoho, smtp: syncImap };
