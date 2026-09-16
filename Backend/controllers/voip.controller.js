import mongoose from "mongoose";

import Activity from "../models/Activity.js";
import Lead from "../models/Lead.js";

import {
  getVoipConfig,
  createVoiceToken,
  buildDialTwiml,
  validateTwilioRequest,
  userIdFromCaller,
  outcomeForStatus,
  toE164,
} from "../services/voip/twilio.service.js";

/* =====================================================
   GET /api/voip/token   (authenticated)
   Short-lived Voice access token for the browser SDK.
===================================================== */
export const getVoiceToken = async (req, res) => {
  try {
    const { token, identity, expiresIn } = createVoiceToken(req.user._id);

    return res.status(200).json({
      success: true,
      data: { token, identity, expiresIn },
    });
  } catch (err) {
    console.error("VOIP TOKEN ERROR:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Unable to issue Twilio token",
    });
  }
};

/* =====================================================
   POST /api/voip/voice   (public — Twilio TwiML App)
   Returns the TwiML that dials the lead.
===================================================== */
export const handleVoice = async (req, res) => {
  try {
    if (!validateTwilioRequest(req)) {
      return res.status(403).type("text/xml").send(
        "<Response><Say>Unauthorized request.</Say></Response>"
      );
    }

    const params = { ...(req.body || {}), ...(req.query || {}) };

    const to = toE164(params.To);
    const leadId = mongoose.Types.ObjectId.isValid(params.leadId) ? params.leadId : null;
    // Identity is established by the signed access token, not by the browser.
    const userId = userIdFromCaller(params.From);

    const twiml = buildDialTwiml({ to, leadId, userId });

    return res.status(200).type("text/xml").send(twiml);
  } catch (err) {
    console.error("VOIP VOICE ERROR:", err);
    return res.status(200).type("text/xml").send(
      "<Response><Say>An application error occurred.</Say></Response>"
    );
  }
};

/* =====================================================
   POST /api/voip/status   (public — Twilio status callback)
   Writes the call result as a Lead CALL Activity using the
   EXISTING Activity schema fields only.
===================================================== */
export const handleCallStatus = async (req, res) => {
  try {
    if (!validateTwilioRequest(req)) {
      return res.sendStatus(403);
    }

    const { leadId, userId } = req.query || {};
    const body = req.body || {};

    if (
      !mongoose.Types.ObjectId.isValid(leadId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      // Nothing to attribute — acknowledge so Twilio does not retry.
      return res.sendStatus(204);
    }

    const lead = await Lead.findById(leadId).select("_id name phone").lean();
    if (!lead) return res.sendStatus(204);

    const status = body.CallStatus || body.DialCallStatus || "";
    const duration = Number(body.CallDuration || body.DialCallDuration || 0);
    const outcome = outcomeForStatus(status);

    const notes = [
      "Browser call via Twilio Voice",
      body.To ? `To: ${body.To}` : null,
      `Outcome: ${outcome}`,
      duration ? `Duration: ${Math.floor(duration / 60)}m ${duration % 60}s` : "Duration: 0s",
      body.CallSid ? `CallSid: ${body.CallSid}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const now = new Date();

    await Activity.create({
      type: "Call",
      lead: lead._id,
      createdBy: userId,
      assignedTo: userId,
      contactedAt: now,
      outcome,
      notes,
      done: true,
      completedAt: now,
    });

    return res.sendStatus(204);
  } catch (err) {
    console.error("VOIP STATUS ERROR:", err);
    // Always 2xx so Twilio does not retry a call we already handled.
    return res.sendStatus(204);
  }
};

/* =====================================================
   GET /api/voip/status-config   (authenticated)
   Lets the UI disable the Call button when Twilio is not
   provisioned, instead of failing at click time.
===================================================== */
export const getVoipStatus = async (req, res) => {
  const { configured, missing, callerId } = getVoipConfig();

  return res.status(200).json({
    success: true,
    data: {
      configured,
      missing,
      callerId: configured ? callerId : null,
    },
  });
};
