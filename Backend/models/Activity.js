import mongoose from "mongoose";
const { Schema } = mongoose;

const ActivitySchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Call", "Email", "Meeting"],
      default: "Call",
    },
    lead: { type: Schema.Types.ObjectId, ref: "Lead" },
    opportunity: { type: Schema.Types.ObjectId, ref: "Opportunity" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
    done: { type: Boolean, default: false },
  },
  { timestamps: true } // auto-manages createdAt & updatedAt
);

export default mongoose.model("Activity", ActivitySchema);
