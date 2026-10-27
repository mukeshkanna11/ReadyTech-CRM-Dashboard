// models/ShopifyInventoryLink.js — Shopify inventory item (variant) ↔ ERP
// product by SKU, per workspace. `lastPushedQty` is what ReadyTech last set
// in Shopify: unchanged quantities are not pushed again, and Shopify's echo
// of our own push (inventory_levels/update) is recognised, so there is no loop.
// Tenant rule: every query carries an explicit top-level `workspace`.
import mongoose from "mongoose";

const shopifyInventoryLinkSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: "ShopifyConnection", required: true },
    shopDomain: { type: String, required: true, lowercase: true },
    sku: { type: String, required: true, uppercase: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    shopifyProductGid: { type: String, default: null },
    inventoryItemGid: { type: String, required: true },
    sourceUpdatedAt: { type: Date, default: null }, // Shopify product updated_at last applied

    lastPushedQty: { type: Number, default: null },
    lastPushedAt: { type: Date, default: null },
    dirty: { type: Boolean, default: true }, // Shopify drifted from ERP → re-assert
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

shopifyInventoryLinkSchema.index({ workspace: 1, inventoryItemGid: 1 }, { unique: true });
shopifyInventoryLinkSchema.index({ workspace: 1, connection: 1, sku: 1 });
shopifyInventoryLinkSchema.index({ workspace: 1, shopifyProductGid: 1 });

export default mongoose.models.ShopifyInventoryLink || mongoose.model("ShopifyInventoryLink", shopifyInventoryLinkSchema);
