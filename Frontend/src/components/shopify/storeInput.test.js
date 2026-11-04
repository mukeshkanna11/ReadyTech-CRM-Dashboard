// Store address parsing. Run: node --test src/components/shopify/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShopInput, validateShopInput } from "./storeInput.js";

test("accepts handles, domains, full store URLs and Shopify admin URLs", () => {
  for (const input of [
    "acme",
    " Acme.myshopify.com ",
    "https://acme.myshopify.com",
    "https://acme.myshopify.com/admin/products?x=1",
    "http://www.acme.myshopify.com/",
    "https://admin.shopify.com/store/acme",
    "admin.shopify.com/store/acme/orders/123",
  ]) assert.equal(normalizeShopInput(input), "acme.myshopify.com", input);
});

test("rejects anything that isn't a myshopify.com store", () => {
  for (const input of ["", "acme.com", "acme.myshopify.com.evil.com", "-acme", "ac me", "https://admin.shopify.com/", "admin.shopify.com/store/"]) {
    assert.equal(normalizeShopInput(input), null, input);
  }
});

test("inline validation: quiet when empty, specific hint for a public domain", () => {
  assert.deepEqual(validateShopInput(""), { shop: null, error: null });
  assert.deepEqual(validateShopInput("acme"), { shop: "acme.myshopify.com", error: null });
  assert.match(validateShopInput("www.acme-shop.com").error, /public website domain.*Settings → Domains/);
  assert.match(validateShopInput("ac me!").error, /valid Shopify store address/);
});
