import crypto from "crypto";
import jwt from "jsonwebtoken";

import MetaConnection from "../../models/MetaConnection.js";
import { encryptToken, decryptToken } from "./tokenVault.js";

/* =========================================================
   META GRAPH SERVICE
   Single source of truth for the ONE centralized Meta
   connection used by CRM, ERP and AI Content.
   Facebook <-> Instagram linkage is already done inside
   Meta Business — this service only READS that linkage.
========================================================= */

/* Only permissions this app can currently request. Instagram
   permissions (instagram_basic, instagram_manage_insights) and
   pages_read_engagement are rejected as "Invalid Scopes" until the
   Instagram product is added to the Meta app and approved — re-add
   them here once available. */
const OAUTH_SCOPES = [
  "public_profile",
  "business_management",
  "pages_show_list",
];

const STATE_PURPOSE = "meta_oauth";
const STATE_TTL = "10m";

/* ================= CONFIG ================= */
export const getMetaConfig = () => {
  const config = {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    portfolioId: process.env.META_BUSINESS_PORTFOLIO_ID,
    redirectUri: process.env.META_REDIRECT_URI,
    apiVersion: process.env.META_API_VERSION || "v21.0",
  };

  const missing = Object.entries({
    META_APP_ID: config.appId,
    META_APP_SECRET: config.appSecret,
    META_REDIRECT_URI: config.redirectUri,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { ...config, missing, configured: missing.length === 0 };
};

const graphUrl = (path, params = {}) => {
  const { apiVersion } = getMetaConfig();

  const url = new URL(
    `https://graph.facebook.com/${apiVersion}/${String(path).replace(/^\/+/, "")}`
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

/* ================= GRAPH REQUEST ================= */
const graphRequest = async (path, params = {}) => {
  const response = await fetch(graphUrl(path, params));
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    const message =
      data?.error?.message || `Meta Graph request failed (${response.status})`;

    const error = new Error(message);
    error.status = response.status === 401 || response.status === 403 ? 400 : 502;
    throw error;
  }

  return data;
};

/* =========================================================
   OAUTH — STATE (CSRF protection, signed with JWT_SECRET)
========================================================= */
export const createOAuthState = (userId) =>
  jwt.sign(
    {
      purpose: STATE_PURPOSE,
      uid: String(userId),
      nonce: crypto.randomBytes(12).toString("hex"),
    },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL }
  );

export const verifyOAuthState = (state) => {
  const decoded = jwt.verify(state, process.env.JWT_SECRET);

  if (decoded?.purpose !== STATE_PURPOSE) {
    throw new Error("Invalid OAuth state purpose");
  }

  return decoded;
};

/* =========================================================
   OAUTH — LOGIN URL
========================================================= */
export const buildOAuthUrl = (state) => {
  const { appId, redirectUri, apiVersion } = getMetaConfig();

  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPES.join(","));

  return url.toString();
};

/* =========================================================
   OAUTH — CODE -> LONG LIVED TOKEN
========================================================= */
const exchangeCodeForToken = async (code) => {
  const { appId, appSecret, redirectUri } = getMetaConfig();

  const shortLived = await graphRequest("oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const longLived = await graphRequest("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  const expiresIn = Number(longLived.expires_in || 0);

  return {
    accessToken: longLived.access_token,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
};

/* =========================================================
   READ EXISTING FACEBOOK PAGE + LINKED INSTAGRAM
   Does NOT reconnect or merge accounts — read only.
========================================================= */
const fetchLinkedAssets = async (userAccessToken) => {
  const { portfolioId } = getMetaConfig();

  const { data: pages = [] } = await graphRequest("me/accounts", {
    access_token: userAccessToken,
    fields:
      "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
    limit: 100,
  });

  if (!pages.length) {
    const error = new Error(
      "No Facebook Page found for this Meta account. Check the Business Portfolio permissions."
    );
    error.status = 400;
    throw error;
  }

  // Prefer a Page that already has the linked Instagram Business account
  const page =
    pages.find((p) => p.instagram_business_account?.id) || pages[0];

  let instagram = page.instagram_business_account || null;

  /* Fallback: the user token sometimes omits the Instagram edge.
     Re-read it from the Page itself with the Page access token.
     Non-fatal — needs pages_read_engagement + instagram_basic. */
  if (!instagram?.id && page.access_token) {
    try {
      const linked = await graphRequest(page.id, {
        access_token: page.access_token,
        fields:
          "instagram_business_account{id,username,name,profile_picture_url}",
      });

      instagram = linked.instagram_business_account || null;
    } catch (error) {
      console.error("Instagram link lookup failed:", error.message);
    }
  }

  /* Business Portfolio: env wins, else read the connected portfolio
     (allowed by business_management). Non-fatal. */
  let businessPortfolioId = portfolioId || null;

  if (!businessPortfolioId) {
    try {
      const { data: businesses = [] } = await graphRequest("me/businesses", {
        access_token: userAccessToken,
        fields: "id,name",
        limit: 10,
      });

      businessPortfolioId = businesses[0]?.id || null;
    } catch (error) {
      console.error("Business portfolio lookup failed:", error.message);
    }
  }

  return {
    businessPortfolioId,
    facebookPage: {
      id: page.id,
      name: page.name,
      encryptedToken: encryptToken(page.access_token),
    },
    instagram: {
      id: instagram?.id || null,
      username: instagram?.username || null,
      name: instagram?.name || null,
      profilePictureUrl: instagram?.profile_picture_url || null,
    },
  };
};

/* =========================================================
   CONNECT (OAuth callback)
========================================================= */
export const completeConnection = async ({ code, userId }) => {
  const { accessToken, expiresAt } = await exchangeCodeForToken(code);
  const assets = await fetchLinkedAssets(accessToken);

  const connection = await MetaConnection.getSingleton();

  connection.status = "connected";
  connection.scopes = OAUTH_SCOPES;
  connection.userToken = {
    encrypted: encryptToken(accessToken),
    expiresAt,
  };
  connection.businessPortfolioId = assets.businessPortfolioId;
  connection.facebookPage = assets.facebookPage;
  connection.instagram = assets.instagram;
  connection.lastSyncedAt = new Date();
  connection.lastError = null;
  connection.connectedBy = userId || null;
  connection.connectedAt = new Date();
  connection.disconnectedAt = null;

  await connection.save();

  return connection;
};

/* =========================================================
   REFRESH STATUS (re-read Page / Instagram from Graph)
========================================================= */
export const refreshConnection = async () => {
  const connection = await MetaConnection.getSingleton();

  if (!connection.userToken?.encrypted) {
    const error = new Error("Meta is not connected");
    error.status = 400;
    throw error;
  }

  try {
    const assets = await fetchLinkedAssets(
      decryptToken(connection.userToken.encrypted)
    );

    connection.status = "connected";
    connection.businessPortfolioId = assets.businessPortfolioId;
    connection.facebookPage = assets.facebookPage;
    connection.instagram = assets.instagram;
    connection.lastSyncedAt = new Date();
    connection.lastError = null;
  } catch (error) {
    connection.status = "error";
    connection.lastError = error.message;
    await connection.save();
    throw error;
  }

  await connection.save();

  return connection;
};

/* =========================================================
   DISCONNECT (local revoke — clears stored tokens)
========================================================= */
export const disconnectConnection = async () => {
  const connection = await MetaConnection.getSingleton();

  connection.status = "disconnected";
  connection.scopes = [];
  connection.userToken = { encrypted: null, expiresAt: null };
  connection.facebookPage = { id: null, name: null, encryptedToken: null };
  connection.instagram = {
    id: null,
    username: null,
    name: null,
    profilePictureUrl: null,
  };
  connection.lastError = null;
  connection.disconnectedAt = new Date();
  connection.connectedAt = null;
  connection.connectedBy = null;

  await connection.save();

  return connection;
};

/* =========================================================
   INTERNAL ACCESS CONTEXT
   Reused by CRM / ERP / AI Content modules — do NOT build a
   second Meta authentication anywhere else.
========================================================= */
export const getMetaAccessContext = async () => {
  const connection = await MetaConnection.getSingleton();

  if (connection.status !== "connected" || !connection.userToken?.encrypted) {
    const error = new Error("Meta is not connected");
    error.status = 400;
    throw error;
  }

  return {
    apiVersion: getMetaConfig().apiVersion,
    userAccessToken: decryptToken(connection.userToken.encrypted),
    pageId: connection.facebookPage?.id || null,
    pageAccessToken: connection.facebookPage?.encryptedToken
      ? decryptToken(connection.facebookPage.encryptedToken)
      : null,
    instagramId: connection.instagram?.id || null,
  };
};

export { OAUTH_SCOPES };
