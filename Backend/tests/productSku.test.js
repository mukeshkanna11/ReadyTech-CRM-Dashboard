// Focused, DB-free tests for product SKU create / edit.
// Run: node --test tests/
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

await import("../utils/workspaceScope.js");
const Product = (await import("../models/Product.js")).default;
const { createProduct, updateProduct } = await import("../controllers/products.controller.js");

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

/* ---------------- create ---------------- */
test("create: blank SKU is auto generated", async () => {
  stub(Product, "findOne", async () => null);
  let created;
  stub(Product, "create", async (doc) => (created = doc, new Product(doc)));

  const res = await call(createProduct, { body: { name: "Phone", price: 10, sku: "  " } });

  assert.equal(res.statusCode, 201);
  assert.equal("sku" in created, false);
  assert.match(res.body.data.sku, /^SKU-[A-Z0-9]+$/);
});

test("create: manual SKU is trimmed and kept", async () => {
  stub(Product, "findOne", async () => null);
  stub(Product, "create", async (doc) => new Product(doc));

  const res = await call(createProduct, { body: { name: "Phone", price: 10, sku: " ABC-1 " } });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.sku, "ABC-1");
});

test("create: duplicate SKU is rejected with 409", async () => {
  stub(Product, "findOne", async (f) => (f.sku === "ABC-1" ? { _id: oid() } : null));
  stub(Product, "create", async () => assert.fail("must not create"));

  const res = await call(createProduct, { body: { name: "Phone", price: 10, sku: "ABC-1" } });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, "SKU already exists");
});

/* ---------------- update ---------------- */
test("update: SKU is saved and returned; barcode is never sent", async () => {
  const id = String(oid());
  let lookup, update;
  stub(Product, "findOne", async (f) => ((lookup = f), null));
  stub(Product, "findByIdAndUpdate", async (_id, body) => {
    update = body;
    return { _id, sku: body.sku, barcode: "RTS12345678001" };
  });

  const res = await call(updateProduct, {
    params: { id },
    body: { name: "Phone", sku: " NEW-SKU ", barcode: "HACKED" },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(lookup, { sku: "NEW-SKU", _id: { $ne: id } });
  assert.equal(update.sku, "NEW-SKU");
  assert.equal("barcode" in update, false);
  assert.equal(res.body.data.sku, "NEW-SKU");
  assert.equal(res.body.data.barcode, "RTS12345678001");
});

test("update: SKU used by another product is rejected with 409", async () => {
  stub(Product, "findOne", async () => ({ _id: oid() }));
  stub(Product, "findByIdAndUpdate", async () => assert.fail("must not update"));

  const res = await call(updateProduct, { params: { id: String(oid()) }, body: { sku: "TAKEN" } });

  assert.equal(res.statusCode, 409);
});

test("update: blank SKU is rejected, never regenerated", async () => {
  stub(Product, "findByIdAndUpdate", async () => assert.fail("must not update"));

  const res = await call(updateProduct, { params: { id: String(oid()) }, body: { sku: "   " } });

  assert.equal(res.statusCode, 400);
});

test("update: omitting SKU leaves it untouched", async () => {
  let update;
  stub(Product, "findOne", async () => assert.fail("no SKU lookup needed"));
  stub(Product, "findByIdAndUpdate", async (_id, body) => ((update = body), { _id }));

  const res = await call(updateProduct, { params: { id: String(oid()) }, body: { name: "Renamed" } });

  assert.equal(res.statusCode, 200);
  assert.equal("sku" in update, false);
});

test("update: unique-index race maps to 409", async () => {
  stub(Product, "findOne", async () => null);
  stub(Product, "findByIdAndUpdate", async () => {
    throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { workspace: 1, sku: 1 } });
  });

  const res = await call(updateProduct, { params: { id: String(oid()) }, body: { sku: "RACE" } });

  assert.equal(res.statusCode, 409);
});
