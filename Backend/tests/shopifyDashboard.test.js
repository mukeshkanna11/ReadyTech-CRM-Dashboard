// Shopify Integration dashboard: event table, inventory preview, missing
// permissions. DB-free. Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  SHOPIFY_API_KEY: "k",
  SHOPIFY_API_SECRET: "s",
  SHOPIFY_API_VERSION: "2026-10",
  SHOPIFY_SCOPES: "read_products,read_orders,read_inventory,write_inventory,read_locations",
  SHOPIFY_OAUTH_REDIRECT_URI: "https://crm.test/cb",
  SHOPIFY_WEBHOOK_URL: "https://crm.test/webhooks",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
});
await import("../utils/workspaceScope.js");
const { encrypt } = await import("../services/shopify/crypto.js");
const { listEvents } = await import("../services/shopify/inbox.service.js");
const { inventoryPreview } = await import("../services/shopify/inventorySync.service.js");
const { missingScopes } = await import("../services/shopify/shopify.service.js");
const User = (await import("../models/User.js")).default;
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const ShopifyWebhookEvent = (await import("../models/ShopifyWebhookEvent.js")).default;
const ShopifyInventoryLink = (await import("../models/ShopifyInventoryLink.js")).default;
const ShopifyOrderLink = (await import("../models/ShopifyOrderLink.js")).default;
const Product = (await import("../models/Product.model.js")).default;
const Inventory = (await import("../models/Inventory.model.js")).default;
const StockLevel = (await import("../models/StockLevel.model.js")).default;
const shopifyRoutes = (await import("../routes/shopify.routes.js")).default;

const oid = () => new mongoose.Types.ObjectId();
const WS = oid();
const WH = oid();
const LOC = "gid://shopify/Location/2";
const P1 = oid();
const P2 = oid();

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const origFetch = globalThis.fetch;
afterEach(() => {
  while (restore.length) restore.pop()();
  globalThis.fetch = origFetch;
});
const chain = (value, calls = {}) => {
  const q = { then: (res, rej) => Promise.resolve(value).then(res, rej) };
  for (const m of ["select", "lean", "sort", "skip", "limit", "populate"]) q[m] = (a) => ((calls[m] = a), q);
  return q;
};

/* ---------------- event table ---------------- */
test("listEvents: workspace-scoped, filtered, paginated, never returns payloads", async () => {
  const seen = {};
  stub(ShopifyWebhookEvent, "find", (f, projection) => ((seen.filter = f), (seen.projection = projection), chain([{ topic: "orders/create" }], seen)));
  stub(ShopifyWebhookEvent, "countDocuments", async () => 101);

  const r = await listEvents(WS, { status: "dead", topic: "orders/create", page: "3", limit: "500" });

  assert.deepEqual(seen.filter, { workspace: WS, status: "dead", topic: "orders/create" });
  assert.doesNotMatch(seen.projection, /payload/);
  assert.equal(seen.limit, 50); // capped
  assert.equal(seen.skip, 100);
  assert.deepEqual(seen.sort, { createdAt: -1 });
  assert.equal(r.pages, 3);
  assert.equal(r.total, 101);
});

test("listEvents: unknown status / topic → 422 (no free-form query input)", async () => {
  await assert.rejects(listEvents(WS, { status: { $ne: null } }), (e) => e.status === 422);
  await assert.rejects(listEvents(WS, { topic: "customers/redact" }), (e) => e.status === 422);
});

/* ---------------- inventory preview ---------------- */
const conn = (inventory = { enabled: true, warehouse: WH, locationGid: LOC, locationName: "My Custom Location" }) => ({
  _id: oid(), workspace: WS, shopDomain: "a.myshopify.com", status: "active", inventory,
});

test("preview: not configured → nothing computed", async () => {
  stub(ShopifyInventoryLink, "find", async () => assert.fail("no lookup"));
  const r = await inventoryPreview(conn({ enabled: false, warehouse: null, locationGid: null }));
  assert.equal(r.configured, false);
  assert.deepEqual(r.items, []);
});

test("preview: per-SKU ERP available (on-hand − reserved − committed) and what Sync would push", async () => {
  const c = conn();
  stub(ShopifyInventoryLink, "find", async (f) => {
    assert.equal(String(f.workspace), String(WS));
    return [
      { _id: oid(), sku: "SNOW-MULTI-001", product: P1, lastPushedQty: 0, dirty: false, lastError: null }, // no ERP stock in this warehouse
      { _id: oid(), sku: "TEE-01", product: P2, lastPushedQty: 5, dirty: false, lastError: null },
      { _id: oid(), sku: "DUP", product: P2, lastPushedQty: null, dirty: true, lastError: null },
      { _id: oid(), sku: "DUP", product: P2, lastPushedQty: null, dirty: true, lastError: "Item not stocked at location" },
    ];
  });
  stub(Inventory, "aggregate", async (pipeline) => {
    assert.equal(String(pipeline[0].$match.warehouse), String(WH)); // only the mapped ERP warehouse
    return [{ _id: P2, onHand: 9 }];
  });
  stub(StockLevel, "find", async () => [{ product: P2, reserved: 2 }]);
  stub(ShopifyOrderLink, "find", async () => []);
  stub(ShopifyWebhookEvent, "find", async () => []);
  stub(Product, "find", async () => [{ _id: P1, name: "The Multi-location Snowboard" }, { _id: P2, name: "Tee" }]);
  globalThis.fetch = async () => assert.fail("preview must not call Shopify");

  const r = await inventoryPreview(c);

  assert.equal(r.locationName, "My Custom Location");
  assert.deepEqual(r.totals, { mapped: 4, willPush: 1, unchanged: 1, ambiguous: 2, failing: 1 });
  const snow = r.items.find((i) => i.sku === "SNOW-MULTI-001");
  assert.deepEqual(
    { onHand: snow.onHand, reserved: snow.reserved, committed: snow.committed, available: snow.available, willPush: snow.willPush, product: snow.product },
    { onHand: 0, reserved: 0, committed: 0, available: 0, willPush: false, product: "The Multi-location Snowboard" }
  );
  const tee = r.items.find((i) => i.sku === "TEE-01");
  assert.equal(tee.available, 7); // 9 − 2
  assert.equal(tee.willPush, true); // last pushed 5
});

/* ---------------- permissions ---------------- */
test("missingScopes: write_x covers read_x; reports what the grant lacks", () => {
  assert.deepEqual(missingScopes(["read_products", "write_inventory", "read_orders", "read_locations"]), []);
  assert.deepEqual(missingScopes(["read_products", "read_inventory"]), ["read_orders", "write_inventory", "read_locations"]);
});

/* ---------------- routes ---------------- */
let server, base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/shopify", shopifyRoutes);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/shopify`;
});
after(() => server.close());

const asUser = (role) => {
  const user = { _id: WS, role, workspace: role === "admin" ? null : WS, isActive: true };
  stub(User, "findById", () => ({ select: () => ({ lean: async () => user }) }));
  return { authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` };
};

test("GET /events and /inventory/preview are admin-only", async () => {
  const headers = asUser("employee");
  for (const path of ["/events", "/inventory/preview"]) {
    assert.equal((await origFetch(base + path, { headers })).status, 403);
  }
});

test("GET /events rejects an unknown status with 422", async () => {
  const headers = asUser("admin");
  const res = await origFetch(`${base}/events?status=bogus`, { headers });
  assert.equal(res.status, 422);
});

test("GET /inventory/preview: caller's workspace only, no writes, no secrets in the response", async () => {
  const headers = asUser("admin");
  const c = { ...conn({ enabled: true, warehouse: null, locationGid: null }), accessToken: encrypt("shpat_secret") };
  stub(ShopifyConnection, "findOne", (f) => {
    assert.equal(String(f.workspace), String(WS));
    return { select: async () => c };
  });
  for (const m of ["updateOne", "findOneAndUpdate"]) stub(ShopifyConnection, m, async () => assert.fail("no writes"));
  const res = await origFetch(`${base}/inventory/preview`, { headers });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.configured, false);
  assert.doesNotMatch(JSON.stringify(body), /shpat|accessToken/);
});

test("GET /status reports missing permissions for a connected store", async () => {
  const headers = asUser("admin");
  const doc = new ShopifyConnection({ workspace: WS, shopDomain: "a.myshopify.com", status: "active", scopes: ["read_products", "read_inventory"] });
  stub(ShopifyConnection, "findOne", () => chain(doc));
  stub(ShopifyWebhookEvent, "aggregate", async () => []);
  stub(ShopifyWebhookEvent, "find", () => chain([]));
  stub(ShopifyOrderLink, "find", () => chain([]));
  stub(ShopifyOrderLink, "countDocuments", async () => 0);
  stub(ShopifyInventoryLink, "find", () => chain([]));
  stub(ShopifyInventoryLink, "countDocuments", async () => 0);

  const res = await origFetch(`${base}/status`, { headers });
  const body = await res.json();
  assert.equal(res.status, 200, body.message);
  assert.deepEqual(body.data.connection.missingScopes, ["read_orders", "write_inventory", "read_locations"]);
});
