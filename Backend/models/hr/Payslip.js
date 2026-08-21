import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    // ======================================================
    // PAYSLIP NUMBER
    // ======================================================

    payslipNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

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
    // PAYROLL
    // ======================================================

    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
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
    },

    payPeriod: {
      startDate: {
        type: Date,
        required: true,
      },

      endDate: {
        type: Date,
        required: true,
      },
    },

    // ======================================================
    // ATTENDANCE SUMMARY
    // ======================================================

    attendance: {
      workingDays: {
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

      paidLeaveDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      unpaidLeaveDays: {
        type: Number,
        default: 0,
        min: 0,
      },

      overtimeMinutes: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ======================================================
    // EARNINGS
    // ======================================================

    earnings: {
      basicSalary: {
        type: Number,
        default: 0,
        min: 0,
      },

      hra: {
        type: Number,
        default: 0,
        min: 0,
      },

      conveyanceAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },

      medicalAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },

      specialAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherAllowances: {
        type: Number,
        default: 0,
        min: 0,
      },

      overtimeAmount: {
        type: Number,
        default: 0,
        min: 0,
      },

      bonus: {
        type: Number,
        default: 0,
        min: 0,
      },

      incentives: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherEarnings: {
        type: Number,
        default: 0,
        min: 0,
      },

      grossSalary: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ======================================================
    // DEDUCTIONS
    // ======================================================

    deductions: {
      providentFund: {
        type: Number,
        default: 0,
        min: 0,
      },

      professionalTax: {
        type: Number,
        default: 0,
        min: 0,
      },

      incomeTax: {
        type: Number,
        default: 0,
        min: 0,
      },

      loanDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },

      leaveDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },

      otherDeductions: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalDeductions: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ======================================================
    // NET SALARY
    // ======================================================

    netSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // PAYMENT DETAILS
    // ======================================================

    paymentDetails: {
      paymentDate: {
        type: Date,
        default: null,
      },

      paymentMethod: {
        type: String,
        enum: [
          "Bank Transfer",
          "Cash",
          "Cheque",
          "UPI",
          "Other",
        ],
        default: "Bank Transfer",
      },

      transactionReference: {
        type: String,
        trim: true,
        default: null,
      },

      bankName: {
        type: String,
        trim: true,
        default: null,
      },

      accountLastFourDigits: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // ======================================================
    // STATUS
    // ======================================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Generated",
        "Approved",
        "Paid",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },

    // ======================================================
    // GENERATION
    // ======================================================

    generatedAt: {
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
    // OTHER
    // ======================================================

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    pdfUrl: {
      type: String,
      trim: true,
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

// One payslip per employee per month/year
payslipSchema.index(
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
payslipSchema.index({
  organization: 1,
  year: -1,
  month: -1,
});

// Payroll reference
payslipSchema.index({
  payroll: 1,
});

// Status filtering
payslipSchema.index({
  status: 1,
});

// ======================================================
// EXPORT
// ======================================================

export default mongoose.model(
  "Payslip",
  payslipSchema
);