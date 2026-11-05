import express from "express";
import {
  verifyWebhook,
  receiveWebhook,
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  syncAccount,
  subscribeWaba,
  updateConversation,
  addNote,
  convertToLead,
  getMessageMedia,
  listAssignees,
  connectAccount,
  disconnectAccount,
  requireWhatsAppForConversation,
  embeddedSignupConfig,
  embeddedSignupComplete,
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
router.get("/conversations/:id/messages", auth, requireWhatsAppForConversation, listMessages);
router.post("/conversations/:id/messages", auth, requireWhatsAppForConversation, sendMessage);
router.patch("/conversations/:id/read", auth, requireWhatsAppForConversation, markConversationRead);
router.patch("/conversations/:id", auth, requireWhatsAppForConversation, updateConversation);
router.post("/conversations/:id/notes", auth, requireWhatsAppForConversation, addNote);
router.post("/conversations/:id/lead", auth, requireWhatsAppForConversation, convertToLead);
router.get("/conversations/:id/messages/:messageId/media", auth, requireWhatsAppForConversation, getMessageMedia);
router.get("/assignees", auth, listAssignees);

/* Admin — connect / disconnect this workspace's own WhatsApp number */
router.post("/connect", auth, role("admin"), connectAccount);
router.post("/disconnect", auth, role("admin"), disconnectAccount);

/* Admin — Meta Embedded Signup (connect / change number / reconnect) */
router.get("/embedded-signup/config", auth, role("admin"), embeddedSignupConfig);
router.post("/embedded-signup", auth, role("admin"), embeddedSignupComplete);

/* Admin — refresh WhatsApp account metadata from Meta */
router.post("/sync", auth, role("admin"), syncAccount);

/* Admin — subscribe the WABA to this app's webhook (manual, one-time) */
router.post("/subscribe", auth, role("admin"), subscribeWaba);

export default router;
