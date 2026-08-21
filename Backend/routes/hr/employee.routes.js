import express from "express";

import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../controllers/hr/employee.controller.js";

const router = express.Router();

router.get("/", getEmployees);
router.get("/:id", getEmployeeById);
// PATCH /api/hr/employees/:id
router.patch("/:id", updateEmployee);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;