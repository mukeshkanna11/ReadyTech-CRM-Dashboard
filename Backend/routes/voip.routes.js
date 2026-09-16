import express from "express";

import {
  getVoiceToken,
  handleVoice,
  handleCallStatus,
  getVoipStatus,
} from "../controllers/voip.controller.js";

import auth from "../middlewares/auth.js";

const router = express.Router();

/* Public — Twilio server-to-server webhooks.
   Guarded by X-Twilio-Signature (see validateTwilioRequest).
   Mounted without app-level auth, same pattern as the
   WhatsApp / Meta webhooks. */
router.post("/voice", handleVoice);
router.post("/status", handleCallStatus);

/* Authenticated CRM endpoints */
router.get("/token", auth, getVoiceToken);
router.get("/status-config", auth, getVoipStatus);

export default router;
