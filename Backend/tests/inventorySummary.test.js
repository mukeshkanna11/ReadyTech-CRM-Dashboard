// Focused, DB-free tests for GET /inventory/summary (mocked model calls).
// Run: node --test tests/
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

await import("../utils/workspaceScope.js");
const Inventory = (await import("../models/Inventory.model.js")).default;
const Product = (await import("../models/Product.model.js")).default;
const Warehouse = (await import("../models/Warehouse.model.js")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;
const { getStockSummary, transferStock, stockIn } = await import("../controllers/inventory.controller.js");

const oid = () => new mongoose.Types.ObjectId();

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
afterEach(() => {
  while (restore.length) restore.pop()();
});

const call = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler(req, res);
  return res;
};

const productDoc = (name) => ({ _id: oid(), name, sku: name.toUpperCase(), price: 100, lowStockLimit: 5 });
const row = (p, wh, onHand, reserved = 0) => ({
  product: { _id: p._id, name: p.name, sku: p.sku, price: p.price, lowStockLimit: p.lowStockLimit },
  warehouse: { _id: wh, name: `WH-${String(wh).slice(-4)}` },
  warehouseStatus: "assigned",
  inQty: onHand,
  outQty: 0,
  onHand,
  reserved,
  available: onHand - reserved,
});

const stubProducts = (list) =>
  stub(Product, "find", () => ({ sort: () => ({ lean: async () => list }) }));

test("default: ledger rows only, warehouse join is strict, no product lookup", async () => {
  const [a] = [productDoc("a")];
  let pipeline;
  stub(Inventory, "aggregate", async (p) => ((pipeline = p), [row(a, oid(), 4)]));
  stub(Product, "find", () => assert.fail("must not list products"));

  const res = await call(getStockSummary, { query: {} });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
  assert.ok(pipeline.some((s) => s.$unwind === "$warehouse"));
});

test("includeUnstocked: every registered product appears exactly once without invented stock", async () => {
  const products = ["a", "b", "c", "d"].map(productDoc);
  const [a, b] = products;
  const wh1 = oid();
  const wh2 = oid();
  let pipeline;
  // a is stocked in two warehouses, b in one; c and d have no ledger entries
  stub(Inventory, "aggregate", async (p) => (
    (pipeline = p), [row(a, wh1, 10, 2), row(a, wh2, 5), row(b, wh1, 0)]
  ));
  stubProducts(products);

  const res = await call(getStockSummary, { query: { includeUnstocked: "true" } });
  const data = res.body.data;

  assert.equal(res.statusCode, 200);
  assert.ok(pipeline.some((s) => s.$unwind?.preserveNullAndEmptyArrays === true));
  // 3 product-warehouse records + 2 unassigned placeholders
  assert.equal(data.length, 5);
  assert.equal(new Set(data.map((r) => String(r.product._id))).size, 4);
  assert.equal(data.filter((r) => String(r.product._id) === String(a._id)).length, 2);

  const placeholders = data.filter((r) => r.warehouseStatus === "unassigned");
  assert.deepEqual(placeholders.map((r) => r.product.name).sort(), ["c", "d"]);
  for (const r of placeholders) {
    assert.equal(r.warehouse, null);
    assert.equal(r.onHand, 0);
    assert.equal(r.reserved, 0);
    assert.equal(r.available, 0);
  }
});

test("includeUnstocked: product stocked only in a deleted warehouse is not duplicated", async () => {
  const p = productDoc("orphan");
  const missing = { ...row(p, oid(), 3), warehouse: { _id: oid(), name: null }, warehouseStatus: "missing" };
  stub(Inventory, "aggregate", async () => [missing]);
  stubProducts([p]);

  const res = await call(getStockSummary, { query: { includeUnstocked: "true" } });

  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].warehouseStatus, "missing");
  assert.equal(res.body.data[0].onHand, 3);
});

/* ---------------- movement / actions ---------------- */
const fakeSession = () =>
  stub(mongoose, "startSession", async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }));
const chain = (v) => ({ session: async () => v });

test("summary: exposes last movement per product-warehouse", async () => {
  let pipeline;
  stub(Inventory, "aggregate", async (p) => ((pipeline = p), []));
  await call(getStockSummary, { query: {} });
  assert.deepEqual(pipeline[0], { $sort: { createdAt: -1 } });
  const project = pipeline.find((s) => s.$project).$project;
  assert.deepEqual(project.lastTransaction, { type: "$lastType", qty: "$lastQty", date: "$lastAt" });
});

test("stock-in: createdBy is set from a lean auth user", async () => {
  fakeSession();
  const user = { _id: oid() };
  stub(Product, "findById", () => chain({ _id: oid() }));
  stub(Warehouse, "findById", () => chain({ _id: oid() }));
  let created;
  stub(Inventory, "create", async ([doc]) => ((created = doc), [doc]));
  const res = await call(stockIn, { body: { product: oid(), warehouse: oid(), quantity: 2 }, user });
  assert.equal(res.statusCode, 200);
  assert.equal(created.createdBy, user._id);
});

const transferReq = (qty) => ({
  body: { product: oid(), fromWarehouse: oid(), toWarehouse: oid(), quantity: qty },
  user: { _id: oid() },
});

test("transfer: drains a deleted source warehouse via two ledger legs", async () => {
  fakeSession();
  stub(Warehouse, "exists", (f) => chain(null)); // source deleted
  stub(Product, "exists", () => chain({ _id: oid() }));
  stub(Warehouse, "findById", () => chain({ _id: oid() })); // destination live
  stub(Inventory, "getAvailable", async () => 3);
  stub(AuditLog, "create", async () => []);
  let legs;
  stub(Inventory, "create", async (docs) => ((legs = docs), docs));

  const res = await call(transferStock, transferReq(3));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(legs.map((l) => [l.type, l.inQty, l.outQty]), [["TRANSFER_OUT", 0, 3], ["TRANSFER_IN", 3, 0]]);
});

test("transfer: cannot move more than the deleted warehouse holds", async () => {
  fakeSession();
  stub(Warehouse, "exists", () => chain(null));
  stub(Product, "exists", () => chain({ _id: oid() }));
  stub(Warehouse, "findById", () => chain({ _id: oid() }));
  stub(Inventory, "getAvailable", async () => 0); // e.g. other workspace's id → scoped ledger is empty
  stub(Inventory, "create", async () => assert.fail("must not write"));

  const res = await call(transferStock, transferReq(1));
  assert.equal(res.statusCode, 400);
});
