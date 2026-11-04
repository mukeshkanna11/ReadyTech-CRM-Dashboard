/* Store address input → canonical "<handle>.myshopify.com" (same final rule as
   the backend normalizeShop, which validates again). Accepts what merchants
   usually paste: the handle, the myshopify.com domain, any URL on it, or the
   Shopify admin URL (admin.shopify.com/store/<handle>/…). */
const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const ADMIN_RE = /^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)(?:[/?#]|$)/;

const clean = (input) => String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");

export const normalizeShopInput = (input) => {
  const raw = clean(input);
  const admin = raw.match(ADMIN_RE);
  let s = admin ? `${admin[1]}.myshopify.com` : raw.replace(/[/?#].*$/, "");
  if (s && !s.includes(".")) s = `${s}.myshopify.com`;
  return SHOP_RE.test(s) ? s : null;
};

/* { shop, error } for inline feedback; error is null while the field is empty */
export const validateShopInput = (input) => {
  const shop = normalizeShopInput(input);
  if (shop) return { shop, error: null };
  const raw = clean(input);
  if (!raw) return { shop: null, error: null };
  const host = raw.replace(/[/?#].*$/, "");
  if (host.includes(".") && !host.endsWith(".myshopify.com") && host !== "admin.shopify.com") {
    return { shop: null, error: "That looks like your public website domain. Use the store's myshopify.com address instead — find it in Shopify admin → Settings → Domains." };
  }
  return { shop: null, error: "Enter a valid Shopify store address, e.g. your-store.myshopify.com (letters, numbers and hyphens only)." };
};
