import express from "express";

import {
  getLeaves,
  getLeaveById,
  getLeaveSummary,
  applyLeave,
  updateLeave,
  updateLeaveStatus,
  approveLeave,
  rejectLeave,
  cancelLeave,
  deleteLeave,
} from "../../controllers/hr/leave.controller.js";

const router = express.Router();

router.get(
  "/summary/:employeeId",
  getLeaveSummary
);

router.get(
  "/",
  getLeaves
);

router.get(
  "/:id",
  getLeaveById
);

router.post(
  "/",
  applyLeave
);

router.put(
  "/:id",
  updateLeave
);

router.put(
  "/:id/status",
  updateLeaveStatus
);

router.put(
  "/:id/approve",
  approveLeave
);

router.put(
  "/:id/reject",
  rejectLeave
);

router.put(
  "/:id/cancel",
  cancelLeave
);

router.delete(
  "/:id",
  deleteLeave
);

export default router;