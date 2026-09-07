import express from "express";
import {
  getMetaStatus,
  getMetaOAuthUrl,
  handleMetaOAuthCallback,
  refreshMetaConnection,
  disconnectMeta,
} from "../controllers/meta.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";

const router = express.Router();

/* Public — Meta redirects the browser here (guarded by signed state) */
router.get("/oauth/callback", handleMetaOAuthCallback);

/* Read status — any authenticated user (CRM / ERP / AI Content) */
router.get("/status", auth, getMetaStatus);

/* Connection management — admin only */
router.get("/oauth/url", auth, role("admin"), getMetaOAuthUrl);
router.post("/refresh", auth, role("admin"), refreshMetaConnection);
router.post("/disconnect", auth, role("admin"), disconnectMeta);

export default router;
