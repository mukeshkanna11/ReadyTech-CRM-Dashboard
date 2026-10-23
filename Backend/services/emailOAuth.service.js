// services/emailOAuth.service.js — per-workspace Gmail / Microsoft 365
// OAuth (authorization code flow), token refresh and sending.
// Uses fetch only (no SDKs). Tokens never leave this module unencrypted.
import crypto from "node:crypto";
import dns from "node:dns/promises";
import jwt from "jsonwebtoken";
import EmailConnection from "../models/EmailConnection.js";

/* ---------------- Provider configuration ---------------- */
const msTenant = () => process.env.MICROSOFT_TENANT_ID || "common";

export const PROVIDERS = {
  google: {
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
      "Azure Portal → App registrations: register a Web app, add MICROSOFT_OAUTH_REDIRECT_URI as a redirect URI, add delegated Microsoft Graph permissions Mail.Send, User.Read, offline_access, and create a client secret. Optional MICROSOFT_TENANT_ID (default: common).",
  },
};

const env = (k) => process.env[k]?.trim();
export const missingConfig = (provider) => PROVIDERS[provider].env.filter((k) => !env(k));
const clientId = (p) => env(p === "google" ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID");
const clientSecret = (p) => env(p === "google" ? "GOOGLE_CLIENT_SECRET" : "MICROSOFT_CLIENT_SECRET");
const redirectUri = (p) => env(p === "google" ? "GOOGLE_OAUTH_REDIRECT_URI" : "MICROSOFT_OAUTH_REDIRECT_URI");

/* ---------------- Token encryption (AES-256-GCM) ---------------- */
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

/* ---------------- OAuth state (CSRF + workspace binding) ---------------- */
const STATE_PURPOSE = "email-oauth";

export const buildAuthUrl = ({ provider, userId, workspaceId, loginHint }) => {
  const p = PROVIDERS[provider];
  const state = jwt.sign(
    { purpose: STATE_PURPOSE, provider, uid: String(userId), ws: String(workspaceId), nonce: crypto.randomBytes(12).toString("hex") },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  const url = new URL(p.authUrl());
  Object.entries({
    client_id: clientId(provider),
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: p.scope,
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
const providerError = async (res, what) => {
  const body = await res.json().catch(() => ({}));
  const detail = body.error_description || body.error?.message || body.error || res.statusText;
  const err = new Error(`${what} failed: ${String(detail).split("\n")[0].slice(0, 200)}`);
  err.providerStatus = res.status;
  err.invalidGrant = body.error === "invalid_grant";
  return err;
};

const tokenRequest = async (provider, params) => {
  const res = await fetch(PROVIDERS[provider].tokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(provider), client_secret: clientSecret(provider), ...params }),
  });
  if (!res.ok) throw await providerError(res, "Token request");
  return res.json();
};

const fetchAccountEmail = async (provider, accessToken) => {
  const url = provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName";
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await providerError(res, "Account lookup");
  const me = await res.json();
  const email = provider === "google" ? me.email : me.mail || me.userPrincipalName;
  if (!email) throw new Error("The provider did not return an email address for this account");
  return email;
};

const expiry = (t) => (t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : null);

/* Callback: code → tokens → account email → store (replaces any previous
   connection of THIS workspace only) */
export const completeConnection = async ({ provider, code, workspaceId, userId }) => {
  const t = await tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri(provider) });
  if (!t.access_token) throw new Error("Provider returned no access token");
  if (!t.refresh_token) throw new Error("Provider returned no refresh token — remove the app's access from your account and connect again");
  // Google's consent screen lets users untick individual permissions
  const granted = String(t.scope || "").toLowerCase().split(/\s+/);
  if (t.scope && !granted.some((g) => g === PROVIDERS[provider].sendScope.toLowerCase() || g.endsWith(`/${PROVIDERS[provider].sendScope.toLowerCase()}`))) {
    await revokeGoogle(provider, t.refresh_token);
    throw new Error("Permission to send email was not granted — please connect again and allow ReadyTech to send email on your behalf");
  }
  const email = await fetchAccountEmail(provider, t.access_token);
  const previous = await loadWithTokens(workspaceId);

  await EmailConnection.findOneAndUpdate(
    { workspace: workspaceId },
    {
      $set: {
        workspace: workspaceId, provider, email,
        accessToken: encrypt(t.access_token), refreshToken: encrypt(t.refresh_token),
        expiresAt: expiry(t), scope: t.scope || PROVIDERS[provider].scope,
        status: "connected", lastError: null, connectedBy: userId,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  // Switched to a different Google account: drop the old account's grant (same account keeps the new grant)
  if (previous && previous.email?.toLowerCase() !== email.toLowerCase()) {
    await revokeGoogle(previous.provider, decrypt(previous.refreshToken) || decrypt(previous.accessToken));
  }
  return email;
};

/* Best-effort Google grant revoke (Microsoft has no token revoke endpoint) */
async function revokeGoogle(provider, token) {
  if (provider !== "google" || !token) return;
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

const loadWithTokens = (workspaceId) =>
  EmailConnection.findOne({ workspace: workspaceId }).select("+accessToken +refreshToken");

/* Valid access token for the workspace, refreshing when (nearly) expired.
   A rejected refresh marks the connection as "error" (reconnect needed). */
export const getAccessToken = async (workspaceId) => {
  const conn = await loadWithTokens(workspaceId);
  if (!conn) return null;
  if (conn.expiresAt && conn.expiresAt.getTime() - 60_000 > Date.now()) return { conn, token: decrypt(conn.accessToken) };

  try {
    const t = await tokenRequest(conn.provider, { grant_type: "refresh_token", refresh_token: decrypt(conn.refreshToken) });
    conn.accessToken = encrypt(t.access_token);
    if (t.refresh_token) conn.refreshToken = encrypt(t.refresh_token); // Microsoft rotates
    conn.expiresAt = expiry(t);
    conn.status = "connected";
    conn.lastError = null;
    await conn.save();
    return { conn, token: t.access_token };
  } catch (err) {
    console.error(`Email OAuth (${conn.provider}) refresh failed:`, err.message);
    conn.status = "error";
    conn.lastError = err.invalidGrant
      ? "Access was revoked or expired — please reconnect the account"
      : "We couldn't refresh access to this mailbox — please reconnect the account";
    await conn.save();
    err.message = `Email account ${conn.email}: ${conn.lastError}`;
    err.status = 409;
    throw err;
  }
};

/* Public view — never includes tokens */
export const connectionStatus = async (workspaceId) => {
  const c = await EmailConnection.findOne({ workspace: workspaceId }).lean();
  return c
    ? { provider: c.provider, providerName: PROVIDERS[c.provider].name, email: c.email, status: c.status, lastError: c.lastError,
        connectedAt: c.updatedAt, lastUsedAt: c.lastUsedAt }
    : null;
};

/* Refresh-check so the status shown is real, not just stored */
export const verifyConnection = async (workspaceId) => {
  try {
    await getAccessToken(workspaceId);
  } catch {
    /* status/lastError already recorded */
  }
  return connectionStatus(workspaceId);
};

export const disconnect = async (workspaceId) => {
  const conn = await loadWithTokens(workspaceId);
  if (!conn) return false;
  // Best effort revoke; local tokens are deleted regardless
  await revokeGoogle(conn.provider, decrypt(conn.refreshToken) || decrypt(conn.accessToken));
  await EmailConnection.deleteOne({ _id: conn._id, workspace: workspaceId });
  return { provider: conn.provider, email: conn.email };
};

/* ---------------- Sending ---------------- */
const b64url = (s) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const header = (v) => String(v).replace(/[\r\n]+/g, " ");
const encodeSubject = (s) => `=?UTF-8?B?${Buffer.from(header(s)).toString("base64")}?=`;

/* Sends from the workspace's connected mailbox. Returns null when the
   workspace has no connection (caller decides the fallback). */
export const sendViaConnectedAccount = async (workspaceId, { to, subject, message }) => {
  const auth = await getAccessToken(workspaceId);
  if (!auth) return null;
  const { conn, token } = auth;

  let res;
  if (conn.provider === "google") {
    const mime = [
      `From: ${header(conn.email)}`,
      `To: ${header(to)}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(String(message)).toString("base64"),
    ].join("\r\n");
    res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ raw: b64url(mime) }),
    });
  } else {
    res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: { subject: header(subject), body: { contentType: "Text", content: String(message) }, toRecipients: [{ emailAddress: { address: to } }] },
        saveToSentItems: true,
      }),
    });
  }

  if (!res.ok) {
    const err = await providerError(res, `${PROVIDERS[conn.provider].name} send`);
    console.error(`Email send via ${conn.provider} failed:`, err.message);
    const authFailed = res.status === 401 || res.status === 403;
    err.message = authFailed
      ? `${conn.email} no longer allows sending from ReadyTech CRM — please reconnect the account`
      : `${conn.email} couldn't send this email right now — please try again shortly`;
    if (authFailed) {
      await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { status: "error", lastError: err.message } });
    }
    err.status = 502;
    throw err;
  }

  const body = res.status === 202 ? {} : await res.json().catch(() => ({}));
  await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { lastUsedAt: new Date() } });
  return { id: body.id || null, from: conn.email, provider: conn.provider };
};

/* ---------------- Provider detection (email → google | microsoft | null) ---------------- */
const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
const MS_DOMAINS = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.in", "hotmail.co.uk", "live.in"]);

export const detectProvider = async (email) => {
  const domain = String(email || "").trim().toLowerCase().split("@")[1];
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  if (GOOGLE_DOMAINS.has(domain)) return "google";
  if (MS_DOMAINS.has(domain)) return "microsoft";
  // Custom domains: look at who hosts the mailbox (best effort, 3s cap)
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    const hosts = mx.map((m) => m.exchange.toLowerCase()).join(" ");
    if (/google\.com|googlemail\.com/.test(hosts)) return "google";
    if (/outlook\.com|office365|microsoft/.test(hosts)) return "microsoft";
  } catch {
    /* unknown — user picks */
  }
  return null;
};
