import express from "express";

import {
  getHRDashboard,
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  getEmployeeReport,
  getDepartmentReport,
  getExpenseReport,
  getPerformanceReport,
} from "../../controllers/hr/hrReport.controller.js";

const router = express.Router();

router.get("/dashboard", getHRDashboard);

router.get(
  "/attendance",
  getAttendanceReport
);

router.get(
  "/leave",
  getLeaveReport
);

router.get(
  "/payroll",
  getPayrollReport
);

router.get(
  "/employees",
  getEmployeeReport
);

router.get(
  "/departments",
  getDepartmentReport
);

router.get(
  "/expenses",
  getExpenseReport
);

router.get(
  "/performance",
  getPerformanceReport
);

export default router;