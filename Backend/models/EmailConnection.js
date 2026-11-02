// models/EmailConnection.js — connected mail accounts (Gmail, Microsoft 365,
// Zoho Mail, custom-domain SMTP). Several per workspace, one default sender.
// Secrets (OAuth tokens, SMTP password) are AES-256-GCM encrypted and never
// selected by default. `workspace` is added by the global scope plugin and is
// always set explicitly by the service.
import mongoose from "mongoose";

const emailConnectionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "microsoft", "zoho", "smtp"], required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, default: "", trim: true, maxlength: 100 },
    isDefault: { type: Boolean, default: false },

    // OAuth providers
    accessToken: { type: String, default: null, select: false },
    refreshToken: { type: String, default: null, select: false },
    expiresAt: { type: Date, default: null },
    scope: { type: String, default: "" },
    // Zoho: data-centre accounts server, mail API base and mail account id (not secret)
    providerData: {
      accountsServer: { type: String, default: null },
      mailBase: { type: String, default: null },
      accountId: { type: String, default: null },
    },

    // Custom-domain SMTP (password encrypted, everything else is not secret)
    smtp: {
      host: { type: String, default: null },
      port: { type: Number, default: null },
      security: { type: String, enum: ["ssl", "starttls"], default: null },
      username: { type: String, default: null },
    },
    smtpPassword: { type: String, default: null, select: false },

    status: { type: String, enum: ["connected", "error"], default: "connected" },
    lastError: { type: String, default: null },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastUsedAt: { type: Date, default: null },
    lastTestedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One row per mailbox per workspace (the legacy unique {workspace} index is
// dropped by scripts/migrateMailAccounts.js)
emailConnectionSchema.index({ workspace: 1, provider: 1, email: 1 }, { unique: true });

export default mongoose.models.EmailConnection || mongoose.model("EmailConnection", emailConnectionSchema);
