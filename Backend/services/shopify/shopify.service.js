// services/shopify/shopify.service.js — per-workspace Shopify connection:
// OAuth (authorization code grant), HMAC verification, GraphQL Admin API
// client, token refresh, webhook registration and lifecycle webhooks.
// Uses fetch only (no SDK). Tokens never leave this module unencrypted.
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import ShopifyConnection from "../../models/ShopifyConnection.js";
import AuditLog from "../../models/AuditLog.js";
import { runWithWorkspace } from "../../utils/workspaceContext.js";
import { encrypt, decrypt } from "./crypto.js";
import { INBOX_TOPICS, toSubscriptionTopic, recordEvent, redactCustomer, countCustomerEvents, deleteShopEvents } from "./inbox.service.js";

/* ---------------- Configuration ---------------- */
const env = (k) => process.env[k]?.trim();

export const REQUIRED_ENV = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_SCOPES",
  "SHOPIFY_API_VERSION",
  "SHOPIFY_OAUTH_REDIRECT_URI",
  "SHOPIFY_WEBHOOK_URL",
  "SHOPIFY_TOKEN_ENCRYPTION_KEY",
];
export const missingConfig = () => REQUIRED_ENV.filter((k) => !env(k));

/* Topics this app subscribes every connected store to */
export const WEBHOOK_TOPICS = ["APP_UNINSTALLED", ...INBOX_TOPICS.map(toSubscriptionTopic)];

const TIMEOUT = 15_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* ---------------- Shop domain ---------------- */
const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/* "my-store", "my-store.myshopify.com" or its admin URL → canonical domain, else null */
export const normalizeShop = (input) => {
  let s = String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (s && !s.includes(".")) s = `${s}.myshopify.com`;
  return SHOP_RE.test(s) ? s : null;
};

/* ---------------- HMAC ---------------- */
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/* OAuth redirect: hex HMAC over the sorted query string without hmac/signature */
export const verifyCallbackHmac = (searchParams) => {
  const hmac = searchParams.get("hmac");
  const secret = env("SHOPIFY_API_SECRET");
  if (!hmac || !secret) return false;
  const message = [...searchParams.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return safeEqual(crypto.createHmac("sha256", secret).update(message).digest("hex"), hmac);
};

/* Webhooks: base64 HMAC over the raw request body */
export const verifyWebhookHmac = (rawBody, header) => {
  const secret = env("SHOPIFY_API_SECRET");
  if (!rawBody || !header || !secret) return false;
  return safeEqual(crypto.createHmac("sha256", secret).update(rawBody).digest("base64"), header);
};

/* ---------------- OAuth state (CSRF + workspace + shop binding) ---------------- */
const STATE_PURPOSE = "shopify-oauth";

export const buildAuthUrl = ({ shop, userId, workspaceId }) => {
  const state = jwt.sign(
    { purpose: STATE_PURPOSE, shop, uid: String(userId), ws: String(workspaceId), nonce: crypto.randomBytes(12).toString("hex") },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env("SHOPIFY_API_KEY"));
  url.searchParams.set("scope", env("SHOPIFY_SCOPES"));
  url.searchParams.set("redirect_uri", env("SHOPIFY_OAUTH_REDIRECT_URI"));
  url.searchParams.set("state", state);
  return url.toString();
};

export const verifyState = (state, shop) => {
  const d = jwt.verify(String(state || ""), process.env.JWT_SECRET);
  if (d?.purpose !== STATE_PURPOSE || d.shop !== shop) throw new Error("Invalid OAuth state");
  return d;
};

/* write_x implies read_x, and Shopify omits the implied scope from the grant */
export const missingScopes = (grantedScopes) => {
  const granted = new Set((Array.isArray(grantedScopes) ? grantedScopes : String(grantedScopes || "").split(",")).map((s) => String(s).trim()).filter(Boolean));
  return env("SHOPIFY_SCOPES").split(",").map((s) => s.trim()).filter(Boolean)
    .filter((s) => !granted.has(s) && !(s.startsWith("read_") && granted.has(`write_${s.slice(5)}`)));
};

export const assertScopes = (grantedScope) => {
  const granted = new Set(String(grantedScope || "").split(",").map((s) => s.trim()).filter(Boolean));
  const missing = missingScopes(grantedScope);
  if (missing.length) throw httpError(422, `Shopify did not grant the required permissions: ${missing.join(", ")}`);
  return [...granted];
};

/* ---------------- Tokens ---------------- */
const tokenRequest = async (shop, params) => {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: env("SHOPIFY_API_KEY"), client_secret: env("SHOPIFY_API_SECRET"), ...params }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const detail = body.error_description || body.error || body.errors || res.statusText;
    const err = new Error(`Shopify token request failed (${res.status}): ${String(detail).slice(0, 200)}`);
    err.invalidGrant = res.status === 400 || res.status === 401;
    throw err;
  }
  return body;
};

const inSeconds = (s) => (s ? new Date(Date.now() + Number(s) * 1000) : null);

/* Expiring offline tokens (with refresh) unless explicitly disabled; both shapes handled */
const wantsExpiringTokens = () => env("SHOPIFY_EXPIRING_OFFLINE_TOKENS") !== "false";

const markError = (conn, message) =>
  ShopifyConnection.updateOne(
    { _id: conn._id, workspace: conn.workspace, status: "active" },
    { $set: { status: "error", lastError: String(message).slice(0, 300) } }
  ).catch((err) => console.error("Shopify markError failed:", err.message));

/* `conn` must be loaded with +accessToken +refreshToken */
export const getAccessToken = async (conn) => {
  const exp = conn.accessTokenExpiresAt ? new Date(conn.accessTokenExpiresAt).getTime() : null;
  if (conn.accessToken && (exp === null || exp - 5 * 60_000 > Date.now())) return decrypt(conn.accessToken);

  if (conn.refreshToken) {
    try {
      const t = await tokenRequest(conn.shopDomain, { grant_type: "refresh_token", refresh_token: decrypt(conn.refreshToken) });
      const set = { accessToken: encrypt(t.access_token), accessTokenExpiresAt: inSeconds(t.expires_in) };
      if (t.refresh_token) Object.assign(set, { refreshToken: encrypt(t.refresh_token), refreshTokenExpiresAt: inSeconds(t.refresh_token_expires_in) });
      // Compare-and-set on the old token: a concurrent refresh may already have rotated it
      const r = await ShopifyConnection.updateOne({ _id: conn._id, workspace: conn.workspace, accessToken: conn.accessToken }, { $set: set });
      if (r.modifiedCount) return t.access_token;
    } catch (err) {
      if (!err.invalidGrant) throw err;
    }
    const fresh = await ShopifyConnection.findOne({ _id: conn._id, workspace: conn.workspace }, "accessToken accessTokenExpiresAt", { lean: true });
    if (fresh?.accessToken && fresh.accessToken !== conn.accessToken && new Date(fresh.accessTokenExpiresAt) > Date.now()) {
      return decrypt(fresh.accessToken);
    }
  }

  await markError(conn, "Shopify access expired — reconnect the store");
  throw Object.assign(new Error("Shopify access expired — reconnect the store"), { unauthorized: true });
};

/* ---------------- GraphQL Admin API ---------------- */
const errorText = (errors) =>
  (Array.isArray(errors) ? errors.map((e) => e.message).join("; ") : String(errors)).slice(0, 300);

export const graphql = async (shop, token, query, variables = {}, { attempts = 4 } = {}) => {
  for (let i = 1; ; i++) {
    let res;
    let body;
    try {
      res = await fetch(`https://${shop}/admin/api/${env("SHOPIFY_API_VERSION")}/graphql.json`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "x-shopify-access-token": token },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      if (i >= attempts) throw err;
      await sleep(500 * 2 ** i);
      continue;
    }

    const throttled = res.status === 429 || (Array.isArray(body.errors) && body.errors.some((e) => e.extensions?.code === "THROTTLED"));
    if ((throttled || res.status >= 500) && i < attempts) {
      await sleep(1000 * 2 ** (i - 1));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error("Shopify rejected the access token"), { unauthorized: true });
    }
    if (!res.ok || body.errors) {
      throw Object.assign(new Error(`Shopify GraphQL error (${res.status}): ${errorText(body.errors || res.statusText)}`), { upstream: true });
    }
    return body.data;
  }
};

/* Runs a query for a stored connection, refreshing the token and flagging revoked access */
export const connectionGraphql = async (conn, query, variables) => {
  try {
    return await graphql(conn.shopDomain, await getAccessToken(conn), query, variables);
  } catch (err) {
    if (err.unauthorized) await markError(conn, err.message);
    throw err;
  }
};

const SHOP_QUERY = `query { shop { id name email myshopifyDomain currencyCode } }`;

const CREATE_WEBHOOK = `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
    webhookSubscription { id }
    userErrors { field message }
  }
}`;

/* Idempotent: an existing subscription for the same address counts as registered */
export const registerWebhooks = async (shop, token) => {
  const registered = [];
  const errors = [];
  for (const topic of WEBHOOK_TOPICS) {
    try {
      const data = await graphql(shop, token, CREATE_WEBHOOK, { topic, sub: { uri: env("SHOPIFY_WEBHOOK_URL") } });
      const userErrors = data?.webhookSubscriptionCreate?.userErrors || [];
      if (userErrors.length && !userErrors.every((e) => /already been taken/i.test(e.message))) {
        throw new Error(userErrors.map((e) => e.message).join("; "));
      }
      registered.push(topic);
    } catch (err) {
      errors.push(`${topic}: ${err.message}`);
    }
  }
  return { registered, lastRegisteredAt: new Date(), lastError: errors.length ? errors.join(" | ").slice(0, 500) : null };
};

/* ---------------- Audit ---------------- */
export const audit = (conn, action, description, meta = {}) => {
  if (!conn?.connectedBy) return Promise.resolve();
  return AuditLog.create({
    user: conn.connectedBy,
    action,
    entity: "ShopifyConnection",
    entityId: conn._id,
    description,
    target: conn.shopDomain,
    meta,
    workspace: conn.workspace,
  }).catch((err) => console.error("Shopify audit log failed:", err.message));
};

/* ---------------- Connect / disconnect ---------------- */

/* OAuth callback: code → token → verify store → claim it for THIS workspace.
   A store already active in another workspace is refused (never reassigned). */
export const completeConnection = async ({ shop, code, workspaceId, userId }) => {
  const t = await tokenRequest(shop, { code, ...(wantsExpiringTokens() && { expiring: 1 }) });
  const scopes = assertScopes(t.scope);

  const info = (await graphql(shop, t.access_token, SHOP_QUERY))?.shop;
  if (String(info?.myshopifyDomain || "").toLowerCase() !== shop) throw new Error("Shopify returned a different store");

  const current = await ShopifyConnection.findOne(
    { workspace: workspaceId, status: "active", shopDomain: { $ne: shop } },
    "shopDomain",
    { lean: true }
  );
  if (current) throw httpError(409, `This workspace is already connected to ${current.shopDomain}. Disconnect it first.`);

  const webhooks = await registerWebhooks(shop, t.access_token);
  const now = new Date();

  let conn;
  try {
    // Matches: this shop when not active anywhere, or already this workspace's.
    // Active in another workspace → no match → the upsert hits the unique
    // shopDomain index (E11000). Their token is NOT revoked: that would
    // uninstall the app and break the owning workspace.
    conn = await ShopifyConnection.findOneAndUpdate(
      { shopDomain: shop, workspace: { $exists: true }, $or: [{ status: { $ne: "active" } }, { workspace: workspaceId }] },
      {
        $set: {
          workspace: workspaceId,
          status: "active",
          accessToken: encrypt(t.access_token),
          accessTokenExpiresAt: inSeconds(t.expires_in),
          refreshToken: t.refresh_token ? encrypt(t.refresh_token) : null,
          refreshTokenExpiresAt: inSeconds(t.refresh_token_expires_in),
          scopes,
          apiVersion: env("SHOPIFY_API_VERSION"),
          shop: { id: info.id, name: info.name, email: info.email, currencyCode: info.currencyCode },
          webhooks,
          connectedBy: userId,
          connectedAt: now,
          disconnectedAt: null,
          uninstalledAt: null,
          lastError: null,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    throw httpError(
      409,
      err.keyPattern?.shopDomain
        ? "This Shopify store is already connected to another ReadyTech workspace."
        : "This workspace already has a connected Shopify store. Disconnect it first."
    );
  }

  await audit(conn, "CREATE", `Connected Shopify store ${shop}`, { scopes, webhooks: webhooks.registered });
  return conn;
};

/* Re-subscribes the workspace's active store to WEBHOOK_TOPICS (idempotent) */
export const refreshWebhooks = async (workspaceId) => {
  const conn = await ShopifyConnection.findOne({ workspace: workspaceId, status: "active" }).select("+accessToken +refreshToken");
  if (!conn) return null;
  const webhooks = await registerWebhooks(conn.shopDomain, await getAccessToken(conn));
  await ShopifyConnection.updateOne({ _id: conn._id, workspace: conn.workspace }, { $set: { webhooks } });
  await audit(conn, "UPDATE", `Re-registered Shopify webhooks for ${conn.shopDomain}`, { registered: webhooks.registered });
  return webhooks;
};

export const getStatus = async (workspaceId) => {
  const conn =
    (await ShopifyConnection.findOne({ workspace: workspaceId, status: "active" })) ||
    (await ShopifyConnection.findOne({ workspace: workspaceId }).sort({ updatedAt: -1 }));
  return conn ? conn.toSafeJSON() : null;
};

const CLEARED_TOKENS = { accessToken: null, accessTokenExpiresAt: null, refreshToken: null, refreshTokenExpiresAt: null };

/* Uninstalls the app from the store (revokes the token at Shopify, best effort),
   then forgets the token locally */
export const disconnect = async (workspaceId) => {
  const conn = await ShopifyConnection.findOne({ workspace: workspaceId, status: { $in: ["active", "error"] } }).select("+accessToken +refreshToken");
  if (!conn) return null;

  try {
    const res = await fetch(`https://${conn.shopDomain}/admin/api_permissions/current.json`, {
      method: "DELETE",
      headers: { "x-shopify-access-token": await getAccessToken(conn) },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok && res.status !== 401) console.warn(`Shopify revoke for ${conn.shopDomain} returned ${res.status}`);
  } catch (err) {
    console.warn(`Shopify revoke for ${conn.shopDomain} failed:`, err.message);
  }

  await ShopifyConnection.updateOne(
    { _id: conn._id, workspace: conn.workspace },
    { $set: { ...CLEARED_TOKENS, status: "disconnected", disconnectedAt: new Date(), "webhooks.registered": [] } }
  );
  await audit(conn, "DELETE", `Disconnected Shopify store ${conn.shopDomain}`);
  return conn;
};

/* ---------------- Webhooks: lifecycle + privacy inline, data topics → inbox ---------------- */

/* Caller must have verified the HMAC. The tenant comes ONLY from the stored
   connection of the shop; unknown shops are dropped, never defaulted. */
export const handleWebhook = async ({ topic, shop, webhookId, eventId, triggeredAt, apiVersion, payload, rawBody }) => {
  const shopDomain = normalizeShop(shop);
  const conn = shopDomain && (await ShopifyConnection.findByShop(shopDomain));
  if (!conn) return { ignored: "unknown shop" };

  return runWithWorkspace(conn.workspace, async () => {
    const scoped = { _id: conn._id, workspace: conn.workspace };

    // Data topics → durable inbox (processed by webhookWorker.js)
    if (INBOX_TOPICS.includes(topic)) {
      if (conn.status !== "active") return { ignored: "store not connected" };
      return recordEvent({ conn, topic, webhookId, eventId, triggeredAt, apiVersion, payload, rawBody });
    }

    switch (topic) {
      case "app/uninstalled": {
        const r = await ShopifyConnection.updateOne(
          { ...scoped, status: { $in: ["active", "error"] } },
          { $set: { ...CLEARED_TOKENS, status: "uninstalled", uninstalledAt: new Date(), "webhooks.registered": [] } }
        );
        if (r.modifiedCount) await audit(conn, "UPDATE", `Shopify app uninstalled from ${conn.shopDomain}`, { webhookId });
        return { handled: topic };
      }

      // 48h after uninstall. Phase 1 stores no shop data beyond the connection.
      case "shop/redact": {
        if (conn.status === "active") return { ignored: "store reinstalled" };
        const events = await deleteShopEvents(conn);
        await ShopifyConnection.deleteOne({ ...scoped, status: { $ne: "active" } });
        await audit(conn, "DELETE", `Shopify shop/redact: erased data for ${conn.shopDomain}`, { webhookId, events });
        return { handled: topic };
      }

      // Customer data is held only in stored webhook payloads (customer sync is Phase 3)
      case "customers/data_request": {
        const events = await countCustomerEvents(conn, payload);
        await audit(conn, "EXPORT", `Shopify customers/data_request: customer ${payload?.customer?.id ?? "?"} appears in ${events} stored webhook event(s)`, { webhookId, events });
        return { handled: topic };
      }

      case "customers/redact": {
        const events = await redactCustomer(conn, payload);
        await audit(conn, "DELETE", `Shopify customers/redact: redacted ${events} stored webhook event(s)`, { webhookId, events });
        return { handled: topic };
      }

      default:
        return { ignored: "topic not handled yet" };
    }
  });
};
