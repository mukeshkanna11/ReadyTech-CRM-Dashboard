// Regression: SKU edit from the product drawer must persist and come back
// in the PUT /api/products/:id response. Exercises the real router, auth
// and role middleware with the exact payload shape the edit form sends.
// DB-free. Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

process.env.JWT_SECRET = "test-jwt";
await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const User = (await import("../models/User.js")).default;
const Product = (await import("../models/Product.js")).default;
const auth = (await import("../middlewares/auth.js")).default;
const productsRoutes = (await import("../routes/products.routes.js")).default;

const oid = () => String(new mongoose.Types.ObjectId());
const ADMIN = oid();
const PRODUCT = oid();
const BARCODE = "RTS12345678042";

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
afterEach(() => {
  while (restore.length) restore.pop()();
});

let server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/products", auth, productsRoutes); // same mount as app.js
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/products`;
});
after(() => server.close());

const asUser = (user) => {
  stub(User, "findById", () => ({ select: () => ({ lean: async () => user }) }));
  return { Authorization: `Bearer ${jwt.sign({ id: user._id }, process.env.JWT_SECRET)}` };
};

// What the drawer holds after setForm(p) on "Edit", with the SKU changed
const editPayload = {
  _id: PRODUCT,
  name: "The Multi-location Snowboard",
  sku: "SNOW-MULTI-001",
  category: "Snowboards",
  price: 729.95,
  stockQuantity: 12,
  status: "Active",
  workspace: ADMIN,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  __v: 0,
  stock: 0,
  tax: 0,
};

test("PUT /api/products/:id persists the edited SKU and returns it; barcode untouched", async () => {
  const headers = asUser({ _id: ADMIN, role: "admin", workspace: null, isActive: true });
  const stored = { _id: PRODUCT, sku: "SKU-WYUCJF6M", barcode: BARCODE, stockQuantity: 12 };
  let lookupWorkspace;
  stub(Product, "findOne", async (f) => {
    lookupWorkspace = String(ctx.getWorkspaceId());
    return f.sku === stored.sku && String(f._id.$ne) !== PRODUCT ? stored : null;
  });
  stub(Product, "findByIdAndUpdate", async (id, update) => {
    assert.equal(String(ctx.getWorkspaceId()), ADMIN); // request is workspace-bound
    assert.equal(id, PRODUCT);
    assert.equal("barcode" in update, false);
    Object.assign(stored, update);
    return stored;
  });

  const res = await fetch(`${base}/${PRODUCT}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...editPayload, barcode: "SHOULD-NOT-APPLY" }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.data.sku, "SNOW-MULTI-001");
  assert.equal(body.data.barcode, BARCODE);
  assert.equal(body.data.stockQuantity, 12);
  assert.equal(lookupWorkspace, ADMIN);
});

test("PUT /api/products/:id rejects a SKU used by another product in the workspace", async () => {
  const headers = asUser({ _id: ADMIN, role: "admin", workspace: null, isActive: true });
  stub(Product, "findOne", async () => ({ _id: oid(), sku: "SNOW-MULTI-001" }));
  stub(Product, "findByIdAndUpdate", async () => assert.fail("must not update"));

  const res = await fetch(`${base}/${PRODUCT}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(editPayload),
  });

  assert.equal(res.status, 409);
  assert.equal((await res.json()).message, "SKU already exists");
});

test("PUT /api/products/:id stays admin-only", async () => {
  const headers = asUser({ _id: oid(), role: "employee", workspace: ADMIN, isActive: true });
  stub(Product, "findByIdAndUpdate", async () => assert.fail("must not update"));

  const res = await fetch(`${base}/${PRODUCT}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(editPayload),
  });

  assert.equal(res.status, 403);
});
