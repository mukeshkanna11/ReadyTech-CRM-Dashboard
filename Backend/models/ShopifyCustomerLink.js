// models/ShopifyCustomerLink.js — Shopify customer ↔ CRM Client per workspace.
// Tenant rule: every query carries an explicit top-level `workspace`.
import mongoose from "mongoose";

const shopifyCustomerLinkSchema = new mongoose.Schema(
  {
    shopDomain: { type: String, required: true, lowercase: true },
    customerGid: { type: String, required: true }, // "guest:<shop>" for orders without a customer
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
  },
  { timestamps: true }
);

shopifyCustomerLinkSchema.index({ workspace: 1, customerGid: 1 }, { unique: true });

export default mongoose.models.ShopifyCustomerLink || mongoose.model("ShopifyCustomerLink", shopifyCustomerLinkSchema);
