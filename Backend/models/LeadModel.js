import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadSchema = new Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    source: { type: String, default: "Website" },
    owner: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "New" }, // New, Contacted, Qualified, Closed
    department: { type: String, default: "Salesforce" },
    notes: String,
  },
  { timestamps: true } // ✅ auto-manages createdAt & updatedAt
);

export default mongoose.model("Lead", LeadSchema);
