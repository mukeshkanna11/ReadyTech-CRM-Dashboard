import mongoose from "mongoose";

const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    // =====================================================
    // ACTIVITY TYPE
    // =====================================================
    type: {
      type: String,
      enum: ["Call", "Email", "Meeting", "Task"],
      required: true,
      default: "Call",
    },

    // =====================================================
    // LEAD RELATION
    // =====================================================
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    // =====================================================
    // OPPORTUNITY RELATION
    // =====================================================
    opportunity: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
    },

    // =====================================================
    // ASSIGNMENT
    // =====================================================
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =====================================================
    // CREATED BY
    // =====================================================
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // =====================================================
    // ACTIVITY DATE / FOLLOW-UP DATE
    // =====================================================
    dueDate: {
      type: Date,
      default: null,
    },

    // =====================================================
    // PRIORITY
    // =====================================================
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    // =====================================================
    // NOTES / DESCRIPTION
    // =====================================================
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // COMPLETION
    // =====================================================
    done: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    // =====================================================
    // CONTACT / COMMUNICATION DETAILS
    // =====================================================
    contactedAt: {
      type: Date,
      default: null,
    },

    // =====================================================
    // RESULT / OUTCOME
    // =====================================================
    outcome: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

ActivitySchema.index({ lead: 1, createdAt: -1 });
ActivitySchema.index({ opportunity: 1, createdAt: -1 });
ActivitySchema.index({ assignedTo: 1, dueDate: 1 });
ActivitySchema.index({ done: 1, dueDate: 1 });
ActivitySchema.index({ type: 1, createdAt: -1 });

// =====================================================
// LEAD RECENCY
// A logged Call / Email / Meeting / Task is a real customer
// interaction, so it refreshes the lead's lastContactedAt and
// floats the lead to the top of the Leads list. $max keeps the
// newest time — back-dated activities never rewind recency.
// Failures are swallowed: activity logging must never break.
// =====================================================
ActivitySchema.post("save", async function (doc) {
  if (!doc?.lead) return;

  try {
    await mongoose
      .model("Lead")
      .updateOne(
        { _id: doc.lead },
        { $max: { lastContactedAt: doc.createdAt || new Date() } }
      );
  } catch (error) {
    console.error("Lead lastContactedAt update failed:", error.message);
  }
});

export default mongoose.model("Activity", ActivitySchema);