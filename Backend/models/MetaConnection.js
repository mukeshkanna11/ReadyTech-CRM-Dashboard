import mongoose from "mongoose";
import {
  getWorkspaceId,
  getDefaultWorkspaceId,
} from "../utils/workspaceContext.js";

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
      webhookSubscribed: { type: Boolean, default: false },
      lastInboundAt: { type: Date, default: null },
    },

    /* 📸 Instagram Business account (@readytechsolutions) */
    instagram: {
      id: { type: String, default: null },
      username: { type: String, default: null },
      name: { type: String, default: null },
      profilePictureUrl: { type: String, default: null },
      lastInboundAt: { type: Date, default: null },
    },

    /* Page / Instagram ids this workspace disconnected. Their webhooks
       are dropped instead of falling into the default workspace. */
    releasedAssetIds: { type: [String], default: [] },

    /* 💬 WhatsApp Cloud API
       Authenticated with its own System User token (env), NOT the
       Facebook OAuth user token — so it survives an FB/IG disconnect. */
    whatsapp: {
      connected: { type: Boolean, default: false },
      phoneNumberId: { type: String, default: null },
      wabaId: { type: String, default: null },
      displayPhoneNumber: { type: String, default: null },
      verifiedName: { type: String, default: null },
      qualityRating: { type: String, default: null },
      // Optional DB-stored token; env is the source of truth initially
      encryptedToken: { type: String, default: null },
      webhookSubscribed: { type: Boolean, default: false },
      lastInboundAt: { type: Date, default: null },
      lastSyncedAt: { type: Date, default: null },
      lastError: { type: String, default: null },
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
/* One document per workspace. The default workspace keeps the
   original "default" document (Siva's connection, unchanged); any
   other workspace gets its own document keyed by its workspace id. */
export const metaKeyFor = (workspaceId = getWorkspaceId()) => {
  const id = workspaceId ? String(workspaceId) : null;
  const defaultId = getDefaultWorkspaceId();

  if (!id) return "default";

  // Fail closed: an unresolved default never maps a tenant onto Siva's doc
  return defaultId && id === defaultId ? "default" : id;
};

metaConnectionSchema.statics.getSingleton = async function (workspaceId) {
  const key = metaKeyFor(workspaceId);
  let doc = await this.findOne({ key });

  if (!doc) {
    try {
      doc = await this.create({ key });
    } catch (error) {
      // Concurrent first request already created it (unique key)
      if (error?.code !== 11000) throw error;
      doc = await this.findOne({ key });
    }
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
      webhookSubscribed: !!this.facebookPage?.webhookSubscribed,
      lastInboundAt: this.facebookPage?.lastInboundAt || null,
    },

    instagram: {
      connected: !!this.instagram?.id,
      id: this.instagram?.id || null,
      username: this.instagram?.username || null,
      name: this.instagram?.name || null,
      profilePictureUrl: this.instagram?.profilePictureUrl || null,
      lastInboundAt: this.instagram?.lastInboundAt || null,
    },

    whatsapp: {
      connected: !!this.whatsapp?.connected,
      phoneNumberId: this.whatsapp?.phoneNumberId || null,
      wabaId: this.whatsapp?.wabaId || null,
      displayPhoneNumber: this.whatsapp?.displayPhoneNumber || null,
      verifiedName: this.whatsapp?.verifiedName || null,
      qualityRating: this.whatsapp?.qualityRating || null,
      tokenPresent: !!this.whatsapp?.encryptedToken,
      webhookSubscribed: !!this.whatsapp?.webhookSubscribed,
      lastInboundAt: this.whatsapp?.lastInboundAt || null,
      lastSyncedAt: this.whatsapp?.lastSyncedAt || null,
      lastError: this.whatsapp?.lastError || null,
    },

    lastSyncedAt: this.lastSyncedAt,
    lastError: this.lastError,
    connectedAt: this.connectedAt,
    disconnectedAt: this.disconnectedAt,
  };
};

export default mongoose.model("MetaConnection", metaConnectionSchema);
