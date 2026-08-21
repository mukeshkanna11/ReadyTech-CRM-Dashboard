import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    leaveType: {
      type: String,
      enum: [
        "Casual Leave",
        "Sick Leave",
        "Earned Leave",
        "Privilege Leave",
        "Maternity Leave",
        "Paternity Leave",
        "Unpaid Leave",
        "Other",
      ],
      required: true,
    },

    fromDate: {
      type: Date,
      required: true,
    },

    toDate: {
      type: Date,
      required: true,
    },

    totalDays: {
      type: Number,
      required: true,
      min: 0.5,
    },

    reason: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Cancelled",
      ],
      default: "Pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: String,

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

const Leave =
  mongoose.models.Leave ||
  mongoose.model("Leave", leaveSchema);

export default Leave;