import Activity from "../models/Activity.js";
import Lead from "../models/Lead.js";

import { sendTwilioMessage } from "../services/voip/twilio.service.js";
import { sendLeadEmail } from "../services/email.service.js";
import { sendViaConnectedAccount } from "../services/emailOAuth.service.js";

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const MAX_SUBJECT = 200;
const MAILBOX_LABEL = { google: "Gmail", microsoft: "Microsoft 365", zoho: "Zoho Mail", smtp: "SMTP" };

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

  if (channel === "email" && subject.length > MAX_SUBJECT) {
    return res.status(400).json({ success: false, message: `Subject must be ${MAX_SUBJECT} characters or fewer` });
  }

  // Optional edited recipient (email only) — a single valid address
  const toOverride = channel === "email" ? String(req.body?.to || "").trim() : "";
  if (toOverride && (toOverride.length > 254 || !EMAIL_RE.test(toOverride))) {
    return res.status(400).json({ success: false, message: "Please enter a valid recipient email address" });
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

  const emailTo = toOverride || lead.email;
  if (channel === "email" && !emailTo) {
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
      // Workspace's connected Gmail / Microsoft 365 mailbox first; Resend otherwise
      const viaAccount = await sendViaConnectedAccount(req.workspace, { to: emailTo, subject, message });
      if (viaAccount) {
        result = { to: emailTo, id: viaAccount.id, from: viaAccount.from, provider: viaAccount.provider, status: "sent" };
        await logActivity("Sent", `Email to ${emailTo} from ${viaAccount.from} via ${MAILBOX_LABEL[viaAccount.provider] || viaAccount.provider}${viaAccount.id ? ` | ID: ${viaAccount.id}` : ""}`);
      } else {
        const { id } = await sendLeadEmail({ to: emailTo, subject, message });
        result = { to: emailTo, id, provider: "resend", status: "sent" };
        await logActivity("Sent", `Email to ${emailTo} via Resend${id ? ` | ID: ${id}` : ""}`);
      }
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

    // Provider (Twilio/Resend) 401/403 must not reach the client as a session 401
    const status = err.status && err.status < 500 && ![401, 403].includes(err.status) ? err.status : 502;
    return res.status(status).json({
      success: false,
      message: `${CHANNELS[channel]} failed: ${reason}`,
      code: err.code,
    });
  }
};
