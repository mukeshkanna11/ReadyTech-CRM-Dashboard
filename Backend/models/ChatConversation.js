// models/ChatConversation.js
//
// Live chat-support conversations. Kept separate from models/Chat.js on purpose:
// Chat.js is the website enquiry form (name + email + message all required), so
// it can't back a widget where a visitor just starts typing. Existing /api/chat
// enquiry endpoints are untouched.

import mongoose from "mongoose";

export const CHAT_INTENTS = [
  "Sales Enquiry",
  "Support Issue",
  "Demo Request",
  "Complaint",
  "General Enquiry",
];

export const CHAT_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    /**
     * How the assistant reply was produced. "faq" and "duplicate" cost zero
     * Claude tokens — this field is what makes the FAQ hit-rate measurable.
     */
    source: {
      type: String,
      enum: ["user", "faq", "claude", "fallback", "duplicate"],
      default: "user",
    },

    faqId: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatConversationSchema = new mongoose.Schema(
  {
    /* ============ Session ============ */

    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    visitor: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },

    /* ============ Message history ============ */

    messages: { type: [messageSchema], default: [] },

    /**
     * Rolling short summary of the conversation. This — not the full history —
     * is what gets sent to Claude, and it is regenerated only every
     * SUMMARY_EVERY_N_MESSAGES turns.
     */
    summary: { type: String, default: "", maxlength: 1200 },
    summaryUpdatedAt: { type: Date, default: null },
    summarizedUpTo: { type: Number, default: 0 },

    /* ============ AI classification ============ */

    intent: { type: String, enum: CHAT_INTENTS, default: "General Enquiry" },
    priority: { type: String, enum: CHAT_PRIORITIES, default: "Medium" },

    leadQualified: { type: Boolean, default: false },
    leadScore: { type: Number, default: 0, min: 0, max: 100 },
    leadReason: { type: String, default: "", maxlength: 500 },

    /** Latest auto-reply suggestion for the human agent taking over. */
    suggestedReply: { type: String, default: "", maxlength: 2000 },

    /* ============ Usage logging (cost control) ============ */

    usage: {
      claudeCalls: { type: Number, default: 0 },
      faqHits: { type: Number, default: 0 },
      dedupeHits: { type: Number, default: 0 },
      fallbacks: { type: Number, default: 0 },
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      cacheReadInputTokens: { type: Number, default: 0 },
      cacheCreationInputTokens: { type: Number, default: 0 },
      lastModel: { type: String, default: "" },
    },

    /** Guards against duplicate AI calls for a resent/double-clicked message. */
    lastUserMessage: { type: String, default: "" },
    lastAssistantMessage: { type: String, default: "" },
    lastUserMessageAt: { type: Date, default: null },

    /* ============ Workflow ============ */

    status: {
      type: String,
      enum: ["Active", "Handed Off", "Closed"],
      default: "Active",
      index: true,
    },

    /** Set when this conversation was converted into a Chat enquiry / lead. */
    enquiry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

chatConversationSchema.index({ createdAt: -1 });
chatConversationSchema.index({ intent: 1 });
chatConversationSchema.index({ leadQualified: 1 });

export default mongoose.model("ChatConversation", chatConversationSchema);
