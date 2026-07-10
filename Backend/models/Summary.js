import mongoose from "mongoose";

const summarySchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  totalAdmins: { type: Number, default: 0 },
  totalClients: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  totalLeads: { type: Number, default: 0 },
  openLeads: { type: Number, default: 0 },
  inProgressLeads: { type: Number, default: 0 },
  closedLeads: { type: Number, default: 0 },
  recentLeads: [{ client: String, source: String }],
  tasks: [String],
});

export default mongoose.model("Summary", summarySchema);
