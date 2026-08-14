import express from "express";

import {
  createAutomation,
  getAutomations,
  getAutomationById,
  updateAutomation,
  activateAutomation,
  pauseAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomationExecutions,
  testAutomation,
} from "../controllers/automationController.js";

import auth from "../middlewares/auth.js";

const router = express.Router();

// 🔐 Protect all automation routes
router.use(auth);

// Create
router.post("/", createAutomation);

// List
router.get("/", getAutomations);

// Get single
router.get("/:id", getAutomationById);

// Update
router.put("/:id", updateAutomation);

// Activate / Pause
router.post("/:id/activate", activateAutomation);
router.post("/:id/pause", pauseAutomation);

// Duplicate
router.post("/:id/duplicate", duplicateAutomation);

// Test
router.post("/:id/test", testAutomation);

// Execution logs
router.get("/:id/executions", getAutomationExecutions);

// Delete
router.delete("/:id", deleteAutomation);

export default router;