import express from "express";

import {
  getSalaryStructures,
  getSalaryStructureById,
  createSalaryStructure,
  updateSalaryStructure,
  toggleSalaryStructureStatus,
  getSalaryStructureEmployees,
  deleteSalaryStructure,
} from "../../controllers/hr/salaryStructure.controller.js";

const router = express.Router();

// ======================================================
// SALARY STRUCTURE ROUTES
// ======================================================

// GET all
router.get(
  "/",
  getSalaryStructures
);

// GET assigned employees
// IMPORTANT: this must come before /:id
router.get(
  "/:id/employees",
  getSalaryStructureEmployees
);

// GET single
router.get(
  "/:id",
  getSalaryStructureById
);

// CREATE
router.post(
  "/",
  createSalaryStructure
);

// UPDATE
router.put(
  "/:id",
  updateSalaryStructure
);

// TOGGLE STATUS
router.patch(
  "/:id/status",
  toggleSalaryStructureStatus
);

// DELETE
router.delete(
  "/:id",
  deleteSalaryStructure
);

export default router;