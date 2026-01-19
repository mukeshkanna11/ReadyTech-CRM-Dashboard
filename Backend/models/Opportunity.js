import mongoose from "mongoose";
const { Schema } = mongoose;

const OpportunitySchema = new Schema(
  {
    title: { type: String, required: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    value: { type: Number, default: 0 },
    stage: {
      type: String,
      enum: ["Prospecting", "Proposal", "Closed Won", "Closed Lost"],
      default: "Prospecting",
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    department: { type: String, default: "Salesforce" },
    notes: String,
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

export default mongoose.model("Opportunity", OpportunitySchema);
