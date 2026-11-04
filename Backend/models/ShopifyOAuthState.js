// models/ShopifyOAuthState.js — one in-flight Shopify OAuth attempt.
// Makes the signed `state` single-use and ties the authorization code to the
// admin who started the connection:
//   pending  → created by GET /oauth/url (authenticated admin)
//   callback → Shopify redirected back; the code is held here (encrypted)
//   used     → that same admin finished it via POST /oauth/complete
// Only SHA-256 hashes of the nonce and completion id are stored. Documents
// expire through the TTL index. Tenant rule: every query carries an explicit
// top-level `workspace` key (the scope plugin then leaves the filter alone).
import mongoose from "mongoose";

const shopifyOAuthStateSchema = new mongoose.Schema(
  {
    nonceHash: { type: String, required: true, unique: true },
    completeHash: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shop: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["pending", "callback", "used"], default: "pending" },
    code: { type: String, default: null, select: false }, // encrypted (services/shopify/crypto.js)
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

shopifyOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
shopifyOAuthStateSchema.index(
  { completeHash: 1 },
  { unique: true, partialFilterExpression: { completeHash: { $type: "string" } } }
);

shopifyOAuthStateSchema.pre("validate", function () {
  if (!this.workspace) throw new Error("ShopifyOAuthState requires a workspace");
});

export default mongoose.models.ShopifyOAuthState || mongoose.model("ShopifyOAuthState", shopifyOAuthStateSchema);
