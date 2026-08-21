import express from "express";

import {
  getPayrolls,
  getPayrollById,
  processPayroll,
  approvePayroll,
  markPayrollPaid,
  resetPayroll,
  deletePayroll,
} from "../../controllers/hr/payroll.controller.js";

const router = express.Router();

// GET /api/hr/payroll
router.get("/", getPayrolls);

// GET /api/hr/payroll/:id
router.get("/:id", getPayrollById);

// POST /api/hr/payroll/process
router.post("/process", processPayroll);

// PATCH /api/hr/payroll/:id/approve
router.patch(
  "/:id/approve",
  approvePayroll
);

// PATCH /api/hr/payroll/:id/mark-paid
router.patch(
  "/:id/mark-paid",
  markPayrollPaid
);

// PATCH /api/hr/payroll/:id/reset
router.patch(
  "/:id/reset",
  resetPayroll
);

// DELETE /api/hr/payroll/:id
router.delete(
  "/:id",
  deletePayroll
);

export default router;