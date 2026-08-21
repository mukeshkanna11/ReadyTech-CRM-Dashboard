import express from "express";

import {
  getEmployeeExpenses,
  getEmployeeExpenseById,
  createEmployeeExpense,
  updateEmployeeExpense,
  submitEmployeeExpense,
  approveEmployeeExpense,
  markExpensePaid,
  rejectEmployeeExpense,
  reimburseEmployeeExpense,
} from "../../controllers/hr/expense.controller.js";

const router = express.Router();

// GET all expenses
router.get("/", getEmployeeExpenses);

// GET single expense
router.get("/:id", getEmployeeExpenseById);

// CREATE
router.post("/", createEmployeeExpense);

// UPDATE
router.put("/:id", updateEmployeeExpense);

// SUBMIT
router.patch("/:id/submit", submitEmployeeExpense);

router.patch(
  "/:id/paid",
  markExpensePaid
);
// APPROVE
router.patch("/:id/approve", approveEmployeeExpense);

// REJECT
router.patch("/:id/reject", rejectEmployeeExpense);

// REIMBURSE
router.patch("/:id/reimburse", reimburseEmployeeExpense);

export default router;