import mongoose from "mongoose";

/* =========================================================
   WHATSAPP CONVERSATION (one thread per customer phone)
   Isolated from Chat / ChatConversation (website + AI chat).
   Customer data is REFERENCED, never duplicated.
========================================================= */
const WINDOW_MS = 24 * 60 * 60 * 1000;

const whatsAppConversationSchema = new mongoose.Schema(
  {
    /* Unified inbox channel. Legacy rows have none = WhatsApp. */
    channel: {
      type: String,
      enum: ["whatsapp", "instagram", "messenger"],
      default: "whatsapp",
    },

    // Instagram-scoped (IGSID) / Page-scoped (PSID) sender id
    externalId: { type: String, default: null, trim: true },

    // Thread key. WhatsApp: E.164, e.g. +919876543210.
    // Instagram / Messenger: "ig:<IGSID>" / "fb:<PSID>" — reuses the
    // existing unique index instead of dropping it.
    // Uniqueness is per workspace — see the index below.
    phoneNumber: {
      type: String,
      required: true,
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

    /* Internal team notes — never sent to the customer */
    notes: [
      {
        body: { type: String, required: true, maxlength: 2000 },
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        authorName: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    /* Indexes are managed by scripts/migrateWhatsAppThreadIndex.js, never
       by app startup: production still carries the legacy global
       phoneNumber_1 unique index and must not be changed implicitly. */
    autoIndex: false,
  }
);

whatsAppConversationSchema.index({ lastMessageAt: -1 });

/* Target uniqueness: one thread per customer key PER WORKSPACE */
whatsAppConversationSchema.index(
  { workspace: 1, phoneNumber: 1 },
  { unique: true, name: "workspace_1_phoneNumber_1" }
);

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
    channel: this.channel || "whatsapp",
    externalId: this.externalId || null,
    phoneNumber:
      (this.channel || "whatsapp") === "whatsapp" ? this.phoneNumber : null,
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
    notes: (this.notes || []).map((n) => ({
      _id: n._id,
      body: n.body,
      authorName: n.authorName,
      createdAt: n.createdAt,
    })),
    createdAt: this.createdAt,
  };
};

export { WINDOW_MS };
export default mongoose.model(
  "WhatsAppConversation",
  whatsAppConversationSchema
);
