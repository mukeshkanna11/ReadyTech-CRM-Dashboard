// services/shopify/orderSync.service.js — Shopify orders → CRM customers +
// ERP sales orders (Phase 3). Worker handlers (webhookWorker.js).
//
// Guarantees
// - Exactly one ERP SalesOrder per Shopify order per workspace: the unique
//   ShopifyOrderLink (workspace, orderGid) and the SalesOrder are written in
//   one MongoDB transaction.
// - Stale / duplicate / out-of-order webhooks are dropped by updated_at.
// - Imported orders are DRAFT: no stock reservation, ledger or invoice
//   (those stay manual until later phases). Cancellation reuses the ERP
//   cancel rules (cancelSalesOrderInSession). Refunds are recorded only.
// - Unknown SKUs fail permanently (dead-letter) so a person can add the
//   products and press Retry.
//
// Tenant isolation: the worker runs each handler inside
// runWithWorkspace(event.workspace) after checking the store still belongs to
// that workspace. ERP models (Product, Client, SalesOrder) are scoped by the
// workspace plugin from that context (which also covers the default
// workspace's legacy records); Shopify link models use explicit filters.
import mongoose from "mongoose";
import ShopifyOrderLink from "../../models/ShopifyOrderLink.js";
import ShopifyCustomerLink from "../../models/ShopifyCustomerLink.js";
import SalesOrder from "../../models/SalesOrder.model.js";
import Product from "../../models/Product.model.js";
import Client from "../../models/Client.js";
import { generateSONumber, cancelSalesOrderInSession, deliverSalesOrderInSession } from "../../controllers/sales.controller.js";
import { getWorkspaceId } from "../../utils/workspaceContext.js";
import { orderFinancials, refundMoney } from "./financials.js";

const permanent = (message) => Object.assign(new Error(message), { permanent: true });
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const validDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const txn = async (fn) => {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
};

const assertContext = (conn) => {
  if (!conn?.workspace || getWorkspaceId() !== String(conn.workspace)) throw permanent("Shopify sync ran outside its workspace");
  if (!conn.connectedBy) throw permanent("Store has no connecting admin to own imported orders — reconnect the store");
};

const addIssue = (link, text) => {
  if (!link.issues.includes(text)) link.issues = [...link.issues, text].slice(-20);
};

/* ---------------- SKU → ERP product ---------------- */

/* Remaining quantities (after Shopify edits / refunds); gift cards are not stock */
const productLines = (order) =>
  (order.line_items || [])
    .filter((l) => !l.gift_card)
    .map((l) => ({ ...l, qty: num(l.current_quantity ?? l.quantity) }))
    .filter((l) => l.qty > 0);

export const mapLineItems = async (order, session) => {
  const lines = productLines(order);
  const skuOf = (l) => String(l.sku || "").trim().toUpperCase(); // ERP SKUs are stored uppercase
  const skus = [...new Set(lines.map(skuOf).filter(Boolean))];
  const products = skus.length ? await Product.find({ sku: { $in: skus } }, "_id sku", { session, lean: true }) : [];
  const bySku = new Map(products.map((p) => [p.sku, p._id]));

  const unmapped = [
    ...skus.filter((s) => !bySku.has(s)),
    ...lines.filter((l) => !skuOf(l)).map((l) => `"${l.title || l.name || "item"}" (no SKU)`),
  ];
  if (unmapped.length) {
    throw permanent(`Unmapped Shopify items — add these SKUs to ERP products, then retry: ${unmapped.join(", ")}`.slice(0, 480));
  }
  return lines.map((l) => ({ product: bySku.get(skuOf(l)), qty: l.qty, price: num(l.price) }));
};

const sameItems = (a, b) => {
  const key = (items) => items.map((i) => `${i.product}:${i.qty}:${i.price}`).sort().join("|");
  return key(a) === key(b);
};

/* ---------------- Shopify customer → CRM client ---------------- */
export const resolveCustomer = async (conn, order, session) => {
  const c = order.customer || null;
  const customerGid = c ? c.admin_graphql_api_id || `gid://shopify/Customer/${c.id}` : `guest:${conn.shopDomain}`;

  const link = await ShopifyCustomerLink.findOne({ workspace: conn.workspace, customerGid }, "client", { session, lean: true });
  if (link && (await Client.findOne({ _id: link.client }, "_id", { session, lean: true }))) return link.client;

  const addr = order.billing_address || c?.default_address || {};
  const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || (c ? addr.name || "" : "");
  const email = String(c?.email || (c ? order.email : "") || "").trim().toLowerCase();

  // Reuse an existing CRM client of this workspace with the same email
  let clientId = c && email ? (await Client.findOne({ email }, "_id", { session, lean: true }))?._id : null;

  if (!clientId) {
    const label = c ? name || email || `Shopify customer ${c.id}` : `Shopify walk-in customers (${conn.shopDomain})`;
    const [client] = await Client.create(
      [
        {
          companyName: addr.company || label,
          contactPerson: c ? name || email || label : "Walk-in",
          email: email || undefined,
          phone: c?.phone || addr.phone || undefined,
          billingAddress: {
            addressLine1: addr.address1 || undefined,
            addressLine2: addr.address2 || undefined,
            city: addr.city || undefined,
            state: addr.province || undefined,
            pincode: addr.zip || undefined,
            country: addr.country || undefined,
          },
          clientType: "Customer",
          status: "Active",
          notes: `Created from Shopify (${conn.shopDomain})`,
          workspace: conn.workspace,
        },
      ],
      { session }
    );
    clientId = client._id;
  }

  await ShopifyCustomerLink.updateOne(
    { workspace: conn.workspace, customerGid },
    { $set: { client: clientId, shopDomain: conn.shopDomain } },
    { upsert: true, session }
  );
  return clientId;
};

/* ---------------- orders/create · orders/updated · orders/cancelled ---------------- */
const applyOrder = async ({ conn, order, orderGid, updatedAt, cancelled, session }) => {
  const workspace = conn.workspace;
  let link = await ShopifyOrderLink.findOne({ workspace, orderGid }, null, { session });
  if (link?.lastUpdatedAt && updatedAt && updatedAt <= link.lastUpdatedAt) return "stale";
  if (!link) link = new ShopifyOrderLink({ workspace, connection: conn._id, shopDomain: conn.shopDomain, orderGid });

  Object.assign(link, {
    orderName: order.name ?? link.orderName,
    financialStatus: order.financial_status ?? link.financialStatus,
    fulfillmentStatus: order.fulfillment_status ?? link.fulfillmentStatus,
    currency: order.currency ?? link.currency,
    totalPrice: order.total_price != null ? num(order.total_price) : link.totalPrice,
    lastUpdatedAt: updatedAt || link.lastUpdatedAt,
    financials: orderFinancials(order),
  });

  const so = link.salesOrder ? await SalesOrder.findOne({ _id: link.salesOrder }, null, { session }) : null;
  if (link.salesOrder && !so) addIssue(link, "The linked ERP sales order was deleted");

  if (cancelled) {
    link.status = "cancelled";
    link.cancelledAt = validDate(order.cancelled_at) || link.cancelledAt || new Date();
    if (so && so.status !== "CANCELLED") {
      if (so.status === "DELIVERED") addIssue(link, `Cancelled in Shopify after ${so.soNumber} was delivered — review stock and invoice manually`);
      else await cancelSalesOrderInSession(so, conn.connectedBy, session); // releases any reservation
    }
  } else if (!link.salesOrder) {
    const items = await mapLineItems(order, session);
    if (!items.length) {
      addIssue(link, "Order has no remaining product items — no ERP sales order created");
    } else {
      const customer = await resolveCustomer(conn, order, session);
      const [created] = await SalesOrder.create(
        [
          {
            soNumber: await generateSONumber(),
            customer,
            items,
            notes: `Shopify order ${order.name || order.id} (${conn.shopDomain})`,
            status: "DRAFT",
            createdBy: conn.connectedBy,
            workspace,
          },
        ],
        { session }
      );
      Object.assign(link, { salesOrder: created._id, customer, status: "imported" });
    }
  } else if (so && so.status !== "CANCELLED") {
    // Follow Shopify edits only while the ERP order is still a draft
    const items = await mapLineItems(order, session);
    if (!sameItems(so.items, items)) {
      if (so.status === "DRAFT" && items.length) {
        so.items = items;
        await so.save({ session });
      } else {
        addIssue(link, `Items changed in Shopify after ${so.soNumber} was ${so.status.toLowerCase()} — review manually`);
      }
    }
  }

  await link.save({ session });
  return link.status;
};

export const handleOrderEvent = async (event, conn) => {
  assertContext(conn);
  const order = event.payload;
  if (!order?.id) return "redacted";

  const args = {
    conn,
    order,
    orderGid: order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`,
    updatedAt: validDate(order.updated_at) || validDate(event.triggeredAt),
    cancelled: Boolean(order.cancelled_at) || event.topic === "orders/cancelled",
  };

  for (let attempt = 1; ; attempt++) {
    try {
      return await txn((session) => applyOrder({ ...args, session }));
    } catch (err) {
      // Two imports picked the same next SO number: retry with a fresh one
      if (err?.code === 11000 && err.keyPattern?.soNumber && attempt < 3) continue;
      throw err;
    }
  }
};

/* ---------------- refunds/create (recorded only) ---------------- */
export const handleRefundEvent = async (event, conn) => {
  assertContext(conn);
  const r = event.payload;
  if (!r?.id || !r.order_id) return "redacted";

  const refundGid = r.admin_graphql_api_id || `gid://shopify/Refund/${r.id}`;
  const money = refundMoney(r);
  const lineItems = r.refund_line_items || [];
  const restock = lineItems.some((l) => l.restock_type && l.restock_type !== "no_restock");

  try {
    // Matches only while this refund is not yet recorded; an existing link
    // that already has it fails the match and the upsert hits the unique
    // index → duplicate delivery, nothing to do.
    await ShopifyOrderLink.updateOne(
      { workspace: conn.workspace, orderGid: `gid://shopify/Order/${r.order_id}`, "refunds.refundGid": { $ne: refundGid } },
      {
        $push: {
          refunds: {
            refundGid,
            money,
            restock,
            lines: lineItems.map((l) => ({ sku: l.line_item?.sku || null, quantity: num(l.quantity) })),
            createdAt: validDate(r.created_at),
          },
        },
        // ERP is the stock master: a Shopify restock is overwritten by the next push
        // unless the return is also received into the ERP
        ...(restock && { $addToSet: { issues: "Shopify refund restocked items — record the return in ERP (stock in) before the next stock sync" } }),
        $setOnInsert: { connection: conn._id, shopDomain: conn.shopDomain, status: "refund_only" },
      },
      { upsert: true }
    );
    return "recorded";
  } catch (err) {
    if (err?.code === 11000) return "duplicate";
    throw err;
  }
};

/* ---------------- fulfillments/create · fulfillments/update ---------------- */
// A Shopify fulfilment that covers the whole order delivers the APPROVED ERP
// order with the ERP's own rules (stock check, SALE ledger, reservation
// release) in one transaction. Exactly once: only APPROVED orders deliver,
// and the order's status change makes concurrent deliveries conflict.
// Anything else (draft, partial, no warehouse, ERP refusal) is flagged.
const coverage = (link, so) => {
  const fulfilled = new Map();
  for (const f of link.fulfillments) {
    if (f.status !== "success") continue;
    for (const l of f.lines) fulfilled.set(l.sku, (fulfilled.get(l.sku) || 0) + num(l.quantity));
  }
  const needed = new Map();
  for (const i of so.items) {
    const sku = String(i.product?.sku || "").toUpperCase();
    needed.set(sku, (needed.get(sku) || 0) + i.qty);
  }
  const full = [...needed].every(([sku, q]) => sku && (fulfilled.get(sku) || 0) >= q);
  return { full, any: fulfilled.size > 0 };
};

const applyFulfillment = async ({ conn, f, orderGid, deliver, session }) => {
  const link = await ShopifyOrderLink.findOne({ workspace: conn.workspace, orderGid }, null, { session });
  // Retried by the worker until the order itself has been imported
  if (!link) throw new Error("Order not imported yet");

  const fulfillmentGid = f.admin_graphql_api_id || `gid://shopify/Fulfillment/${f.id}`;
  const updatedAt = validDate(f.updated_at) || validDate(f.created_at);
  const prev = link.fulfillments.find((x) => x.fulfillmentGid === fulfillmentGid);
  if (prev?.updatedAt && updatedAt && updatedAt <= prev.updatedAt) return "stale";

  const entry = {
    fulfillmentGid,
    status: f.status || null,
    lines: (f.line_items || []).map((l) => ({ sku: String(l.sku || "").trim().toUpperCase(), quantity: num(l.quantity) })),
    updatedAt,
  };
  link.fulfillments = [...link.fulfillments.filter((x) => x.fulfillmentGid !== fulfillmentGid), entry];

  const so = link.salesOrder
    ? await SalesOrder.findOne({ _id: link.salesOrder }, null, { session, populate: "items.product" })
    : null;
  let result = "recorded";

  if (so) {
    const { full, any } = coverage(link, so);
    if (entry.status === "cancelled" && so.status === "DELIVERED") {
      addIssue(link, `A Shopify fulfilment was cancelled after ${so.soNumber} was delivered — review stock manually`);
    } else if (full && so.status === "APPROVED" && so.warehouse && deliver) {
      await deliverSalesOrderInSession(so, null, conn.connectedBy, session);
      result = "delivered";
    } else if (full && so.status === "APPROVED" && !so.warehouse) {
      addIssue(link, `Fulfilled in Shopify — deliver ${so.soNumber} in ERP (approved without a warehouse)`);
    } else if (full && so.status === "DRAFT") {
      addIssue(link, `Fulfilled in Shopify — approve and deliver ${so.soNumber} in ERP`);
    } else if (!full && any && so.status !== "DELIVERED") {
      addIssue(link, `Partially fulfilled in Shopify — ${so.soNumber} is delivered once fully fulfilled`);
    }
  }

  await link.save({ session });
  return result;
};

export const handleFulfillmentEvent = async (event, conn) => {
  assertContext(conn);
  const f = event.payload;
  if (!f?.id || !f.order_id) return "redacted";
  const args = { conn, f, orderGid: `gid://shopify/Order/${f.order_id}` };

  try {
    return await txn((session) => applyFulfillment({ ...args, deliver: true, session }));
  } catch (err) {
    if (!err?.status) throw err; // infrastructure errors → worker retry
    // ERP rule refused the delivery (e.g. insufficient stock): the transaction
    // rolled back; record the fulfilment and the reason only.
    return txn(async (session) => {
      await applyFulfillment({ ...args, deliver: false, session });
      const link = await ShopifyOrderLink.findOne({ workspace: conn.workspace, orderGid: args.orderGid }, null, { session });
      addIssue(link, `Fulfilled in Shopify but ERP delivery failed: ${err.message}`);
      await link.save({ session });
      return "flagged";
    });
  }
};

export const ORDER_HANDLERS = {
  "orders/create": handleOrderEvent,
  "orders/updated": handleOrderEvent,
  "orders/cancelled": handleOrderEvent,
  "refunds/create": handleRefundEvent,
  "fulfillments/create": handleFulfillmentEvent,
  "fulfillments/update": handleFulfillmentEvent,
};

/* Dashboard: recent orders of this workspace */
export const orderSummary = async (workspaceId) => {
  const recent = await ShopifyOrderLink.find(
    { workspace: workspaceId },
    "orderName status financialStatus fulfillmentStatus currency totalPrice financials refunds.money issues salesOrder updatedAt"
  )
    .sort({ updatedAt: -1 })
    .limit(15)
    .populate("salesOrder", "soNumber status")
    .lean();
  // Refunded per currency (never summed across currencies)
  for (const o of recent) {
    const totals = new Map();
    for (const r of o.refunds || []) {
      for (const x of r.money || []) {
        const t = totals.get(x.currency) || { currency: x.currency, digits: x.digits, amountMinor: 0 };
        t.amountMinor += x.amountMinor;
        totals.set(x.currency, t);
      }
    }
    o.refunded = [...totals.values()];
    delete o.refunds;
  }
  const needsAttention = await ShopifyOrderLink.countDocuments({ workspace: workspaceId, "issues.0": { $exists: true } });
  return { recent, needsAttention };
};
