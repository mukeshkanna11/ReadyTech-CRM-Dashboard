// controllers/meta.controller.js
import MetaConnection from "../models/MetaConnection.js";
import {
  getMetaConfig,
  createOAuthState,
  verifyOAuthState,
  buildOAuthUrl,
  completeConnection,
  refreshConnection,
  disconnectConnection,
  subscribePageWebhook,
} from "../services/meta/meta.service.js";
import { verifyWebhookSignature } from "../services/meta/whatsapp.service.js";
import { usesPlatformCredentials } from "../utils/workspaceContext.js";
import { processWebhookPayload as processInstagramWebhook } from "../services/meta/instagram.service.js";

/* =========================================================
   Frontend page that shows the connection result
========================================================= */
const clientRedirect = (params) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );

  const query = new URLSearchParams(params).toString();

  return `${base}/integrations/meta?${query}`;
};

/* =========================================================
   SETUP CHECKLIST — derived only from stored state (no Graph calls).
   "ok" is reported only for things Meta actually confirmed.
========================================================= */
const buildSetup = (safe, { configured, missing, redirectUri }, platformWhatsApp) => {
  let origin = null;
  try {
    origin = redirectUri ? new URL(redirectUri).origin : null;
  } catch {
    origin = null;
  }
  const url = (path) => (origin ? `${origin}${path}` : path);
  const granted = safe.scopes || [];
  const scopesKnown = granted.length > 0;
  const scope = (p) => (scopesKnown ? granted.includes(p) : null);
  const seen = (d) => (d ? `Last event ${new Date(d).toISOString()}` : "No webhook event received yet");
  const item = (key, label, state, detail) => ({ key, label, state, detail });

  const wa = safe.whatsapp;
  const page = safe.facebookPage;
  const ig = safe.instagram;
  const metaOn = safe.connected;

  return [
    item("meta_app", "Meta app configuration", configured ? "ok" : "missing",
      configured ? "App ID, secret and redirect URI set" : `Server missing: ${missing.join(", ")}`),

    item("whatsapp_number", "WhatsApp number", wa.connected ? "ok" : "missing",
      wa.connected
        ? `${wa.displayPhoneNumber || wa.phoneNumberId} (${platformWhatsApp ? "platform .env" : "workspace credentials"})`
        : wa.lastError || (platformWhatsApp ? "Press Sync to verify the platform number" : "Connect this workspace's own number")),

    item("whatsapp_webhook", "WhatsApp webhook", wa.lastInboundAt ? "ok" : wa.webhookSubscribed ? "warning" : "missing",
      wa.lastInboundAt
        ? seen(wa.lastInboundAt)
        : `${wa.webhookSubscribed ? "WABA subscribed, " : "WABA not subscribed (add WABA ID). "}${seen(null)}. Callback ${url("/api/whatsapp/webhook")}, field "messages".`),

    item("facebook_page", "Facebook Page (Meta login)", metaOn && page.connected ? "ok" : "missing",
      metaOn && page.connected ? page.name : "Connect with Meta to link a Page"),

    item("instagram_dm", "Instagram DMs", !ig.connected ? "missing" : scope("instagram_manage_messages") === false ? "missing" : ig.lastInboundAt ? "ok" : "warning",
      !ig.connected
        ? "No Instagram Business account linked to the Page"
        : scope("instagram_manage_messages") === false
          ? "Permission instagram_manage_messages not granted — replies will fail"
          : `${seen(ig.lastInboundAt)}. Callback ${url("/api/meta/webhook")}, Instagram object, field "messages".`),

    item("messenger", "Messenger replies", !page.connected ? "missing" : scope("pages_messaging") ? "ok" : "missing",
      !page.connected
        ? "Connect a Facebook Page first"
        : scope("pages_messaging") === null
          ? "Permissions not verified — press Refresh"
          : scope("pages_messaging")
            ? "pages_messaging granted"
            : "pages_messaging not granted — needs App Review and META_EXTRA_SCOPES"),

    item("page_webhook", "Page webhook (Messenger / IG)", page.lastInboundAt ? "ok" : page.webhookSubscribed ? "warning" : "missing",
      page.lastInboundAt
        ? seen(page.lastInboundAt)
        : page.webhookSubscribed
          ? `Page subscribed. ${seen(null)}. Callback ${url("/api/meta/webhook")}, Page object, field "messages".`
          : scope("pages_manage_metadata") === false
            ? "pages_manage_metadata not granted — cannot subscribe the Page"
            : "Page not subscribed — press Subscribe Page"),
  ];
};

/* ================= GET CONNECTION STATUS ================= */
export const getMetaStatus = async (req, res) => {
  try {
    const { configured, missing, portfolioId, apiVersion, redirectUri } =
      getMetaConfig();
    const connection = await MetaConnection.getSingleton();
    const safe = connection.toSafeJSON();
    // Only the default workspace may use the platform (.env) number
    const platformWhatsApp =
      usesPlatformCredentials() && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

    res.json({
      success: true,
      data: {
        ...safe,
        platformWhatsApp,
        setup: buildSetup(safe, { configured, missing, redirectUri }, platformWhatsApp),
        config: {
          configured,
          missingEnv: missing,
          apiVersion,
          businessPortfolioId: portfolioId || null,
          // Public callback URL only — must match the Meta app's
          // "Valid OAuth Redirect URIs". Not a secret.
          redirectUri: redirectUri || null,
        },
      },
    });
  } catch (error) {
    console.error("Meta status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load Meta connection status",
    });
  }
};

/* ================= START OAUTH ================= */
export const getMetaOAuthUrl = async (req, res) => {
  try {
    const { configured, missing } = getMetaConfig();

    if (!configured) {
      return res.status(500).json({
        success: false,
        message: `Meta is not configured. Missing: ${missing.join(", ")}`,
      });
    }

    const state = createOAuthState(req.user._id);

    res.json({
      success: true,
      data: { url: buildOAuthUrl(state) },
    });
  } catch (error) {
    console.error("Meta OAuth URL error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to build Meta OAuth URL",
    });
  }
};

/* ================= OAUTH CALLBACK =================
   Called by Meta (public). Protected by the signed state
   token, then redirects back to the frontend.
=================================================== */
export const handleMetaOAuthCallback = async (req, res) => {
  const { code, state, error_description: errorDescription, error } = req.query;

  if (error || !code) {
    return res.redirect(
      clientRedirect({
        connected: "0",
        message: errorDescription || error || "Meta authorization was cancelled",
      })
    );
  }

  try {
    const { uid } = verifyOAuthState(state);

    await completeConnection({ code, userId: uid });

    return res.redirect(clientRedirect({ connected: "1" }));
  } catch (err) {
    console.error("Meta OAuth callback error:", err);

    return res.redirect(
      clientRedirect({
        connected: "0",
        message: err.message || "Meta connection failed",
      })
    );
  }
};

/* =========================================================
   INSTAGRAM WEBHOOK — VERIFY (public, called once by Meta)
   GET /api/meta/instagram/webhook
========================================================= */
export const verifyInstagramWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expected = process.env.META_INSTAGRAM_VERIFY_TOKEN;

  if (expected && mode === "subscribe" && token === expected) {
    return res.status(200).send(String(challenge ?? ""));
  }

  console.error("Instagram webhook verification failed");

  return res.status(403).send("Forbidden");
};

/* =========================================================
   INSTAGRAM WEBHOOK — RECEIVE (public)
   POST /api/meta/instagram/webhook
   Acknowledge immediately (Meta retries on slow replies), then
   turn inbound DMs into CRM Leads.
========================================================= */
export const receiveInstagramWebhook = async (req, res) => {
  res.status(200).json({ success: true });

  const payload = req.body;

  // Payload only — no tokens, app secret or env values are logged.
  console.log("[IG-WEBHOOK] received", new Date().toISOString());

  if (process.env.NODE_ENV !== "production") {
    console.log("[IG-WEBHOOK] body:", JSON.stringify(payload));
  }

  try {
    const trusted = verifyWebhookSignature(
      req.rawBody,
      req.headers["x-hub-signature-256"]
    );
    const result = await processInstagramWebhook(payload, { trusted });

    console.log("[IG-WEBHOOK] processed", JSON.stringify(result));
  } catch (error) {
    console.error("Instagram webhook processing error:", error.message);
  }
};

/* ================= SUBSCRIBE PAGE WEBHOOK ================= */
export const subscribeMetaPage = async (req, res) => {
  try {
    const data = await subscribePageWebhook();
    res.json({ success: true, message: "Page subscribed to webhook", data });
  } catch (error) {
    console.error("Meta page subscribe error:", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to subscribe Page",
    });
  }
};

/* ================= REFRESH STATUS ================= */
export const refreshMetaConnection = async (req, res) => {
  try {
    const connection = await refreshConnection();

    res.json({
      success: true,
      message: "Meta connection refreshed",
      data: connection.toSafeJSON(),
    });
  } catch (error) {
    console.error("Meta refresh error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to refresh Meta connection",
    });
  }
};

/* ================= DISCONNECT ================= */
export const disconnectMeta = async (req, res) => {
  try {
    const connection = await disconnectConnection();

    res.json({
      success: true,
      message: "Meta disconnected",
      data: connection.toSafeJSON(),
    });
  } catch (error) {
    console.error("Meta disconnect error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to disconnect Meta",
    });
  }
};
