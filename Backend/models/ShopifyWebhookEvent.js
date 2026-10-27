// models/ShopifyWebhookEvent.js — durable inbox for verified Shopify webhooks.
// One document per delivery (unique shop + X-Shopify-Webhook-Id), processed
// by services/shopify/webhookWorker.js with atomic lease claims.
//
// Tenant rule (as ShopifyConnection): every query carries an explicit
// top-level `workspace` key; `workspace` is always the owning connection's.
import mongoose from "mongoose";

const shopifyWebhookEventSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: "ShopifyConnection", required: true },
    shopDomain: { type: String, required: true, lowercase: true, trim: true },
    topic: { type: String, required: true },
    webhookId: { type: String, required: true },
    eventId: { type: String, default: null },
    triggeredAt: { type: Date, default: null },
    apiVersion: { type: String, default: null },

    // What the event is about (for ordering / later reconciliation)
    resource: {
      gid: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    redactedAt: { type: Date, default: null },

    status: { type: String, enum: ["pending", "processing", "processed", "ignored", "dead"], default: "pending" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    leaseUntil: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    deadAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Deduplication: Shopify retries a delivery with the same webhook id
shopifyWebhookEventSchema.index({ shopDomain: 1, webhookId: 1 }, { unique: true });
// Worker claims
shopifyWebhookEventSchema.index({ status: 1, topic: 1, nextAttemptAt: 1 });
shopifyWebhookEventSchema.index({ status: 1, leaseUntil: 1 });
// Dashboard / privacy lookups
shopifyWebhookEventSchema.index({ workspace: 1, status: 1, createdAt: -1 });

shopifyWebhookEventSchema.pre("validate", function () {
  if (!this.workspace) throw new Error("ShopifyWebhookEvent requires a workspace");
});

export default mongoose.models.ShopifyWebhookEvent || mongoose.model("ShopifyWebhookEvent", shopifyWebhookEventSchema);
