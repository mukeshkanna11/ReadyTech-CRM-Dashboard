import mongoose from "mongoose";

const salaryStructureSchema = new mongoose.Schema(
  {
    // ==================================================
    // BASIC DETAILS
    // ==================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // ==================================================
    // EARNINGS
    // ==================================================

    basicSalary: {
      type: Number,
      required: true,
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

    // ==================================================
    // DEDUCTIONS
    // ==================================================

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

    otherDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================================================
    // EFFECTIVE DATE
    // ==================================================

    effectiveFrom: {
      type: Date,
      required: true,
    },

    // ==================================================
    // STATUS
    // ==================================================

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    // ==================================================
    // ORGANIZATION
    // ==================================================

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

salaryStructureSchema.index({
  organization: 1,
  status: 1,
});

salaryStructureSchema.index({
  organization: 1,
  name: 1,
});

salaryStructureSchema.index({
  effectiveFrom: -1,
});

// ======================================================
// MODEL
// ======================================================

const SalaryStructure =
  mongoose.models.SalaryStructure ||
  mongoose.model(
    "SalaryStructure",
    salaryStructureSchema
  );

export default SalaryStructure;