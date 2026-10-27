// services/shopify/financials.js — exact money mapping for Shopify orders.
// Amounts are kept as integers in the currency's minor unit (paise, cents;
// none for JPY, three digits for KWD …) parsed from Shopify's decimal
// strings, so nothing is lost to floating point and Shopify's own rounding is
// preserved. Figures are Shopify's, in the shop currency; nothing is recomputed.

/* Minor-unit digits of an ISO currency (2 when unknown) */
export const currencyDigits = (currency) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

/* "12.345" → integer minor units; extra digits round half away from zero */
export const toMinor = (value, digits) => {
  const s = String(value ?? "0").trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return 0;
  const [, sign, int, frac = ""] = m;
  let minor = Number(int) * 10 ** digits + Number((frac + "0".repeat(digits)).slice(0, digits) || 0);
  if (Number(frac[digits] || 0) >= 5) minor += 1;
  return sign ? -minor : minor;
};

const sum = (list, fn) => (list || []).reduce((acc, x) => acc + fn(x), 0);

/* Snapshot of what Shopify charged, for review / later invoicing */
export const orderFinancials = (order) => {
  const currency = order.currency || null;
  const digits = currencyDigits(currency);
  const m = (v) => toMinor(v, digits);

  const lineSubtotal = sum(order.line_items, (l) => m(l.price) * (Number(l.quantity) || 0));
  const lineDiscounts = sum(order.line_items, (l) => sum(l.discount_allocations, (a) => m(a.amount)));
  const shipping = sum(order.shipping_lines, (s) => m(s.price));
  const shippingDiscounts = sum(order.shipping_lines, (s) => sum(s.discount_allocations, (a) => m(a.amount)));

  // Group Shopify's tax lines (e.g. "CGST 9%", "SGST 9%", "IGST 18%")
  const taxes = new Map();
  for (const t of order.tax_lines || []) {
    const key = `${t.title}|${t.rate}`;
    const cur = taxes.get(key) || { title: t.title || "Tax", rate: Number(t.rate) || 0, amount: 0 };
    cur.amount += m(t.price);
    taxes.set(key, cur);
  }

  const f = {
    currency,
    digits,
    presentmentCurrency: order.presentment_currency && order.presentment_currency !== currency ? order.presentment_currency : null,
    taxesIncluded: Boolean(order.taxes_included),
    lineSubtotal,
    lineDiscounts,
    subtotal: m(order.subtotal_price), // after discounts, before shipping & tax
    totalDiscounts: m(order.total_discounts),
    discountCodes: (order.discount_codes || []).map((d) => d.code).filter(Boolean),
    shipping,
    shippingDiscounts,
    tax: m(order.total_tax),
    taxLines: [...taxes.values()],
    tips: m(order.total_tip_received),
    total: m(order.total_price),
    currentTotal: order.current_total_price != null ? m(order.current_total_price) : null,
    outstanding: order.total_outstanding != null ? m(order.total_outstanding) : null,
    financialStatus: order.financial_status || null,
    gateways: order.payment_gateway_names || [],
  };

  // Shown when Shopify's components do not add up to its total (e.g. duties)
  const expected = f.subtotal + f.shipping - f.shippingDiscounts + (f.taxesIncluded ? 0 : f.tax) + f.tips;
  f.unreconciled = expected - f.total;
  return f;
};

/* Refund money actually returned (successful refund transactions), per currency */
export const refundMoney = (refund) => {
  const byCurrency = new Map();
  for (const t of refund.transactions || []) {
    if (t.kind !== "refund" || t.status !== "success") continue;
    const currency = t.currency || null;
    const digits = currencyDigits(currency);
    byCurrency.set(currency, (byCurrency.get(currency) || 0) + toMinor(t.amount, digits));
  }
  return [...byCurrency].map(([currency, amountMinor]) => ({ currency, digits: currencyDigits(currency), amountMinor }));
};
