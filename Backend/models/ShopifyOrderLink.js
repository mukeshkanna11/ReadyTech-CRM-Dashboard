// models/ShopifyOrderLink.js — one Shopify order ↔ one ERP SalesOrder per
// workspace. The unique (workspace, orderGid) index is what makes order
// import exactly-once; `lastUpdatedAt` drops stale / out-of-order webhooks.
// Tenant rule: every query carries an explicit top-level `workspace`.
import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    refundGid: { type: String, required: true },
    // Money actually returned (successful refund transactions), minor units per currency
    money: [{ currency: String, digits: Number, amountMinor: Number, _id: false }],
    restock: { type: Boolean, default: false },
    lines: [{ sku: String, quantity: Number, _id: false }],
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const shopifyOrderLinkSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: "ShopifyConnection", required: true },
    shopDomain: { type: String, required: true, lowercase: true },
    orderGid: { type: String, required: true },
    orderName: { type: String, default: null }, // "#1001"
    salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder", default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },

    status: { type: String, enum: ["imported", "cancelled", "refund_only"], default: "imported" },
    lastUpdatedAt: { type: Date, default: null }, // Shopify order updated_at last applied
    financialStatus: { type: String, default: null },
    fulfillmentStatus: { type: String, default: null },
    currency: { type: String, default: null },
    totalPrice: { type: Number, default: null },
    cancelledAt: { type: Date, default: null },
    refunds: { type: [refundSchema], default: [] },
    fulfillments: {
      type: [
        {
          fulfillmentGid: { type: String, required: true },
          status: { type: String, default: null },
          lines: [{ sku: String, quantity: Number, _id: false }],
          updatedAt: { type: Date, default: null },
          _id: false,
        },
      ],
      default: [],
    },
    // Shopify money snapshot in minor units (services/shopify/financials.js)
    financials: { type: mongoose.Schema.Types.Mixed, default: null },
    // Shopify changes the ERP order could not follow (needs a person)
    issues: { type: [String], default: [] },
  },
  { timestamps: true }
);

shopifyOrderLinkSchema.index({ workspace: 1, orderGid: 1 }, { unique: true });
shopifyOrderLinkSchema.index({ workspace: 1, updatedAt: -1 });

export default mongoose.models.ShopifyOrderLink || mongoose.model("ShopifyOrderLink", shopifyOrderLinkSchema);
