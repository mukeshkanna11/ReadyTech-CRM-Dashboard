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

// import {
//   verifyToken,
//   isAdmin
// } from "../middleware/auth.middleware.js";


const router = express.Router();



/* =========================================================
   Public Website Route
========================================================= */

// Website Chat Submit
router.post(
  "/",
  createChatController
);



/* =========================================================
   CRM Admin Routes
   Add auth middleware in production
========================================================= */


// Get All Chat Enquiries
router.get(
  "/",
  // verifyToken,
  // isAdmin,
  getChatsController
);


/* =========================================================
   AI Chat Support (conversations)

   MUST be declared before "/:id" — Express matches in order, so
   "/conversations" and "/faqs" would otherwise be captured as an :id.
========================================================= */

// Open or resume a widget session
router.post("/conversations/start", startChatConversationController);

// Send a customer message, get the assistant reply
router.post("/conversations/message", sendChatMessageController);

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
router.get("/conversations", listChatConversationsController);

// Rule-based FAQ list
router.get("/faqs", listChatFaqsController);


// Get Single Chat
router.get(
  "/:id",
  // verifyToken,
  // isAdmin,
  getChatController
);


// Update Status
router.patch(
  "/:id/status",
  // verifyToken,
  // isAdmin,
  updateStatusController
);


// Assign Chat To Sales User
router.patch(
  "/:id/assign",
  // verifyToken,
  // isAdmin,
  assignChatController
);


// Add Admin Note
router.post(
  "/:id/note",
  // verifyToken,
  // isAdmin,
  addAdminNoteController
);


// Mark Chat Read
router.patch(
  "/:id/read",
  // verifyToken,
  // isAdmin,
  markAsReadController
);


// Soft Delete Chat
router.delete(
  "/:id",
  // verifyToken,
  // isAdmin,
  deleteChatController
);



export default router;