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