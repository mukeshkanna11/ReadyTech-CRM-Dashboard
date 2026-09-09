import mongoose from "mongoose";

/* =========================================================
   WHATSAPP CONVERSATION (one thread per customer phone)
   Isolated from Chat / ChatConversation (website + AI chat).
   Customer data is REFERENCED, never duplicated.
========================================================= */
const WINDOW_MS = 24 * 60 * 60 * 1000;

const whatsAppConversationSchema = new mongoose.Schema(
  {
    // E.164, e.g. +919876543210
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Meta wa_id (digits only)
    waId: { type: String, default: null, trim: true },

    // WhatsApp profile name reported by Meta
    profileName: { type: String, default: null, trim: true },

    /* 🔗 Existing CRM records — references only */
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    unreadCount: { type: Number, default: 0, min: 0 },

    /* 🕒 24-hour customer service window driver */
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },

    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "", maxlength: 300 },
    lastMessageDirection: {
      type: String,
      enum: ["inbound", "outbound"],
      default: "inbound",
    },

    status: {
      type: String,
      enum: ["Open", "Pending", "Closed"],
      default: "Open",
    },
  },
  { timestamps: true }
);

whatsAppConversationSchema.index({ lastMessageAt: -1 });

/* =========================================================
   24-HOUR CUSTOMER SERVICE WINDOW
========================================================= */
whatsAppConversationSchema.methods.isWindowOpen = function () {
  if (!this.lastInboundAt) return false;
  return Date.now() - new Date(this.lastInboundAt).getTime() < WINDOW_MS;
};

whatsAppConversationSchema.methods.windowExpiresAt = function () {
  if (!this.lastInboundAt) return null;
  return new Date(new Date(this.lastInboundAt).getTime() + WINDOW_MS);
};

whatsAppConversationSchema.methods.toInboxJSON = function () {
  const populated = (v) => (v && v._id ? v : null);

  return {
    _id: this._id,
    phoneNumber: this.phoneNumber,
    profileName: this.profileName,
    unreadCount: this.unreadCount,
    status: this.status,
    lastMessageAt: this.lastMessageAt,
    lastMessagePreview: this.lastMessagePreview,
    lastMessageDirection: this.lastMessageDirection,
    lastInboundAt: this.lastInboundAt,
    window: {
      open: this.isWindowOpen(),
      expiresAt: this.windowExpiresAt(),
    },
    lead: populated(this.lead),
    client: populated(this.client),
    assignedTo: populated(this.assignedTo),
    createdAt: this.createdAt,
  };
};

export { WINDOW_MS };
export default mongoose.model(
  "WhatsAppConversation",
  whatsAppConversationSchema
);
