// routes/shopify.routes.js — Shopify Integration (each workspace connects its own store)
import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import User from "../models/User.js";
import {
  missingConfig, missingOAuthConfig, installUrl, normalizeShop, startOAuth, verifyState, verifyCallbackHmac,
  verifyWebhookHmac, claimCallback, finishOAuth,
  INSTALL_COOKIE, freshTimestamp, isInstallState, startInstall, completeInstall, linkInstallation, getStatus, disconnect, handleWebhook, refreshWebhooks, missingScopes,
} from "../services/shopify/shopify.service.js";
import { inboxSummary, retryDeadEvent, listEvents } from "../services/shopify/inbox.service.js";
import { orderSummary } from "../services/shopify/orderSync.service.js";
import {
  listLocations, reconcileSavedLocation, saveInventorySettings, scanVariants, syncInventory, inventorySummary, inventoryPreview,
} from "../services/shopify/inventorySync.service.js";
import ShopifyConnection from "../models/ShopifyConnection.js";

const router = express.Router();

/* Public frontend landing page: keeps the result across a login, then opens
   the workspace's Shopify page (Frontend/src/pages/Integrations/ShopifyReturn.jsx) */
const clientRedirect = (params) =>
  `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/shopify/return?${new URLSearchParams(params)}`;

const NOT_AVAILABLE = "Shopify connection isn't available yet. ReadyTech is finishing a one-time setup — please try again later or contact support.";

/* Friendly callback errors (details are logged server-side) */
const friendlyError = (err) => {
  if (err.status) return err.message;
  if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError" || err.message === "Invalid OAuth state") {
    return "The connection link expired — please click Connect again.";
  }
  if (err.message === "NO_STATE") return "Please start the Shopify connection from ReadyTech CRM → Integrations → Shopify.";
  if (err.message === "INSTALL_BROWSER") return "Please finish installing in the same browser window you started in — open the app from Shopify again.";
  if (err.message === "CANCELLED") return "The Shopify connection was cancelled. Nothing was changed — click Connect with Shopify to try again.";
  return "We couldn't finish connecting your Shopify store. Please try again.";
};

/* Status — any workspace member (no secrets) */
router.get("/status", auth, async (req, res) => {
  try {
    const [connection, inbox, orders, inventory] = await Promise.all([
      getStatus(req.workspace), inboxSummary(req.workspace), orderSummary(req.workspace), inventorySummary(req.workspace),
    ]);
    // Connect / Reconnect work only when OAuth (incl. the state secret) is configured
    const available = missingOAuthConfig().length === 0;
    // Permissions the app needs but this store's grant lacks → reconnect to approve them
    if (connection?.connected && !missingConfig().length) connection.missingScopes = missingScopes(connection.scopes);
    res.json({ success: true, data: { available, installUrl: available ? installUrl() : null, connection, inbox, orders, inventory } });
  } catch (error) {
    console.error("Shopify status error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load Shopify integration status" });
  }
});

/* Start OAuth — admin only; single-use state binds user + workspace + shop */
router.get("/oauth/url", auth, role("admin"), async (req, res) => {
  const missing = missingOAuthConfig();
  if (missing.length) {
    console.warn(`Shopify OAuth not configured — ReadyTech admin: set ${missing.join(", ")}`);
    return res.status(400).json({ success: false, code: "SHOPIFY_NOT_CONFIGURED", message: NOT_AVAILABLE });
  }
  const shop = normalizeShop(req.query.shop);
  if (!shop) return res.status(422).json({ success: false, message: "Enter your store's myshopify.com address, e.g. your-store.myshopify.com" });
  try {
    res.json({ success: true, data: { url: await startOAuth({ shop, userId: req.user._id, workspaceId: req.workspace }) } });
  } catch (error) {
    console.error("Shopify OAuth start error:", error.message);
    res.status(500).json({ success: false, message: "Couldn't start the Shopify connection. Please try again." });
  }
});

/* ---------------- Shopify-started install (App URL) ---------------- */
/* Install cookie: set and read only on Shopify's top-level redirects to this API
   (SameSite=Lax is sent on those), never readable by scripts */
const installCookie = { httpOnly: true, secure: true, sameSite: "lax", path: "/api/shopify", maxAge: 10 * 60_000 };
const readCookie = (req, name) => {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
};

/* Public, signed by Shopify (hmac over the query, fresh timestamp). ALWAYS starts
   OAuth immediately — install and reinstall alike, no ReadyTech login first — with
   a single-use install state bound to this browser. */
router.get("/install", async (req, res) => {
  const params = new URL(req.originalUrl, "http://localhost").searchParams;
  const shop = normalizeShop(params.get("shop"));
  try {
    if (missingOAuthConfig().length) throw Object.assign(new Error(NOT_AVAILABLE), { status: 503 });
    if (!shop || !verifyCallbackHmac(params) || !freshTimestamp(params.get("timestamp"))) {
      throw Object.assign(new Error("This Shopify install link is invalid or has expired. Open the app from Shopify again."), { status: 400 });
    }
    const { url, binder } = await startInstall(shop);
    res.cookie(INSTALL_COOKIE, binder, installCookie);
    return res.redirect(url);
  } catch (err) {
    console.error(`Shopify install start failed (${shop || "invalid shop"}):`, err.message);
    return res.redirect(clientRedirect({ connected: "0", message: friendlyError(err).slice(0, 200) }));
  }
});

/* OAuth callback — public (Shopify redirects the browser), protected by HMAC +
   signed single-use state. It does NOT connect the store: the code is parked
   and only the initiating admin's signed-in session can finish (POST /oauth/complete),
   so an authorize link forwarded to someone else can't attach their store. */
router.get("/oauth/callback", async (req, res) => {
  const params = new URL(req.originalUrl, "http://localhost").searchParams;
  const shop = normalizeShop(params.get("shop"));
  try {
    if (missingOAuthConfig().length) throw new Error("Shopify is not configured");
    if (!params.get("code") && params.get("error")) throw new Error("CANCELLED"); // declined / cancelled in Shopify
    if (!shop || !params.get("code") || !verifyCallbackHmac(params)) throw new Error("Invalid Shopify callback");
    if (!params.get("state")) throw new Error("NO_STATE");

    // Shopify-started install: unbound installation + one-time link code (in the
    // URL fragment, which browsers never send to servers or in Referer headers)
    if (isInstallState(params.get("state"))) {
      const binder = readCookie(req, INSTALL_COOKIE);
      res.clearCookie(INSTALL_COOKIE, { ...installCookie, maxAge: undefined });
      const result = await completeInstall({ state: params.get("state"), shop, code: params.get("code"), timestamp: params.get("timestamp"), binder });
      // Straight to the ReadyTech app UI: already linked → connected; otherwise the link step
      if (result.linked) return res.redirect(clientRedirect({ connected: "1", shop }));
      return res.redirect(`${clientRedirect({ shop })}#${new URLSearchParams({ installed: result.linkCode })}`);
    }

    const s = verifyState(params.get("state"), shop);
    // The initiating admin must still belong to (and administer) that workspace
    const user = await User.findById(s.uid).select("role workspace isActive").lean();
    if (!user || user.role !== "admin" || user.isActive === false || String(user.workspace || user._id) !== s.ws) {
      throw Object.assign(new Error("You're not allowed to connect a Shopify store for this workspace."), { status: 403 });
    }

    const complete = await claimCallback(s, shop, params.get("code"));
    return res.redirect(clientRedirect({ complete, shop }));
  } catch (err) {
    console.error(`Shopify OAuth callback failed (${shop || "invalid shop"}):`, err.message);
    return res.redirect(clientRedirect({ connected: "0", message: friendlyError(err).slice(0, 200) }));
  }
});

/* Finish OAuth — the same admin, signed in to the same workspace that started it */
router.post("/oauth/complete", auth, role("admin"), async (req, res) => {
  try {
    const conn = await finishOAuth({ completeId: req.body?.id, workspaceId: req.workspace, userId: req.user._id });
    res.json({ success: true, message: "Shopify store connected", data: { shopDomain: conn.shopDomain, shopName: conn.shop?.name || null } });
  } catch (err) {
    console.error("Shopify OAuth completion failed:", err.message);
    res.status(err.status || 400).json({ success: false, message: friendlyError(err).slice(0, 200) });
  }
});

/* Link a Shopify-started installation to the signed-in admin's workspace (explicit confirmation in the UI) */
router.post("/oauth/link", auth, role("admin"), async (req, res) => {
  try {
    const conn = await linkInstallation({ code: req.body?.code, workspaceId: req.workspace, userId: req.user._id });
    res.json({ success: true, message: "Shopify store connected", data: { shopDomain: conn.shopDomain, shopName: conn.shop?.name || null } });
  } catch (err) {
    console.error("Shopify install link failed:", err.message);
    res.status(err.status || 400).json({ success: false, message: friendlyError(err).slice(0, 200) });
  }
});

router.post("/disconnect", auth, role("admin"), async (req, res) => {
  try {
    const removed = await disconnect(req.workspace);
    if (!removed) return res.status(409).json({ success: false, message: "No Shopify store is connected" });
    res.json({ success: true, message: `Disconnected ${removed.shopDomain}` });
  } catch (error) {
    console.error("Shopify disconnect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to disconnect the Shopify store" });
  }
});

/* Re-subscribe the connected store to every webhook topic — admin only */
router.post("/webhooks/register", auth, role("admin"), async (req, res) => {
  try {
    const webhooks = await refreshWebhooks(req.workspace);
    if (!webhooks) return res.status(409).json({ success: false, message: "No Shopify store is connected" });
    res.json({ success: true, message: `${webhooks.registered.length} webhook topic(s) registered`, data: webhooks });
  } catch (error) {
    console.error("Shopify webhook registration error:", error.message);
    res.status(error.unauthorized ? 409 : 500).json({ success: false, message: error.unauthorized ? error.message : "Failed to register Shopify webhooks" });
  }
});

/* Dead-letter replay of one of this workspace's events — admin only */
router.post("/events/:id/retry", auth, role("admin"), async (req, res) => {
  try {
    if (!(await retryDeadEvent(req.workspace, req.params.id))) {
      return res.status(404).json({ success: false, message: "Failed event not found" });
    }
    res.json({ success: true, message: "Event queued for retry" });
  } catch (error) {
    console.error("Shopify event retry error:", error.message);
    res.status(500).json({ success: false, message: "Failed to retry the event" });
  }
});

/* Webhook event table (metadata only, no payloads) — admin only */
router.get("/events", auth, role("admin"), async (req, res) => {
  try {
    const { status, topic, page, limit } = req.query;
    res.json({ success: true, data: await listEvents(req.workspace, { status, topic, page, limit }) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Shopify events error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load Shopify events" });
  }
});

/* ---------------- Inventory sync (ERP → Shopify) — admin only ---------------- */
const activeConnection = (workspace) =>
  ShopifyConnection.findOne({ workspace, status: "active" }).select("+accessToken +refreshToken");

// Messages only (never tokens). Shopify-side failures → 502 with Shopify's reason
const sendError = (res, error, fallback) => {
  if (!error.status && !error.unauthorized) console.error(`Shopify ${fallback}:`, error.message);
  const status = error.status || (error.unauthorized ? 409 : error.upstream ? 502 : 500);
  res.status(status).json({ success: false, message: status === 500 ? `Failed to ${fallback}` : error.message });
};

router.get("/inventory/locations", auth, role("admin"), async (req, res) => {
  try {
    const conn = await activeConnection(req.workspace);
    if (!conn) return res.status(409).json({ success: false, message: "No Shopify store is connected" });
    const locations = (await listLocations(conn)).map(({ id, name }) => ({ id, name }));
    res.json({ success: true, data: locations, saved: await reconcileSavedLocation(conn, locations) });
  } catch (error) {
    sendError(res, error, "load Shopify locations");
  }
});

router.put("/inventory/settings", auth, role("admin"), async (req, res) => {
  try {
    const { enabled, warehouse, locationGid } = req.body || {};
    const conn = await saveInventorySettings(req.workspace, req.user._id, { enabled, warehouse, locationGid });
    res.json({ success: true, message: enabled ? "Inventory sync enabled — use Sync now to map products and push stock" : "Inventory sync settings saved", data: { shopDomain: conn.shopDomain } });
  } catch (error) {
    sendError(res, error, "save inventory settings");
  }
});

/* Read-only preview of what Sync now would push (no Shopify call, no writes) */
router.get("/inventory/preview", auth, role("admin"), async (req, res) => {
  try {
    const conn = await activeConnection(req.workspace);
    if (!conn) return res.status(409).json({ success: false, message: "No Shopify store is connected" });
    res.json({ success: true, data: await inventoryPreview(conn) });
  } catch (error) {
    sendError(res, error, "load the inventory preview");
  }
});

/* Map products by SKU (full rescan), then push ERP stock now */
router.post("/inventory/sync", auth, role("admin"), async (req, res) => {
  try {
    const conn = await activeConnection(req.workspace);
    if (!conn?.inventory?.enabled) return res.status(409).json({ success: false, message: "Enable inventory sync first" });
    const mapping = await scanVariants(conn);
    const result = await syncInventory(conn._id, conn.workspace);
    res.json({ success: true, message: result.skipped || `${result.pushed} stock level(s) updated in Shopify`, data: { mapping, result } });
  } catch (error) {
    sendError(res, error, "sync inventory");
  }
});

/* Webhooks — public, verified by HMAC over the raw body (captured in app.js).
   401 on a bad signature (required by Shopify for privacy webhooks);
   5xx makes Shopify retry. */
router.post("/webhooks", async (req, res) => {
  if (!verifyWebhookHmac(req.rawBody, req.get("x-shopify-hmac-sha256"))) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }
  try {
    await handleWebhook({
      topic: req.get("x-shopify-topic"),
      shop: req.get("x-shopify-shop-domain"),
      webhookId: req.get("x-shopify-webhook-id"),
      eventId: req.get("x-shopify-event-id"),
      triggeredAt: req.get("x-shopify-triggered-at"),
      apiVersion: req.get("x-shopify-api-version"),
      payload: req.body,
      rawBody: req.rawBody,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Shopify webhook error:", error.message);
    res.status(500).json({ success: false });
  }
});

export default router;
