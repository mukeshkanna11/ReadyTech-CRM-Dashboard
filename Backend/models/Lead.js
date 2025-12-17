import mongoose from "mongoose";
const { Schema } = mongoose;

const LeadSchema = new Schema({
  name: { type: String, required: true },
  source: String,
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  status: { type: String, default: "new" }, // new, contacted, qualified, lost, converted
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Lead", LeadSchema);
