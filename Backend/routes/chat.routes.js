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