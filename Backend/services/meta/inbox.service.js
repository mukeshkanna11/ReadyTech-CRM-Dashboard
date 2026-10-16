import MetaConnection, { metaKeyFor } from "../../models/MetaConnection.js";
import WhatsAppConversation from "../../models/WhatsAppConversation.js";
import WhatsAppMessage from "../../models/WhatsAppMessage.js";
import Lead from "../../models/Lead.js";
import User from "../../models/User.js";
import {
  activeUserScope,
  getDefaultWorkspaceId,
} from "../../utils/workspaceContext.js";
import { getMetaConfig, explainMetaError } from "./meta.service.js";
import { phoneMatcher } from "./whatsapp.service.js";
import {
  resolveInstagramLogin,
  sendInstagramLoginMessage,
  fetchInstagramProfile,
} from "./instagramLogin.service.js";
import { decryptToken } from "./tokenVault.js";

/* =========================================================
   UNIFIED INBOX — Instagram DM + Facebook Messenger threads
   Stored in the existing WhatsAppConversation / WhatsAppMessage
   collections (channel field) so one inbox lists every channel.
   Sending uses the workspace's own Page token (Graph Send API).
========================================================= */

const THREAD_PREFIX = { instagram: "ig", messenger: "fb" };

/* Workspace that connected this Instagram account / Facebook Page.
   `legacyDefault`: unknown ids fall back to the default workspace
   (pre-existing Instagram behaviour for Siva). */
export const workspaceForMetaAsset = async (field, assetId, { legacyDefault = false } = {}) => {
  const id = assetId ? String(assetId) : null;
  if (!id) return null;

  const fields = [].concat(field);
  const doc = await MetaConnection.findOne({ $or: fields.map((f) => ({ [f]: id })) })
    .select("key")
    .lean();

  if (!doc) {
    if (!legacyDefault) return null;
    // A tenant's disconnected account must never fall into Siva's workspace
    const released = await MetaConnection.findOne({
      key: { $ne: "default" },
      releasedAssetIds: id,
    }).select("_id").lean();
    return released ? null : getDefaultWorkspaceId();
  }
  return doc.key === "default" ? getDefaultWorkspaceId() : doc.key;
};

const attachmentPreview = (attachments = []) =>
  attachments.length ? `[${attachments[0].type || "attachment"}]` : "";

/* Records one inbound IG / Messenger message (runs inside the
   owning workspace context). Duplicate-safe on Meta's message id. */
export const recordSocialInbound = async ({
  channel,
  senderId,
  mid,
  text,
  attachments = [],
  sentAt,
  leadId = null,
}) => {
  if (!senderId || (!text && !attachments.length)) return { skipped: "empty" };
  if (mid && (await WhatsAppMessage.exists({ messageId: mid }))) {
    return { skipped: "duplicate" };
  }

  const key = `${THREAD_PREFIX[channel]}:${senderId}`;
  let conversation = await WhatsAppConversation.findOne({ phoneNumber: key });

  if (!conversation) {
    // Real Instagram name/username when the workspace token allows it
    let profileName = `${channel === "instagram" ? "Instagram" : "Messenger"} user ${String(senderId).slice(-4)}`;
    if (channel === "instagram") {
      try {
        const { token } = await resolveInstagramLogin();
        if (token) {
          const p = await fetchInstagramProfile(token, senderId);
          profileName = p?.name || (p?.username ? `@${p.username}` : profileName);
        }
      } catch {
        /* profile is optional — keep the placeholder */
      }
    }

    try {
      conversation = await WhatsAppConversation.create({
        channel,
        phoneNumber: key,
        externalId: String(senderId),
        profileName,
        lead: leadId,
      });
    } catch (error) {
      // Concurrent delivery created it first (IGSID/PSID are app+asset scoped)
      if (error?.code !== 11000) throw error;
      conversation = await WhatsAppConversation.findOne({ phoneNumber: key });
      if (!conversation) throw error;
    }
  }

  if (leadId && !conversation.lead) conversation.lead = leadId;

  const timestamp = sentAt || new Date();
  const preview = text || attachmentPreview(attachments);

  try {
    await WhatsAppMessage.create({
      conversation: conversation._id,
      direction: "inbound",
      messageId: mid || null,
      from: String(senderId),
      type: attachments.length && !text ? attachments[0].type || "attachment" : "text",
      body: preview,
      timestamp,
      status: "delivered",
      meta: attachments.length ? { attachments } : null,
    });
  } catch (error) {
    if (error?.code === 11000) return { skipped: "duplicate" };
    throw error;
  }

  conversation.lastInboundAt = timestamp;
  conversation.lastMessageAt = timestamp;
  conversation.lastMessagePreview = preview.slice(0, 300);
  conversation.lastMessageDirection = "inbound";
  conversation.unreadCount = (conversation.unreadCount || 0) + 1;
  if (conversation.status === "Closed") conversation.status = "Open";
  await conversation.save();

  // Webhook health for the connection status page
  await MetaConnection.updateOne(
    { key: metaKeyFor() },
    { $set: { [`${channel === "instagram" ? "instagram" : "facebookPage"}.lastInboundAt`]: timestamp } }
  );

  return { conversationId: conversation._id };
};

/* Outbound IG / Messenger text — POST /{page-id}/messages with the
   workspace's Page token (pages_messaging / instagram_manage_messages).
   Meta's 24-hour standard messaging window is enforced. */
export const sendSocialMessage = async ({ conversation, text, user }) => {
  const clean = String(text || "").trim();
  if (!clean) {
    const error = new Error("Message text is required (attachments are WhatsApp-only)");
    error.status = 400;
    throw error;
  }

  if (!conversation.isWindowOpen()) {
    const error = new Error("24-hour messaging window expired. Meta only allows replies within 24h of the customer's last message.");
    error.status = 409;
    error.code = "WINDOW_EXPIRED";
    throw error;
  }

  // Instagram: prefer the Instagram Login token (Instagram Inbox)
  const igLogin = conversation.channel === "instagram" ? await resolveInstagramLogin() : null;
  if (igLogin?.token && !igLogin.connection.instagramLogin?.tokenInvalid) {
    return sendViaInstagramLogin({ conversation, text: clean, user, token: igLogin.token });
  }

  const connection = await MetaConnection.getSingleton();
  const pageId = connection.facebookPage?.id;
  const pageToken = connection.facebookPage?.encryptedToken
    ? decryptToken(connection.facebookPage.encryptedToken)
    : null;

  if (!pageId || !pageToken) {
    const error = new Error(
      conversation.channel === "instagram"
        ? "Connect this workspace's Instagram account (Instagram Inbox → Connect) to reply"
        : "Connect Meta (Facebook Page) for this workspace to reply"
    );
    error.status = 400;
    throw error;
  }

  const record = await WhatsAppMessage.create({
    conversation: conversation._id,
    direction: "outbound",
    to: conversation.externalId,
    type: "text",
    body: clean,
    timestamp: new Date(),
    status: "pending",
    sentBy: user?._id || null,
  });

  const { apiVersion } = getMetaConfig();
  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${pageId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${pageToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: conversation.externalId },
      messaging_type: "RESPONSE",
      message: { text: clean },
    }),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok || data?.error) {
    record.status = "failed";
    record.error = {
      code: data?.error?.code ? String(data.error.code) : null,
      title: "Send failed",
      message: explainMetaError(data?.error, `Meta Send API failed (${res.status})`),
    };
    await record.save();
    const error = new Error(record.error.message);
    error.status = 400;
    throw error;
  }

  record.messageId = data?.message_id || null;
  record.status = "sent";
  await record.save();

  const now = new Date();
  conversation.lastOutboundAt = now;
  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = clean.slice(0, 300);
  conversation.lastMessageDirection = "outbound";
  await conversation.save();

  return record;
};

const touchOutbound = async (conversation, text) => {
  const now = new Date();
  conversation.lastOutboundAt = now;
  conversation.lastMessageAt = now;
  conversation.lastMessagePreview = text.slice(0, 300);
  conversation.lastMessageDirection = "outbound";
  await conversation.save();
};

const sendViaInstagramLogin = async ({ conversation, text, user, token }) => {
  const record = await WhatsAppMessage.create({
    conversation: conversation._id,
    direction: "outbound",
    to: conversation.externalId,
    type: "text",
    body: text,
    timestamp: new Date(),
    status: "pending",
    sentBy: user?._id || null,
  });

  try {
    const data = await sendInstagramLoginMessage(token, conversation.externalId, text);
    record.messageId = data?.message_id || null;
    record.status = "sent";
    await record.save();
  } catch (error) {
    record.status = "failed";
    record.error = { code: error.code ? String(error.code) : null, title: "Send failed", message: error.message };
    await record.save();
    if (Number(error.code) === 190) {
      await MetaConnection.updateOne(
        { key: metaKeyFor() },
        { $set: { "instagramLogin.tokenInvalid": true, "instagramLogin.lastError": error.message } }
      );
    }
    throw error;
  }

  await touchOutbound(conversation, text);
  return record;
};

/* =========================================================
   ONE-CLICK CONVERT TO LEAD (existing Lead model, never duplicates)
========================================================= */
const LEAD_SOURCE = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Facebook" };

export const convertConversationToLead = async ({ conversation, user, name }) => {
  if (conversation.lead) {
    return { lead: conversation.lead, created: false };
  }

  const channel = conversation.channel || "whatsapp";

  // Link an existing lead for the same customer instead of duplicating
  const match =
    channel === "instagram" && conversation.externalId
      ? { instagramSenderId: conversation.externalId }
      : channel === "whatsapp" && phoneMatcher(conversation.phoneNumber)
        ? { phone: phoneMatcher(conversation.phoneNumber) }
        : null;
  const existing = match ? await Lead.findOne(match).select("_id").lean() : null;

  if (existing) {
    conversation.lead = existing._id;
    await conversation.save();
    return { lead: existing._id, created: false };
  }

  const owner =
    (user?._id && (await User.findOne({ ...activeUserScope(), _id: user._id }).select("_id name").lean())) ||
    (await User.findOne({ ...activeUserScope(), role: "admin", isActive: { $ne: false } })
      .select("_id name")
      .lean());

  if (!owner) {
    const error = new Error("No lead owner found in this workspace");
    error.status = 400;
    throw error;
  }

  const lead = await Lead.create({
    name: String(name || conversation.profileName || conversation.phoneNumber).slice(0, 120),
    phone: channel === "whatsapp" ? conversation.phoneNumber : "",
    source: LEAD_SOURCE[channel],
    message: conversation.lastMessagePreview || "",
    status: "New",
    statusHistory: [{ status: "New", changedBy: owner._id, changedAt: new Date() }],
    owner: owner._id,
    assignedTo: owner.name || "",
    ...(channel === "instagram" ? { instagramSenderId: conversation.externalId } : {}),
    lastContactedAt: conversation.lastMessageAt || new Date(),
  });

  conversation.lead = lead._id;
  await conversation.save();

  return { lead: lead._id, created: true };
};
