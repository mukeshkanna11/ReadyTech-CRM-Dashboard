// services/emailOAuth.service.js — per-workspace Gmail / Microsoft 365
// OAuth (authorization code flow), token refresh and sending.
// Uses fetch only (no SDKs). Tokens never leave this module unencrypted.
import crypto from "node:crypto";
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
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    limitations:
      "Sends only (gmail.send scope) — no inbox sync. Gmail daily sending limits apply (~500/day personal, ~2,000/day Workspace). Apps in Google 'Testing' mode expire refresh tokens after 7 days.",
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
    limitations:
      "Sends only (Mail.Send) — no inbox sync. Exchange Online limits apply (~10,000 recipients/day). Some organisations require admin consent for Mail.Send. Disconnecting removes tokens here; revoke app access in your Microsoft account to fully withdraw consent.",
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

export const buildAuthUrl = ({ provider, userId, workspaceId }) => {
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
  const email = await fetchAccountEmail(provider, t.access_token);

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
  return email;
};

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
    conn.status = "error";
    conn.lastError = err.invalidGrant ? "Access was revoked or expired — reconnect the account" : err.message;
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
  if (conn.provider === "google") {
    // Best effort revoke; local tokens are deleted regardless
    const token = decrypt(conn.refreshToken) || decrypt(conn.accessToken);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => {});
  }
  await EmailConnection.deleteOne({ _id: conn._id, workspace: workspaceId });
  return true;
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
    if (res.status === 401 || res.status === 403) {
      await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { status: "error", lastError: err.message } });
    }
    err.status = 502;
    throw err;
  }

  const body = res.status === 202 ? {} : await res.json().catch(() => ({}));
  await EmailConnection.updateOne({ _id: conn._id, workspace: workspaceId }, { $set: { lastUsedAt: new Date() } });
  return { id: body.id || null, from: conn.email, provider: conn.provider };
};
