// Shopify return kept across a login. Run: node --test src/components/shopify/
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShopInput, pickReturnParams, saveShopifyReturn, peekShopifyReturn, clearShopifyReturn, RETURN_TTL_MS, markConnectIntent, takeConnectIntent, INTENT_TTL_MS } from "./shopifyReturn.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const ID = "a".repeat(48);

test("shop input: same rule as the backend (myshopify.com only)", () => {
  assert.equal(normalizeShopInput(" Acme "), "acme.myshopify.com");
  assert.equal(normalizeShopInput("https://acme.myshopify.com/admin"), "acme.myshopify.com");
  assert.equal(normalizeShopInput("shop.acme.com"), null);
  assert.equal(normalizeShopInput("acme.myshopify.com.evil.com"), null);
  assert.equal(normalizeShopInput(""), null);
});

test("only known params survive (Shopify launch hmac/host dropped, bad ids and shops rejected)", () => {
  assert.equal(pickReturnParams(`?complete=${ID}&shop=acme.myshopify.com&hmac=x&host=y`), `complete=${ID}&shop=acme.myshopify.com`);
  assert.equal(pickReturnParams("?complete=nothex&shop=evil.com"), "");
  assert.equal(pickReturnParams("?connected=0&message=Cancelled"), "connected=0&message=Cancelled");
  assert.equal(pickReturnParams("?connected=1&message=spoof"), "connected=1");
});

test("kept for 5 minutes in this tab, then discarded", () => {
  const store = memory();
  saveShopifyReturn(`complete=${ID}`, store, 1000);
  assert.equal(peekShopifyReturn(store, 1000 + RETURN_TTL_MS - 1), `complete=${ID}`);
  assert.equal(peekShopifyReturn(store, 1000 + RETURN_TTL_MS), "");
  assert.equal(store.getItem("shopifyReturn"), null);

  saveShopifyReturn(`complete=${ID}`, store, 1000);
  clearShopifyReturn(store);
  assert.equal(peekShopifyReturn(store, 1000), "");

  store.setItem("shopifyReturn", "{broken");
  assert.equal(peekShopifyReturn(store, 1000), "");
  saveShopifyReturn("", store, 1000); // nothing to keep
  assert.equal(store.getItem("shopifyReturn"), null);
});

test("connect intent: only a fresh click here auto-continues, and only once", () => {
  const store = memory();
  assert.equal(takeConnectIntent(store, 1000), false); // opened from Shopify admin: no intent
  markConnectIntent(store, 1000);
  assert.equal(takeConnectIntent(store, 1000 + INTENT_TTL_MS - 1), true);
  assert.equal(takeConnectIntent(store, 1000 + 1), false); // single use
  markConnectIntent(store, 1000);
  assert.equal(takeConnectIntent(store, 1000 + INTENT_TTL_MS), false); // expired
  store.setItem("shopifyConnectIntent", "junk");
  assert.equal(takeConnectIntent(store, 1000), false);
});
