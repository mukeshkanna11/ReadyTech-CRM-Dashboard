import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema(
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
    // SALARY STRUCTURE
    // ======================================================

    salaryStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure",
      default: null,
      index: true,
    },

    // ======================================================
    // PAYROLL PERIOD
    // ======================================================

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    // ======================================================
    // ATTENDANCE
    // ======================================================

    totalWorkingDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    presentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    absentDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    leaveDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // SALARY
    // ======================================================

    grossSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    netSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // STATUS
    // ======================================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Processed",
        "Approved",
        "Paid",
      ],
      default: "Draft",
      index: true,
    },

    // ======================================================
    // PROCESSING
    // ======================================================

    processedAt: {
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
    // PAYMENT
    // ======================================================

    paidAt: {
      type: Date,
      default: null,
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

// One payroll per employee per month/year
payrollSchema.index(
  {
    employee: 1,
    month: 1,
    year: 1,
  },
  {
    unique: true,
  }
);

// Organization payroll listing
payrollSchema.index({
  organization: 1,
  year: -1,
  month: -1,
});

// Salary structure filtering
payrollSchema.index({
  salaryStructure: 1,
});

// Status filtering
payrollSchema.index({
  status: 1,
});

const Payroll =
  mongoose.models.Payroll ||
  mongoose.model("Payroll", payrollSchema);

export default Payroll;