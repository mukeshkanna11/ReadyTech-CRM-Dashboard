/* Shopify → ReadyTech return, kept across a login.
   Shopify sends the browser to the public /shopify/return page (OAuth result,
   or the App URL launch from Shopify admin). If the user isn't signed in, the
   protected page bounces to /login and the URL is lost — so the few allowed
   params are kept in sessionStorage (this tab only) for the same 5 minutes
   the server keeps a completion valid, then replayed after login.
   Nothing here is a credential: finishing still needs the initiating admin's
   own login (POST /shopify/oauth/complete). */

const KEY = "shopifyReturn";
export const RETURN_TTL_MS = 5 * 60_000;

import { normalizeShopInput } from "./storeInput.js";

export { normalizeShopInput };

/* Only the params the Shopify page understands; anything else (hmac, host…) is dropped */
export const pickReturnParams = (search) => {
  const q = new URLSearchParams(search);
  const out = new URLSearchParams();
  const complete = q.get("complete");
  if (complete && /^[a-f0-9]{48}$/.test(complete)) out.set("complete", complete);
  const shop = normalizeShopInput(q.get("shop"));
  if (shop) out.set("shop", shop);
  const connected = q.get("connected");
  if (connected === "0" || connected === "1") out.set("connected", connected);
  const message = q.get("message");
  if (message && connected === "0") out.set("message", message.slice(0, 200));
  return out.toString();
};

const storage = () => (typeof sessionStorage === "undefined" ? null : sessionStorage);

export const saveShopifyReturn = (params, store = storage(), now = Date.now()) => {
  if (params) store?.setItem(KEY, JSON.stringify({ params, at: now }));
};

/* Fresh params, or "" (stale/invalid entries are removed) */
export const peekShopifyReturn = (store = storage(), now = Date.now()) => {
  try {
    const { params, at } = JSON.parse(store?.getItem(KEY) || "null") || {};
    if (typeof params === "string" && params && now - at >= 0 && now - at < RETURN_TTL_MS) return pickReturnParams(params);
  } catch {
    /* fall through */
  }
  store?.removeItem(KEY);
  return "";
};

export const clearShopifyReturn = (store = storage()) => store?.removeItem(KEY);

/* "Connect Shopify" intent: set when this admin clicks Connect here, so the
   Shopify install link's return (?shop=…) may start OAuth automatically.
   Without a fresh intent (e.g. the app was opened from Shopify admin) the page
   asks the admin to confirm instead. Single use; same 10 minutes as the OAuth state. */
const INTENT_KEY = "shopifyConnectIntent";
export const INTENT_TTL_MS = 10 * 60_000;

export const markConnectIntent = (store = storage(), now = Date.now()) => store?.setItem(INTENT_KEY, String(now));

export const takeConnectIntent = (store = storage(), now = Date.now()) => {
  const at = Number(store?.getItem(INTENT_KEY));
  store?.removeItem(INTENT_KEY);
  return Number.isFinite(at) && at > 0 && now - at >= 0 && now - at < INTENT_TTL_MS;
};
