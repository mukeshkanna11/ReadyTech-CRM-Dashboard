// routes/shopify.routes.js — Shopify Integration (each workspace connects its own store)
import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import User from "../models/User.js";
import { runWithWorkspace } from "../utils/workspaceContext.js";
import {
  missingConfig, normalizeShop, buildAuthUrl, verifyState, verifyCallbackHmac,
  verifyWebhookHmac, completeConnection, getStatus, disconnect, handleWebhook, refreshWebhooks,
} from "../services/shopify/shopify.service.js";
import { inboxSummary, retryDeadEvent } from "../services/shopify/inbox.service.js";
import { orderSummary } from "../services/shopify/orderSync.service.js";
import {
  listLocations, saveInventorySettings, scanVariants, syncInventory, inventorySummary,
} from "../services/shopify/inventorySync.service.js";
import ShopifyConnection from "../models/ShopifyConnection.js";

const router = express.Router();

const clientRedirect = (params) =>
  `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/integrations/shopify?${new URLSearchParams(params)}`;

const NOT_AVAILABLE = "Shopify connection isn't available yet. ReadyTech is finishing a one-time setup — please try again later or contact support.";

/* Friendly callback errors (details are logged server-side) */
const friendlyError = (err) => {
  if (err.status) return err.message;
  if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError" || err.message === "Invalid OAuth state") {
    return "The connection link expired — please click Connect again.";
  }
  if (err.message === "NO_STATE") return "Please start the Shopify connection from ReadyTech CRM → Integrations → Shopify.";
  return "We couldn't finish connecting your Shopify store. Please try again.";
};

/* Status — any workspace member (no secrets) */
router.get("/status", auth, async (req, res) => {
  try {
    const [connection, inbox, orders, inventory] = await Promise.all([
      getStatus(req.workspace), inboxSummary(req.workspace), orderSummary(req.workspace), inventorySummary(req.workspace),
    ]);
    res.json({ success: true, data: { available: missingConfig().length === 0, connection, inbox, orders, inventory } });
  } catch (error) {
    console.error("Shopify status error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load Shopify integration status" });
  }
});

/* Start OAuth — admin only; state binds user + workspace + shop */
router.get("/oauth/url", auth, role("admin"), (req, res) => {
  const missing = missingConfig();
  if (missing.length) {
    console.warn(`Shopify OAuth not configured — ReadyTech admin: set ${missing.join(", ")}`);
    return res.status(400).json({ success: false, code: "SHOPIFY_NOT_CONFIGURED", message: NOT_AVAILABLE });
  }
  const shop = normalizeShop(req.query.shop);
  if (!shop) return res.status(422).json({ success: false, message: "Enter your store's myshopify.com address, e.g. your-store.myshopify.com" });
  res.json({ success: true, data: { url: buildAuthUrl({ shop, userId: req.user._id, workspaceId: req.workspace }) } });
});

/* OAuth callback — public (Shopify redirects the browser), protected by HMAC + signed state */
router.get("/oauth/callback", async (req, res) => {
  const params = new URL(req.originalUrl, "http://localhost").searchParams;
  const shop = normalizeShop(params.get("shop"));
  try {
    if (missingConfig().length) throw new Error("Shopify is not configured");
    if (!shop || !params.get("code") || !verifyCallbackHmac(params)) throw new Error("Invalid Shopify callback");
    if (!params.get("state")) throw new Error("NO_STATE");

    const s = verifyState(params.get("state"), shop);
    // The initiating admin must still belong to (and administer) that workspace
    const user = await User.findById(s.uid).select("role workspace isActive").lean();
    if (!user || user.role !== "admin" || user.isActive === false || String(user.workspace || user._id) !== s.ws) {
      throw Object.assign(new Error("You're not allowed to connect a Shopify store for this workspace."), { status: 403 });
    }

    await runWithWorkspace(s.ws, () => completeConnection({ shop, code: params.get("code"), workspaceId: s.ws, userId: s.uid }));
    return res.redirect(clientRedirect({ connected: "1", shop }));
  } catch (err) {
    console.error(`Shopify OAuth callback failed (${shop || "invalid shop"}):`, err.message);
    return res.redirect(clientRedirect({ connected: "0", message: friendlyError(err).slice(0, 200) }));
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

/* ---------------- Inventory sync (ERP → Shopify) — admin only ---------------- */
const activeConnection = (workspace) =>
  ShopifyConnection.findOne({ workspace, status: "active" }).select("+accessToken +refreshToken");

const sendError = (res, error, fallback) => {
  if (!error.status && !error.unauthorized) console.error(`Shopify ${fallback}:`, error.message);
  res.status(error.status || (error.unauthorized ? 409 : 500)).json({ success: false, message: error.status || error.unauthorized ? error.message : `Failed to ${fallback}` });
};

router.get("/inventory/locations", auth, role("admin"), async (req, res) => {
  try {
    const conn = await activeConnection(req.workspace);
    if (!conn) return res.status(409).json({ success: false, message: "No Shopify store is connected" });
    res.json({ success: true, data: (await listLocations(conn)).map(({ id, name }) => ({ id, name })) });
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
