// services/emailOAuth.service.js — per-workspace mail accounts: Gmail,
// Microsoft 365 and Zoho Mail (OAuth authorization code flow) plus custom-domain
// SMTP. Several accounts per workspace, one default sender. Uses fetch only for
// OAuth providers. Secrets never leave this module unencrypted, and every query
// is filtered by the owning workspace — there is no cross-workspace fallback.
import crypto from "node:crypto";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import EmailConnection from "../models/EmailConnection.js";
import { validateSmtpInput, verifySmtp, sendSmtp } from "./mail/smtp.service.js";

export const MAX_ACCOUNTS_PER_WORKSPACE = 10;

/* ---------------- Provider configuration ---------------- */
const msTenant = () => process.env.MICROSOFT_TENANT_ID || "common";
const ZOHO_DEFAULT_ACCOUNTS = "https://accounts.zoho.com";
// Only Zoho's own data-centre account servers ever receive our client secret
const ZOHO_ACCOUNTS_RE = /^https:\/\/accounts\.zoho\.(com|eu|in|com\.au|jp|ca|sa|uk|com\.cn)$/;
export const zohoAccountsServer = (v) => {
  const s = String(v || "").trim().replace(/\/+$/, "").toLowerCase();
  return ZOHO_ACCOUNTS_RE.test(s) ? s : null;
};

export const PROVIDERS = {
  google: {
    kind: "oauth",
    name: "Gmail / Google Workspace",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI"],
    scope: "openid email https://www.googleapis.com/auth/gmail.send",
    authUrl: () => "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: () => "https://oauth2.googleapis.com/token",
    // select_account: lets admins pick / switch the Google account; consent: guarantees a refresh token
    extraAuthParams: { access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true" },
    sendScope: "https://www.googleapis.com/auth/gmail.send",
    revokeUrl: "https://myaccount.google.com/permissions",
    limitations:
      "Sends emails from your Gmail address (no inbox access). Gmail daily sending limits apply (~500/day personal, ~2,000/day Workspace).",
    setup:
      "Google Cloud Console → APIs & Services: enable the Gmail API, configure the OAuth consent screen (scope gmail.send), create an OAuth client (Web application) and add GOOGLE_OAUTH_REDIRECT_URI as an Authorized redirect URI.",
  },
  microsoft: {
    kind: "oauth",
    name: "Microsoft Outlook / 365",
    env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_OAUTH_REDIRECT_URI"],
    scope: "openid email offline_access User.Read Mail.Send",
    authUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`,
    extraAuthParams: { prompt: "select_account" },
    sendScope: "Mail.Send",
    revokeUrl: "https://myapps.microsoft.com",
    limitations:
      "Sends emails from your Outlook / Microsoft 365 address (no inbox access). Some organisations require IT admin approval the first time.",
    setup:
      "Azure Portal → App registrations: register a Web app (accounts in any organizational directory and personal Microsoft accounts), add MICROSOFT_OAUTH_REDIRECT_URI as a Web redirect URI, add delegated Microsoft Graph permissions Mail.Send, User.Read, offline_access, and create a client secret. Optional MICROSOFT_TENANT_ID (default: common).",
  },
  zoho: {
    kind: "oauth",
    name: "Zoho Mail",
    env: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_OAUTH_REDIRECT_URI"],
    scope: "ZohoMail.messages.CREATE,ZohoMail.accounts.READ",
    authUrl: () => `${ZOHO_DEFAULT_ACCOUNTS}/oauth/v2/auth`,
    tokenUrl: (conn) => `${zohoAccountsServer(conn?.providerData?.accountsServer) || ZOHO_DEFAULT_ACCOUNTS}/oauth/v2/token`,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    sendScope: null,
    revokeUrl: "https://accounts.zoho.com/home#sessions/userauthtoken",
    limitations: "Sends emails from your Zoho Mail address (no inbox access). Zoho Mail sending limits apply.",
    setup:
      "Zoho API Console (api-console.zoho.com) → Add Client → Server-based Applications: add ZOHO_OAUTH_REDIRECT_URI as an Authorized Redirect URI, then Settings → enable Multi-DC so accounts from every Zoho data centre can connect.",
  },
  smtp: {
    kind: "smtp",
    name: "Custom domain (SMTP)",
    env: [],
    revokeUrl: null,
    limitations:
      "Sends through your own mail server (Hostinger, cPanel, GoDaddy, …) over SSL (465) or STARTTLS (587). Your provider's sending limits apply.",
  },
};

const env = (k) => process.env[k]?.trim();
export const missingConfig = (provider) => PROVIDERS[provider].env.filter((k) => !env(k));
const ENV_PREFIX = { google: "GOOGLE", microsoft: "MICROSOFT", zoho: "ZOHO" };
const clientId = (p) => env(`${ENV_PREFIX[p]}_CLIENT_ID`);
const clientSecret = (p) => env(`${ENV_PREFIX[p]}_CLIENT_SECRET`);
const redirectUri = (p) => env(`${ENV_PREFIX[p]}_OAUTH_REDIRECT_URI`);

/* ---------------- Secret encryption (AES-256-GCM) ---------------- */
const key = () =>
  crypto.createHash("sha256").update(env("EMAIL_TOKEN_ENCRYPTION_KEY") || `email-oauth:${process.env.JWT_SECRET}`).digest();

export const encrypt = (plain) => {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

const decrypt = (blob) => {
  if (!blob) return null;
  const [iv, tag, enc] = String(blob).split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
};

/* Never throws (key changed / corrupt value → null) */
const safeDecrypt = (blob) => {
  try {
    return decrypt(blob);
  } catch {
    return null;
  }
};

const httpError = (message, status) => Object.assign(new Error(message), { status });

/* ---------------- OAuth state (CSRF + workspace binding) ---------------- */
const STATE_PURPOSE = "email-oauth";

/* `extraScopes` is only passed by the (feature-flagged) "Enable inbox sync"
   flow; every other connection requests exactly PROVIDERS[provider].scope. */
export const buildAuthUrl = ({ provider, userId, workspaceId, loginHint, returnOrigin, extraScopes }) => {
  const p = PROVIDERS[provider];
  const extra = (extraScopes || []).filter(Boolean);
  const state = jwt.sign(
    {
      purpose: STATE_PURPOSE, provider, uid: String(userId), ws: String(workspaceId), nonce: crypto.randomBytes(12).toString("hex"),
      ...(returnOrigin && { ret: returnOrigin }), ...(extra.length && { inbox: true }),
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  const url = new URL(p.authUrl());
  Object.entries({
    client_id: clientId(provider),
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: extra.length ? [p.scope, ...extra].join(" ") : p.scope,
    state,
    ...p.extraAuthParams,
    ...(loginHint && { login_hint: loginHint }),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
};

export const verifyState = (state, provider) => {
  const d = jwt.verify(String(state || ""), process.env.JWT_SECRET);
  if (d?.purpose !== STATE_PURPOSE || d.provider !== provider) throw new Error("Invalid OAuth state");
  return d;
};

/* ---------------- Provider HTTP ---------------- */
const INVALID_GRANT = new Set(["invalid_grant", "invalid_code"]);

const bodyError = (body = {}, status, statusText, what) => {
  const detail = body.error_description || body.error?.message || body.data?.moreInfo || body.status?.description || body.error || statusText;
  const err = new Error(`${what} failed: ${String(detail).split("\n")[0].slice(0, 200)}`);
  err.providerStatus = status;
  err.invalidGrant = INVALID_GRANT.has(body.error);
  if (typeof body.error === "string") err.providerCode = body.error;
  return err;
};
const providerError = async (res, what) => bodyError(await res.json().catch(() => ({})), res.status, res.statusText, what);

const tokenRequest = async (provider, params, url = PROVIDERS[provider].tokenUrl()) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(provider), client_secret: clientSecret(provider), ...params }),
  });
  if (!res.ok) throw await providerError(res, "Token request");
  const body = await res.json();
  // Zoho reports some errors with HTTP 200
  if (body?.error) {
    const err = new Error(`Token request failed: ${String(body.error).slice(0, 200)}`);
    err.invalidGrant = INVALID_GRANT.has(body.error);
    throw err;
  }
  return body;
};

const zohoMailBase = (accountsServer) => accountsServer.replace("https://accounts.", "https://mail.");

/* Mailbox identity for the token: { email, providerData? } */
const fetchAccountIdentity = async (provider, accessToken, ctx = {}) => {
  if (provider === "zoho") {
    const mailBase = zohoMailBase(ctx.accountsServer);
    const res = await fetch(`${mailBase}/api/accounts`, { headers: { authorization: `Zoho-oauthtoken ${accessToken}` } });
    if (!res.ok) throw await providerError(res, "Account lookup");
    const acct = (await res.json())?.data?.[0];
    const email = acct?.primaryEmailAddress || acct?.mailboxAddress || acct?.emailAddress?.find?.((e) => e.isPrimary)?.mailId;
    if (!email || !acct?.accountId) throw new Error("The provider did not return an email address for this account");
    return { email, providerData: { accountsServer: ctx.accountsServer, mailBase, accountId: String(acct.accountId) } };
  }
  const url = provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName";
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await providerError(res, "Account lookup");
  const me = await res.json();
  const email = provider === "google" ? me.email : me.mail || me.userPrincipalName;
  if (!email) throw new Error("The provider did not return an email address for this account");
  return { email };
};

const expiry = (t) => (t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : null);

/* Best-effort grant revoke (Microsoft has no token revoke endpoint) */
async function revokeGrant(provider, token, conn) {
  if (!token) return;
  let url;
  if (provider === "google") url = "https://oauth2.googleapis.com/revoke";
  else if (provider === "zoho") url = `${zohoAccountsServer(conn?.providerData?.accountsServer) || ZOHO_DEFAULT_ACCOUNTS}/oauth/v2/token/revoke`;
  else return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

/* ---------------- Account storage (always workspace-filtered) ---------------- */
const SECRETS = "+accessToken +refreshToken +smtpPassword";
const isId = (id) => mongoose.isValidObjectId(id);

const listWithSecrets = (workspaceId) =>
  EmailConnection.find({ workspace: workspaceId }).select(SECRETS).sort({ createdAt: 1 });

const loadAccount = async (workspaceId, accountId) => {
  if (!accountId) {
    const all = await listWithSecrets(workspaceId);
    return all.find((a) => a.isDefault) || all[0] || null;
  }
  if (!isId(accountId)) return null;
  return EmailConnection.findOne({ workspace: workspaceId, _id: accountId }).select(SECRETS);
};

/* Adds a new mailbox (respecting the per-workspace limit) or updates the
   same mailbox. First account of a workspace becomes the default sender. */
const upsertAccount = async (workspaceId, { provider, email }, fields, existingId) => {
  const all = await EmailConnection.find({ workspace: workspaceId }).lean();
  const same = existingId
    ? all.find((a) => String(a._id) === String(existingId))
    : all.find((a) => a.provider === provider && a.email === email);
  if (!same && all.length >= MAX_ACCOUNTS_PER_WORKSPACE) {
    throw httpError(`A workspace can connect up to ${MAX_ACCOUNTS_PER_WORKSPACE} email accounts. Disconnect one first.`, 409);
  }
  if (existingId && all.some((a) => String(a._id) !== String(existingId) && a.provider === provider && a.email === email)) {
    throw httpError(`${email} is already connected in this workspace`, 409);
  }
  const isDefault = same ? !!same.isDefault || !all.some((a) => a.isDefault) : !all.some((a) => a.isDefault);
  const filter = same ? { workspace: workspaceId, _id: same._id } : { workspace: workspaceId, provider, email };
  try {
    return await EmailConnection.findOneAndUpdate(
      filter,
      { $set: { workspace: workspaceId, provider, email, isDefault, status: "connected", lastError: null, ...fields } },
      { upsert: !same, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) {
      // Legacy single-account index still present → migration not yet run
      if (/workspace_1(?!_)/.test(String(err.message))) {
        console.error("EmailConnection: legacy unique index workspace_1 present — run scripts/migrateMailAccounts.js --apply");
        throw httpError("Connecting more than one email account isn't enabled yet. Please contact ReadyTech support.", 409);
      }
      throw httpError(`${email} is already connected in this workspace`, 409);
    }
    throw err;
  }
};

/* Callback: code → tokens → account email → store (this workspace only) */
export const completeConnection = async ({ provider, code, workspaceId, userId, accountsServer }) => {
  const ctx = {};
  let tokenUrl;
  if (provider === "zoho") {
    ctx.accountsServer = zohoAccountsServer(accountsServer || ZOHO_DEFAULT_ACCOUNTS);
    if (!ctx.accountsServer) throw new Error("Invalid OAuth state");
    tokenUrl = `${ctx.accountsServer}/oauth/v2/token`;
  }
  const t = await tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri(provider) }, tokenUrl);
  if (!t.access_token) throw new Error("Provider returned no access token");
  if (!t.refresh_token) throw new Error("Provider returned no refresh token — remove the app's access from your account and connect again");
  // Google's consent screen lets users untick individual permissions
  const sendScope = PROVIDERS[provider].sendScope?.toLowerCase();
  const granted = String(t.scope || "").toLowerCase().split(/[\s,]+/);
  if (sendScope && t.scope && !granted.some((g) => g === sendScope || g.endsWith(`/${sendScope}`))) {
    await revokeGrant(provider, t.refresh_token);
    throw new Error("Permission to send email was not granted — please connect again and allow ReadyTech to send email on your behalf");
  }
  const { email: rawEmail, providerData } = await fetchAccountIdentity(provider, t.access_token, ctx);
  const email = String(rawEmail).trim().toLowerCase();

  try {
    await upsertAccount(workspaceId, { provider, email }, {
      accessToken: encrypt(t.access_token), refreshToken: encrypt(t.refresh_token),
      expiresAt: expiry(t), scope: t.scope || PROVIDERS[provider].scope,
      connectedBy: userId, ...(providerData && { providerData }),
    });
  } catch (err) {
    await revokeGrant(provider, t.refresh_token, { providerData });
    throw err;
  }
  return email;
};

/* ---------------- Tokens ---------------- */
const refreshing = new Map(); // accountId → in-flight refresh (no parallel rotations)

const markError = async (conn, message) => {
  conn.status = "error";
  conn.lastError = message;
  await EmailConnection.updateOne({ _id: conn._id, workspace: conn.workspace }, { $set: { status: "error", lastError: message } });
};

/* Valid access token for an OAuth account, refreshing when (nearly) expired.
   A rejected refresh marks the account as "error" (reconnect needed). */
const ensureToken = async (conn) => {
  if (conn.expiresAt && conn.expiresAt.getTime() - 60_000 > Date.now()) {
    const token = safeDecrypt(conn.accessToken);
    if (token) return token;
  }
  const id = String(conn._id);
  if (!refreshing.has(id)) {
    refreshing.set(id, (async () => {
      try {
        const refreshToken = safeDecrypt(conn.refreshToken);
        if (!refreshToken) {
          const err = new Error("stored credentials unreadable");
          err.invalidGrant = true;
          throw err;
        }
        const t = await tokenRequest(conn.provider, {
          grant_type: "refresh_token", refresh_token: refreshToken,
          ...(conn.provider === "microsoft" && { scope: PROVIDERS.microsoft.scope }),
        }, PROVIDERS[conn.provider].tokenUrl(conn));
        conn.accessToken = encrypt(t.access_token);
        if (t.refresh_token) conn.refreshToken = encrypt(t.refresh_token); // Microsoft rotates
        conn.expiresAt = expiry(t);
        conn.status = "connected";
        conn.lastError = null;
        await conn.save();
        return t.access_token;
      } catch (err) {
        console.error(`Email OAuth (${conn.provider}) refresh failed:`, err.message);
        await markError(conn, err.invalidGrant
          ? "Access was revoked or expired — please reconnect the account"
          : "We couldn't refresh access to this mailbox — please reconnect the account");
        err.message = `Email account ${conn.email}: ${conn.lastError}`;
        err.status = 409;
        throw err;
      } finally {
        refreshing.delete(id);
      }
    })());
  }
  return refreshing.get(id);
};

/* Access token for the workspace's default (or given) OAuth account */
export const getAccessToken = async (workspaceId, accountId) => {
  const conn = await loadAccount(workspaceId, accountId);
  if (!conn) return null;
  if (conn.provider === "smtp") return { conn, token: null };
  return { conn, token: await ensureToken(conn) };
};

/* ---------------- Public views (never include secrets) ---------------- */
export const publicAccount = (c) => ({
  id: String(c._id),
  provider: c.provider,
  providerName: PROVIDERS[c.provider]?.name || c.provider,
  email: c.email,
  displayName: c.displayName || "",
  isDefault: !!c.isDefault,
  status: c.status,
  lastError: c.lastError,
  connectedAt: c.createdAt || c.updatedAt,
  updatedAt: c.updatedAt,
  lastUsedAt: c.lastUsedAt,
  lastTestedAt: c.lastTestedAt || null,
  ...(c.provider === "smtp" && {
    smtp: { host: c.smtp?.host, port: c.smtp?.port, security: c.smtp?.security, username: c.smtp?.username },
  }),
});

export const listAccounts = async (workspaceId) => {
  const all = await EmailConnection.find({ workspace: workspaceId }).sort({ createdAt: 1 }).lean();
  const list = all.map(publicAccount);
  // Legacy rows have no default flag yet: the oldest one is the sender
  if (list.length && !list.some((a) => a.isDefault)) list[0].isDefault = true;
  return list;
};

export const connectionStatus = async (workspaceId) => {
  const list = await listAccounts(workspaceId);
  return list.find((a) => a.isDefault) || null;
};

/* Refresh-check expired OAuth tokens so the status shown is real */
export const verifyConnection = async (workspaceId) => {
  const all = await listWithSecrets(workspaceId);
  await Promise.all(
    all
      .filter((c) => c.provider !== "smtp" && c.status === "connected" && !(c.expiresAt && c.expiresAt.getTime() - 60_000 > Date.now()))
      .map((c) => ensureToken(c).catch(() => {}))
  );
  return connectionStatus(workspaceId);
};

/* ---------------- Account management ---------------- */
export const setDefaultAccount = async (workspaceId, accountId) => {
  if (!isId(accountId)) return null;
  const conn = await EmailConnection.findOne({ workspace: workspaceId, _id: accountId }).lean();
  if (!conn) return null;
  await EmailConnection.updateMany({ workspace: workspaceId }, { $set: { isDefault: false } });
  await EmailConnection.updateOne({ workspace: workspaceId, _id: conn._id }, { $set: { isDefault: true } });
  return publicAccount({ ...conn, isDefault: true });
};

export const disconnect = async (workspaceId, accountId) => {
  const conn = await loadAccount(workspaceId, accountId);
  if (!conn) return false;
  // Best effort revoke; local secrets are deleted regardless (even if unreadable)
  if (conn.provider !== "smtp") {
    await revokeGrant(conn.provider, safeDecrypt(conn.refreshToken) || safeDecrypt(conn.accessToken), conn);
  }
  await EmailConnection.deleteOne({ _id: conn._id, workspace: workspaceId });
  if (conn.isDefault || !accountId) {
    const next = (await EmailConnection.find({ workspace: workspaceId }).sort({ createdAt: 1 }).lean())[0];
    if (next) await EmailConnection.updateOne({ workspace: workspaceId, _id: next._id }, { $set: { isDefault: true } });
  }
  return { provider: conn.provider, email: conn.email };
};

/* SMTP: validate → resolve/SSRF-check → real login → encrypt + store */
export const saveSmtpAccount = async (workspaceId, userId, body, accountId) => {
  let existing = null;
  if (accountId) {
    existing = isId(accountId)
      ? await EmailConnection.findOne({ workspace: workspaceId, _id: accountId }).select("+smtpPassword")
      : null;
    if (!existing || existing.provider !== "smtp") throw httpError("Email account not found", 404);
  }
  const input = validateSmtpInput(body, { requirePassword: !existing });
  const password = input.password || safeDecrypt(existing?.smtpPassword);
  if (!password) throw httpError("Please re-enter the mailbox password", 422);

  const cfg = { host: input.host, port: input.port, security: input.security, username: input.username };
  await verifySmtp(cfg, password);

  const saved = await upsertAccount(workspaceId, { provider: "smtp", email: input.email }, {
    displayName: input.displayName, smtp: cfg, smtpPassword: encrypt(password),
    connectedBy: userId, lastTestedAt: new Date(),
  }, existing?._id);
  return publicAccount(saved?.toObject ? saved.toObject() : saved || { ...cfg, provider: "smtp", email: input.email });
};

/* ---------------- Sending ---------------- */
const b64url = (s) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const header = (v) => String(v).replace(/[\r\n]+/g, " ");
const encodeWord = (s) => `=?UTF-8?B?${Buffer.from(header(s)).toString("base64")}?=`;

/* ---- Rich messages (CC/BCC, HTML, attachments, threading) ----
   Used only when one of these fields is present; plain-text sends keep the
   original single-part path below byte for byte. */
const RICH_FIELDS = ["cc", "bcc", "html", "attachments", "inReplyTo", "references", "threadId", "messageId"];
const isRich = (m) => RICH_FIELDS.some((k) => (Array.isArray(m[k]) ? m[k].length : m[k]));
const wrap76 = (b64) => b64.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
const boundary = () => `rt_${crypto.randomBytes(12).toString("hex")}`;
const asciiName = (s) => header(s).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
const b64part = (type, body) =>
  [`Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", wrap76(Buffer.from(String(body ?? "")).toString("base64"))].join("\r\n");
const multipart = (type, parts) => {
  const b = boundary();
  return [`Content-Type: multipart/${type}; boundary="${b}"`, "", ...parts.flatMap((p) => [`--${b}`, p]), `--${b}--`].join("\r\n");
};

/* RFC 5322 message. Bcc is included for Gmail (which delivers to it and
   strips the header); attachments are { filename, contentType, content: Buffer }. */
export const buildMime = ({ from, to, cc, bcc, subject, text, html, attachments = [], messageId, inReplyTo, references }) => {
  const head = [`From: ${from}`, `To: ${header(to)}`];
  if (cc) head.push(`Cc: ${header(cc)}`);
  if (bcc) head.push(`Bcc: ${header(bcc)}`);
  head.push(`Subject: ${encodeWord(subject)}`, `Date: ${new Date().toUTCString()}`);
  if (messageId) head.push(`Message-ID: ${header(messageId)}`);
  if (inReplyTo) head.push(`In-Reply-To: ${header(inReplyTo)}`);
  if (references) head.push(`References: ${header(references)}`);
  head.push("MIME-Version: 1.0");

  let body = html ? multipart("alternative", [b64part("text/plain", text), b64part("text/html", html)]) : b64part("text/plain", text);
  if (attachments.length) {
    body = multipart("mixed", [
      body,
      ...attachments.map((a) => {
        const name = asciiName(a.filename) || "attachment";
        return [
          `Content-Type: ${header(a.contentType || "application/octet-stream")}; name="${name}"`,
          `Content-Disposition: attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(header(a.filename))}`,
          "Content-Transfer-Encoding: base64",
          "",
          wrap76(Buffer.from(a.content).toString("base64")),
        ].join("\r\n");
      }),
    ]);
  }
  return `${head.join("\r\n")}\r\n${body}`;
};

const addressList = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const graphRecipients = (v) => addressList(v).map((address) => ({ emailAddress: { address } }));
const MS_MAX_ATTACH = 3 * 1024 * 1024; // Graph sendMail request limit is 4 MB (base64)

const sendRichOAuth = async (conn, token, m) => {
  const text = String(m.message ?? "");
  const attachments = m.attachments || [];
  if (conn.provider === "google") {
    const from = conn.displayName ? `${encodeWord(conn.displayName)} <${header(conn.email)}>` : header(conn.email);
    const mime = buildMime({ ...m, from, text });
    const auth = { authorization: `Bearer ${token}` };
    if (!attachments.length) {
      return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ raw: b64url(mime), ...(m.threadId && { threadId: String(m.threadId) }) }),
      });
    }
    // Attachments: media upload endpoint (35 MB) with the thread id as metadata
    const b = boundary();
    const payload = [
      `--${b}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify(m.threadId ? { threadId: String(m.threadId) } : {}),
      `--${b}`, "Content-Type: message/rfc822", "", mime, `--${b}--`,
    ].join("\r\n");
    return fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart", {
      method: "POST",
      headers: { ...auth, "content-type": `multipart/related; boundary=${b}` },
      body: payload,
    });
  }
  if (conn.provider === "zoho") {
    if (attachments.length) throw httpError("Attachments aren't supported for Zoho Mail yet — send without attachments or use another mailbox", 422);
    const { mailBase, accountId } = conn.providerData || {};
    return fetch(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      headers: { authorization: `Zoho-oauthtoken ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        fromAddress: conn.email, toAddress: header(m.to), subject: header(m.subject),
        ...(m.cc && { ccAddress: header(m.cc) }), ...(m.bcc && { bccAddress: header(m.bcc) }),
        content: m.html || text, mailFormat: m.html ? "html" : "plaintext",
      }),
    });
  }
  if (attachments.reduce((n, a) => n + a.content.length, 0) > MS_MAX_ATTACH) {
    throw httpError("Outlook / Microsoft 365 attachments are limited to 3 MB in total", 422);
  }
  return fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: header(m.subject),
        body: m.html ? { contentType: "HTML", content: m.html } : { contentType: "Text", content: text },
        toRecipients: graphRecipients(m.to),
        ...(m.cc && { ccRecipients: graphRecipients(m.cc) }),
        ...(m.bcc && { bccRecipients: graphRecipients(m.bcc) }),
        ...(attachments.length && {
          attachments: attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment", name: header(a.filename),
            contentType: a.contentType || "application/octet-stream", contentBytes: Buffer.from(a.content).toString("base64"),
          })),
        }),
      },
      saveToSentItems: true,
    }),
  });
};

const sendOAuth = async (conn, token, msg) => {
  if (isRich(msg)) return sendRichOAuth(conn, token, msg);
  const { to, subject, message } = msg;
  if (conn.provider === "google") {
    const from = conn.displayName ? `${encodeWord(conn.displayName)} <${header(conn.email)}>` : header(conn.email);
    const mime = [
      `From: ${from}`,
      `To: ${header(to)}`,
      `Subject: ${encodeWord(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(String(message)).toString("base64"),
    ].join("\r\n");
    return fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: b64url(mime) }),
    });
  }
  if (conn.provider === "zoho") {
    const { mailBase, accountId } = conn.providerData || {};
    return fetch(`${mailBase}/api/accounts/${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      headers: { authorization: `Zoho-oauthtoken ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ fromAddress: conn.email, toAddress: header(to), subject: header(subject), content: String(message), mailFormat: "plaintext" }),
    });
  }
  return fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: { subject: header(subject), body: { contentType: "Text", content: String(message) }, toRecipients: [{ emailAddress: { address: to } }] },
      saveToSentItems: true,
    }),
  });
};

/* Sends from the workspace's default (or given) mailbox. Returns null when
   the workspace has no account (caller decides). Never uses another
   workspace's account. */
export const sendViaConnectedAccount = async (workspaceId, msg, { accountId } = {}) => {
  const { to, subject, message } = msg;
  const conn = await loadAccount(workspaceId, accountId);
  if (!conn) return null;

  if (conn.provider === "smtp") {
    const password = safeDecrypt(conn.smtpPassword);
    if (!password) {
      await markError(conn, "Stored credentials can't be read — please update the SMTP password");
      throw httpError(`${conn.email}: ${conn.lastError}`, 409);
    }
    try {
      const rich = {};
      for (const k of ["cc", "bcc", "html", "attachments", "messageId", "inReplyTo", "references"]) {
        if (Array.isArray(msg[k]) ? msg[k].length : msg[k]) rich[k] = msg[k];
      }
      const sent = await sendSmtp(conn.smtp, password, { from: conn.email, fromName: conn.displayName, to, subject: header(subject), text: String(message ?? ""), ...rich });
      await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { lastUsedAt: new Date(), status: "connected", lastError: null } });
      return { id: sent.id, from: conn.email, provider: "smtp" };
    } catch (err) {
      const msg = err.authFailed
        ? `${conn.email}: the mail server rejected the saved password — please update the SMTP settings`
        : `${conn.email} couldn't send this email right now — ${err.status === 422 ? err.message : "please try again shortly"}`;
      if (err.authFailed) await markError(conn, msg);
      throw Object.assign(new Error(msg), { status: 502 });
    }
  }

  const token = await ensureToken(conn);
  const res = await sendOAuth(conn, token, msg);
  const body = res.status === 202 ? {} : await res.json().catch(() => ({}));
  const zohoFailed = conn.provider === "zoho" && body?.status?.code && body.status.code >= 300;

  if (!res.ok || zohoFailed) {
    const err = bodyError(body, res.status, res.statusText, `${PROVIDERS[conn.provider].name} send`);
    console.error(`Email send via ${conn.provider} failed:`, err.message);
    // Gmail API switched off in the Google Cloud project: not the account's fault, reconnecting won't help
    const apiDisabled = res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(err.message);
    const authFailed = !apiDisabled && (res.status === 401 || res.status === 403);
    err.message = apiDisabled
      ? `${PROVIDERS[conn.provider].name} sending isn't enabled on ReadyTech's side yet (API disabled) — please contact ReadyTech support`
      : authFailed
      ? `${conn.email} no longer allows sending from ReadyTech CRM — please reconnect the account`
      : `${conn.email} couldn't send this email right now — please try again shortly`;
    if (authFailed) await markError(conn, err.message);
    err.status = 502;
    throw err;
  }

  await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { lastUsedAt: new Date() } });
  return {
    id: body.id || body.data?.messageId || null, from: conn.email, provider: conn.provider,
    ...(body.threadId && { threadId: body.threadId }),
  };
};

/* Records a successful test on the account */
export const markTested = (workspaceId, accountId) =>
  EmailConnection.updateOne({ _id: accountId, workspace: workspaceId }, { $set: { lastTestedAt: new Date(), status: "connected", lastError: null } });

/* ---------------- Provider detection (email → google | microsoft | zoho | smtp | null) ---------------- */
const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const MS_DOMAINS = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.in", "hotmail.co.uk", "live.in"]);
const ZOHO_DOMAINS = new Set(["zoho.com", "zohomail.com", "zoho.in", "zohomail.in", "zoho.eu", "zohomail.eu"]);

export const detectProvider = async (email) => {
  const domain = String(email || "").trim().toLowerCase().split("@")[1];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  if (GOOGLE_DOMAINS.has(domain)) return "google";
  if (MS_DOMAINS.has(domain)) return "microsoft";
  if (ZOHO_DOMAINS.has(domain)) return "zoho";
  // Custom domains: look at who hosts the mailbox (best effort, 3s cap)
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    const hosts = mx.map((m) => m.exchange.toLowerCase()).join(" ");
    if (/google\.com|googlemail\.com/.test(hosts)) return "google";
    if (/outlook\.com|office365|microsoft/.test(hosts)) return "microsoft";
    if (/zoho\./.test(hosts)) return "zoho";
    if (hosts) return "smtp";
  } catch {
    /* unknown — user picks */
  }
  return null;
};

/* Public view of the account a send would use (default or given) — lets the
   mailbox service record which mailbox sent a message without secrets */
export const resolveSendingAccount = async (workspaceId, accountId) => {
  const conn = await loadAccount(workspaceId, accountId);
  return conn ? publicAccount(conn.toObject ? conn.toObject() : conn) : null;
};
