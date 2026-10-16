import MetaConnection from "../../models/MetaConnection.js";
import User from "../../models/User.js";
import { usesPlatformCredentials } from "../../utils/workspaceContext.js";
import { encryptToken, decryptToken } from "./tokenVault.js";
import { getMetaConfig, explainMetaError, subscribePageWebhook } from "./meta.service.js";

/* =========================================================
   INSTAGRAM API WITH INSTAGRAM LOGIN (Instagram Inbox)
   Official flow: instagram.com/oauth/authorize → short-lived token
   → long-lived (60 days) → graph.instagram.com. Tokens are stored
   encrypted on the workspace's own MetaConnection.
   The default workspace (Siva) may also use INSTAGRAM_ACCESS_TOKEN;
   no other workspace ever reads it.
========================================================= */
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"];
const IG_GRAPH = "https://graph.instagram.com";

export const getInstagramConfig = () => {
  const { redirectUri: metaRedirect, apiVersion } = getMetaConfig();
  let derived = null;
  try {
    derived = metaRedirect ? `${new URL(metaRedirect).origin}/api/meta/instagram/oauth/callback` : null;
  } catch {
    derived = null;
  }

  const config = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || derived,
    apiVersion,
  };
  const missing = Object.entries({
    INSTAGRAM_APP_ID: config.appId,
    INSTAGRAM_APP_SECRET: config.appSecret,
    INSTAGRAM_REDIRECT_URI: config.redirectUri,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return { ...config, missing, configured: missing.length === 0 };
};

const fail = (message, status = 400, code = null) =>
  Object.assign(new Error(message), { status, code });

const igFetch = async (path, { token, method = "GET", params, body, base } = {}) => {
  const { apiVersion } = getInstagramConfig();
  const url = new URL(base || `${IG_GRAPH}/${apiVersion}/${String(path).replace(/^\/+/, "")}`);
  Object.entries(params || {}).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body instanceof URLSearchParams ? {} : body ? { "Content-Type": "application/json" } : {}),
    },
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  const err = data?.error || (data?.error_message ? { message: data.error_message, code: data.code } : null);

  if (!res.ok || err) {
    // Never include the token in errors/logs
    throw fail(explainMetaError(err, `Instagram API request failed (${res.status})`), 400, err?.code ?? null);
  }
  return data;
};

/* Active workspace's Instagram token. Workspace token first; the env
   token is offered ONLY to the default workspace. */
export const resolveInstagramLogin = async () => {
  const connection = await MetaConnection.getSingleton();
  const il = connection.instagramLogin || {};

  if (il.encryptedToken) {
    return { connection, token: decryptToken(il.encryptedToken), source: "workspace" };
  }
  if (usesPlatformCredentials() && process.env.INSTAGRAM_ACCESS_TOKEN) {
    return { connection, token: process.env.INSTAGRAM_ACCESS_TOKEN, source: "platform" };
  }
  return { connection, token: null, source: null };
};

/* Facebook-Login path: the workspace's connected Page token can read and
   reply to its linked Instagram account (instagram_manage_messages).
   This is Siva's working connection; preferred when present. */
export const resolveInstagramPage = (connection) => {
  if (connection?.status !== "connected") return null;
  if (!connection.facebookPage?.encryptedToken || !connection.instagram?.id) return null;
  if ((connection.scopes || []).length && !connection.scopes.includes("instagram_manage_messages")) return null;
  return {
    pageId: connection.facebookPage.id,
    igId: connection.instagram.id,
    token: decryptToken(connection.facebookPage.encryptedToken),
  };
};

export const fbGet = async (path, token, params = {}) => {
  const { apiVersion } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw fail(explainMetaError(data?.error, `Meta request failed (${res.status})`), 400, data?.error?.code ?? null);
  }
  return data;
};

/* ================= OAUTH ================= */
export const buildInstagramAuthUrl = (state) => {
  const { appId, redirectUri } = getInstagramConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", IG_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
};

const readProfile = (token) =>
  igFetch("me", { token, params: { fields: "user_id,username,name,profile_picture_url,account_type" } });

/* One Instagram account belongs to ONE workspace (webhook routing) */
const assertUnclaimed = async (key, igId) => {
  const other = await MetaConnection.findOne({
    key: { $ne: key },
    $or: [{ "instagramLogin.id": igId }, { "instagram.id": igId }],
  })
    .select("_id")
    .lean();
  if (other) throw fail("This Instagram account is already connected to another workspace", 409);
};

const subscribeWebhook = async (token) => {
  const data = await igFetch("me/subscribed_apps", {
    token,
    method: "POST",
    params: { subscribed_fields: "messages" },
  });
  return data?.success === true;
};

export const completeInstagramConnection = async ({ code, userId }) => {
  const { appId, appSecret, redirectUri } = getInstagramConfig();
  const owner = userId ? await User.findById(userId).select("_id workspace").lean() : null;
  if (!owner) throw fail("Connecting user not found"); // never Siva's doc

  const short = await igFetch(null, {
    base: "https://api.instagram.com/oauth/access_token",
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: String(code).replace(/#_$/, ""),
    }),
  });
  const shortData = Array.isArray(short?.data) ? short.data[0] : short;

  const long = await igFetch(null, {
    base: `${IG_GRAPH}/access_token`,
    params: { grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortData.access_token },
  });

  const profile = await readProfile(long.access_token);
  const igId = String(profile.user_id || shortData.user_id);

  const connection = await MetaConnection.getSingleton(owner.workspace || owner._id);
  await assertUnclaimed(connection.key, igId);

  let webhookSubscribed = false;
  let lastError = null;
  try {
    webhookSubscribed = await subscribeWebhook(long.access_token);
  } catch (error) {
    lastError = `Webhook subscribe failed: ${error.message}`;
  }

  const granted = String(shortData.permissions || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  connection.instagramLogin = {
    id: igId,
    username: profile.username || null,
    name: profile.name || null,
    profilePictureUrl: profile.profile_picture_url || null,
    encryptedToken: encryptToken(long.access_token),
    expiresAt: long.expires_in ? new Date(Date.now() + Number(long.expires_in) * 1000) : null,
    scopes: granted.length ? granted : [],
    tokenInvalid: false,
    webhookSubscribed,
    connectedAt: new Date(),
    lastSyncedAt: new Date(),
    lastError,
  };
  connection.releasedAssetIds = (connection.releasedAssetIds || []).filter((id) => id !== igId);
  await connection.save();
  return connection;
};

/* ================= STATUS CHECK (real Graph call) ================= */
export const refreshInstagramConnection = async () => {
  const resolved = await resolveInstagramLogin();
  const page = resolveInstagramPage(resolved.connection);

  if (page) {
    // Real check of the Page → Instagram link with the Page token
    const { connection } = resolved;
    try {
      const ig = await fbGet(page.igId, page.token, { fields: "username,name,profile_picture_url" });
      connection.instagram.username = ig.username || connection.instagram.username;
      connection.instagram.name = ig.name || connection.instagram.name;
      connection.instagram.profilePictureUrl = ig.profile_picture_url || connection.instagram.profilePictureUrl;
      connection.lastSyncedAt = new Date();
      connection.lastError = null;
    } catch (error) {
      connection.lastError = error.message;
      await connection.save();
      throw error;
    }
    // A separate Instagram-Login token is optional here — check it, non-fatal
    if (resolved.token) {
      await refreshLoginToken(resolved).catch(() => {});
    }
    await connection.save();
    return connection;
  }

  return refreshLoginToken(resolved);
};

const refreshLoginToken = async ({ connection, token, source }) => {
  if (!token) throw fail("Instagram is not connected for this workspace");

  const il = connection.instagramLogin;
  il.lastSyncedAt = new Date();

  try {
    let active = token;
    // Long-lived workspace tokens are refreshable after 24h (60-day validity)
    if (source === "workspace" && il.connectedAt && Date.now() - il.connectedAt.getTime() > 864e5) {
      try {
        const r = await igFetch(null, {
          base: `${IG_GRAPH}/refresh_access_token`,
          params: { grant_type: "ig_refresh_token", access_token: token },
        });
        active = r.access_token;
        il.encryptedToken = encryptToken(active);
        if (r.expires_in) il.expiresAt = new Date(Date.now() + Number(r.expires_in) * 1000);
      } catch (error) {
        console.error("Instagram token refresh failed:", error.message);
      }
    }

    const profile = await readProfile(active);
    const igId = String(profile.user_id);
    await assertUnclaimed(connection.key, igId);

    Object.assign(il, {
      id: igId,
      username: profile.username || null,
      name: profile.name || null,
      profilePictureUrl: profile.profile_picture_url || null,
      tokenInvalid: false,
      lastError: null,
    });
  } catch (error) {
    il.tokenInvalid = Number(error.code) === 190;
    il.lastError = error.message;
    await connection.save();
    throw error;
  }

  await connection.save();
  return connection;
};

export const subscribeInstagramWebhook = async () => {
  const { connection, token } = await resolveInstagramLogin();
  if (resolveInstagramPage(connection)) {
    // Facebook-Login path: Page subscription (needs pages_manage_metadata)
    await subscribePageWebhook();
    return MetaConnection.getSingleton();
  }
  if (!token) throw fail("Instagram is not connected for this workspace");
  connection.instagramLogin.webhookSubscribed = await subscribeWebhook(token);
  await connection.save();
  return connection;
};

export const disconnectInstagramConnection = async () => {
  const connection = await MetaConnection.getSingleton();
  const id = connection.instagramLogin?.id;
  if (connection.key !== "default" && id) {
    connection.releasedAssetIds = [...new Set([...(connection.releasedAssetIds || []), id])];
  }
  connection.instagramLogin = {};
  await connection.save();
  return connection;
};

/* ================= MESSAGING ================= */
export const sendInstagramLoginMessage = async (token, recipientId, text) =>
  igFetch("me/messages", {
    token,
    method: "POST",
    body: { recipient: { id: recipientId }, message: { text } },
  });

/* Customer name/username (User Profile API; allowed once they messaged) */
export const fetchInstagramProfile = async (token, igsid) =>
  igFetch(igsid, { token, params: { fields: "name,username" } });
