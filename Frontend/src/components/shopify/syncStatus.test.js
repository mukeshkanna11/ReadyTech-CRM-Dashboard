// Product / order / inventory status derived from GET /shopify/status. Run: node --test src/components/shopify/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { inventorySync, orderSync, productSync, scopeHelp } from "./syncStatus.js";

const ALL = ["APP_UNINSTALLED", "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED", "PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE", "INVENTORY_LEVELS_UPDATE"];
const conn = (over = {}) => ({ status: "active", webhooks: { registered: ALL }, inventory: {}, ...over });

test("not connected → every area says so", () => {
  for (const f of [productSync, orderSync, inventorySync]) assert.equal(f(conn({ status: "disconnected" }), {}).label, "Not connected");
});

test("registered webhooks alone are never shown as a successful sync", () => {
  const fresh = conn(); // every topic registered, nothing received / matched / run yet
  for (const [name, st] of [["products", productSync(fresh, { mapped: 0 })], ["orders", orderSync(fresh, { recent: [], needsAttention: 0 })], ["inventory", inventorySync(conn({ inventory: { enabled: true } }), {})]]) {
    assert.notEqual(st.tone, "green", name);
  }
});

test("product sync: green only with real SKU matches; paused when webhooks are missing", () => {
  assert.deepEqual([productSync(conn(), { mapped: 12 }).tone, productSync(conn(), { mapped: 12 }).label], ["green", "12 matched"]);
  assert.equal(productSync(conn(), { mapped: 0 }).label, "No matches yet");
  assert.equal(productSync(conn({ webhooks: { registered: ["ORDERS_CREATE"] } }), { mapped: 3 }).label, "Updates paused");
});

test("order sync: green only after an order was received; attention wins", () => {
  const recent = [{ orderName: "#1002", updatedAt: new Date() }];
  assert.deepEqual([orderSync(conn(), { recent, needsAttention: 0 }).tone, orderSync(conn(), { recent, needsAttention: 0 }).label], ["green", "Receiving"]);
  assert.match(orderSync(conn(), { recent, needsAttention: 0 }).detail, /#1002/);
  assert.equal(orderSync(conn(), { recent, needsAttention: 2 }).label, "2 need attention");
  assert.equal(orderSync(conn(), { recent: [], needsAttention: 0 }).label, "No orders yet");
  assert.equal(orderSync(conn({ webhooks: { registered: [] } }), {}).tone, "amber");
});

test("inventory sync: off, not run, failing, partial failures, overdue, synced", () => {
  const now = Date.now();
  const at = (minAgo, extra = {}) => conn({ inventory: { enabled: true, lastSyncAt: new Date(now - minAgo * 60_000), ...extra } });
  assert.equal(inventorySync(conn(), {}).label, "Off");
  assert.equal(inventorySync(conn({ inventory: { enabled: true } }), {}).label, "Not run yet");
  assert.equal(inventorySync(conn({ inventory: { enabled: true, lastError: "boom" } }), {}).detail, "boom");
  assert.equal(inventorySync(at(2), { failing: [{ sku: "A" }] }, now).label, "1 SKU(s) failing");
  assert.equal(inventorySync(at(2, { lastResult: { pushed: 3, failed: 2 } }), { failing: [] }, now).label, "2 SKU(s) failing");
  assert.equal(inventorySync(at(40), { failing: [] }, now).label, "Sync overdue");
  assert.deepEqual([inventorySync(at(2), { failing: [] }, now).tone, inventorySync(at(2), { failing: [] }, now).label], ["green", "Synced"]);
});

test("every scope the backend requests has a plain-language explanation", () => {
  for (const s of ["read_products", "read_orders", "read_inventory", "write_inventory", "read_locations", "read_fulfillments"]) {
    assert.doesNotMatch(scopeHelp(s), /Additional access/, s);
  }
  assert.match(scopeHelp("read_unknown"), /Additional access/);
});
