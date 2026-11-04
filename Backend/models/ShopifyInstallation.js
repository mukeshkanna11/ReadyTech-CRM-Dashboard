// models/ShopifyInstallation.js — a store that installed the app from Shopify
// but is not linked to a ReadyTech workspace yet. Holds the encrypted tokens
// only until an authenticated ReadyTech admin links it (POST /oauth/link),
// which moves them into that workspace's ShopifyConnection and deletes this
// record. Unlinked records expire after 10 minutes (TTL), so tokens never
// linger. Never workspace-scoped: every query/write carries `workspace: null`.
import mongoose from "mongoose";

const shopifyInstallationSchema = new mongoose.Schema(
  {
    shopDomain: { type: String, required: true, lowercase: true, trim: true, unique: true },
    accessToken: { type: String, default: null, select: false },
    accessTokenExpiresAt: { type: Date, default: null },
    refreshToken: { type: String, default: null, select: false },
    refreshTokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    shop: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      email: { type: String, default: null },
      currencyCode: { type: String, default: null },
    },
    linkCodeHash: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

shopifyInstallationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
shopifyInstallationSchema.index({ linkCodeHash: 1 }, { unique: true, partialFilterExpression: { linkCodeHash: { $type: "string" } } });

export default mongoose.models.ShopifyInstallation || mongoose.model("ShopifyInstallation", shopifyInstallationSchema);
