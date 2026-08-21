import express from "express";

import employeeRoutes
  from "./employee.routes.js";

import attendanceRoutes
  from "./attendance.routes.js";

import leaveRoutes
  from "./leave.routes.js";

import holidayRoutes
  from "./holiday.routes.js";

import shiftRoutes
  from "./shift.routes.js";

import salaryStructureRoutes
  from "./salaryStructure.routes.js";

import payrollRoutes
  from "./payroll.routes.js";

import payslipRoutes
  from "./payslip.routes.js";

import expenseRoutes
  from "./expense.routes.js";

import performanceRoutes
  from "./performance.routes.js";

import hrReportRoutes
  from "./hrReport.routes.js";

const router = express.Router();

router.use(
  "/employees",
  employeeRoutes
);

router.use(
  "/attendance",
  attendanceRoutes
);

router.use(
  "/leaves",
  leaveRoutes
);

router.use(
  "/holidays",
  holidayRoutes
);

router.use(
  "/shifts",
  shiftRoutes
);

router.use(
  "/salary-structures",
  salaryStructureRoutes
);

router.use(
  "/payroll",
  payrollRoutes
);

router.use(
  "/payslips",
  payslipRoutes
);

router.use(
  "/expenses",
  expenseRoutes
);

router.use(
  "/performance",
  performanceRoutes
);

router.use(
  "/reports",
  hrReportRoutes
);

export default router;