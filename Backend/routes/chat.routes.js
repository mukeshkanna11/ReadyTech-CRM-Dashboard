// routes/chat.routes.js

import express from "express";

import {
  createChatController,
  getChatsController,
  getChatController,
  updateStatusController,
  assignChatController,
  addAdminNoteController,
  markAsReadController,
  deleteChatController,
  sendChatMessageController,
  startChatConversationController,
  getChatConversationController,
  clearChatConversationController,
  listChatConversationsController,
  listChatFaqsController,
} from "../controllers/chat.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import rateLimit from "express-rate-limit";

/* CRM admin routes: signed-in workspace admins only. `auth` binds the
   request to the caller's workspace, so the workspace scope plugin limits
   every Chat / ChatConversation query to that workspace. */
const adminOnly = [auth, role("admin")];

/* Public website chat: per-IP cap (LLM cost + DB spam guard) */
const publicChatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many messages. Please wait a few minutes and try again." },
});


const router = express.Router();



/* =========================================================
   Public Website Route
========================================================= */

// Website Chat Submit
router.post(
  "/",
  publicChatLimiter,
  createChatController
);



/* =========================================================
   CRM Admin Routes (auth + admin)
========================================================= */


// Get All Chat Enquiries
router.get(
  "/",
  ...adminOnly,
  getChatsController
);


/* =========================================================
   AI Chat Support (conversations)

   MUST be declared before "/:id" — Express matches in order, so
   "/conversations" and "/faqs" would otherwise be captured as an :id.
========================================================= */

// Open or resume a widget session
router.post("/conversations/start", publicChatLimiter, startChatConversationController);

// Send a customer message, get the assistant reply
router.post("/conversations/message", publicChatLimiter, sendChatMessageController);

// Message history for a session
router.get(
  "/conversations/session/:sessionId",
  getChatConversationController
);

// Clear conversation
router.delete(
  "/conversations/session/:sessionId",
  clearChatConversationController
);

// CRM list view
router.get("/conversations", ...adminOnly, listChatConversationsController);

// Rule-based FAQ list
router.get("/faqs", listChatFaqsController);


// Get Single Chat
router.get(
  "/:id",
  ...adminOnly,
  getChatController
);


// Update Status
router.patch(
  "/:id/status",
  ...adminOnly,
  updateStatusController
);


// Assign Chat To Sales User
router.patch(
  "/:id/assign",
  ...adminOnly,
  assignChatController
);


// Add Admin Note
router.post(
  "/:id/note",
  ...adminOnly,
  addAdminNoteController
);


// Mark Chat Read
router.patch(
  "/:id/read",
  ...adminOnly,
  markAsReadController
);


// Soft Delete Chat
router.delete(
  "/:id",
  ...adminOnly,
  deleteChatController
);



export default router;