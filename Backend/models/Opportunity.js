import mongoose from "mongoose";

const { Schema } = mongoose;

const OpportunitySchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Opportunity title is required"],
      trim: true,
      maxlength: 200,
    },

    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead is required"],
      index: true,
    },

    value: {
      type: Number,
      default: 0,
      min: [0, "Value cannot be negative"],
    },

    probability: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    expectedCloseDate: {
      type: Date,
    },

    stage: {
  type: String,
  enum: [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Value Proposition",
    "Proposal",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
  ],
  default: "Prospecting",
},

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    department: {
      type: String,
      default: "Salesforce",
      immutable: true,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastActivityDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

OpportunitySchema.index({ title: "text" });
OpportunitySchema.index({ stage: 1 });
OpportunitySchema.index({ assignedTo: 1 });
OpportunitySchema.index({ createdAt: -1 });

export default mongoose.model("Opportunity", OpportunitySchema);