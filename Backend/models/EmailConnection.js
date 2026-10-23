// models/EmailConnection.js — one connected mailbox per workspace (Gmail /
// Microsoft 365). Tokens are AES-256-GCM encrypted and never selected by
// default. Workspace-scoped by the global scope plugin.
import mongoose from "mongoose";

const emailConnectionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "microsoft"], required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, default: null, select: false },
    expiresAt: { type: Date, default: null },
    scope: { type: String, default: "" },
    status: { type: String, enum: ["connected", "error"], default: "connected" },
    lastError: { type: String, default: null },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailConnectionSchema.index({ workspace: 1 }, { unique: true });

export default mongoose.models.EmailConnection || mongoose.model("EmailConnection", emailConnectionSchema);
