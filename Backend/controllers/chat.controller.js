// controllers/chat.controller.js

import {
  createChat,
  getAllChats,
  getChatById,
  updateChatStatus,
  assignChatToUser,
  addAdminNote,
  markAsRead,
  deleteChat,
} from "../services/chat.service.js";

import {
  handleUserMessage,
  getConversation,
  listConversations,
  clearConversation,
  getOrCreateConversation,
  FAQS,
} from "../services/chatAi.service.js";

/* =========================================================
   Shared shape for the widget so the frontend has one contract.
========================================================= */
const toWidgetPayload = (conversation) => ({
  sessionId: conversation.sessionId,
  intent: conversation.intent,
  priority: conversation.priority,
  leadQualified: conversation.leadQualified,
  leadScore: conversation.leadScore,
  summary: conversation.summary,
  status: conversation.status,
  messages: (conversation.messages || []).map((m) => ({
    id: String(m._id),
    role: m.role,
    text: m.text,
    source: m.source,
    createdAt: m.createdAt,
  })),
});

/* =========================================================
   POST /api/chat/conversations/message
   Send a customer message and get the assistant reply.
========================================================= */
export const sendChatMessageController = async (req, res) => {
  try {
    const { sessionId, message, visitor } = req.body;

    const result = await handleUserMessage({ sessionId, message, visitor });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      source: result.source,
      aiUsed: result.aiUsed,
      degraded: Boolean(result.degraded),
      data: toWidgetPayload(result.conversation),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to process message.",
    });
  }
};

/* =========================================================
   POST /api/chat/conversations/start
   Open (or resume) a session — used when the widget mounts.
========================================================= */
export const startChatConversationController = async (req, res) => {
  try {
    const { sessionId, visitor } = req.body;

    const conversation = await getOrCreateConversation(sessionId, visitor);

    return res.status(200).json({
      success: true,
      suggestedQuestions: [
        "Book a product demo",
        "What does the CRM include?",
        "How does GST invoicing work?",
        "I need help logging in",
      ],
      data: toWidgetPayload(conversation),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to start conversation.",
    });
  }
};

/* =========================================================
   GET /api/chat/conversations/session/:sessionId
   Message history for one session.
========================================================= */
export const getChatConversationController = async (req, res) => {
  try {
    const conversation = await getConversation(req.params.sessionId);

    return res.status(200).json({
      success: true,
      data: toWidgetPayload(conversation),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load conversation.",
    });
  }
};

/* =========================================================
   DELETE /api/chat/conversations/session/:sessionId
   Clear conversation (widget "Clear conversation" action).
========================================================= */
export const clearChatConversationController = async (req, res) => {
  try {
    const conversation = await clearConversation(req.params.sessionId);

    return res.status(200).json({
      success: true,
      message: "Conversation cleared.",
      data: toWidgetPayload(conversation),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to clear conversation.",
    });
  }
};

/* =========================================================
   GET /api/chat/conversations
   CRM list view (no transcripts, paginated).
========================================================= */
export const listChatConversationsController = async (req, res) => {
  try {
    const result = await listConversations(req.query);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to list conversations.",
    });
  }
};

/* =========================================================
   GET /api/chat/faqs
   The rule-based answers, so the UI can show them as suggestions.
========================================================= */
export const listChatFaqsController = async (_req, res) => {
  return res.status(200).json({
    success: true,
    count: FAQS.length,
    data: FAQS.map(({ id, answer, intent }) => ({ id, answer, intent })),
  });
};

/* =========================================================
   POST /api/chat
   Create Chat Enquiry
========================================================= */

export const createChatController = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      category,
      subject,
      message,
      source,
      priority,
    } = req.body;

    // Validation
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      });
    }

    const result = await createChat({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone,
      company,
      category,
      subject,
      message: message.trim(),
      source,
      priority,
    });

    return res.status(201).json(result);

  } catch (error) {
    console.error("Create Chat Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit enquiry.",
    });
  }
};

/* =========================================================
   GET /api/chat
   Get All Chats
========================================================= */

export const getChatsController = async (req, res) => {
  try {

    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await getAllChats(filters);

    return res.status(200).json(result);

  } catch (error) {

    console.error("Get Chats Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

/* =========================================================
   GET /api/chat/:id
   Get Single Chat
========================================================= */

export const getChatController = async (req, res) => {
  try {

    const result = await getChatById(req.params.id);

    return res.status(200).json(result);

  } catch (error) {

    console.error("Get Chat Error:", error);

    return res.status(404).json({
      success: false,
      message: error.message,
    });

  }
};/* =========================================================
   PATCH /api/chat/:id/status
   Update Chat Status
========================================================= */

export const updateStatusController = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const result = await updateChatStatus(
      req.params.id,
      status.trim()
    );

    return res.status(200).json(result);

  } catch (error) {

    console.error("Update Chat Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

/* =========================================================
   PATCH /api/chat/:id/assign
   Assign Chat To User
========================================================= */

export const assignChatController = async (req, res) => {
  try {

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const result = await assignChatToUser(
      req.params.id,
      userId
    );

    return res.status(200).json(result);

  } catch (error) {

    console.error("Assign Chat Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

/* =========================================================
   POST /api/chat/:id/note
   Add Admin Note
========================================================= */

/* =========================================================
   POST /api/chat/:id/note
   Add Admin Note
========================================================= */

export const addAdminNoteController = async (req, res) => {
  try {

    const { note } = req.body;

    if (!note?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Note is required.",
      });
    }


    // For testing without authentication
    const userId = req.user?._id || null;


    const result = await addAdminNote(
      req.params.id,
      note.trim(),
      userId
    );


    return res.status(200).json(result);


  } catch (error) {

    console.error("Add Note Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

/* =========================================================
   PATCH /api/chat/:id/read
   Mark Chat As Read
========================================================= */

export const markAsReadController = async (req, res) => {
  try {

    const result = await markAsRead(req.params.id);

    return res.status(200).json(result);

  } catch (error) {

    console.error("Mark Read Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};

/* =========================================================
   DELETE /api/chat/:id
   Soft Delete Chat
========================================================= */

export const deleteChatController = async (req, res) => {
  try {

    const result = await deleteChat(req.params.id);

    return res.status(200).json(result);

  } catch (error) {

    console.error("Delete Chat Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};