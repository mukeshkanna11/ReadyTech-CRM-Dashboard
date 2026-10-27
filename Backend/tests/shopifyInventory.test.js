// Focused, DB-free tests for Phase 4: ERP → Shopify stock and fulfilment.
// Run: node --test tests/
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  SHOPIFY_API_KEY: "k",
  SHOPIFY_API_SECRET: "s",
  SHOPIFY_API_VERSION: "2026-07",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
});
await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const { encrypt } = await import("../services/shopify/crypto.js");
const inv = await import("../services/shopify/inventorySync.service.js");
const sync = await import("../services/shopify/orderSync.service.js");
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const ShopifyInventoryLink = (await import("../models/ShopifyInventoryLink.js")).default;
const ShopifyOrderLink = (await import("../models/ShopifyOrderLink.js")).default;
const ShopifyWebhookEvent = (await import("../models/ShopifyWebhookEvent.js")).default;
const SalesOrder = (await import("../models/SalesOrder.model.js")).default;
const Product = (await import("../models/Product.model.js")).default;
const Inventory = (await import("../models/Inventory.model.js")).default;
const StockLevel = (await import("../models/StockLevel.model.js")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;

const oid = () => new mongoose.Types.ObjectId();
const WS = oid();
const WS_OTHER = oid();
const ADMIN = oid();
const WH = oid();
const P1 = oid();
const P2 = oid();
const LOC = "gid://shopify/Location/1";

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const origFetch = globalThis.fetch;
const json = (body) => ({ ok: true, status: 200, json: async () => body });

let conn;
let state;
beforeEach(() => {
  ctx.setDefaultWorkspaceId(oid());
  conn = {
    _id: oid(), workspace: WS, shopDomain: "a.myshopify.com", status: "active", connectedBy: ADMIN,
    accessToken: encrypt("shpat"), inventory: { enabled: true, warehouse: WH, locationGid: LOC },
  };
  state = { links: [], linkUpdates: [], connUpdates: [], pushes: [], ledger: [], releases: [], orderLinks: [], sos: [] };
  stub(AuditLog, "create", async (d) => d);
  stub(mongoose, "startSession", async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
});
afterEach(() => {
  while (restore.length) restore.pop()();
  globalThis.fetch = origFetch;
});

/* ---------------- quantities ---------------- */
const stockStubs = ({ onHand = { [P1]: 10, [P2]: 4 }, reserved = { [P1]: 2 }, drafts = [], events = [], known = [] } = {}) => {
  stub(Inventory, "aggregate", async (pipeline) => {
    assert.equal(String(pipeline[0].$match.warehouse), String(WH));
    return Object.entries(onHand).map(([id, q]) => ({ _id: id, onHand: q }));
  });
  stub(StockLevel, "find", async () => Object.entries(reserved).map(([product, r]) => ({ product, reserved: r })));
  stub(ShopifyOrderLink, "find", async (f) => {
    assert.equal(String(f.workspace), String(WS));
    return f.orderGid ? known.map((orderGid) => ({ orderGid })) : drafts.map((d) => ({ salesOrder: d._id }));
  });
  stub(SalesOrder, "find", async () => drafts);
  stub(ShopifyWebhookEvent, "find", async (f) => {
    assert.equal(String(f.workspace), String(WS));
    return events;
  });
};
const run = (fn) => ctx.runWithWorkspace(WS, fn);

test("available = ERP on-hand − reserved − Shopify sales not yet reserved (never negative)", async () => {
  stockStubs({
    drafts: [{ _id: oid(), items: [{ product: P1, qty: 3 }] }],
    events: [
      { resource: { gid: "gid://shopify/Order/9", updatedAt: new Date(2) }, payload: { line_items: [{ sku: "p2-sku", quantity: 1, current_quantity: 5 }] } },
      { resource: { gid: "gid://shopify/Order/9", updatedAt: new Date(1) }, payload: { line_items: [{ sku: "P2-SKU", quantity: 1 }] } }, // older copy
      { resource: { gid: "gid://shopify/Order/8", updatedAt: new Date(1) }, payload: { cancelled_at: "x", line_items: [{ sku: "P1-SKU", quantity: 9 }] } },
    ],
  });
  const desired = await run(() => inv.desiredQuantities(conn, [P1, P2]));
  assert.equal(desired(P1, "P1-SKU"), 5); // 10 − 2 − 3
  assert.equal(desired(P2, "P2-SKU"), 0); // 4 − 5 → clamped
});

/* ---------------- push ---------------- */
const link = (over) => ({ _id: oid(), workspace: WS, sku: "P1-SKU", product: P1, inventoryItemGid: "gid://shopify/InventoryItem/1", lastPushedQty: null, dirty: true, ...over });
const syncStubs = ({ claim = true, owner = true, userErrors = () => [] } = {}) => {
  stub(ShopifyConnection, "findOneAndUpdate", (f, u) => {
    assert.equal(String(f.workspace), String(WS));
    if (claim) conn.inventory.leaseToken = u.$set["inventory.leaseToken"];
    return { select: async () => (claim ? conn : null) };
  });
  stub(ShopifyConnection, "exists", async () => owner);
  stub(ShopifyConnection, "updateOne", async (f, u) => (state.connUpdates.push({ f, u }), {}));
  stub(ShopifyInventoryLink, "find", async () => state.links);
  stub(ShopifyInventoryLink, "updateOne", async (f, u) => (state.linkUpdates.push({ f, u }), {}));
  globalThis.fetch = async (url, init) => {
    const { variables } = JSON.parse(init.body);
    state.pushes.push(variables.input);
    return json({ data: { inventorySetQuantities: { inventoryAdjustmentGroup: { id: "g" }, userErrors: userErrors(variables.input, state.pushes.length) } } });
  };
};

test("pushes only changed or drifted items; unchanged and ambiguous SKUs are skipped", async () => {
  stockStubs({ onHand: { [P1]: 10, [P2]: 4 }, reserved: {} });
  state.links = [
    link({ lastPushedQty: 10, dirty: false }), // unchanged
    link({ sku: "P2-SKU", product: P2, inventoryItemGid: "gid://shopify/InventoryItem/2", lastPushedQty: 7, dirty: false }), // changed
    link({ sku: "DUP", product: P1, inventoryItemGid: "gid://shopify/InventoryItem/3" }),
    link({ sku: "DUP", product: P1, inventoryItemGid: "gid://shopify/InventoryItem/4" }),
  ];
  syncStubs();
  const result = await inv.syncInventory(conn._id, WS);
  assert.deepEqual(result, { pushed: 1, unchanged: 1, failed: 0, ambiguous: ["DUP"] });
  assert.equal(state.pushes.length, 1);
  assert.deepEqual(state.pushes[0].quantities, [{ inventoryItemId: "gid://shopify/InventoryItem/2", locationId: LOC, quantity: 4 }]);
  assert.equal(state.pushes[0].name, "available");
  assert.equal(state.linkUpdates[0].u.$set.lastPushedQty, 4);
  assert.equal(String(state.linkUpdates[0].f.workspace), String(WS));
  const done = state.connUpdates.at(-1).u.$set;
  assert.equal(done["inventory.leaseUntil"], null);
});

test("an item Shopify rejects is reported; the rest of the batch is retried and applied", async () => {
  stockStubs({ onHand: { [P1]: 3, [P2]: 4 }, reserved: {} });
  state.links = [link(), link({ sku: "P2-SKU", product: P2, inventoryItemGid: "gid://shopify/InventoryItem/2" })];
  syncStubs({ userErrors: (input, n) => (n === 1 ? [{ field: ["input", "quantities", "0", "locationId"], message: "Item not stocked at location" }] : []) });
  const result = await inv.syncInventory(conn._id, WS);
  assert.equal(result.pushed, 1);
  assert.equal(result.failed, 1);
  assert.equal(state.pushes.length, 2);
  assert.equal(state.pushes[1].quantities.length, 1);
  assert.ok(state.linkUpdates.some((x) => x.u.$set.lastError === "Item not stocked at location"));
});

test("a second sync while one is running is skipped (lease)", async () => {
  syncStubs({ claim: false });
  const r = await inv.syncInventory(conn._id, WS);
  assert.match(r.skipped, /already running/);
  assert.equal(state.pushes.length, 0);
});

test("a run that lost its lease stops before pushing stale quantities", async () => {
  stockStubs();
  state.links = [link()];
  syncStubs({ owner: false });
  await assert.rejects(inv.syncInventory(conn._id, WS), /lease was lost/);
  assert.equal(state.pushes.length, 0);
});

/* ---------------- loop prevention ---------------- */
test("our own push echoing back is ignored; real drift marks the item; other locations ignored", async () => {
  const filters = [];
  stub(ShopifyInventoryLink, "updateOne", async (f) => (filters.push(f), { modifiedCount: f.lastPushedQty.$ne === 5 ? 0 : 1 } /* stored lastPushedQty is 5 */));
  const ev = (available, location_id = 1) => ({ payload: { inventory_item_id: 1, location_id, available } });
  assert.equal(await run(() => inv.handleInventoryLevelEvent(ev(5), conn)), "echo");
  assert.equal(await run(() => inv.handleInventoryLevelEvent(ev(7), conn)), "drift");
  assert.equal(await run(() => inv.handleInventoryLevelEvent(ev(7, 2), conn)), "ignored");
  assert.equal(filters.length, 2);
  assert.equal(String(filters[0].workspace), String(WS));
  assert.equal(filters[0].inventoryItemGid, "gid://shopify/InventoryItem/1");
});

/* ---------------- product mapping ---------------- */
test("product webhook maps variants by ERP SKU; stale updates never overwrite newer mappings", async () => {
  const ups = [];
  const dels = [];
  stub(Product, "find", async (f) => (f.sku.$in.includes("P1-SKU") ? [{ _id: P1, sku: "P1-SKU" }] : []));
  stub(ShopifyInventoryLink, "updateOne", async (f, u) => {
    ups.push({ f, u });
    if (ups.length === 2) throw Object.assign(new Error("E11000"), { code: 11000 }); // newer mapping exists
    return {};
  });
  stub(ShopifyInventoryLink, "deleteMany", async (f) => (dels.push(f), {}));
  const product = (updated_at) => ({
    topic: "products/update",
    payload: { id: 5, updated_at, variants: [{ sku: "p1-sku", inventory_item_id: 11 }, { sku: "UNKNOWN", inventory_item_id: 12 }] },
  });
  await run(() => inv.handleProductEvent(product("2026-10-02T00:00:00Z"), conn));
  await run(() => inv.handleProductEvent(product("2026-10-01T00:00:00Z"), conn)); // stale: swallowed
  assert.equal(ups[0].u.$set.sku, "P1-SKU");
  assert.equal(String(ups[0].u.$set.product), String(P1));
  assert.equal(ups[0].f.inventoryItemGid, "gid://shopify/InventoryItem/11");
  assert.ok(ups[0].f.$or[1].sourceUpdatedAt.$lte instanceof Date);
  assert.deepEqual(dels[0].inventoryItemGid, { $in: ["gid://shopify/InventoryItem/12"] }); // unknown SKU unmapped
  assert.equal(String(dels[0].workspace), String(WS));
});

test("handlers refuse to run outside the connection's workspace", async () => {
  await assert.rejects(
    ctx.runWithWorkspace(WS_OTHER, () => inv.handleProductEvent({ topic: "products/delete", payload: { id: 1 } }, conn)),
    (err) => err.permanent
  );
});

/* ---------------- fulfilment ---------------- */
const fulfilmentStubs = ({ soStatus = "APPROVED", warehouse = WH, available = 100 } = {}) => {
  state.orderLinks = [{ workspace: WS, orderGid: "gid://shopify/Order/1", salesOrder: oid(), fulfillments: [], issues: [], refunds: [] }];
  const so = {
    _id: state.orderLinks[0].salesOrder, soNumber: "SO-1001", status: soStatus, warehouse,
    items: [{ product: { _id: P1, sku: "P1-SKU", name: "Shirt" }, qty: 2 }],
    async save() { state.sos.push({ status: this.status }); return this; },
  };
  stub(ShopifyOrderLink, "findOne", async (f) => {
    const d = state.orderLinks.find((l) => String(l.workspace) === String(f.workspace) && l.orderGid === f.orderGid);
    return d ? ShopifyOrderLink.hydrate({ ...d }) : null;
  });
  stub(ShopifyOrderLink.prototype, "save", async function () {
    state.orderLinks[0] = this.toObject();
    return this;
  });
  stub(SalesOrder, "findOne", async (f, p, o) => {
    assert.equal(o.populate, "items.product");
    return so;
  });
  stub(Inventory, "getAvailable", async () => available);
  stub(Inventory, "create", async ([row]) => (state.ledger.push(row), [row]));
  stub(StockLevel, "getReserved", async () => 2);
  stub(StockLevel, "updateOne", async () => (state.releases.push(1), {}));
  return so;
};
const fulfilment = (over = {}) => ({
  topic: "fulfillments/create",
  payload: { id: 70, order_id: 1, status: "success", updated_at: "2026-10-03T00:00:00Z", line_items: [{ sku: "p1-sku", quantity: 2 }], ...over },
});
const fulfil = (e) => ctx.runWithWorkspace(WS, () => sync.handleFulfillmentEvent(e, conn));

test("full fulfilment delivers the approved ERP order once (ledger + reservation release)", async () => {
  const so = fulfilmentStubs();
  assert.equal(await fulfil(fulfilment()), "delivered");
  assert.equal(so.status, "DELIVERED");
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].type, "SALE");
  assert.equal(state.ledger[0].outQty, 2);
  assert.equal(String(state.ledger[0].createdBy), String(ADMIN));
  assert.equal(state.releases.length, 1);

  // Same delivery again, and a later update of the fulfilment: no second deduction
  assert.equal(await fulfil(fulfilment()), "stale");
  assert.equal(await fulfil(fulfilment({ updated_at: "2026-10-04T00:00:00Z" })), "recorded");
  assert.equal(state.ledger.length, 1);
});

test("partial fulfilment is recorded and flagged; nothing is deducted", async () => {
  fulfilmentStubs();
  assert.equal(await fulfil(fulfilment({ line_items: [{ sku: "P1-SKU", quantity: 1 }] })), "recorded");
  assert.equal(state.ledger.length, 0);
  assert.match(state.orderLinks[0].issues.join(), /Partially fulfilled/);
});

test("fulfilment of a DRAFT order is flagged, not delivered", async () => {
  fulfilmentStubs({ soStatus: "DRAFT" });
  assert.equal(await fulfil(fulfilment()), "recorded");
  assert.equal(state.ledger.length, 0);
  assert.match(state.orderLinks[0].issues.join(), /approve and deliver SO-1001/);
});

test("ERP refusing the delivery (insufficient stock) rolls back and flags the order", async () => {
  const so = fulfilmentStubs({ available: 1 });
  assert.equal(await fulfil(fulfilment()), "flagged");
  assert.equal(state.ledger.length, 0);
  assert.equal(so.status, "APPROVED");
  assert.match(state.orderLinks[0].issues.join(), /ERP delivery failed: Insufficient stock/);
  assert.equal(state.orderLinks[0].fulfillments.length, 1);
});

test("fulfilment before the order is imported is retried (not dead-lettered)", async () => {
  fulfilmentStubs();
  state.orderLinks = [];
  await assert.rejects(fulfil(fulfilment()), (err) => !err.permanent && /not imported yet/.test(err.message));
});

test("existing deliver API behaves as before the extraction", async () => {
  const { deliverSalesOrder } = await import("../controllers/sales.controller.js");
  const so = fulfilmentStubs({ available: 1 });
  stub(SalesOrder, "findById", () => ({ populate: () => ({ session: async () => so }) }));
  const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await run(() => deliverSalesOrder({ params: { id: so._id }, body: {}, user: { _id: ADMIN } }, res));
  assert.equal(res.code, 400);
  assert.match(res.body.message, /Insufficient stock for Shirt. Available: 1, required: 2/);

  so.status = "APPROVED";
  stub(Inventory, "getAvailable", async () => 5);
  await run(() => deliverSalesOrder({ params: { id: so._id }, body: {}, user: { _id: ADMIN } }, res));
  assert.equal(res.code, 200);
  assert.equal(so.status, "DELIVERED");
  assert.equal(state.ledger.length, 1);
});
