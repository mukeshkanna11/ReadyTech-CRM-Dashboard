// models/ShopifyConnection.js — one Shopify store per workspace.
// A store (shopDomain) belongs to at most one workspace, so webhooks resolve
// their tenant from the shop. Tokens are AES-256-GCM encrypted
// (services/shopify/crypto.js) and never selected by default.
//
// Tenant rule: EVERY query on this model carries an explicit top-level
// `workspace` key — `{ workspace: req.workspace }` for workspace requests,
// `{ shopDomain, workspace: { $ne: null } }` for verified webhooks. The scope
// plugin then leaves the filter alone, and unauthenticated traffic can never
// fall back to the default workspace.
import mongoose from "mongoose";

const shopifyConnectionSchema = new mongoose.Schema(
  {
    shopDomain: { type: String, required: true, lowercase: true, trim: true, unique: true },
    status: { type: String, enum: ["active", "disconnected", "uninstalled", "error"], default: "active", index: true },

    accessToken: { type: String, default: null, select: false },
    accessTokenExpiresAt: { type: Date, default: null }, // null = non-expiring offline token
    refreshToken: { type: String, default: null, select: false },
    refreshTokenExpiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    apiVersion: { type: String, default: null },

    shop: {
      id: { type: String, default: null }, // gid://shopify/Shop/…
      name: { type: String, default: null },
      email: { type: String, default: null },
      currencyCode: { type: String, default: null },
    },

    webhooks: {
      registered: { type: [String], default: [] }, // topics
      lastRegisteredAt: { type: Date, default: null },
      lastError: { type: String, default: null },
    },

    /* ERP → Shopify stock sync: one ERP warehouse feeds one Shopify location */
    inventory: {
      enabled: { type: Boolean, default: false },
      warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
      locationGid: { type: String, default: null },
      locationName: { type: String, default: null },
      leaseUntil: { type: Date, default: null },
      leaseToken: { type: String, default: null },
      lastSyncAt: { type: Date, default: null },
      lastResult: { type: mongoose.Schema.Types.Mixed, default: null },
      lastError: { type: String, default: null },
    },

    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
    uninstalledAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

// `workspace` is added by the global scope plugin; at most one active store per workspace
shopifyConnectionSchema.index(
  { workspace: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

shopifyConnectionSchema.pre("validate", function () {
  if (!this.workspace) throw new Error("ShopifyConnection requires a workspace");
});

/* Verified-webhook lookup: the explicit workspace key bypasses the scope plugin */
shopifyConnectionSchema.statics.findByShop = function (shopDomain) {
  return this.findOne({ shopDomain: String(shopDomain || "").toLowerCase(), workspace: { $ne: null } });
};

shopifyConnectionSchema.methods.toSafeJSON = function () {
  return {
    shopDomain: this.shopDomain,
    status: this.status,
    connected: this.status === "active",
    shop: this.shop,
    scopes: this.scopes,
    apiVersion: this.apiVersion,
    tokenExpiresAt: this.accessTokenExpiresAt,
    webhooks: this.webhooks,
    inventory: {
      enabled: !!this.inventory?.enabled,
      warehouse: this.inventory?.warehouse || null,
      locationGid: this.inventory?.locationGid || null,
      locationName: this.inventory?.locationName || null,
      lastSyncAt: this.inventory?.lastSyncAt || null,
      lastResult: this.inventory?.lastResult || null,
      lastError: this.inventory?.lastError || null,
    },
    connectedAt: this.connectedAt,
    disconnectedAt: this.disconnectedAt,
    uninstalledAt: this.uninstalledAt,
    lastError: this.lastError,
  };
};

export default mongoose.models.ShopifyConnection || mongoose.model("ShopifyConnection", shopifyConnectionSchema);
