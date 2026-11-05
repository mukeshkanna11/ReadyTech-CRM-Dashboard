// models/EmailSyncState.js — Gmail reply-sync cursor and status, one row per
// connected mailbox per workspace. Holds no secrets (tokens stay encrypted on
// EmailConnection). `lockedUntil` / `lockId` form a lease so a mailbox is
// never synced twice in parallel (several app instances, worker + Refresh).
import mongoose from "mongoose";

const emailSyncStateSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "EmailConnection", required: true },
    provider: { type: String, default: "google" },
    historyId: { type: String, default: null },
    status: { type: String, enum: ["idle", "syncing", "error", "needs_permission"], default: "idle" },
    lastSyncAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    failures: { type: Number, default: 0 },
    nextRunAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    lockId: { type: String, default: null },
    lastImported: { type: Number, default: 0 },
    totalImported: { type: Number, default: 0 },
  },
  { timestamps: true }
);

emailSyncStateSchema.index({ workspace: 1, account: 1 }, { unique: true });
emailSyncStateSchema.index({ nextRunAt: 1 });

export default mongoose.models.EmailSyncState || mongoose.model("EmailSyncState", emailSyncStateSchema);
