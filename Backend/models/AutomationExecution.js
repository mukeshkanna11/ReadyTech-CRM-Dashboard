import mongoose from "mongoose";

const automationExecutionSchema = new mongoose.Schema(
  {
    automation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Automation",
      required: true,
      index: true,
    },

    automationVersion: {
      type: Number,
      default: 1,
    },

    module: {
      type: String,
      required: true,
      index: true,
    },

    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    trigger: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      enum: ["running", "success", "failed", "skipped"],
      default: "running",
      index: true,
    },

    conditionsPassed: {
      type: Boolean,
      default: false,
    },

    actions: [
      {
        type: {
          type: String,
        },

        status: {
          type: String,
          enum: ["pending", "success", "failed", "skipped"],
          default: "pending",
        },

        message: {
          type: String,
          default: "",
        },

        startedAt: {
          type: Date,
          default: null,
        },

        completedAt: {
          type: Date,
          default: null,
        },
      },
    ],

    error: {
      type: String,
      default: null,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

automationExecutionSchema.index({
  automation: 1,
  createdAt: -1,
});

automationExecutionSchema.index({
  status: 1,
  createdAt: -1,
});

const AutomationExecution =
  mongoose.models.AutomationExecution ||
  mongoose.model("AutomationExecution", automationExecutionSchema);

export default AutomationExecution;