import express from "express";
import {
  getMetaStatus,
  getMetaOAuthUrl,
  handleMetaOAuthCallback,
  refreshMetaConnection,
  disconnectMeta,
  verifyInstagramWebhook,
  receiveInstagramWebhook,
  subscribeMetaPage,
  getInstagramOAuthUrl,
  handleInstagramOAuthCallback,
  refreshInstagram,
  subscribeInstagram,
  disconnectInstagram,
} from "../controllers/meta.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";

const router = express.Router();

/* Public — Meta redirects the browser here (guarded by signed state) */
router.get("/oauth/callback", handleMetaOAuthCallback);
router.get("/instagram/oauth/callback", handleInstagramOAuthCallback);

/* Public — Meta Instagram webhook
   GET  = one-time verification (hub.challenge)
   POST = events (acknowledged only, processing not implemented yet) */
router.get("/instagram/webhook", verifyInstagramWebhook);
router.post("/instagram/webhook", receiveInstagramWebhook);

/* Public — shared Meta webhook (Page/Messenger + Instagram objects) */
router.get("/webhook", verifyInstagramWebhook);
router.post("/webhook", receiveInstagramWebhook);

/* Read status — any authenticated user (CRM / ERP / AI Content) */
router.get("/status", auth, getMetaStatus);

/* Connection management — admin only */
router.get("/oauth/url", auth, role("admin"), getMetaOAuthUrl);
router.post("/refresh", auth, role("admin"), refreshMetaConnection);
router.post("/disconnect", auth, role("admin"), disconnectMeta);
router.post("/subscribe-page", auth, role("admin"), subscribeMetaPage);

/* Instagram Inbox (Instagram API with Instagram Login) — admin only */
router.get("/instagram/oauth/url", auth, role("admin"), getInstagramOAuthUrl);
router.post("/instagram/refresh", auth, role("admin"), refreshInstagram);
router.post("/instagram/subscribe", auth, role("admin"), subscribeInstagram);
router.post("/instagram/disconnect", auth, role("admin"), disconnectInstagram);

export default router;
