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
import role from "../middlewares/role.js";

const router = express.Router();

// 🔐 Protect all automation routes
router.use(auth);
router.use(role("admin", "employee"));
const adminOnly = role("admin");

// Create
router.post("/", adminOnly, createAutomation);

// List
router.get("/", getAutomations);

// Get single
router.get("/:id", getAutomationById);

// Update
router.put("/:id", adminOnly, updateAutomation);

// Activate / Pause
router.post("/:id/activate", adminOnly, activateAutomation);
router.post("/:id/pause", adminOnly, pauseAutomation);

// Duplicate
router.post("/:id/duplicate", adminOnly, duplicateAutomation);

// Test
router.post("/:id/test", adminOnly, testAutomation);

// Execution logs
router.get("/:id/executions", getAutomationExecutions);

// Delete
router.delete("/:id", adminOnly, deleteAutomation);

export default router;