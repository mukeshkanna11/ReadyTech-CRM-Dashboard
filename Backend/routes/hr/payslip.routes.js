import express from "express";

import {
  getPayslips,
  getPayslipById,
  createPayslip,
  createPayslipFromPayroll,
  updatePayslip,
  updatePayslipStatus,
  deletePayslip,
  getEmployeePayslips,
} from "../../controllers/hr/payslip.controller.js";

const router = express.Router();

router.get("/", getPayslips);

router.get(
  "/employee/:employeeId",
  getEmployeePayslips
);

router.get("/:id", getPayslipById);

router.post("/", createPayslip);

router.post(
  "/from-payroll/:payrollId",
  createPayslipFromPayroll
);

router.put("/:id", updatePayslip);

router.patch(
  "/:id/status",
  updatePayslipStatus
);

router.delete(
  "/:id",
  deletePayslip
);

export default router;