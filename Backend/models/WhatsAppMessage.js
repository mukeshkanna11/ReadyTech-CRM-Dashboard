import mongoose from "mongoose";

/* =========================================================
   WHATSAPP MESSAGE
   Separate collection (threads are unbounded — never embed).
========================================================= */
const whatsAppMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppConversation",
      required: true,
      index: true,
    },

    direction: {
      type: String,
      enum: ["inbound", "outbound"],
      required: true,
    },

    // Meta wamid — unique guard against duplicate webhook delivery
    messageId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      trim: true,
    },

    from: { type: String, default: null, trim: true },
    to: { type: String, default: null, trim: true },

    // text is supported now; other types are recorded but not rendered
    type: { type: String, default: "text", trim: true },

    body: { type: String, default: "", maxlength: 8000 },

    timestamp: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "read", "failed"],
      default: "pending",
    },

    error: {
      code: { type: String, default: null },
      title: { type: String, default: null },
      message: { type: String, default: null },
    },

    // Set only for outbound messages sent by a CRM user
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Only populated for non-text payloads we cannot model yet
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

whatsAppMessageSchema.index({ conversation: 1, timestamp: -1 });

export default mongoose.model("WhatsAppMessage", whatsAppMessageSchema);
