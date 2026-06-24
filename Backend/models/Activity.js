import mongoose from "mongoose";

const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "Call",
        "Email",
        "Meeting",
        "Task",
      ],
      default: "Call",
    },

    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
    },

    opportunity: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    dueDate: Date,

    priority: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High",
      ],
      default: "Medium",
    },

    notes: {
      type: String,
      default: "",
    },

    done: {
      type: Boolean,
      default: false,
    },

    completedAt: Date,

    createdBy: {
  type: Schema.Types.ObjectId,
  ref: "User",
},
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Activity",
  ActivitySchema
);