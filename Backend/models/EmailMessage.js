// models/EmailMessage.js — Mail workspace messages (sent, drafts and — once a
// mailbox grants read access — received mail). One row per message per
// workspace. `workspace` is added by the global scope plugin and is always set
// explicitly by services/mail/mailbox.service.js. Attachment bytes live in
// EmailAttachment; only their metadata is kept here.
import mongoose from "mongoose";

const LINK_TYPES = ["lead", "client", "vendor", "salesOrder", "purchaseOrder"];

const attachmentMetaSchema = new mongoose.Schema(
  {
    // null for received attachments that weren't imported (see `unavailable`)
    attachment: { type: mongoose.Schema.Types.ObjectId, ref: "EmailAttachment", default: null },
    unavailable: { type: String, enum: [null, "too_large", "blocked", "limit"], default: null },
    filename: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const linkSchema = new mongoose.Schema(
  {
    type: { type: String, enum: LINK_TYPES, required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: "", maxlength: 200 },
  },
  { _id: false }
);

const emailMessageSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "EmailConnection", default: null },
    accountEmail: { type: String, default: "" },
    provider: { type: String, default: null },

    direction: { type: String, enum: ["outbound", "inbound"], default: "outbound" },
    // draft → sending → sent | failed (inbound rows are "received")
    status: { type: String, enum: ["draft", "sending", "sent", "failed", "received"], default: "draft", index: true },
    error: { type: String, default: null },

    from: { type: String, default: "" },
    fromName: { type: String, default: "", maxlength: 100 },
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    subject: { type: String, default: "", maxlength: 300 },
    html: { type: String, default: "" },
    text: { type: String, default: "" },
    snippet: { type: String, default: "" },
    attachments: { type: [attachmentMetaSchema], default: [] },

    // Conversation: our own key (stable across providers) + provider ids
    threadKey: { type: String, required: true },
    messageIdHeader: { type: String, default: null },
    inReplyTo: { type: String, default: null },
    references: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    providerThreadId: { type: String, default: null },
    replyMode: { type: String, enum: [null, "reply", "replyAll", "forward"], default: null },
    replyToMessage: { type: mongoose.Schema.Types.ObjectId, ref: "EmailMessage", default: null },

    // Idempotency key from the composer: a retried / double-clicked send is never sent twice
    clientId: { type: String, default: null },

    read: { type: Boolean, default: true },
    starred: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    trashed: { type: Boolean, default: false },

    links: { type: [linkSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailMessageSchema.index({ workspace: 1, status: 1, updatedAt: -1 });
emailMessageSchema.index({ workspace: 1, threadKey: 1, createdAt: 1 });
emailMessageSchema.index({ workspace: 1, "links.type": 1, "links.id": 1 });
emailMessageSchema.index(
  { workspace: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);
// Prevents duplicate synchronisation of the same provider message (inbox sync, phase 2)
emailMessageSchema.index(
  { workspace: 1, account: 1, providerMessageId: 1 },
  { unique: true, partialFilterExpression: { providerMessageId: { $type: "string" } } }
);

export const EMAIL_LINK_TYPES = LINK_TYPES;
export default mongoose.models.EmailMessage || mongoose.model("EmailMessage", emailMessageSchema);
