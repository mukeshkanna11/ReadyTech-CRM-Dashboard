// Pure UI logic for the Shopify page. Run: node --test src/components/shopify/
import { test } from "node:test";
import assert from "node:assert/strict";
import { locationState, rowStatus } from "./format.js";

const LOC = "gid://shopify/Location/2";

test("location: matched by id, so a renamed location keeps its mapping", () => {
  const list = [{ id: "gid://shopify/Location/1", name: "Shop location" }, { id: LOC, name: "Hindusthan Store" }];
  assert.deepEqual(locationState(LOC, "My Custom Location", list), { status: "renamed", name: "Hindusthan Store" });
  assert.deepEqual(locationState(LOC, "Hindusthan Store", list), { status: "ok", name: "Hindusthan Store" });
});

test("location: a saved id Shopify no longer lists is inactive (sync must be blocked)", () => {
  assert.deepEqual(locationState(LOC, "My Custom Location", [{ id: "gid://shopify/Location/1", name: "My Custom Location" }]), {
    status: "inactive",
    name: "My Custom Location",
  });
  assert.equal(locationState(null, null, []).status, "unset");
});

test("row status precedence matches the preview totals", () => {
  assert.equal(rowStatus({ ambiguous: true, lastError: "x", willPush: true })[1], "Duplicate SKU");
  assert.equal(rowStatus({ lastError: "x", willPush: true })[1], "Failing");
  assert.equal(rowStatus({ willPush: true })[1], "Will update");
  assert.equal(rowStatus({})[1], "Up to date");
});
