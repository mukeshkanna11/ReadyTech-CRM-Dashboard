import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      trim: true,
    },

    operator: {
      type: String,
      enum: [
        "equals",
        "notEquals",
        "contains",
        "notContains",
        "startsWith",
        "endsWith",
        "greaterThan",
        "greaterThanOrEqual",
        "lessThan",
        "lessThanOrEqual",
        "exists",
        "notExists",
        "isTrue",
        "isFalse",
      ],
      required: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "updateField",
        "assignOwner",
        "changeStatus",
        "changeStage",
        "addTag",
        "removeTag",
        "createTask",
        "sendEmail",
        "sendNotification",
        "createRecord",
        "webhook",
      ],
      required: true,
    },

    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const triggerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["event", "schedule"],
      default: "event",
      required: true,
    },

    event: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "statusChanged",
        "stageChanged",
        "fieldChanged",
      ],
      required: true,
    },

    field: {
      type: String,
      default: null,
    },

    fromValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    toValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const automationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    module: {
      type: String,
      required: true,
      enum: [
        // CRM
        "Lead",
        "Contact",
        "Client",
        "Opportunity",
        "Activity",
        "Quotation",
        "SalesOrder",
        "Invoice",
        "Payment",

        // ERP
        "Product",
        "Inventory",
        "Warehouse",
        "Vendor",
        "PurchaseOrder",
        "Expense",
        "Employee",
        "Payroll",
      ],
    },

    trigger: {
      type: triggerSchema,
      required: true,
    },

    conditionLogic: {
      type: String,
      enum: ["AND", "OR"],
      default: "AND",
    },

    conditions: {
      type: [conditionSchema],
      default: [],
    },

    actions: {
      type: [actionSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["draft", "active", "paused"],
      default: "draft",
      index: true,
    },

    version: {
      type: Number,
      default: 1,
    },

    executionCount: {
      type: Number,
      default: 0,
    },

    successCount: {
      type: Number,
      default: 0,
    },

    failureCount: {
      type: Number,
      default: 0,
    },

    lastExecutedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

automationSchema.index({
  module: 1,
  "trigger.event": 1,
  status: 1,
});

automationSchema.index({
  createdBy: 1,
  status: 1,
});

const Automation =
  mongoose.models.Automation ||
  mongoose.model("Automation", automationSchema);

export default Automation;