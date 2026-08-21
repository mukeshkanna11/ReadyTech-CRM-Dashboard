import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    breakMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    workingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Half Day",
        "Leave",
        "Holiday",
        "Week Off",
        "Late",
        "Work From Home",
      ],
      default: "Absent",
      index: true,
    },

    source: {
      type: String,
      enum: ["Manual", "Web", "Mobile", "Import"],
      default: "Web",
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
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

/*
|--------------------------------------------------------------------------
| Unique attendance per employee per date
|--------------------------------------------------------------------------
*/
attendanceSchema.index(
  { employee: 1, date: 1 },
  { unique: true }
);

/*
|--------------------------------------------------------------------------
| Additional indexes
|--------------------------------------------------------------------------
*/
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ organization: 1, date: 1 });

const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema
);

export default Attendance;