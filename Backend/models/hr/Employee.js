import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    employeeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    dateOfBirth: Date,

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    dateOfJoining: {
      type: Date,
      required: true,
    },

    dateOfLeaving: Date,

    department: {
      type: String,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    employmentType: {
      type: String,
      enum: [
        "Full Time",
        "Part Time",
        "Contract",
        "Intern",
        "Temporary",
      ],
      default: "Full Time",
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Inactive",
        "On Leave",
        "Resigned",
        "Terminated",
      ],
      default: "Active",
    },

    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },

    salaryStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryStructure",
      default: null,
    },

    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },

    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },

    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      bankName: String,
      branchName: String,
      ifscCode: String,
    },

    documents: [
      {
        name: String,
        type: String,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    notes: String,

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

const Employee =
  mongoose.models.Employee ||
  mongoose.model("Employee", employeeSchema);

export default Employee;