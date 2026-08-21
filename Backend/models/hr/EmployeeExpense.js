import mongoose from "mongoose";

const employeeExpenseSchema = new mongoose.Schema(
  {
    // ======================================================
    // EMPLOYEE
    // ======================================================

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    // ======================================================
    // EXPENSE NUMBER
    // ======================================================

    expenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // ======================================================
    // EXPENSE DATE
    // ======================================================

    expenseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // ======================================================
    // CATEGORY
    // ======================================================

    category: {
      type: String,
      enum: [
        "Travel",
        "Food",
        "Accommodation",
        "Fuel",
        "Transport",
        "Office Supplies",
        "Communication",
        "Medical",
        "Training",
        "Client Meeting",
        "Other",
      ],
      required: true,
    },

    // ======================================================
    // BASIC DETAILS
    // ======================================================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ======================================================
    // AMOUNT
    // ======================================================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },

    // ======================================================
    // PAYMENT
    // ======================================================

    paymentMethod: {
      type: String,
      enum: [
        "Cash",
        "Credit Card",
        "Debit Card",
        "UPI",
        "Bank Transfer",
        "Other",
      ],
      default: "Cash",
    },

    merchantName: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    billNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    receiptUrl: {
      type: String,
      trim: true,
    },

    // ======================================================
    // PROJECT / CLIENT
    // ======================================================

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },

    // ======================================================
    // STATUS
    // ======================================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Approved",
        "Rejected",
        "Reimbursed",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },

    // ======================================================
    // SUBMISSION
    // ======================================================

    submittedAt: {
      type: Date,
      default: null,
    },

    // ======================================================
    // APPROVAL
    // ======================================================

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    // ======================================================
    // REJECTION
    // ======================================================

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // ======================================================
    // REIMBURSEMENT
    // ======================================================

    reimbursedAt: {
      type: Date,
      default: null,
    },

    reimbursementReference: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // ======================================================
    // NOTES
    // ======================================================

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ======================================================
    // ORGANIZATION
    // ======================================================

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

employeeExpenseSchema.index({
  employee: 1,
  expenseDate: -1,
});

employeeExpenseSchema.index({
  status: 1,
  expenseDate: -1,
});

employeeExpenseSchema.index({
  organization: 1,
  expenseDate: -1,
});

// ======================================================
// EXPORT
// ======================================================

export default mongoose.model(
  "EmployeeExpense",
  employeeExpenseSchema
);