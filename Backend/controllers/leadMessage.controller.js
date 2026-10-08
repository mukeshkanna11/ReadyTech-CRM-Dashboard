import Activity from "../models/Activity.js";
import Lead from "../models/Lead.js";

import { sendTwilioMessage } from "../services/voip/twilio.service.js";
import { sendLeadEmail } from "../services/email.service.js";

const CHANNELS = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

/* =====================================================
   POST /api/leads/:id/message   (authenticated)
   body: { channel: "email" | "sms" | "whatsapp", message, subject? }
   Email -> Resend, SMS / WhatsApp -> Twilio.
   Every attempt is logged as a Lead Activity.
===================================================== */
export const sendLeadMessage = async (req, res) => {
  const channel = String(req.body?.channel || "").toLowerCase();
  const message = String(req.body?.message || "").trim();
  const subject = String(req.body?.subject || "").trim();

  if (!CHANNELS[channel]) {
    return res.status(400).json({ success: false, message: "Invalid channel" });
  }

  if (!message) {
    return res.status(400).json({ success: false, message: "Message is required" });
  }

  if (channel === "email" && !subject) {
    return res.status(400).json({ success: false, message: "Subject is required" });
  }

  let lead;
  try {
    lead = await Lead.findById(req.params.id).select("_id name email phone").lean();
  } catch {
    lead = null;
  }

  if (!lead) {
    return res.status(404).json({ success: false, message: "Lead not found" });
  }

  if (channel === "email" && !lead.email) {
    return res.status(400).json({ success: false, message: "This lead has no email address" });
  }

  if (channel !== "email" && !lead.phone) {
    return res.status(400).json({ success: false, message: "This lead has no phone number" });
  }

  const logActivity = async (outcome, details) => {
    const now = new Date();
    try {
      await Activity.create({
        type: CHANNELS[channel],
        lead: lead._id,
        createdBy: req.user._id,
        assignedTo: req.user._id,
        contactedAt: now,
        outcome,
        notes: [
          channel === "email" ? `Subject: ${subject}` : null,
          message,
          details,
        ]
          .filter(Boolean)
          .join(" | "),
        done: true,
        completedAt: now,
      });
    } catch (err) {
      console.error("LEAD MESSAGE LOG ERROR:", err.message);
    }
  };

  try {
    let result;

    if (channel === "email") {
      const { id } = await sendLeadEmail({ to: lead.email, subject, message });
      result = { to: lead.email, id, status: "sent" };
      await logActivity("Sent", `Email to ${lead.email} via Resend${id ? ` | ID: ${id}` : ""}`);
    } else {
      result = await sendTwilioMessage({ channel, to: lead.phone, body: message });
      await logActivity(
        "Sent",
        `${CHANNELS[channel]} to ${result.to} via Twilio | Status: ${result.status} | SID: ${result.sid}`
      );
    }

    return res.status(200).json({
      success: true,
      message: `${CHANNELS[channel]} sent to ${lead.name || "lead"}`,
      data: { channel, ...result },
    });
  } catch (err) {
    console.error(`LEAD ${channel.toUpperCase()} ERROR:`, err.message);

    const reason = err.message || "Send failed";
    await logActivity("Failed", `Error: ${reason}`);

    return res.status(err.status && err.status < 500 ? err.status : 502).json({
      success: false,
      message: `${CHANNELS[channel]} failed: ${reason}`,
      code: err.code,
    });
  }
};
