import express from "express";
import {
  verifyWebhook,
  receiveWebhook,
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  syncAccount,
} from "../controllers/whatsapp.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";

const router = express.Router();

/* Public — Meta WhatsApp Cloud API webhook
   GET  = one-time verification (hub.challenge)
   POST = events, guarded by X-Hub-Signature-256 HMAC */
router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveWebhook);

/* Authenticated CRM inbox */
router.get("/conversations", auth, listConversations);
router.get("/conversations/:id/messages", auth, listMessages);
router.post("/conversations/:id/messages", auth, sendMessage);
router.patch("/conversations/:id/read", auth, markConversationRead);

/* Admin — refresh WhatsApp account metadata from Meta */
router.post("/sync", auth, role("admin"), syncAccount);

export default router;
