import crypto from "crypto";

import MetaConnection from "../../models/MetaConnection.js";
import WhatsAppConversation, { WINDOW_MS } from "../../models/WhatsAppConversation.js";
import WhatsAppMessage from "../../models/WhatsAppMessage.js";
import Lead from "../../models/Lead.js";
import Client from "../../models/Client.js";
import User from "../../models/User.js";
import {
  activeUserScope,
  getDefaultWorkspaceId,
  runWithWorkspace,
} from "../../utils/workspaceContext.js";

// Reuse the existing Meta config (Graph version + app secret) — no duplication
import { getMetaConfig, explainMetaError } from "./meta.service.js";
import { encryptToken, decryptToken } from "./tokenVault.js";
import { metaKeyFor } from "../../models/MetaConnection.js";

/* =========================================================
   CONFIG
========================================================= */
export const getWhatsAppConfig = () => {
  const { apiVersion, appSecret } = getMetaConfig();

  // The env number is the default workspace's (Siva's) — never shared
  // with another workspace.
  const own = metaKeyFor() === "default";

  const config = {
    phoneNumberId: own ? process.env.WHATSAPP_PHONE_NUMBER_ID : null,
    wabaId: own ? process.env.WHATSAPP_WABA_ID : null,
    accessToken: own ? process.env.WHATSAPP_ACCESS_TOKEN : null,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret,
    apiVersion,
  };

  const missing = Object.entries({
    WHATSAPP_PHONE_NUMBER_ID: config.phoneNumberId,
    WHATSAPP_ACCESS_TOKEN: config.accessToken,
    WHATSAPP_VERIFY_TOKEN: config.verifyToken,
    META_APP_SECRET: config.appSecret,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return { ...config, missing, configured: missing.length === 0 };
};

/* Active workspace's WhatsApp account. Default workspace: env first,
   its own DB doc as fallback. Any other workspace: ONLY its own DB doc
   (getWhatsAppConfig never returns env values there). */
export const resolveWhatsAppAccount = async () => {
  const connection = await MetaConnection.getSingleton();
  const wa = connection.whatsapp || {};
  // Platform (.env) number switched off by the default workspace → own doc only
  const config = wa.platformDisabled ? {} : getWhatsAppConfig();

  return {
    connection,
    phoneNumberId: config.phoneNumberId || wa.phoneNumberId || null,
    wabaId: config.wabaId || wa.wabaId || null,
    accessToken:
      config.accessToken ||
      (wa.encryptedToken ? decryptToken(wa.encryptedToken) : null),
    source: config.accessToken ? "platform" : wa.encryptedToken ? "workspace" : null,
  };
};

const resolveAccessToken = async () => {
  const { accessToken } = await resolveWhatsAppAccount();
  if (accessToken) return accessToken;

  const error = new Error("WhatsApp is not connected for this workspace");
  error.status = 400;
  throw error;
};

/* =========================================================
   GRAPH REQUEST (WhatsApp Cloud API)
========================================================= */
const graphFetch = async (path, { method = "GET", body, params, token: override, form } = {}) => {
  const { apiVersion } = getWhatsAppConfig();
  const token = override || (await resolveAccessToken());

  const url = new URL(
    `https://graph.facebook.com/${apiVersion}/${String(path).replace(/^\/+/, "")}`
  );

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    // Never surface the token in errors/logs
    const error = new Error(
      explainMetaError(data?.error, `WhatsApp API request failed (${response.status})`)
    );
    error.status = response.status >= 500 ? 502 : 400;
    error.metaCode = data?.error?.code || null;
    throw error;
  }

  return data;
};

/* =========================================================
   WEBHOOK VERIFICATION
========================================================= */
export const verifyWebhookToken = (mode, token) => {
  const { verifyToken } = getWhatsAppConfig();
  if (!verifyToken || mode !== "subscribe" || !token) return false;

  const a = Buffer.from(String(token));
  const b = Buffer.from(String(verifyToken));

  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const verifyWebhookSignature = (rawBody, signatureHeader, secret) => {
  const appSecret = secret || getWhatsAppConfig().appSecret;

  if (!appSecret || !rawBody || !signatureHeader) return false;
  if (!String(signatureHeader).startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const received = String(signatureHeader).slice(7);

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");

  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* =========================================================
   PHONE NORMALIZATION
========================================================= */
export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

/* Match existing CRM records on the last 10 digits, tolerating any
   separators used in stored values ("+91 98765 00003", "98765-00003"). */
export const phoneMatcher = (normalized) => {
  const tail = String(normalized).replace(/\D/g, "").slice(-10);
  if (tail.length < 8) return null;
  return new RegExp(`${tail.split("").join("[^0-9]*")}$`);
};

/* =========================================================
   CONTACT / CLIENT / LEAD RESOLUTION
   Reuses existing CRM models. Never duplicates records.
========================================================= */
const resolveCrmRecords = async ({ phoneNumber, profileName }) => {
  const matcher = phoneMatcher(phoneNumber);
  if (!matcher) return { lead: null, client: null };

  const [client, lead] = await Promise.all([
    Client.findOne({ phone: matcher }).select("_id").lean(),
    Lead.findOne({ phone: matcher }).select("_id").lean(),
  ]);

  if (client || lead) {
    return { client: client?._id || null, lead: lead?._id || null };
  }

  // No existing record — create a Lead using the existing model.
  // Lead.owner is required, so fall back to an admin user.
  const owner = await User.findOne({
    ...activeUserScope(),
    role: "admin",
    isActive: { $ne: false },
  })
    .select("_id")
    .lean();

  if (!owner) {
    // Never lose the message: keep the conversation unlinked.
    return { lead: null, client: null };
  }

  const created = await Lead.create({
    name: profileName || phoneNumber,
    phone: phoneNumber,
    source: "WhatsApp", // value already present in the existing Lead enum
    owner: owner._id,
  });

  return { lead: created._id, client: null };
};

/* Refresh lead recency so a live WhatsApp thread floats to the top
   of the Leads list. $max keeps the newest time; never duplicates or
   otherwise alters the lead. */
const touchLeadRecency = async (leadId, when) => {
  if (!leadId) return;

  try {
    await Lead.updateOne(
      { _id: leadId },
      { $max: { lastContactedAt: when || new Date() } }
    );
  } catch (error) {
    console.error("Lead lastContactedAt update failed:", error.message);
  }
};

/* =========================================================
   CONVERSATION UPSERT
========================================================= */
const getOrCreateConversation = async ({ phoneNumber, waId, profileName }) => {
  let conversation = await WhatsAppConversation.findOne({ phoneNumber });

  if (conversation) {
    if (profileName && conversation.profileName !== profileName) {
      conversation.profileName = profileName;
    }
    return conversation;
  }

  const { lead, client } = await resolveCrmRecords({ phoneNumber, profileName });

  try {
    conversation = await WhatsAppConversation.create({
      channel: "whatsapp",
      phoneNumber,
      waId: waId || null,
      profileName: profileName || null,
      lead,
      client,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;

    // Concurrent webhook created it in THIS workspace — reuse it
    conversation = await WhatsAppConversation.findOne({ phoneNumber });
    if (conversation) return conversation;

    // Legacy global unique phoneNumber_1 index (pre-migration): the same
    // customer has a thread in ANOTHER workspace. Never attach to it.
    const e = new Error(
      "Thread exists in another workspace — run scripts/migrateWhatsAppThreadIndex.js"
    );
    e.code = "CROSS_WORKSPACE_THREAD";
    throw e;
  }

  return conversation;
};

/* =========================================================
   INBOUND MESSAGE
========================================================= */
const extractBody = (message) => {
  switch (message.type) {
    case "text":
      return message.text?.body || "";
    case "button":
      return message.button?.text || "";
    case "interactive":
      return (
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        ""
      );
    case "location": {
      const l = message.location || {};
      return [l.name, l.address, l.latitude != null ? `${l.latitude},${l.longitude}` : ""]
        .filter(Boolean)
        .join(" — ");
    }
    default:
      return message[message.type]?.caption || "";
  }
};

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

/* Media is fetched later through the authenticated proxy — Meta media
   URLs expire and require the workspace token. */
const extractMedia = (message) => {
  if (!MEDIA_TYPES.has(message.type)) return null;
  const m = message[message.type] || {};
  return {
    mediaId: m.id || null,
    mimeType: m.mime_type || null,
    filename: m.filename || null,
  };
};

const processInboundMessage = async (message, contactProfile, metadata) => {
  const phoneNumber = normalizePhone(message.from);
  if (!phoneNumber) return { skipped: "no-phone" };

  // Duplicate protection by Meta message ID
  if (message.id && (await WhatsAppMessage.exists({ messageId: message.id }))) {
    return { skipped: "duplicate" };
  }

  const conversation = await getOrCreateConversation({
    phoneNumber,
    waId: message.from,
    profileName: contactProfile?.name || null,
  });

  const body = extractBody(message);
  const timestamp = message.timestamp
    ? new Date(Number(message.timestamp) * 1000)
    : new Date();

  const isText = message.type === "text";
  const media = extractMedia(message);

  try {
    await WhatsAppMessage.create({
      conversation: conversation._id,
      direction: "inbound",
      messageId: message.id || null,
      from: phoneNumber,
      to: normalizePhone(metadata?.display_phone_number),
      type: message.type || "text",
      body: isText ? body : body || `[${message.type}]`,
      timestamp,
      status: "delivered",
      meta: isText ? null : { type: message.type, ...(media || {}) },
    });
  } catch (error) {
    // Unique index race on messageId — treat as duplicate, not an error
    if (error?.code === 11000) return { skipped: "duplicate" };
    throw error;
  }

  conversation.lastInboundAt = timestamp;
  conversation.lastMessageAt = timestamp;
  conversation.lastMessagePreview = (body || `[${message.type}]`).slice(0, 300);
  conversation.lastMessageDirection = "inbound";
  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  if (conversation.status === "Closed") conversation.status = "Open";
  await conversation.save();

  // Inbound WhatsApp message = customer interaction on the linked lead.
  await touchLeadRecency(conversation.lead, timestamp);

  // Reflect activity on the centralized Meta connection
  await MetaConnection.updateOne(
    { key: metaKeyFor() },
    { $set: { "whatsapp.lastInboundAt": timestamp } }
  );

  return { conversationId: conversation._id };
};

/* =========================================================
   STATUS EVENTS (sent / delivered / read / failed)
========================================================= */
const STATUS_RANK = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

const processStatusEvent = async (status) => {
  if (!status?.id) return { skipped: "no-id" };

  const next = String(status.status || "").toLowerCase();
  if (!(next in STATUS_RANK)) return { skipped: "unsupported-status" };

  const message = await WhatsAppMessage.findOne({ messageId: status.id });
  if (!message) return { skipped: "unknown-message" };

  // Never regress status (webhooks can arrive out of order)
  if (STATUS_RANK[next] <= STATUS_RANK[message.status] && next !== "failed") {
    return { skipped: "stale-status" };
  }

  message.status = next;

  if (next === "failed") {
    const err = status.errors?.[0];
    message.error = {
      code: err?.code ? String(err.code) : null,
      title: err?.title || null,
      message: err?.message || err?.error_data?.details || null,
    };
  }

  await message.save();

  return { messageId: status.id, status: next };
};

/* =========================================================
   WEBHOOK → WORKSPACE ROUTING
   The env number (and the default doc) belong to the default
   workspace; any other number must be registered by its workspace.
========================================================= */
export const workspaceForPhoneNumberId = async (phoneNumberId) => {
  const id = phoneNumberId ? String(phoneNumberId) : null;
  if (!id) return null;

  if (id === String(process.env.WHATSAPP_PHONE_NUMBER_ID || "")) {
    const own = await MetaConnection.findOne({ key: "default" })
      .select("whatsapp.platformDisabled")
      .lean();
    if (!own?.whatsapp?.platformDisabled) return getDefaultWorkspaceId();
    // Disabled: only routed if re-connected through the workspace doc below
  }

  const doc = await MetaConnection.findOne({ "whatsapp.phoneNumberId": id })
    .select("key")
    .lean();

  if (!doc) return null;
  return doc.key === "default" ? getDefaultWorkspaceId() : doc.key;
};

/* =========================================================
   WEBHOOK ENTRY POINT
   Tolerant by design: unsupported events are ignored, never thrown.
========================================================= */
/* account_update: the business removed this app / offboarded the
   number in Meta. Mark that WABA's connection disconnected so the UI
   never shows a stale "Connected". Returns 1 when nothing matched. */
const OFFBOARD_EVENTS = new Set(["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED", "ACCOUNT_DELETED"]);

const processAccountUpdate = async (wabaId, value = {}) => {
  const event = String(value?.event || "").toUpperCase();
  if (!wabaId || !OFFBOARD_EVENTS.has(event)) return 1;

  const r = await MetaConnection.updateMany(
    { "whatsapp.wabaId": String(wabaId), "whatsapp.connected": true },
    {
      $set: {
        "whatsapp.connected": false,
        "whatsapp.health": "error",
        "whatsapp.webhookSubscribed": false,
        "whatsapp.lastError": `Meta reported ${event} for this WhatsApp account — reconnect WhatsApp to resume messaging`,
      },
    }
  );
  return r.modifiedCount ? 0 : 1;
};

export const processWebhookPayload = async (payload) => {
  const result = { messages: 0, statuses: 0, ignored: 0 };

  if (payload?.object !== "whatsapp_business_account") {
    result.ignored += 1;
    return result;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === "account_update") {
        result.ignored += await processAccountUpdate(entry.id, change.value);
        continue;
      }

      if (change.field !== "messages") {
        result.ignored += 1;
        continue;
      }

      const value = change.value || {};
      const profile = value.contacts?.[0]?.profile || null;

      // Route to the workspace that owns this phone number. Unknown
      // numbers are dropped — never written into Siva's workspace.
      const workspaceId = await workspaceForPhoneNumberId(
        value.metadata?.phone_number_id
      );
      if (!workspaceId) {
        result.ignored += 1;
        continue;
      }

      await runWithWorkspace(workspaceId, async () => {
      for (const message of value.messages || []) {
        try {
          const r = await processInboundMessage(message, profile, value.metadata);
          if (r.skipped) result.ignored += 1;
          else result.messages += 1;
        } catch (error) {
          console.error("WhatsApp inbound error:", error.message);
          result.ignored += 1;
        }
      }

      for (const status of value.statuses || []) {
        try {
          const r = await processStatusEvent(status);
          if (r.skipped) result.ignored += 1;
          else result.statuses += 1;
        } catch (error) {
          console.error("WhatsApp status error:", error.message);
          result.ignored += 1;
        }
      }
      });
    }
  }

  return result;
};

/* =========================================================
   OUTBOUND TEXT MESSAGE
   Backend ENFORCES the 24-hour window — frontend cannot bypass.
========================================================= */
/* WhatsApp Cloud API supported outbound media (official limits) */
const MB = 1024 * 1024;
const OUTBOUND_RULES = [
  [/^image\/(jpeg|png)$/, "image", 5 * MB],
  [/^video\/(mp4|3gpp)$/, "video", 16 * MB],
  [/^audio\/(aac|amr|mpeg|mp4|ogg)$/, "audio", 16 * MB],
  [/^(application\/pdf|text\/plain|application\/msword|application\/vnd\.ms-(excel|powerpoint)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))$/, "document", 100 * MB],
];

const OUTBOUND_MEDIA = (mime) =>
  OUTBOUND_RULES.find(([re]) => re.test(String(mime || "")))?.[1] || null;

const assertSupportedMedia = (media) => {
  const rule = OUTBOUND_RULES.find(([re]) => re.test(String(media.mimeType || "")));
  if (!rule) {
    const error = new Error(
      `Unsupported attachment type "${media.mimeType || "unknown"}". WhatsApp accepts JPEG/PNG, MP4, AAC/MP3/OGG audio, PDF and Office documents.`
    );
    error.status = 400;
    error.code = "UNSUPPORTED_MEDIA";
    throw error;
  }
  const size = Math.floor((String(media.data || "").replace(/^data:[^,]+,/, "").length * 3) / 4);
  if (size > rule[2]) {
    const error = new Error(`Attachment exceeds WhatsApp's ${rule[2] / MB} MB limit for ${rule[1]}s`);
    error.status = 400;
    error.code = "MEDIA_TOO_LARGE";
    throw error;
  }
};

/* Uploads a base64 file to WhatsApp media storage (official /media edge) */
const uploadMedia = async (phoneNumberId, { data, mimeType, filename }) => {
  const buffer = Buffer.from(String(data || "").replace(/^data:[^,]+,/, ""), "base64");
  if (!buffer.length) {
    const error = new Error("Attachment is empty");
    error.status = 400;
    throw error;
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([buffer], { type: mimeType }), filename || "file");

  const res = await graphFetch(`${phoneNumberId}/media`, { method: "POST", form });
  return res.id;
};

export const sendTextMessage = async ({ conversationId, text, media, user }) => {
  const clean = String(text || "").trim();
  if (media) assertSupportedMedia(media);
  const mediaType = media ? OUTBOUND_MEDIA(media.mimeType) : null;

  if (!clean && !mediaType) {
    const error = new Error("Message text or attachment is required");
    error.status = 400;
    throw error;
  }

  const conversation = await WhatsAppConversation.findById(conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }

  if (!conversation.isWindowOpen()) {
    const error = new Error(
      "24-hour window expired. An approved WhatsApp template is required."
    );
    error.status = 409;
    error.code = "WINDOW_EXPIRED";
    throw error;
  }

  const { phoneNumberId } = await resolveWhatsAppAccount();
  if (!phoneNumberId) {
    const error = new Error("WhatsApp is not connected for this workspace");
    error.status = 400;
    throw error;
  }

  const record = await WhatsAppMessage.create({
    conversation: conversation._id,
    direction: "outbound",
    to: conversation.phoneNumber,
    type: mediaType || "text",
    body: clean || (mediaType ? `[${mediaType}]` : ""),
    timestamp: new Date(),
    status: "pending",
    sentBy: user?._id || null,
  });

  try {
    let payload = { type: "text", text: { preview_url: false, body: clean } };

    if (mediaType) {
      const mediaId = await uploadMedia(phoneNumberId, media);
      const item = { id: mediaId };
      if (clean && mediaType !== "audio") item.caption = clean;
      if (mediaType === "document") item.filename = media.filename || "file";
      payload = { type: mediaType, [mediaType]: item };
      record.meta = {
        type: mediaType,
        mediaId,
        mimeType: media.mimeType,
        filename: media.filename || null,
      };
    }

    const response = await graphFetch(`${phoneNumberId}/messages`, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conversation.phoneNumber,
        ...payload,
      },
    });

    record.messageId = response?.messages?.[0]?.id || null;
    record.status = "sent";
    await record.save();
  } catch (error) {
    record.status = "failed";
    record.error = {
      code: error.metaCode ? String(error.metaCode) : null,
      title: "Send failed",
      message: error.message,
    };
    await record.save();
    throw error;
  }

  const now = new Date();
  conversation.lastOutboundAt = now;
  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = (clean || `[${mediaType}]`).slice(0, 300);
  conversation.lastMessageDirection = "outbound";
  await conversation.save();

  // Replying to the customer also counts as contact.
  await touchLeadRecency(conversation.lead, now);

  return record;
};

/* =========================================================
   ACCOUNT SYNC — stores metadata locally so the inbox never
   needs to call the Graph API on refresh.
========================================================= */
export const syncWhatsAppAccount = async () => {
  const { connection, phoneNumberId, wabaId, accessToken } =
    await resolveWhatsAppAccount();

  if (!phoneNumberId || !accessToken) {
    const error = new Error("WhatsApp is not connected for this workspace");
    error.status = 400;
    throw error;
  }

  try {
    const data = await graphFetch(phoneNumberId, {
      params: {
        fields: "display_phone_number,verified_name,quality_rating,id",
      },
    });

    connection.whatsapp.connected = true;
    connection.whatsapp.phoneNumberId = data.id || phoneNumberId;
    connection.whatsapp.wabaId = wabaId || connection.whatsapp.wabaId;
    connection.whatsapp.displayPhoneNumber = data.display_phone_number || null;
    connection.whatsapp.verifiedName = data.verified_name || null;
    connection.whatsapp.qualityRating = data.quality_rating || null;
    connection.whatsapp.lastSyncedAt = new Date();
    connection.whatsapp.lastTestedAt = new Date();
    connection.whatsapp.health = "healthy";
    connection.whatsapp.lastError = null;
  } catch (error) {
    connection.whatsapp.connected = false;
    connection.whatsapp.health = "error";
    connection.whatsapp.lastError = error.message;
    connection.whatsapp.lastSyncedAt = new Date();
    connection.whatsapp.lastTestedAt = new Date();
    await connection.save();
    throw error;
  }

  await connection.save();

  return connection;
};

/* =========================================================
   WABA WEBHOOK SUBSCRIPTION — registers this app on the WABA
   so Meta delivers events to /api/whatsapp/webhook.
   Explicit admin action only; never runs automatically.
========================================================= */
export const subscribeWabaToWebhook = async () => {
  const { wabaId } = await resolveWhatsAppAccount();

  if (!wabaId) {
    const error = new Error("WhatsApp Business Account ID is not set for this workspace");
    error.status = 400;
    throw error;
  }

  // POST /{waba-id}/subscribed_apps — token is applied inside graphFetch
  const data = await graphFetch(`${wabaId}/subscribed_apps`, { method: "POST" });

  const connection = await MetaConnection.getSingleton();
  connection.whatsapp.wabaId = wabaId || connection.whatsapp.wabaId;
  connection.whatsapp.webhookSubscribed = data?.success === true;
  await connection.save();

  return { wabaId, success: data?.success === true, response: data };
};

/* Marks the webhook as verified by Meta (called from the GET handler) */
export const markWebhookSubscribed = async () => {
  await MetaConnection.updateOne(
    { key: "default" },
    { $set: { "whatsapp.webhookSubscribed": true } },
    { upsert: false }
  );
};

/* =========================================================
   WORKSPACE CONNECT / DISCONNECT (own number + System User token)
   Token is validated against the Graph API, then stored encrypted
   on this workspace's MetaConnection only.
========================================================= */
export const connectWhatsAppAccount = async ({ phoneNumberId, wabaId, accessToken }) => {
  const id = String(phoneNumberId || "").trim();
  const token = String(accessToken || "").trim();
  const waba = String(wabaId || "").trim() || null;

  if (!/^\d+$/.test(id) || !token) {
    const error = new Error("Phone number ID (digits) and access token are required");
    error.status = 400;
    throw error;
  }

  await assertNumberAvailable(id);

  // Throws on invalid token / number — nothing is stored then
  const data = await graphFetch(id, {
    token,
    params: { fields: "display_phone_number,verified_name,quality_rating,id" },
  });

  const connection = await MetaConnection.getSingleton();
  Object.assign(connection.whatsapp, {
    connected: true,
    phoneNumberId: data.id || id,
    wabaId: waba,
    displayPhoneNumber: data.display_phone_number || null,
    verifiedName: data.verified_name || null,
    qualityRating: data.quality_rating || null,
    encryptedToken: encryptToken(token),
    onboardingType: "manual",
    connectedAt: new Date(),
    health: "healthy",
    lastTestedAt: new Date(),
    lastSyncedAt: new Date(),
    lastError: null,
  });

  if (waba) {
    try {
      const sub = await graphFetch(`${waba}/subscribed_apps`, { method: "POST", token });
      connection.whatsapp.webhookSubscribed = sub?.success === true;
    } catch (error) {
      connection.whatsapp.lastError = `Webhook subscribe failed: ${error.message}`;
    }
  }

  await connection.save();
  return connection;
};

export const disconnectWhatsAppAccount = async () => {
  const connection = await MetaConnection.getSingleton();
  const wa = connection.whatsapp || {};

  // Best effort: unsubscribe this app from the workspace's own WABA
  // (DB-token connections only; the platform .env WABA is left as is).
  if (wa.wabaId && wa.encryptedToken) {
    try {
      await graphFetch(`${wa.wabaId}/subscribed_apps`, {
        method: "DELETE",
        token: decryptToken(wa.encryptedToken),
      });
    } catch (error) {
      console.warn("WhatsApp unsubscribe on disconnect failed:", error.message);
    }
  }

  Object.assign(connection.whatsapp, {
    connected: false,
    encryptedToken: null,
    encryptedPin: null,
    webhookSubscribed: false,
    health: null,
    onboardingType: null,
    connectedAt: null,
    lastError: null,
  });
  // Default workspace disconnecting the platform (.env) number: switch it
  // off for this workspace so it never reappears on its own.
  if (connection.key === "default" && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    connection.whatsapp.platformDisabled = true;
  }
  connection.whatsapp.phoneNumberId = null;
  await connection.save();
  return connection;
};

/* A number may belong to exactly one workspace */
const assertNumberAvailable = async (phoneNumberId) => {
  const key = metaKeyFor();
  const claimed = await MetaConnection.findOne({
    "whatsapp.phoneNumberId": phoneNumberId,
    key: { $ne: key },
  }).select("_id").lean();

  if (claimed || (key !== "default" && phoneNumberId === String(process.env.WHATSAPP_PHONE_NUMBER_ID || ""))) {
    const error = new Error("This WhatsApp number is already connected to another workspace");
    error.status = 409;
    throw error;
  }
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

/* =========================================================
   EMBEDDED SIGNUP (Meta Cloud API, Tech Provider flow)
   1. GET config → app id + Login-for-Business config id + a signed,
      short-lived state bound to this workspace + admin user.
   2. Browser runs FB.login; Meta returns a 30-second code plus the
      chosen phone_number_id / waba_id (session info event).
   3. POST → state verified, code exchanged server-side for the
      business token, number/WABA ownership confirmed, webhooks
      subscribed, number registered (skipped for Coexistence).
      Only then is THIS workspace's connection replaced, so a failed
      Change Number never breaks the working number.
========================================================= */
const SIGNUP_STATE_TTL_MS = 15 * 60 * 1000;
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const signState = (body, secret) =>
  crypto.createHmac("sha256", secret).update(`wa-embedded-signup:${body}`).digest("base64url");

export const createSignupState = (userId) => {
  const { appSecret } = getMetaConfig();
  const body = b64url(JSON.stringify({
    k: metaKeyFor(),
    u: String(userId || ""),
    e: Date.now() + SIGNUP_STATE_TTL_MS,
    n: crypto.randomBytes(8).toString("hex"),
  }));
  return `${body}.${signState(body, appSecret)}`;
};

export const verifySignupState = (state, userId) => {
  const { appSecret } = getMetaConfig();
  const [body, sig] = String(state || "").split(".");
  if (!appSecret || !body || !sig) return false;

  const expected = Buffer.from(signState(body, appSecret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;

  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return s.k === metaKeyFor() && s.u === String(userId || "") && s.e > Date.now();
  } catch {
    return false;
  }
};

/* Exact server-side blockers — the UI shows these instead of a fake status */
export const getEmbeddedSignupConfig = (userId) => {
  const { appId, appSecret, apiVersion } = getMetaConfig();
  const configId = process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || null;

  const blockers = [
    !appId && "META_APP_ID is not set on the server.",
    !appSecret && "META_APP_SECRET is not set on the server (needed for the token exchange and webhook signatures).",
    !configId && "WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID is not set — create a Facebook Login for Business configuration (WhatsApp Embedded Signup) in the Meta App Dashboard and set its ID.",
    !process.env.WHATSAPP_VERIFY_TOKEN && "WHATSAPP_VERIFY_TOKEN is not set — the WhatsApp webhook cannot be verified.",
  ].filter(Boolean);

  return {
    appId: appId || null,
    configId,
    apiVersion,
    // Embedded Signup flow version + session-info event format
    esVersion: process.env.WHATSAPP_EMBEDDED_SIGNUP_VERSION || "v4",
    sessionInfoVersion: process.env.WHATSAPP_EMBEDDED_SIGNUP_SESSION_INFO_VERSION || "3",
    state: blockers.length ? null : createSignupState(userId),
    ready: blockers.length === 0,
    blockers,
  };
};

const exchangeSignupCode = async (code) => {
  const { appId, appSecret, apiVersion } = getMetaConfig();
  const url = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw httpError(400, explainMetaError(
      data?.error,
      "Meta did not return a business token. The signup code is valid for 30 seconds and single use — please start again."
    ));
  }
  return data.access_token;
};

export const completeEmbeddedSignup = async ({ code, state, phoneNumberId, wabaId, coexistence } = {}, userId) => {
  if (!verifySignupState(state, userId)) {
    throw httpError(403, "This signup session expired or belongs to another workspace. Please start WhatsApp signup again.");
  }

  const id = String(phoneNumberId || "").trim();
  const waba = String(wabaId || "").trim();
  if (!code || !/^\d+$/.test(id) || !/^\d+$/.test(waba)) {
    throw httpError(400, "Meta did not return a phone number and WhatsApp Business Account. Finish every signup step, including adding a phone number.");
  }

  await assertNumberAvailable(id);

  const token = await exchangeSignupCode(code);

  // The shared WABA must actually own the chosen number
  const numbers = await graphFetch(`${waba}/phone_numbers`, {
    token,
    params: { fields: "id,display_phone_number,verified_name,quality_rating,platform_type" },
  });
  const phone = (numbers?.data || []).find((p) => String(p.id) === id);
  if (!phone) {
    throw httpError(400, "The selected phone number does not belong to the shared WhatsApp Business Account.");
  }

  // Webhooks (messages, statuses) for this WABA → /api/whatsapp/webhook
  const sub = await graphFetch(`${waba}/subscribed_apps`, { method: "POST", token });
  if (sub?.success !== true) {
    throw httpError(502, "Meta did not confirm the webhook subscription for this WhatsApp Business Account.");
  }

  // Cloud API registration. Coexistence numbers are already registered
  // through the WhatsApp Business app and must not be re-registered.
  let pin = null;
  if (!coexistence) {
    pin = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    try {
      await graphFetch(`${id}/register`, {
        method: "POST",
        token,
        body: { messaging_product: "whatsapp", pin },
      });
    } catch (error) {
      // Already on Cloud API (e.g. reconnecting the same number) is fine
      if (phone.platform_type !== "CLOUD_API") {
        throw httpError(error.status || 400, `Phone number registration failed: ${error.message}`);
      }
      pin = null;
    }
  }

  const connection = await MetaConnection.getSingleton();
  const sameNumber = connection.whatsapp.phoneNumberId === id;
  Object.assign(connection.whatsapp, {
    connected: true,
    phoneNumberId: id,
    wabaId: waba,
    displayPhoneNumber: phone.display_phone_number || null,
    verifiedName: phone.verified_name || null,
    qualityRating: phone.quality_rating || null,
    encryptedToken: encryptToken(token),
    encryptedPin: pin ? encryptToken(pin) : sameNumber ? connection.whatsapp.encryptedPin : null,
    webhookSubscribed: true,
    onboardingType: coexistence ? "coexistence" : "embedded",
    connectedAt: new Date(),
    health: "healthy",
    lastTestedAt: new Date(),
    lastSyncedAt: new Date(),
    lastError: null,
  });

  await connection.save();
  return connection;
};

/* =========================================================
   MEDIA PROXY — GET /{media-id} → short-lived URL → bytes
========================================================= */
export const fetchWhatsAppMedia = async (mediaId) => {
  const token = await resolveAccessToken();
  const info = await graphFetch(mediaId, { token });

  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const error = new Error(`Media download failed (${res.status})`);
    error.status = 502;
    throw error;
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: info.mime_type || res.headers.get("content-type") || "application/octet-stream",
  };
};

export { WINDOW_MS };
