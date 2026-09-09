import crypto from "crypto";

import MetaConnection from "../../models/MetaConnection.js";
import WhatsAppConversation, { WINDOW_MS } from "../../models/WhatsAppConversation.js";
import WhatsAppMessage from "../../models/WhatsAppMessage.js";
import Lead from "../../models/Lead.js";
import Client from "../../models/Client.js";
import User from "../../models/User.js";

// Reuse the existing Meta config (Graph version + app secret) — no duplication
import { getMetaConfig } from "./meta.service.js";
import { decryptToken } from "./tokenVault.js";

/* =========================================================
   CONFIG
========================================================= */
export const getWhatsAppConfig = () => {
  const { apiVersion, appSecret } = getMetaConfig();

  const config = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: process.env.WHATSAPP_WABA_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
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

/* Access token: env System User token first, encrypted DB token as fallback */
const resolveAccessToken = async () => {
  const { accessToken } = getWhatsAppConfig();
  if (accessToken) return accessToken;

  const connection = await MetaConnection.getSingleton();
  if (connection.whatsapp?.encryptedToken) {
    return decryptToken(connection.whatsapp.encryptedToken);
  }

  const error = new Error("WhatsApp access token is not configured");
  error.status = 400;
  throw error;
};

/* =========================================================
   GRAPH REQUEST (WhatsApp Cloud API)
========================================================= */
const graphFetch = async (path, { method = "GET", body, params } = {}) => {
  const { apiVersion } = getWhatsAppConfig();
  const token = await resolveAccessToken();

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
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    // Never surface the token in errors/logs
    const error = new Error(
      data?.error?.message || `WhatsApp API request failed (${response.status})`
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

export const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const { appSecret } = getWhatsAppConfig();

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
const phoneMatcher = (normalized) => {
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
  const owner = await User.findOne({ role: "admin", isActive: { $ne: false } })
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

  conversation = await WhatsAppConversation.create({
    phoneNumber,
    waId: waId || null,
    profileName: profileName || null,
    lead,
    client,
  });

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
    default:
      return "";
  }
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
      meta: isText ? null : { type: message.type },
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

  // Reflect activity on the centralized Meta connection
  await MetaConnection.updateOne(
    { key: "default" },
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
   WEBHOOK ENTRY POINT
   Tolerant by design: unsupported events are ignored, never thrown.
========================================================= */
export const processWebhookPayload = async (payload) => {
  const result = { messages: 0, statuses: 0, ignored: 0 };

  if (payload?.object !== "whatsapp_business_account") {
    result.ignored += 1;
    return result;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") {
        result.ignored += 1;
        continue;
      }

      const value = change.value || {};
      const profile = value.contacts?.[0]?.profile || null;

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
    }
  }

  return result;
};

/* =========================================================
   OUTBOUND TEXT MESSAGE
   Backend ENFORCES the 24-hour window — frontend cannot bypass.
========================================================= */
export const sendTextMessage = async ({ conversationId, text, user }) => {
  const clean = String(text || "").trim();

  if (!clean) {
    const error = new Error("Message text is required");
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

  const { phoneNumberId } = getWhatsAppConfig();

  const record = await WhatsAppMessage.create({
    conversation: conversation._id,
    direction: "outbound",
    to: conversation.phoneNumber,
    type: "text",
    body: clean,
    timestamp: new Date(),
    status: "pending",
    sentBy: user?._id || null,
  });

  try {
    const response = await graphFetch(`${phoneNumberId}/messages`, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conversation.phoneNumber,
        type: "text",
        text: { preview_url: false, body: clean },
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
  conversation.lastMessagePreview = clean.slice(0, 300);
  conversation.lastMessageDirection = "outbound";
  await conversation.save();

  return record;
};

/* =========================================================
   ACCOUNT SYNC — stores metadata locally so the inbox never
   needs to call the Graph API on refresh.
========================================================= */
export const syncWhatsAppAccount = async () => {
  const { configured, missing, phoneNumberId, wabaId } = getWhatsAppConfig();

  if (!configured) {
    const error = new Error(`WhatsApp is not configured. Missing: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const connection = await MetaConnection.getSingleton();

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
    connection.whatsapp.lastError = null;
  } catch (error) {
    connection.whatsapp.connected = false;
    connection.whatsapp.lastError = error.message;
    connection.whatsapp.lastSyncedAt = new Date();
    await connection.save();
    throw error;
  }

  await connection.save();

  return connection;
};

/* Marks the webhook as verified by Meta (called from the GET handler) */
export const markWebhookSubscribed = async () => {
  await MetaConnection.updateOne(
    { key: "default" },
    { $set: { "whatsapp.webhookSubscribed": true } },
    { upsert: false }
  );
};

export { WINDOW_MS };
