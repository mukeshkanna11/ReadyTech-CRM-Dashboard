// models/ShopifyInstallState.js — one Shopify-started install attempt
// (GET /api/shopify/install → Shopify authorize → OAuth callback).
// Single use, bound to the initiating browser (hash of an HttpOnly cookie),
// expires through the TTL index. Not tied to any workspace: every query and
// write carries an explicit `workspace: null` (the scope plugin then leaves it
// alone) and documents are only written through upserts.
import mongoose from "mongoose";

const shopifyInstallStateSchema = new mongoose.Schema(
  {
    nonceHash: { type: String, required: true, unique: true },
    bindingHash: { type: String, required: true },
    shop: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "used"], default: "pending" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

shopifyInstallStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ShopifyInstallState || mongoose.model("ShopifyInstallState", shopifyInstallStateSchema);
