import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },

    startTime: {
      type: String,
      required: true,
      trim: true,
    },

    endTime: {
      type: String,
      required: true,
      trim: true,
    },

    breakMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },

    gracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },

    workingDays: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
      },
    ],

    isNightShift: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Inactive",
      ],
      default: "Active",
    },

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

shiftSchema.index({
  organization: 1,
  name: 1,
});

shiftSchema.index({
  organization: 1,
  code: 1,
});

shiftSchema.index({
  status: 1,
});

const Shift =
  mongoose.models.Shift ||
  mongoose.model(
    "Shift",
    shiftSchema
  );

export default Shift;