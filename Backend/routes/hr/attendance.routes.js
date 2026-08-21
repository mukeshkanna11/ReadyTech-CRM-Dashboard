import express from "express";

import {
  getAttendance,
  getAttendanceById,
  getTodayAttendance,
  getEmployeeAttendanceSummary,
  createAttendance,
  createBulkAttendance,
  updateAttendance,
  deleteAttendance,
} from "../../controllers/hr/attendance.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Attendance Routes
|--------------------------------------------------------------------------
| Mounted from:
| /api/hr/attendance
|--------------------------------------------------------------------------
*/


// GET /api/hr/attendance
router.get(
  "/",
  getAttendance
);


// GET /api/hr/attendance/today
router.get(
  "/today",
  getTodayAttendance
);


// GET /api/hr/attendance/employee/:employeeId/summary
router.get(
  "/employee/:employeeId/summary",
  getEmployeeAttendanceSummary
);


// GET /api/hr/attendance/:id
router.get(
  "/:id",
  getAttendanceById
);


// POST /api/hr/attendance
router.post(
  "/",
  createAttendance
);


// POST /api/hr/attendance/bulk
router.post(
  "/bulk",
  createBulkAttendance
);


// PUT /api/hr/attendance/:id
router.put(
  "/:id",
  updateAttendance
);


// PATCH /api/hr/attendance/:id
router.patch(
  "/:id",
  updateAttendance
);


// DELETE /api/hr/attendance/:id
router.delete(
  "/:id",
  deleteAttendance
);


export default router;