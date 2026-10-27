// services/shopify/inbox.service.js — durable webhook inbox: record verified
// deliveries once, privacy redaction, dashboard summary and dead-letter replay.
// Recording never touches CRM / ERP data; processing is webhookWorker.js.
import crypto from "node:crypto";
import mongoose from "mongoose";
import ShopifyWebhookEvent from "../../models/ShopifyWebhookEvent.js";

/* Data topics stored in the inbox (header form) */
export const INBOX_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "refunds/create",
  "fulfillments/create",
  "fulfillments/update",
  "products/create",
  "products/update",
  "products/delete",
  "inventory_levels/update",
];

/* "orders/create" → "ORDERS_CREATE" (GraphQL WebhookSubscriptionTopic) */
export const toSubscriptionTopic = (topic) => topic.toUpperCase().replace("/", "_");

const resourceOf = (topic, p = {}) => ({
  gid:
    p.admin_graphql_api_id ||
    (topic === "inventory_levels/update" && p.inventory_item_id
      ? `inventory_level:${p.inventory_item_id}@${p.location_id}`
      : p.id ? `${topic.split("/")[0]}:${p.id}` : null),
  updatedAt: p.updated_at ? new Date(p.updated_at) : null,
});

const validDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/* Records one verified delivery for an ACTIVE connection. Duplicate deliveries
   (same shop + webhook id) are acknowledged without a second record. */
export const recordEvent = async ({ conn, topic, webhookId, eventId, triggeredAt, apiVersion, payload, rawBody }) => {
  // Shopify always sends X-Shopify-Webhook-Id; the body hash keeps dedup if it ever doesn't
  const id = webhookId || `sha256:${crypto.createHash("sha256").update(rawBody || JSON.stringify(payload ?? null)).digest("hex")}`;
  try {
    const event = await ShopifyWebhookEvent.create({
      workspace: conn.workspace,
      connection: conn._id,
      shopDomain: conn.shopDomain,
      topic,
      webhookId: id,
      eventId: eventId || null,
      triggeredAt: validDate(triggeredAt),
      apiVersion: apiVersion || null,
      resource: resourceOf(topic, payload || {}),
      payload: payload ?? null,
    });
    return { recorded: event._id };
  } catch (err) {
    if (err?.code === 11000) return { duplicate: true };
    throw err;
  }
};

/* customers/redact: drop stored payloads that mention the customer or their orders */
export const redactCustomer = async (conn, payload = {}) => {
  const customerId = payload.customer?.id;
  const orderIds = (payload.orders_to_redact || []).map(Number).filter(Number.isFinite);
  const or = [];
  if (customerId != null) or.push({ "payload.customer.id": customerId });
  if (orderIds.length) or.push({ "payload.id": { $in: orderIds }, topic: /^orders\// }, { "payload.order_id": { $in: orderIds } });
  if (!or.length) return 0;
  const r = await ShopifyWebhookEvent.updateMany(
    { workspace: conn.workspace, shopDomain: conn.shopDomain, payload: { $ne: null }, $or: or },
    { $set: { payload: null, redactedAt: new Date() } }
  );
  return r.modifiedCount || 0;
};

/* customers/data_request: how many stored events hold this customer's data */
export const countCustomerEvents = (conn, payload = {}) =>
  payload.customer?.id == null
    ? Promise.resolve(0)
    : ShopifyWebhookEvent.countDocuments({ workspace: conn.workspace, shopDomain: conn.shopDomain, "payload.customer.id": payload.customer.id });

/* shop/redact: erase every stored event of the shop in its workspace */
export const deleteShopEvents = async (conn) =>
  (await ShopifyWebhookEvent.deleteMany({ workspace: conn.workspace, shopDomain: conn.shopDomain })).deletedCount || 0;

/* Dashboard: counts per status + recent failures (no payloads) */
export const inboxSummary = async (workspaceId) => {
  const ws = new mongoose.Types.ObjectId(String(workspaceId));
  const [rows, failures] = await Promise.all([
    ShopifyWebhookEvent.aggregate([{ $match: { workspace: ws } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ShopifyWebhookEvent.find(
      { workspace: workspaceId, $or: [{ status: "dead" }, { status: "pending", lastError: { $ne: null } }] },
      "topic shopDomain status attempts lastError nextAttemptAt deadAt createdAt resource.gid"
    ).sort({ updatedAt: -1 }).limit(10).lean(),
  ]);
  const counts = { pending: 0, processing: 0, processed: 0, ignored: 0, dead: 0 };
  rows.forEach((r) => (counts[r._id] = r.n));
  return { counts, failures };
};

/* Dead-letter replay — only this workspace's own dead events */
export const retryDeadEvent = async (workspaceId, eventId) => {
  if (!mongoose.isValidObjectId(eventId)) return false;
  const r = await ShopifyWebhookEvent.updateOne(
    { _id: eventId, workspace: workspaceId, status: "dead" },
    { $set: { status: "pending", attempts: 0, nextAttemptAt: new Date(), deadAt: null, lastError: null, leaseUntil: null, lockedBy: null } }
  );
  return r.modifiedCount === 1;
};
