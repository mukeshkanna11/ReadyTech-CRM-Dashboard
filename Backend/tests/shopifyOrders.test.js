// Focused, DB-free tests for Shopify order sync (Phase 3).
// Link / sales-order documents are real Mongoose documents; persistence is an
// in-memory store with the same unique keys as the real indexes. ERP lookups
// are filtered by the active workspace, as the scope plugin does.
// Run: node --test tests/
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.JWT_SECRET = "test-jwt";
await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const ShopifyOrderLink = (await import("../models/ShopifyOrderLink.js")).default;
const ShopifyCustomerLink = (await import("../models/ShopifyCustomerLink.js")).default;
const ShopifyWebhookEvent = (await import("../models/ShopifyWebhookEvent.js")).default;
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const SalesOrder = (await import("../models/SalesOrder.model.js")).default;
const Product = (await import("../models/Product.model.js")).default;
const Client = (await import("../models/Client.js")).default;
const StockLevel = (await import("../models/StockLevel.model.js")).default;
const sync = await import("../services/shopify/orderSync.service.js");
const worker = await import("../services/shopify/webhookWorker.js");

const oid = () => new mongoose.Types.ObjectId();
const WS_A = oid();
const WS_B = oid();
const ADMIN_A = oid();
const DEFAULT_WS = oid();

let db;
const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const active = () => ctx.getWorkspaceId();
const inWs = (doc) => String(doc.workspace) === active();
const dup = (keyPattern) => Object.assign(new Error("E11000 duplicate key"), { code: 11000, keyPattern });
const chain = (value) => ({ sort() { return this; }, select() { return this; }, then: (res, rej) => Promise.resolve(value).then(res, rej) });

const connA = { _id: "connA", shopDomain: "a.myshopify.com", workspace: WS_A, status: "active", connectedBy: ADMIN_A };

beforeEach(() => {
  ctx.setDefaultWorkspaceId(DEFAULT_WS);
  db = { links: [], customerLinks: [], sos: [], clients: [], releases: [], products: [
    { _id: oid(), sku: "TSHIRT-RED", workspace: WS_A },
    { _id: oid(), sku: "MUG", workspace: WS_A },
    { _id: oid(), sku: "SECRET-B", workspace: WS_B }, // another tenant's product
  ] };

  stub(mongoose, "startSession", async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));

  // ShopifyOrderLink — unique (workspace, orderGid)
  stub(ShopifyOrderLink, "findOne", async (f) => {
    const d = db.links.find((l) => String(l.workspace) === String(f.workspace) && l.orderGid === f.orderGid);
    return d ? ShopifyOrderLink.hydrate({ ...d }) : null;
  });
  stub(ShopifyOrderLink.prototype, "save", async function () {
    const i = db.links.findIndex((l) => String(l.workspace) === String(this.workspace) && l.orderGid === this.orderGid);
    if (this.isNew && i >= 0) throw dup({ workspace: 1, orderGid: 1 });
    const plain = this.toObject();
    i >= 0 ? (db.links[i] = plain) : db.links.push(plain);
    this.isNew = false;
    return this;
  });
  stub(ShopifyOrderLink, "updateOne", async (f, u, o) => {
    let d = db.links.find((l) => String(l.workspace) === String(f.workspace) && l.orderGid === f.orderGid);
    if (d && d.refunds.some((r) => r.refundGid === f["refunds.refundGid"].$ne)) {
      if (o?.upsert) throw dup({ workspace: 1, orderGid: 1 });
      return { modifiedCount: 0 };
    }
    if (!d) db.links.push((d = { workspace: f.workspace, orderGid: f.orderGid, refunds: [], issues: [], ...u.$setOnInsert }));
    d.refunds.push(u.$push.refunds);
    if (u.$addToSet?.issues && !d.issues.includes(u.$addToSet.issues)) d.issues.push(u.$addToSet.issues);
    return { modifiedCount: 1 };
  });

  // ERP models — scoped to the active workspace like the plugin
  stub(Product, "find", async (f) => db.products.filter((p) => inWs(p) && f.sku.$in.includes(p.sku)));
  stub(Client, "findOne", async (f) => db.clients.find((c) => inWs(c) && (f._id ? String(c._id) === String(f._id) : c.email === f.email)) || null);
  stub(Client, "create", async ([d]) => {
    const c = { _id: oid(), ...d };
    db.clients.push(c);
    return [c];
  });
  stub(ShopifyCustomerLink, "findOne", async (f) => db.customerLinks.find((l) => String(l.workspace) === String(f.workspace) && l.customerGid === f.customerGid) || null);
  stub(ShopifyCustomerLink, "updateOne", async (f, u) => {
    const l = db.customerLinks.find((x) => String(x.workspace) === String(f.workspace) && x.customerGid === f.customerGid);
    l ? Object.assign(l, u.$set) : db.customerLinks.push({ workspace: f.workspace, customerGid: f.customerGid, ...u.$set });
    return {};
  });
  stub(SalesOrder, "findOne", (f) => {
    const scoped = db.sos.filter(inWs);
    const d = f ? scoped.find((s) => String(s._id) === String(f._id)) : scoped.at(-1); // no filter = generateSONumber's "latest"
    return chain(d ? SalesOrder.hydrate({ ...d }) : null);
  });
  stub(SalesOrder, "create", async ([d]) => {
    if (db.sos.some((s) => String(s.workspace) === String(d.workspace) && s.soNumber === d.soNumber)) throw dup({ workspace: 1, soNumber: 1 });
    const so = new SalesOrder(d);
    db.sos.push(so.toObject());
    return [so];
  });
  stub(SalesOrder.prototype, "save", async function () {
    db.sos[db.sos.findIndex((s) => String(s._id) === String(this._id))] = this.toObject();
    return this;
  });
  stub(StockLevel, "getReserved", async () => 5);
  stub(StockLevel, "updateOne", async (f, u) => (db.releases.push({ f, u }), {}));
});
afterEach(() => {
  while (restore.length) restore.pop()();
  for (const t of Object.keys(sync.ORDER_HANDLERS)) worker.unregisterHandler(t);
});

const order = (over = {}) => ({
  id: 1001,
  admin_graphql_api_id: "gid://shopify/Order/1001",
  name: "#1001",
  updated_at: "2026-10-01T10:00:00Z",
  financial_status: "paid",
  currency: "INR",
  total_price: "1180.00",
  email: "asha@example.com",
  customer: { id: 77, admin_graphql_api_id: "gid://shopify/Customer/77", first_name: "Asha", last_name: "K", email: "Asha@Example.com" },
  billing_address: { address1: "1 MG Road", city: "Chennai", zip: "600001", country: "India" },
  line_items: [
    { sku: "tshirt-red", quantity: 2, current_quantity: 2, price: "400.00", title: "Red T-shirt" },
    { sku: "MUG", quantity: 1, current_quantity: 1, price: "200.00", title: "Mug" },
  ],
  ...over,
});
const ev = (topic, payload) => ({ topic, payload, workspace: WS_A });
const run = (topic, payload, conn = connA) => ctx.runWithWorkspace(conn.workspace, () => sync.handleOrderEvent(ev(topic, payload), conn));

test("order imports once as a DRAFT sales order with mapped SKUs and a CRM customer", async () => {
  assert.equal(await run("orders/create", order()), "imported");
  assert.equal(db.sos.length, 1);
  const so = db.sos[0];
  assert.equal(so.status, "DRAFT");
  assert.equal(so.soNumber, "SO-1001");
  assert.equal(String(so.createdBy), String(ADMIN_A));
  assert.deepEqual(so.items.map((i) => [String(i.product), i.qty, i.price]), [
    [String(db.products[0]._id), 2, 400],
    [String(db.products[1]._id), 1, 200],
  ]);
  assert.equal(db.clients.length, 1);
  assert.equal(db.clients[0].email, "asha@example.com");
  assert.equal(String(db.clients[0].workspace), String(WS_A));
  assert.equal(String(so.customer), String(db.clients[0]._id));
  assert.equal(db.releases.length, 0); // no stock touched
  assert.equal(db.links[0].financials.total, 118000); // exact minor units
  assert.equal(db.links[0].financials.currency, "INR");
});

test("duplicate and out-of-order webhooks never create a second sales order", async () => {
  await run("orders/create", order());
  assert.equal(await run("orders/create", order()), "stale"); // same delivery replayed
  assert.equal(await run("orders/updated", order({ updated_at: "2026-09-30T00:00:00Z" })), "stale"); // older
  assert.equal(db.sos.length, 1);
  assert.equal(db.links.length, 1);
});

test("orders/updated arriving before orders/create imports once; the late create is stale", async () => {
  await run("orders/updated", order({ updated_at: "2026-10-01T11:00:00Z" }));
  assert.equal(await run("orders/create", order()), "stale");
  assert.equal(db.sos.length, 1);
});

test("unknown or missing SKU fails permanently with the list of SKUs; nothing is written", async () => {
  const bad = order({ line_items: [{ sku: "NOPE-1", quantity: 1, price: "1" }, { sku: "", quantity: 1, price: "1", title: "Gift wrap" }] });
  await assert.rejects(run("orders/create", bad), (err) => err.permanent && /NOPE-1/.test(err.message) && /Gift wrap/.test(err.message));
  assert.equal(db.sos.length + db.links.length + db.clients.length, 0);
});

test("SKU mapping never uses another workspace's products", async () => {
  const other = order({ line_items: [{ sku: "SECRET-B", quantity: 1, price: "1" }] });
  await assert.rejects(run("orders/create", other), (err) => err.permanent && /SECRET-B/.test(err.message));
});

test("customer matches an existing CRM client of the same workspace by email, not another tenant's", async () => {
  const mine = { _id: oid(), email: "asha@example.com", workspace: WS_A };
  db.clients.push({ _id: oid(), email: "asha@example.com", workspace: WS_B }, mine);
  await run("orders/create", order());
  assert.equal(db.clients.length, 2); // none created
  assert.equal(String(db.sos[0].customer), String(mine._id));
});

test("guest orders share one walk-in client per store", async () => {
  await run("orders/create", order({ customer: null }));
  await run("orders/create", order({ id: 1002, admin_graphql_api_id: "gid://shopify/Order/1002", customer: null }));
  assert.equal(db.clients.length, 1);
  assert.match(db.clients[0].companyName, /walk-in/);
  assert.equal(db.sos.length, 2);
});

test("Shopify edits update a DRAFT order; after approval they are flagged instead", async () => {
  await run("orders/create", order());
  await run("orders/updated", order({ updated_at: "2026-10-01T12:00:00Z", line_items: [{ sku: "MUG", quantity: 1, current_quantity: 3, price: "200" }] }));
  assert.deepEqual(db.sos[0].items.map((i) => i.qty), [3]);

  db.sos[0].status = "APPROVED";
  await run("orders/updated", order({ updated_at: "2026-10-01T13:00:00Z", line_items: [{ sku: "MUG", quantity: 1, current_quantity: 1, price: "200" }] }));
  assert.deepEqual(db.sos[0].items.map((i) => i.qty), [3]);
  assert.match(db.links[0].issues.join(), /changed in Shopify after SO-1001 was approved/);
});

test("cancellation reuses the ERP cancel rules (releases an approved reservation)", async () => {
  await run("orders/create", order());
  Object.assign(db.sos[0], { status: "APPROVED", warehouse: oid() });
  await run("orders/cancelled", order({ updated_at: "2026-10-02T00:00:00Z", cancelled_at: "2026-10-02T00:00:00Z" }));
  assert.equal(db.sos[0].status, "CANCELLED");
  assert.equal(String(db.sos[0].cancelledBy), String(ADMIN_A));
  assert.equal(db.releases.length, 2); // one release per item, via applyRelease
  assert.equal(db.links[0].status, "cancelled");
});

test("cancellation after ERP delivery is flagged, never forced", async () => {
  await run("orders/create", order());
  db.sos[0].status = "DELIVERED";
  await run("orders/cancelled", order({ updated_at: "2026-10-02T00:00:00Z", cancelled_at: "2026-10-02T00:00:00Z" }));
  assert.equal(db.sos[0].status, "DELIVERED");
  assert.match(db.links[0].issues.join(), /after SO-1001 was delivered/);
});

test("an order cancelled before import never gets a sales order, even when a failed create is retried", async () => {
  await run("orders/cancelled", order({ updated_at: "2026-10-02T00:00:00Z", cancelled_at: "2026-10-02T00:00:00Z" }));
  assert.equal(await run("orders/create", order()), "stale");
  assert.equal(db.sos.length, 0);
});

test("refunds are recorded once and do not touch the sales order", async () => {
  await run("orders/create", order());
  const refund = {
    id: 5, order_id: 1001, admin_graphql_api_id: "gid://shopify/Refund/5",
    transactions: [{ kind: "refund", status: "success", amount: "200.10", currency: "INR" }, { kind: "refund", status: "failure", amount: "999", currency: "INR" }],
    refund_line_items: [{ quantity: 1, restock_type: "return", line_item: { sku: "MUG" } }],
  };
  const handle = () => ctx.runWithWorkspace(WS_A, () => sync.handleRefundEvent(ev("refunds/create", refund), connA));
  assert.equal(await handle(), "recorded");
  assert.equal(await handle(), "duplicate");
  assert.equal(db.links[0].refunds.length, 1);
  assert.deepEqual(db.links[0].refunds[0].money, [{ currency: "INR", digits: 2, amountMinor: 20010 }]);
  assert.equal(db.links[0].refunds[0].restock, true);
  assert.match(db.links[0].issues.join(), /record the return in ERP/);
  assert.equal(db.sos[0].status, "DRAFT");
});

test("concurrent SO-number collision is retried with a fresh number", async () => {
  db.sos.push(new SalesOrder({ soNumber: "SO-1001", workspace: WS_A, customer: oid(), items: [{ product: oid(), qty: 1, price: 1 }], createdBy: ADMIN_A }).toObject());
  let calls = 0;
  const realFindOne = SalesOrder.findOne;
  // First lookup reports no previous order (simulates a concurrent import that committed SO-1001)
  SalesOrder.findOne = (f) => (f || calls++ ? realFindOne(f) : chain(null));
  await run("orders/create", order());
  assert.deepEqual(db.sos.map((s) => s.soNumber), ["SO-1001", "SO-1002"]);
});

test("handler refuses to run outside the connection's workspace", async () => {
  await assert.rejects(
    ctx.runWithWorkspace(WS_B, () => sync.handleOrderEvent(ev("orders/create", order()), connA)),
    (err) => err.permanent && /outside its workspace/.test(err.message)
  );
  assert.equal(db.sos.length, 0);
});

test("through the worker: transient failures retry, unmapped SKUs dead-letter", async () => {
  const events = [
    { _id: "e1", topic: "orders/create", payload: order(), workspace: WS_A, connection: "connA", shopDomain: "a.myshopify.com", status: "pending", attempts: 0, nextAttemptAt: new Date(0) },
    { _id: "e2", topic: "orders/create", payload: order({ id: 9, admin_graphql_api_id: "gid://shopify/Order/9", line_items: [{ sku: "NOPE", quantity: 1, price: "1" }] }), workspace: WS_A, connection: "connA", shopDomain: "a.myshopify.com", status: "pending", attempts: 0, nextAttemptAt: new Date(1) },
  ];
  stub(ShopifyConnection, "findOne", async () => connA);
  stub(ShopifyWebhookEvent, "findOneAndUpdate", async (f, u) => {
    const e = events.find((x) => f.topic.$in.includes(x.topic) && x.status === "pending" && x.nextAttemptAt <= f.$or[0].nextAttemptAt.$lte);
    if (!e) return null;
    Object.assign(e, u.$set);
    e.attempts += 1;
    return { ...e };
  });
  stub(ShopifyWebhookEvent, "updateOne", async (f, u) => (Object.assign(events.find((x) => x._id === f._id), u.$set), { modifiedCount: 1 }));
  for (const [t, fn] of Object.entries(sync.ORDER_HANDLERS)) worker.registerHandler(t, fn);

  // First attempt of e1 hits a transient database error
  const realCreate = SalesOrder.create;
  SalesOrder.create = async () => {
    SalesOrder.create = realCreate;
    throw new Error("connection reset");
  };
  assert.deepEqual(await worker.runWorkerOnce(), ["retry", "dead"]);
  assert.equal(events[0].status, "pending");
  assert.match(events[1].lastError, /NOPE/);
  assert.equal(events[1].status, "dead");

  events[0].nextAttemptAt = new Date(0);
  assert.deepEqual(await worker.runWorkerOnce(), ["processed"]);
  assert.equal(db.sos.length, 1);
});

test("existing cancel API behaves as before the extraction", async () => {
  const { cancelSalesOrder } = await import("../controllers/sales.controller.js");
  const call = async (status) => {
    const so = SalesOrder.hydrate({ _id: oid(), soNumber: "SO-9", status, workspace: WS_A, warehouse: oid(), items: [{ product: oid(), qty: 2, price: 1 }] });
    db.sos.push(so.toObject());
    stub(SalesOrder, "findById", () => ({ session: async () => so }));
    const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await ctx.runWithWorkspace(WS_A, () => cancelSalesOrder({ params: { id: so._id }, user: { _id: ADMIN_A } }, res));
    return { res, so };
  };
  const delivered = await call("DELIVERED");
  assert.equal(delivered.res.code, 400);
  assert.equal(delivered.res.body.message, "Delivered sales orders cannot be cancelled");

  const approved = await call("APPROVED");
  assert.equal(approved.res.code, 200);
  assert.equal(approved.so.status, "CANCELLED");
  assert.equal(String(approved.so.cancelledBy), String(ADMIN_A));
  assert.equal(db.releases.length, 1);
});
