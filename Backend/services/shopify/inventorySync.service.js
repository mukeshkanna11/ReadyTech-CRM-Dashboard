// services/shopify/inventorySync.service.js — ERP → Shopify stock (Phase 4).
//
// The ERP is the only stock master. Shopify's "available" at ONE mapped
// location is set to what the mapped ERP warehouse can still promise:
//
//   ERP on-hand (Inventory ledger) − ERP reserved (StockLevel)
//   − units Shopify already sold that the ERP has not reserved yet
//     (imported Shopify orders still DRAFT / approved without a warehouse,
//      and orders received but not imported: waiting or failed events)
//
// Shopify stock is never written back into the ERP, so there is no loop.
// Shopify's echo of our own push (inventory_levels/update with the value we
// set) is ignored; any other value marks the item to be re-asserted.
// One sync per store at a time (lease on the connection); quantities are
// absolute and recomputed on every run, so a stale run cannot win.
import crypto from "node:crypto";
import mongoose from "mongoose";
import ShopifyConnection from "../../models/ShopifyConnection.js";
import ShopifyInventoryLink from "../../models/ShopifyInventoryLink.js";
import ShopifyOrderLink from "../../models/ShopifyOrderLink.js";
import ShopifyWebhookEvent from "../../models/ShopifyWebhookEvent.js";
import SalesOrder from "../../models/SalesOrder.model.js";
import Product from "../../models/Product.model.js";
import Inventory from "../../models/Inventory.model.js";
import StockLevel from "../../models/StockLevel.model.js";
import Warehouse from "../../models/Warehouse.model.js";
import { runWithWorkspace, getWorkspaceId } from "../../utils/workspaceContext.js";
import { connectionGraphql, audit } from "./shopify.service.js";

const LEASE_MS = 10 * 60_000;
const BATCH = 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const gid = (type, id) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/${type}/${id}`);
const validDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const permanent = (message) => Object.assign(new Error(message), { permanent: true });
const assertContext = (conn) => {
  if (!conn?.workspace || getWorkspaceId() !== String(conn.workspace)) throw permanent("Shopify sync ran outside its workspace");
};

/* ---------------- GraphQL (verify field names on the pinned API version) ---------------- */
const LOCATIONS = `query { locations(first: 50) { nodes { id name isActive } } }`;
const VARIANTS = `query($after: String) {
  productVariants(first: 100, after: $after) {
    nodes { sku inventoryItem { id } product { id updatedAt } }
    pageInfo { hasNextPage endCursor }
  }
}`;
// 2026-04+: @idempotent is required and every quantity needs changeFromQuantity
// (null = absolute set; ignoreCompareQuantity no longer exists)
const SET_QUANTITIES = `mutation($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup { id }
    userErrors { field message }
  }
}`;

export const listLocations = async (conn) =>
  ((await connectionGraphql(conn, LOCATIONS))?.locations?.nodes || []).filter((l) => l.isActive !== false);

/* ---------------- SKU mapping (Shopify inventory item ↔ ERP product) ---------------- */
const erpProductsBySku = async (skus) => {
  const list = skus.length ? await Product.find({ sku: { $in: skus } }, "_id sku", { lean: true }) : [];
  return new Map(list.map((p) => [p.sku, p._id]));
};

/* Out-of-order product webhooks: an older update never overwrites a newer mapping */
const upsertLink = async (conn, { sku, product, productGid, itemGid, sourceUpdatedAt }) => {
  try {
    await ShopifyInventoryLink.updateOne(
      { workspace: conn.workspace, inventoryItemGid: itemGid, $or: [{ sourceUpdatedAt: null }, { sourceUpdatedAt: { $lte: sourceUpdatedAt } }] },
      { $set: { connection: conn._id, shopDomain: conn.shopDomain, sku, product, shopifyProductGid: productGid, sourceUpdatedAt, dirty: true } },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err; // a newer mapping is already stored
  }
};

/* variants: [{ sku, itemGid, productGid, updatedAt }] — maps the ones whose SKU exists in the ERP */
const applyVariants = async (conn, variants) => {
  const skuOf = (v) => String(v.sku || "").trim().toUpperCase();
  const products = await erpProductsBySku([...new Set(variants.map(skuOf).filter(Boolean))]);
  const unmapped = [];
  for (const v of variants) {
    const product = products.get(skuOf(v));
    if (!product) unmapped.push(v.itemGid);
    else await upsertLink(conn, { sku: skuOf(v), product, productGid: v.productGid, itemGid: v.itemGid, sourceUpdatedAt: v.updatedAt || new Date(0) });
  }
  if (unmapped.length) await ShopifyInventoryLink.deleteMany({ workspace: conn.workspace, inventoryItemGid: { $in: unmapped } });
  return { mapped: variants.length - unmapped.length, unmapped: unmapped.length };
};

/* Full rescan of the store's variants (initial mapping / manual refresh) */
export const scanVariants = async (conn) => {
  const variants = [];
  let after = null;
  do {
    const page = (await connectionGraphql(conn, VARIANTS, { after }))?.productVariants;
    for (const n of page?.nodes || []) {
      if (n.inventoryItem?.id) variants.push({ sku: n.sku, itemGid: n.inventoryItem.id, productGid: n.product?.id || null, updatedAt: validDate(n.product?.updatedAt) });
    }
    after = page?.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);

  const result = await applyVariants(conn, variants);
  // Variants deleted in Shopify
  await ShopifyInventoryLink.deleteMany({ workspace: conn.workspace, connection: conn._id, inventoryItemGid: { $nin: variants.map((v) => v.itemGid) } });
  return result;
};

/* products/create · products/update · products/delete */
export const handleProductEvent = async (event, conn) => {
  assertContext(conn);
  const p = event.payload;
  if (!p?.id) return "redacted";
  const productGid = p.admin_graphql_api_id || gid("Product", p.id);

  if (event.topic === "products/delete") {
    await ShopifyInventoryLink.deleteMany({ workspace: conn.workspace, shopifyProductGid: productGid });
    return "unmapped";
  }

  const updatedAt = validDate(p.updated_at) || new Date(0);
  const variants = (p.variants || [])
    .filter((v) => v.inventory_item_id)
    .map((v) => ({ sku: v.sku, itemGid: gid("InventoryItem", v.inventory_item_id), productGid, updatedAt }));
  await applyVariants(conn, variants);
  // Variants removed from this product (only by an update at least as new)
  await ShopifyInventoryLink.deleteMany({
    workspace: conn.workspace,
    shopifyProductGid: productGid,
    inventoryItemGid: { $nin: variants.map((v) => v.itemGid) },
    sourceUpdatedAt: { $lte: updatedAt },
  });
  return "mapped";
};

/* inventory_levels/update — drift detection only (never written to the ERP) */
export const handleInventoryLevelEvent = async (event, conn) => {
  assertContext(conn);
  const p = event.payload;
  if (!p?.inventory_item_id || !conn.inventory?.locationGid) return "ignored";
  if (gid("Location", p.location_id) !== conn.inventory.locationGid) return "ignored";
  // Our own push echoes back with the value we set → no-op (no loop)
  const r = await ShopifyInventoryLink.updateOne(
    { workspace: conn.workspace, inventoryItemGid: gid("InventoryItem", p.inventory_item_id), lastPushedQty: { $ne: num(p.available) } },
    { $set: { dirty: true } }
  );
  return r.modifiedCount ? "drift" : "echo";
};

/* ---------------- quantities ---------------- */

/* Units Shopify has sold that the ERP has not reserved yet */
export const shopifyCommitted = async (conn) => {
  const byProduct = new Map();
  const bySku = new Map();
  const add = (m, k, q) => m.set(k, (m.get(k) || 0) + q);

  const links = await ShopifyOrderLink.find({ workspace: conn.workspace, status: "imported", salesOrder: { $ne: null } }, "salesOrder", { lean: true });
  if (links.length) {
    const open = await SalesOrder.find(
      { _id: { $in: links.map((l) => l.salesOrder) }, $or: [{ status: "DRAFT" }, { status: "APPROVED", warehouse: null }] },
      "items",
      { lean: true }
    );
    for (const so of open) for (const i of so.items) add(byProduct, String(i.product), num(i.qty));
  }

  // Received but not imported (waiting, or failed e.g. on an unknown SKU)
  const events = await ShopifyWebhookEvent.find(
    { workspace: conn.workspace, shopDomain: conn.shopDomain, topic: { $in: ["orders/create", "orders/updated"] }, status: { $in: ["pending", "processing", "dead"] } },
    "resource payload.line_items payload.cancelled_at",
    { lean: true }
  );
  const latest = new Map();
  for (const e of events) {
    const g = e.resource?.gid;
    const cur = g && latest.get(g);
    if (g && (!cur || new Date(e.resource.updatedAt || 0) > new Date(cur.resource.updatedAt || 0))) latest.set(g, e);
  }
  if (latest.size) {
    const known = new Set(
      (await ShopifyOrderLink.find({ workspace: conn.workspace, orderGid: { $in: [...latest.keys()] } }, "orderGid", { lean: true })).map((l) => l.orderGid)
    );
    for (const [g, e] of latest) {
      if (known.has(g) || e.payload?.cancelled_at) continue;
      for (const l of e.payload?.line_items || []) {
        const sku = String(l.sku || "").trim().toUpperCase();
        const q = num(l.current_quantity ?? l.quantity);
        if (sku && !l.gift_card && q > 0) add(bySku, sku, q);
      }
    }
  }
  return { byProduct, bySku };
};

export const desiredQuantities = async (conn, productIds) => {
  const wh = new mongoose.Types.ObjectId(String(conn.inventory.warehouse));
  const ids = productIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const [ledger, levels, committed] = await Promise.all([
    Inventory.aggregate([
      { $match: { warehouse: wh, product: { $in: ids } } },
      { $group: { _id: "$product", onHand: { $sum: { $subtract: [{ $ifNull: ["$inQty", 0] }, { $ifNull: ["$outQty", 0] }] } } } },
    ]),
    StockLevel.find({ warehouse: wh, product: { $in: ids } }, "product reserved", { lean: true }),
    shopifyCommitted(conn),
  ]);
  const onHand = new Map(ledger.map((r) => [String(r._id), num(r.onHand)]));
  const reserved = new Map(levels.map((r) => [String(r.product), num(r.reserved)]));
  const parts = (productId, sku) => {
    const id = String(productId);
    return {
      onHand: onHand.get(id) || 0,
      reserved: reserved.get(id) || 0,
      committed: (committed.byProduct.get(id) || 0) + (committed.bySku.get(sku) || 0),
    };
  };
  // desired(productId, sku) → quantity to push; desired.parts(...) → its breakdown
  return Object.assign(
    (productId, sku) => {
      const p = parts(productId, sku);
      return Math.max(0, Math.floor(p.onHand - p.reserved - p.committed));
    },
    { parts }
  );
};

/* Read-only: what the next sync would push to the mapped location, per SKU.
   Same calculation as syncInventory; never writes to Shopify or the ERP. */
const PREVIEW_LIMIT = 500;
export const inventoryPreview = async (conn) => {
  const { warehouse, locationGid, locationName } = conn.inventory || {};
  const base = { configured: Boolean(warehouse && locationGid), warehouse: warehouse || null, locationGid: locationGid || null, locationName: locationName || null };
  if (!base.configured) return { ...base, totals: { mapped: 0, willPush: 0, unchanged: 0, ambiguous: 0, failing: 0 }, items: [], truncated: false };

  const links = await ShopifyInventoryLink.find(
    { workspace: conn.workspace, connection: conn._id },
    "sku product lastPushedQty lastPushedAt dirty lastError",
    { lean: true }
  );
  const ids = [...new Set(links.map((l) => String(l.product)))];
  const [desired, products] = await Promise.all([
    desiredQuantities(conn, ids),
    ids.length ? Product.find({ _id: { $in: ids } }, "name", { lean: true }) : [],
  ]);
  const names = new Map(products.map((p) => [String(p._id), p.name]));
  const perSku = new Map();
  links.forEach((l) => perSku.set(l.sku, (perSku.get(l.sku) || 0) + 1));

  const totals = { mapped: links.length, willPush: 0, unchanged: 0, ambiguous: 0, failing: 0 };
  const items = links
    .map((l) => {
      const ambiguous = perSku.get(l.sku) > 1;
      const quantity = desired(l.product, l.sku);
      const willPush = !ambiguous && (l.dirty || l.lastPushedQty !== quantity);
      if (ambiguous) totals.ambiguous++;
      else if (willPush) totals.willPush++;
      else totals.unchanged++;
      if (l.lastError) totals.failing++;
      return {
        _id: l._id,
        sku: l.sku,
        product: names.get(String(l.product)) || null,
        ...desired.parts(l.product, l.sku),
        available: quantity,
        lastPushedQty: l.lastPushedQty,
        lastPushedAt: l.lastPushedAt,
        willPush,
        ambiguous,
        lastError: l.lastError,
      };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
  return { ...base, totals, items: items.slice(0, PREVIEW_LIMIT), truncated: items.length > PREVIEW_LIMIT };
};

/* ---------------- push ---------------- */

/* One batch; quantities Shopify rejects are reported and the rest retried once */
const pushBatch = async (conn, batch) => {
  const failed = new Map();
  let pending = batch;
  for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
    // New key per attempt: the retry sends a different set of quantities
    const data = await connectionGraphql(conn, SET_QUANTITIES, {
      input: {
        name: "available",
        reason: "correction",
        quantities: pending.map((c) => ({ inventoryItemId: c.link.inventoryItemGid, locationId: conn.inventory.locationGid, quantity: c.qty, changeFromQuantity: null })),
      },
      idempotencyKey: crypto.randomUUID(),
    });
    const errors = data?.inventorySetQuantities?.userErrors || [];
    if (!errors.length) return { applied: pending, failed };

    const byIndex = new Map();
    for (const e of errors) {
      const i = Number(e.field?.[2]);
      if (e.field?.[1] === "quantities" && Number.isInteger(i) && pending[i]) byIndex.set(i, e.message);
    }
    if (!byIndex.size) {
      // Not attributable to an item: the whole batch failed
      pending.forEach((c) => failed.set(c.link._id, errors.map((e) => e.message).join("; ")));
      return { applied: [], failed };
    }
    byIndex.forEach((msg, i) => failed.set(pending[i].link._id, msg));
    pending = pending.filter((_, i) => !byIndex.has(i));
  }
  pending.forEach((c) => failed.has(c.link._id) || failed.set(c.link._id, "Shopify rejected the batch"));
  return { applied: [], failed };
};

const stillOwner = (conn, token) => ShopifyConnection.exists({ _id: conn._id, workspace: conn.workspace, "inventory.leaseToken": token });

export const syncInventory = async (connectionId, workspaceId) => {
  const token = crypto.randomUUID();
  const now = new Date();
  const conn = await ShopifyConnection.findOneAndUpdate(
    {
      _id: connectionId,
      workspace: workspaceId,
      status: "active",
      "inventory.enabled": true,
      "inventory.warehouse": { $ne: null },
      "inventory.locationGid": { $ne: null },
      $or: [{ "inventory.leaseUntil": null }, { "inventory.leaseUntil": { $lte: now } }],
    },
    { $set: { "inventory.leaseUntil": new Date(now.getTime() + LEASE_MS), "inventory.leaseToken": token } },
    { returnDocument: "after" }
  ).select("+accessToken +refreshToken");
  if (!conn) return { skipped: "Inventory sync is off, not configured, or already running" };

  return runWithWorkspace(conn.workspace, async () => {
    const result = { pushed: 0, unchanged: 0, failed: 0, ambiguous: [] };
    let error = null;
    let upstream = false;
    try {
      const links = await ShopifyInventoryLink.find({ workspace: conn.workspace, connection: conn._id }, null, { lean: true });
      const bySku = new Map();
      links.forEach((l) => bySku.set(l.sku, [...(bySku.get(l.sku) || []), l]));
      const desired = await desiredQuantities(conn, [...new Set(links.map((l) => String(l.product)))]);

      const changes = [];
      for (const [sku, group] of bySku) {
        if (group.length > 1) {
          result.ambiguous.push(sku); // same SKU on several Shopify variants: never guessed
          continue;
        }
        const qty = desired(group[0].product, sku);
        if (!group[0].dirty && group[0].lastPushedQty === qty) result.unchanged++;
        else changes.push({ link: group[0], qty });
      }

      for (let i = 0; i < changes.length; i += BATCH) {
        if (!(await stillOwner(conn, token))) throw new Error("Inventory sync lease was lost; stopping");
        const { applied, failed } = await pushBatch(conn, changes.slice(i, i + BATCH));
        const at = new Date();
        await Promise.all([
          ...applied.map((c) =>
            ShopifyInventoryLink.updateOne({ _id: c.link._id, workspace: conn.workspace }, { $set: { lastPushedQty: c.qty, lastPushedAt: at, dirty: false, lastError: null } })
          ),
          ...[...failed].map(([id, msg]) => ShopifyInventoryLink.updateOne({ _id: id, workspace: conn.workspace }, { $set: { lastError: String(msg).slice(0, 300) } })),
        ]);
        result.pushed += applied.length;
        result.failed += failed.size;
      }
    } catch (err) {
      error = String(err.message).slice(0, 300);
      upstream = Boolean(err.upstream);
    }

    await ShopifyConnection.updateOne(
      { _id: conn._id, workspace: conn.workspace, "inventory.leaseToken": token },
      { $set: { "inventory.lastSyncAt": new Date(), "inventory.lastResult": result, "inventory.lastError": error, "inventory.leaseUntil": null, "inventory.leaseToken": null } }
    );
    if (error) throw Object.assign(new Error(error), { result, upstream });
    return result;
  });
};

/* Periodic run (worker): every enabled store, each in its own workspace */
export const runInventorySyncAll = async () => {
  const conns = await ShopifyConnection.find({ workspace: { $ne: null }, status: "active", "inventory.enabled": true }, "_id workspace", { lean: true });
  for (const c of conns) {
    await syncInventory(c._id, c.workspace).catch((err) => console.error(`❌ Shopify inventory sync (${c._id}) failed:`, err.message));
  }
};

/* ---------------- settings + dashboard ---------------- */
export const saveInventorySettings = async (workspaceId, userId, { enabled, warehouse, locationGid }) => {
  const conn = await ShopifyConnection.findOne({ workspace: workspaceId, status: "active" }).select("+accessToken +refreshToken");
  if (!conn) throw Object.assign(new Error("No Shopify store is connected"), { status: 409 });

  const set = { "inventory.enabled": Boolean(enabled) };
  if (warehouse !== undefined) {
    // Scoped to the caller's workspace by the workspace plugin
    if (warehouse && (!mongoose.isValidObjectId(warehouse) || !(await Warehouse.exists({ _id: warehouse })))) {
      throw Object.assign(new Error("Warehouse not found"), { status: 422 });
    }
    set["inventory.warehouse"] = warehouse || null;
  }
  if (locationGid !== undefined) {
    const location = locationGid ? (await listLocations(conn)).find((l) => l.id === locationGid) : null;
    if (locationGid && !location) throw Object.assign(new Error("Shopify location not found"), { status: 422 });
    set["inventory.locationGid"] = location?.id || null;
    set["inventory.locationName"] = location?.name || null;
  }
  const next = { warehouse: set["inventory.warehouse"] ?? conn.inventory?.warehouse, location: set["inventory.locationGid"] ?? conn.inventory?.locationGid };
  if (set["inventory.enabled"] && (!next.warehouse || !next.location)) {
    throw Object.assign(new Error("Choose an ERP warehouse and a Shopify location first"), { status: 422 });
  }

  await ShopifyConnection.updateOne({ _id: conn._id, workspace: conn.workspace }, { $set: set });
  // A new warehouse or location: every quantity must be re-asserted
  await ShopifyInventoryLink.updateMany({ workspace: conn.workspace, connection: conn._id }, { $set: { dirty: true } });
  await audit({ ...conn.toObject(), connectedBy: userId }, "UPDATE", `Shopify inventory sync ${set["inventory.enabled"] ? "enabled" : "disabled"} for ${conn.shopDomain}`, {
    warehouse: String(next.warehouse || ""),
    location: next.location || null,
  });
  return conn;
};

export const inventorySummary = async (workspaceId) => {
  const [mapped, failing] = await Promise.all([
    ShopifyInventoryLink.countDocuments({ workspace: workspaceId }),
    ShopifyInventoryLink.find({ workspace: workspaceId, lastError: { $ne: null } }, "sku lastError updatedAt", { lean: true }).sort({ updatedAt: -1 }).limit(10),
  ]);
  return { mapped, failing };
};

export const INVENTORY_HANDLERS = {
  "products/create": handleProductEvent,
  "products/update": handleProductEvent,
  "products/delete": handleProductEvent,
  "inventory_levels/update": handleInventoryLevelEvent,
};
