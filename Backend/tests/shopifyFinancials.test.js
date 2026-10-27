// Focused tests for exact Shopify money mapping (Phase 5).
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinor, currencyDigits, orderFinancials, refundMoney } from "../services/shopify/financials.js";

test("decimal strings convert to exact integer minor units per currency", () => {
  assert.equal(toMinor("0.10", 2) + toMinor("0.20", 2), 30); // no 0.30000000000000004
  assert.equal(toMinor("19.99", 2) * 3, 5997);
  assert.equal(toMinor("1180", 2), 118000);
  assert.equal(toMinor("-5.5", 2), -550);
  assert.equal(toMinor("1.005", 2), 101); // extra digit rounds half up
  assert.equal(toMinor("abc", 2), 0);
  assert.equal(currencyDigits("INR"), 2);
  assert.equal(currencyDigits("JPY"), 0);
  assert.equal(currencyDigits("KWD"), 3);
  assert.equal(toMinor("1500", currencyDigits("JPY")), 1500);
  assert.equal(toMinor("1.234", currencyDigits("KWD")), 1234);
});

const order = (over = {}) => ({
  currency: "INR",
  taxes_included: false,
  line_items: [
    { price: "400.00", quantity: 2, discount_allocations: [{ amount: "80.00" }] },
    { price: "200.00", quantity: 1, discount_allocations: [] },
  ],
  subtotal_price: "920.00",
  total_discounts: "80.00",
  discount_codes: [{ code: "DIWALI10" }],
  shipping_lines: [{ price: "50.00", discount_allocations: [] }],
  tax_lines: [
    { title: "CGST", rate: 0.09, price: "82.80" },
    { title: "SGST", rate: 0.09, price: "82.80" },
    { title: "CGST", rate: 0.09, price: "4.50" }, // shipping CGST, grouped
  ],
  total_tax: "170.10",
  total_price: "1140.10",
  financial_status: "paid",
  payment_gateway_names: ["razorpay"],
  total_outstanding: "0.00",
  ...over,
});

test("order snapshot keeps Shopify's discounts, shipping, taxes and payment exactly", () => {
  const f = orderFinancials(order());
  assert.equal(f.lineSubtotal, 100000);
  assert.equal(f.lineDiscounts, 8000);
  assert.equal(f.subtotal, 92000);
  assert.equal(f.totalDiscounts, 8000);
  assert.deepEqual(f.discountCodes, ["DIWALI10"]);
  assert.equal(f.shipping, 5000);
  assert.equal(f.tax, 17010);
  assert.deepEqual(f.taxLines, [
    { title: "CGST", rate: 0.09, amount: 8730 },
    { title: "SGST", rate: 0.09, amount: 8280 },
  ]);
  assert.equal(f.total, 114010);
  assert.equal(f.unreconciled, 0);
  assert.equal(f.outstanding, 0);
  assert.deepEqual(f.gateways, ["razorpay"]);
});

test("tax-inclusive prices are not added to the total again", () => {
  const f = orderFinancials(order({ taxes_included: true, total_price: "970.00", total_tax: "147.97", tax_lines: [] }));
  assert.equal(f.taxesIncluded, true);
  assert.equal(f.unreconciled, 0);
});

test("components that don't add up are reported, not hidden", () => {
  const f = orderFinancials(order({ total_price: "1150.10" })); // e.g. duties not modelled
  assert.equal(f.unreconciled, -1000);
});

test("refund money counts only successful refund transactions, per currency", () => {
  const money = refundMoney({
    transactions: [
      { kind: "refund", status: "success", amount: "100.05", currency: "INR" },
      { kind: "refund", status: "success", amount: "0.10", currency: "INR" },
      { kind: "refund", status: "failure", amount: "999", currency: "INR" },
      { kind: "sale", status: "success", amount: "5", currency: "INR" },
      { kind: "refund", status: "success", amount: "3", currency: "USD" },
    ],
  });
  assert.deepEqual(money, [
    { currency: "INR", digits: 2, amountMinor: 10015 },
    { currency: "USD", digits: 2, amountMinor: 300 },
  ]);
});
