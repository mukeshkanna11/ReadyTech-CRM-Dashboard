import express from "express";
import {
  getMetaStatus,
  getMetaOAuthUrl,
  handleMetaOAuthCallback,
  refreshMetaConnection,
  disconnectMeta,
  verifyInstagramWebhook,
  receiveInstagramWebhook,
} from "../controllers/meta.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";

const router = express.Router();

/* Public — Meta redirects the browser here (guarded by signed state) */
router.get("/oauth/callback", handleMetaOAuthCallback);

/* Public — Meta Instagram webhook
   GET  = one-time verification (hub.challenge)
   POST = events (acknowledged only, processing not implemented yet) */
router.get("/instagram/webhook", verifyInstagramWebhook);
router.post("/instagram/webhook", receiveInstagramWebhook);

/* Read status — any authenticated user (CRM / ERP / AI Content) */
router.get("/status", auth, getMetaStatus);

/* Connection management — admin only */
router.get("/oauth/url", auth, role("admin"), getMetaOAuthUrl);
router.post("/refresh", auth, role("admin"), refreshMetaConnection);
router.post("/disconnect", auth, role("admin"), disconnectMeta);

export default router;
