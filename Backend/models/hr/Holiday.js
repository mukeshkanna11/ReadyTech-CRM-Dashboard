import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    date: {
      type: Date,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "Public",
        "Optional",
        "Company",
      ],
      default: "Company",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: true,
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

holidaySchema.index({
  date: 1,
});

holidaySchema.index({
  organization: 1,
  date: 1,
});

holidaySchema.index({
  type: 1,
  isActive: 1,
});

// Prevent duplicate holiday names on same date
holidaySchema.index(
  {
    organization: 1,
    name: 1,
    date: 1,
  },
  {
    unique: true,
  }
);

const Holiday =
  mongoose.models.Holiday ||
  mongoose.model(
    "Holiday",
    holidaySchema
  );

export default Holiday;