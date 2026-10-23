// models/RestorePoint.js — workspace recovery checkpoint (metadata).
// Snapshot data lives in the raw "restorepointchunks" collection and is
// never returned by the API. See services/backup.service.js
import mongoose from "mongoose";

const restorePointSchema = new mongoose.Schema(
  {
    trigger: { type: String, enum: ["manual", "scheduled", "pre-restore"], required: true },
    status: { type: String, enum: ["in_progress", "completed", "failed"], default: "in_progress" },
    error: { type: String, default: null },
    collections: [{ _id: false, name: String, model: String, count: Number, chunks: Number }],
    totalDocs: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    lastRestoredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.RestorePoint || mongoose.model("RestorePoint", restorePointSchema);
