import mongoose from "mongoose";

const performanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    reviewPeriod: {
      type: String,
      required: true,
      trim: true,
    },

    reviewStartDate: {
      type: Date,
      required: true,
    },

    reviewEndDate: {
      type: Date,
      required: true,
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    overallRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    goals: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },

        description: {
          type: String,
          trim: true,
        },

        target: {
          type: String,
          trim: true,
        },

        achievement: {
          type: String,
          trim: true,
        },

        rating: {
          type: Number,
          min: 0,
          max: 5,
          default: 0,
        },

        status: {
          type: String,
          enum: [
            "Not Started",
            "In Progress",
            "Completed",
            "Partially Completed",
          ],
          default: "Not Started",
        },
      },
    ],

    strengths: [
      {
        type: String,
        trim: true,
      },
    ],

    areasForImprovement: [
      {
        type: String,
        trim: true,
      },
    ],

    achievements: [
      {
        type: String,
        trim: true,
      },
    ],

    feedback: {
      type: String,
      trim: true,
    },

    employeeComments: {
      type: String,
      trim: true,
    },

    promotionRecommended: {
      type: Boolean,
      default: false,
    },

    incrementRecommended: {
      type: Boolean,
      default: false,
    },

    recommendedIncrementPercentage: {
      type: Number,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Reviewed",
        "Finalized",
      ],
      default: "Draft",
      index: true,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    finalizedAt: {
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

performanceSchema.index({
  employee: 1,
  reviewStartDate: 1,
  reviewEndDate: 1,
});

const Performance =
  mongoose.models.Performance ||
  mongoose.model(
    "Performance",
    performanceSchema
  );

export default Performance;