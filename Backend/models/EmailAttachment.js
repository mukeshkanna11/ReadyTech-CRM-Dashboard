// models/EmailAttachment.js — attachment bytes for EmailMessage (drafts, sent
// and forwarded mail). Kept out of EmailMessage so lists never load file data;
// `data` is never selected by default. Workspace-scoped like every model.
import mongoose from "mongoose";

const emailAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, maxlength: 150 },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, required: true },
    sha256: { type: String, default: null },
    data: { type: Buffer, required: true, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.models.EmailAttachment || mongoose.model("EmailAttachment", emailAttachmentSchema);
