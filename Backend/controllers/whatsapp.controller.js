// controllers/whatsapp.controller.js
import WhatsAppConversation from "../models/WhatsAppConversation.js";
import WhatsAppMessage from "../models/WhatsAppMessage.js";
import {
  getWhatsAppConfig,
  verifyWebhookToken,
  verifyWebhookSignature,
  processWebhookPayload,
  sendTextMessage,
  syncWhatsAppAccount,
  markWebhookSubscribed,
} from "../services/meta/whatsapp.service.js";

/* =========================================================
   WEBHOOK — VERIFY (public, called once by Meta)
========================================================= */
export const verifyWebhook = async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (!verifyWebhookToken(mode, token)) {
    return res.status(403).send("Forbidden");
  }

  try {
    await markWebhookSubscribed();
  } catch {
    // Non-fatal: Meta still needs the challenge echoed back
  }

  return res.status(200).send(String(challenge ?? ""));
};

/* =========================================================
   WEBHOOK — RECEIVE (public, HMAC verified)
   Returns 200 fast; processing errors must not trigger Meta retries
   for events we have already accepted.
========================================================= */
export const receiveWebhook = async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];

  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  // Acknowledge immediately, then process
  res.status(200).json({ success: true });

  try {
    await processWebhookPayload(req.body);
  } catch (error) {
    console.error("WhatsApp webhook processing error:", error.message);
  }
};

/* =========================================================
   GET /conversations  (paginated, DB only — no Graph calls)
========================================================= */
export const listConversations = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { search, unread } = req.query;

    const filter = {};

    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { phoneNumber: new RegExp(safe, "i") },
        { profileName: new RegExp(safe, "i") },
      ];
    }

    if (unread === "true") filter.unreadCount = { $gt: 0 };

    const [items, total] = await Promise.all([
      WhatsAppConversation.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("lead", "name company status source owner")
        .populate("client", "companyName contactPerson status")
        .populate("assignedTo", "name email"),
      WhatsAppConversation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items.map((c) => c.toInboxJSON()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List WhatsApp conversations error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch conversations",
    });
  }
};

/* =========================================================
   GET /conversations/:id/messages  (paginated, newest first)
========================================================= */
export const listMessages = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const conversation = await WhatsAppConversation.findById(req.params.id)
      .populate("lead", "name company status source owner")
      .populate("client", "companyName contactPerson status")
      .populate("assignedTo", "name email");

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    const [messages, total] = await Promise.all([
      WhatsAppMessage.find({ conversation: conversation._id })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-meta")
        .lean(),
      WhatsAppMessage.countDocuments({ conversation: conversation._id }),
    ]);

    res.json({
      success: true,
      data: {
        conversation: conversation.toInboxJSON(),
        // return oldest-first for direct rendering
        messages: messages.reverse(),
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List WhatsApp messages error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch messages",
    });
  }
};

/* =========================================================
   POST /conversations/:id/messages
========================================================= */
export const sendMessage = async (req, res) => {
  try {
    const message = await sendTextMessage({
      conversationId: req.params.id,
      text: req.body?.text,
      user: req.user,
    });

    res.status(201).json({
      success: true,
      message: "Message sent",
      data: message,
    });
  } catch (error) {
    console.error("Send WhatsApp message error:", error.message);
    res.status(error.status || 500).json({
      success: false,
      code: error.code || null,
      message: error.message || "Failed to send message",
    });
  }
};

/* =========================================================
   PATCH /conversations/:id/read
========================================================= */
export const markConversationRead = async (req, res) => {
  try {
    const conversation = await WhatsAppConversation.findByIdAndUpdate(
      req.params.id,
      { $set: { unreadCount: 0 } },
      { new: true }
    );

    if (!conversation) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    res.json({ success: true, data: conversation.toInboxJSON() });
  } catch (error) {
    console.error("Mark WhatsApp read error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to mark as read",
    });
  }
};

/* =========================================================
   POST /sync  (admin) — refreshes WhatsApp account metadata
========================================================= */
export const syncAccount = async (req, res) => {
  try {
    const connection = await syncWhatsAppAccount();

    res.json({
      success: true,
      message: "WhatsApp account synced",
      data: connection.toSafeJSON().whatsapp,
    });
  } catch (error) {
    console.error("WhatsApp sync error:", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to sync WhatsApp account",
      missingEnv: getWhatsAppConfig().missing,
    });
  }
};
