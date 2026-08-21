import express from "express";

import {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  toggleShiftStatus,
  getShiftEmployees,
  deleteShift,
} from "../../controllers/hr/shift.controller.js";

const router = express.Router();

// ======================================================
// SHIFT ROUTES
// ======================================================

// Get all shifts
router.get(
  "/",
  getShifts
);

// Get shift employees
router.get(
  "/:id/employees",
  getShiftEmployees
);

// Get single shift
router.get(
  "/:id",
  getShiftById
);

// Create shift
router.post(
  "/",
  createShift
);

// Update shift
router.put(
  "/:id",
  updateShift
);

// Toggle active/inactive
router.patch(
  "/:id/status",
  toggleShiftStatus
);

// Delete shift
router.delete(
  "/:id",
  deleteShift
);

export default router;