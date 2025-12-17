import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g., "CREATE_CLIENT", "UPDATE_PRODUCT"
    description: { type: String },
    target: { type: String }, // Optional: target entity ID or name
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);
