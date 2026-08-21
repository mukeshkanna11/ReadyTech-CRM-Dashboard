// controllers/hr/expense.controller.js

import EmployeeExpense from "../../models/hr/EmployeeExpense.js";
import Employee from "../../models/hr/Employee.js";
import mongoose from "mongoose";

// ======================================================
// GENERATE EXPENSE NUMBER
// ======================================================

const generateExpenseNumber = async () => {
  const year = new Date().getFullYear();

  const lastExpense = await EmployeeExpense.findOne({
    expenseNumber: {
      $regex: `^EXP-${year}-`,
    },
  }).sort({ createdAt: -1 });

  let nextNumber = 1;

  if (lastExpense?.expenseNumber) {
    const parts = lastExpense.expenseNumber.split("-");
    nextNumber = Number(parts[2]) + 1;
  }

  return `EXP-${year}-${String(nextNumber).padStart(5, "0")}`;
};

// ======================================================
// GET ALL EXPENSES
// ======================================================

export const getEmployeeExpenses = async (req, res) => {
  try {
    const {
      employee,
      category,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const query = {};

    if (employee) query.employee = employee;
    if (category) query.category = category;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.expenseDate = {};

      if (startDate) {
        query.expenseDate.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        query.expenseDate.$lte = end;
      }
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [expenses, total] = await Promise.all([
      EmployeeExpense.find(query)
        .populate(
          "employee",
          "employeeCode firstName lastName department designation email"
        )
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      EmployeeExpense.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: expenses,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("GET EXPENSES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch expenses",
    });
  }
};

// ======================================================
// GET EXPENSE BY ID
// ======================================================

export const getEmployeeExpenseById = async (req, res) => {
  try {
    const expense = await EmployeeExpense.findById(req.params.id)
      .populate("employee")
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email");

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("GET EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch expense",
    });
  }
};

// ======================================================
// CREATE EMPLOYEE EXPENSE
// ======================================================

export const createEmployeeExpense = async (req, res) => {
  try {
    const {
      employee,
      expenseDate,
      category,
      title,
      description,
      amount,
      currency,
      paymentMethod,
      merchantName,
      billNumber,
      receiptUrl,
      project,
      client,
      notes,
    } = req.body;

    if (
      !employee ||
      !category ||
      !title ||
      amount === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Employee, category, title and amount are required",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Expense amount must be a valid positive number",
      });
    }

    const employeeExists = await Employee.findById(employee);

    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const expenseNumber = await generateExpenseNumber();

    const expense = await EmployeeExpense.create({
      employee,
      expenseNumber,
      expenseDate: expenseDate || new Date(),
      category,
      title,
      description,
      amount: numericAmount,
      currency: currency || "INR",
      paymentMethod,
      merchantName,
      billNumber,
      receiptUrl,
      project: project || null,
      client: client || null,
      notes,
      status: "Draft",
      organization:
        employeeExists.organization ||
        req.user?.organization ||
        null,
    });

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense,
    });
  } catch (error) {
    console.error("CREATE EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create expense",
    });
  }
};

// ======================================================
// UPDATE EMPLOYEE EXPENSE
// ======================================================

export const updateEmployeeExpense = async (req, res) => {
  try {
    const expense = await EmployeeExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (!["Draft", "Rejected"].includes(expense.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Only draft or rejected expenses can be updated",
      });
    }

    const allowedFields = [
      "expenseDate",
      "category",
      "title",
      "description",
      "amount",
      "currency",
      "paymentMethod",
      "merchantName",
      "billNumber",
      "receiptUrl",
      "project",
      "client",
      "notes",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    }

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("UPDATE EXPENSE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update expense",
    });
  }
};

// ======================================================
// SUBMIT EXPENSE
// ======================================================

export const submitEmployeeExpense = async (req, res) => {
  try {
    const expense = await EmployeeExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (!["Draft", "Rejected"].includes(expense.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Expense cannot be submitted in its current status",
      });
    }

    expense.status = "Submitted";
    expense.submittedAt = new Date();

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense submitted successfully",
      data: expense,
    });
  } catch (error) {
    console.error("SUBMIT EXPENSE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to submit expense",
    });
  }
};

// ======================================================
// APPROVE EXPENSE
// ======================================================

export const approveEmployeeExpense = async (req, res) => {
  try {
    const expense = await EmployeeExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Submitted") {
      return res.status(400).json({
        success: false,
        message:
          "Only submitted expenses can be approved",
      });
    }

    expense.status = "Approved";
    expense.approvedBy = req.user?._id || null;
    expense.approvedAt = new Date();

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense approved successfully",
      data: expense,
    });
  } catch (error) {
    console.error("APPROVE EXPENSE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to approve expense",
    });
  }
};

// ======================================================
// REJECT EXPENSE
// ======================================================

export const rejectEmployeeExpense = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    const expense = await EmployeeExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Submitted") {
      return res.status(400).json({
        success: false,
        message:
          "Only submitted expenses can be rejected",
      });
    }

    expense.status = "Rejected";
    expense.rejectedBy = req.user?._id || null;
    expense.rejectedAt = new Date();
    expense.rejectionReason = rejectionReason || "";

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense rejected successfully",
      data: expense,
    });
  } catch (error) {
    console.error("REJECT EXPENSE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reject expense",
    });
  }
};

// ======================================================
// REIMBURSE EXPENSE
// ======================================================

export const reimburseEmployeeExpense = async (req, res) => {
  try {
    const { reimbursementReference } = req.body;

    const expense = await EmployeeExpense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.status !== "Approved") {
      return res.status(400).json({
        success: false,
        message:
          "Only approved expenses can be reimbursed",
      });
    }

    expense.status = "Reimbursed";
    expense.reimbursedAt = new Date();
    expense.reimbursementReference =
      reimbursementReference || "";

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense reimbursed successfully",
      data: expense,
    });
  } catch (error) {
    console.error("REIMBURSE EXPENSE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reimburse expense",
    });
  }
};



const getOrganizationFilter = (user) => {
  if (user?.organization) {
    return { organization: user.organization };
  }

  return {};
};

// ======================================================
// MARK EXPENSE AS PAID
// PATCH /api/hr/expenses/:id/paid
// ======================================================

// ======================================================
// MARK EXPENSE AS PAID / REIMBURSED
// ======================================================

export const markExpensePaid = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      paymentMethod,
      paymentDate,
      transactionReference,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await EmployeeExpense.findOne({
      _id: id,
      ...getOrganizationFilter(req.user),
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Employee expense not found",
      });
    }

    // Only approved expenses can be paid
    if (expense.status !== "Approved") {
      return res.status(400).json({
        success: false,
        message: `Expense cannot be paid because current status is ${expense.status}`,
      });
    }

    // Validate payment method
    const allowedPaymentMethods = [
      "Cash",
      "Credit Card",
      "Debit Card",
      "UPI",
      "Bank Transfer",
      "Other",
    ];

    if (
      paymentMethod &&
      !allowedPaymentMethods.includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // Update payment details
    if (paymentMethod) {
      expense.paymentMethod = paymentMethod;
    }

    // Reimbursement date
    expense.reimbursedAt = paymentDate
      ? new Date(paymentDate)
      : new Date();

    // Transaction / reimbursement reference
    if (transactionReference) {
      expense.reimbursementReference =
        transactionReference;
    }

    // IMPORTANT:
    // Schema uses "Reimbursed", NOT "Paid"
    expense.status = "Reimbursed";

    await expense.save();

    const populatedExpense =
      await EmployeeExpense.findById(expense._id)
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .populate(
          "approvedBy",
          "name email"
        )
        .populate(
          "rejectedBy",
          "name email"
        )
        .lean();

    return res.status(200).json({
      success: true,
      message:
        "Employee expense marked as reimbursed successfully",
      data: populatedExpense,
    });
  } catch (error) {
    console.error(
      "MARK EXPENSE PAID ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        "Failed to mark employee expense as paid",
      error: error.message,
    });
  }
};