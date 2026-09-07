import mongoose from "mongoose";

/* =========================================================
   META CONNECTION (SINGLETON)
   ONE centralized Meta connection shared by CRM, ERP and
   AI Content modules. Never create a second document.
   Tokens are stored encrypted and never returned to client.
========================================================= */
const metaConnectionSchema = new mongoose.Schema(
  {
    // Singleton guard — always "default"
    key: {
      type: String,
      default: "default",
      unique: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: ["connected", "disconnected", "error"],
      default: "disconnected",
    },

    businessPortfolioId: {
      type: String,
      default: null,
      trim: true,
    },

    scopes: {
      type: [String],
      default: [],
    },

    /* 🔐 Long-lived user access token (encrypted at rest) */
    userToken: {
      encrypted: { type: String, default: null },
      expiresAt: { type: Date, default: null },
    },

    /* 📘 Facebook Page (already linked in Meta Business) */
    facebookPage: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      encryptedToken: { type: String, default: null },
    },

    /* 📸 Instagram Business account (@readytechsolutions) */
    instagram: {
      id: { type: String, default: null },
      username: { type: String, default: null },
      name: { type: String, default: null },
      profilePictureUrl: { type: String, default: null },
    },

    lastSyncedAt: { type: Date, default: null },
    lastError: { type: String, default: null },

    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* =========================================================
   FETCH / CREATE SINGLETON
========================================================= */
metaConnectionSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: "default" });

  if (!doc) {
    doc = await this.create({ key: "default" });
  }

  return doc;
};

/* =========================================================
   SAFE PAYLOAD (no secrets, no tokens)
========================================================= */
metaConnectionSchema.methods.toSafeJSON = function () {
  const tokenExpired =
    !!this.userToken?.expiresAt && this.userToken.expiresAt <= new Date();

  return {
    status: this.status,
    connected: this.status === "connected" && !tokenExpired,
    businessPortfolioId: this.businessPortfolioId,
    scopes: this.scopes,

    token: {
      present: !!this.userToken?.encrypted,
      expiresAt: this.userToken?.expiresAt || null,
      expired: tokenExpired,
    },

    facebookPage: {
      connected: !!this.facebookPage?.id,
      id: this.facebookPage?.id || null,
      name: this.facebookPage?.name || null,
      tokenPresent: !!this.facebookPage?.encryptedToken,
    },

    instagram: {
      connected: !!this.instagram?.id,
      id: this.instagram?.id || null,
      username: this.instagram?.username || null,
      name: this.instagram?.name || null,
      profilePictureUrl: this.instagram?.profilePictureUrl || null,
    },

    lastSyncedAt: this.lastSyncedAt,
    lastError: this.lastError,
    connectedAt: this.connectedAt,
    disconnectedAt: this.disconnectedAt,
  };
};

export default mongoose.model("MetaConnection", metaConnectionSchema);
