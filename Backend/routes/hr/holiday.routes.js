import express from "express";

import {
  getHolidays,
  getHolidayById,
  getHolidaysByYear,
  createHoliday,
  updateHoliday,
  toggleHolidayStatus,
  deleteHoliday,
} from "../../controllers/hr/holiday.controller.js";

const router = express.Router();

// ======================================================
// HOLIDAY ROUTES
// ======================================================

// Get holidays by year
router.get(
  "/year/:year",
  getHolidaysByYear
);

// Get all holidays
router.get(
  "/",
  getHolidays
);

// Get single holiday
router.get(
  "/:id",
  getHolidayById
);

// Create holiday
router.post(
  "/",
  createHoliday
);

// Update holiday
router.put(
  "/:id",
  updateHoliday
);

// Toggle active/inactive
router.patch(
  "/:id/status",
  toggleHolidayStatus
);

// Delete holiday
router.delete(
  "/:id",
  deleteHoliday
);

export default router;