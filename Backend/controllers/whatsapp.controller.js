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
  subscribeWabaToWebhook,
  connectWhatsAppAccount,
  getEmbeddedSignupConfig,
  completeEmbeddedSignup,
  disconnectWhatsAppAccount,
  fetchWhatsAppMedia,
} from "../services/meta/whatsapp.service.js";
import {
  sendSocialMessage,
  convertConversationToLead,
} from "../services/meta/inbox.service.js";
import User from "../models/User.js";
import { userWorkspaceFilter } from "../utils/workspaceContext.js";

const POPULATE = [
  ["lead", "name company status source owner"],
  ["client", "companyName contactPerson status"],
  ["assignedTo", "name email"],
];
const populateAll = (q) => POPULATE.reduce((acc, [p, f]) => acc.populate(p, f), q);
const fail = (res, error, fallback) =>
  res.status(error.status || 500).json({
    success: false,
    code: error.code || null,
    message: error.message || fallback,
  });

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
    const { search, unread, channel, status } = req.query;

    const filter = {};

    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { phoneNumber: new RegExp(safe, "i") },
        { profileName: new RegExp(safe, "i") },
      ];
    }

    if (unread === "true") filter.unreadCount = { $gt: 0 };

    // Legacy rows have no channel field = WhatsApp
    if (channel === "whatsapp") filter.channel = { $in: ["whatsapp", null] };
    else if (["instagram", "messenger"].includes(channel)) filter.channel = channel;

    if (["Open", "Pending", "Closed"].includes(status)) filter.status = status;

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
    const conversation = await WhatsAppConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const message =
      (conversation.channel || "whatsapp") === "whatsapp"
        ? await sendTextMessage({
            conversationId: conversation._id,
            text: req.body?.text,
            media: req.body?.media || null,
            user: req.user,
          })
        : await sendSocialMessage({ conversation, text: req.body?.text, user: req.user });

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
   POST /subscribe  (admin) — subscribes the WABA to this app's webhook
========================================================= */
export const subscribeWaba = async (req, res) => {
  try {
    const result = await subscribeWabaToWebhook();

    res.json({
      success: true,
      message: "WABA subscribed to webhook",
      data: result,
    });
  } catch (error) {
    console.error("WhatsApp WABA subscribe error:", error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to subscribe WABA",
      metaCode: error.metaCode || null,
      missingEnv: getWhatsAppConfig().missing,
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


/* =========================================================
   PATCH /conversations/:id  — status + employee assignment
========================================================= */
export const updateConversation = async (req, res) => {
  try {
    const conversation = await WhatsAppConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const { status, assignedTo } = req.body || {};

    if (status !== undefined) {
      if (!["Open", "Pending", "Closed"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      conversation.status = status;
    }

    if (assignedTo !== undefined) {
      if (assignedTo) {
        // Assignee must belong to the caller's workspace
        const user = await User.findOne({
          ...userWorkspaceFilter(req.workspace),
          _id: assignedTo,
        }).select("_id");
        if (!user) {
          return res.status(400).json({ success: false, message: "Assignee not in this workspace" });
        }
      }
      conversation.assignedTo = assignedTo || null;
    }

    await conversation.save();
    const fresh = await populateAll(WhatsAppConversation.findById(conversation._id));
    res.json({ success: true, data: fresh.toInboxJSON() });
  } catch (error) {
    console.error("Update conversation error:", error.message);
    fail(res, error, "Failed to update conversation");
  }
};

/* POST /conversations/:id/notes — internal note (never sent) */
export const addNote = async (req, res) => {
  try {
    const body = String(req.body?.body || "").trim().slice(0, 2000);
    if (!body) return res.status(400).json({ success: false, message: "Note is required" });

    const conversation = await populateAll(
      WhatsAppConversation.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            notes: { body, author: req.user?._id || null, authorName: req.user?.name || "" },
          },
        },
        { new: true }
      )
    );
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    res.status(201).json({ success: true, data: conversation.toInboxJSON() });
  } catch (error) {
    console.error("Add note error:", error.message);
    fail(res, error, "Failed to add note");
  }
};

/* POST /conversations/:id/lead — one-click Convert to Lead */
export const convertToLead = async (req, res) => {
  try {
    const conversation = await WhatsAppConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    const { created } = await convertConversationToLead({
      conversation,
      user: req.user,
      name: req.body?.name,
    });
    const fresh = await populateAll(WhatsAppConversation.findById(conversation._id));

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Lead created" : "Linked to existing lead",
      data: fresh.toInboxJSON(),
    });
  } catch (error) {
    console.error("Convert to lead error:", error.message);
    fail(res, error, "Failed to convert to lead");
  }
};

/* GET /conversations/:id/messages/:messageId/media — authenticated
   WhatsApp media proxy (token never reaches the browser) */
export const getMessageMedia = async (req, res) => {
  try {
    const message = await WhatsAppMessage.findOne({
      _id: req.params.messageId,
      conversation: req.params.id,
    }).lean();
    const mediaId = message?.meta?.mediaId;

    if (!mediaId) return res.status(404).json({ success: false, message: "Media not found" });

    const { buffer, mimeType } = await fetchWhatsAppMedia(mediaId);
    res.set("Content-Type", mimeType);
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (error) {
    console.error("WhatsApp media error:", error.message);
    fail(res, error, "Failed to load media");
  }
};

/* GET /assignees — users of the caller's workspace */
export const listAssignees = async (req, res) => {
  try {
    const users = await User.find({
      ...userWorkspaceFilter(req.workspace),
      isActive: { $ne: false },
    })
      .select("name email role")
      .sort({ name: 1 })
      .lean();
    res.json({ success: true, data: users });
  } catch (error) {
    fail(res, error, "Failed to load users");
  }
};

/* POST /connect (admin) — this workspace's own WhatsApp number */
export const connectAccount = async (req, res) => {
  try {
    const connection = await connectWhatsAppAccount(req.body || {});
    res.json({
      success: true,
      message: "WhatsApp connected",
      data: connection.toSafeJSON().whatsapp,
    });
  } catch (error) {
    console.error("WhatsApp connect error:", error.message);
    fail(res, error, "Failed to connect WhatsApp");
  }
};

/* POST /disconnect (admin) */
export const disconnectAccount = async (req, res) => {
  try {
    const connection = await disconnectWhatsAppAccount();
    res.json({ success: true, message: "WhatsApp disconnected", data: connection.toSafeJSON().whatsapp });
  } catch (error) {
    fail(res, error, "Failed to disconnect WhatsApp");
  }
};

/* GET /embedded-signup/config (admin) — public app/config ids + signed
   state; lists exact server setup blockers. Never returns secrets. */
export const embeddedSignupConfig = async (req, res) => {
  try {
    res.json({ success: true, data: getEmbeddedSignupConfig(req.user?._id || req.user?.id) });
  } catch (error) {
    fail(res, error, "Failed to load WhatsApp signup configuration");
  }
};

/* POST /embedded-signup (admin) — connect / change / reconnect number */
export const embeddedSignupComplete = async (req, res) => {
  try {
    const connection = await completeEmbeddedSignup(req.body || {}, req.user?._id || req.user?.id);
    res.json({ success: true, message: "WhatsApp connected", data: connection.toSafeJSON().whatsapp });
  } catch (error) {
    console.error("WhatsApp embedded signup error:", error.message);
    fail(res, error, "WhatsApp signup failed");
  }
};
