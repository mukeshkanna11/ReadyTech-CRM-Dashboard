/* Product / order / inventory sync status, derived ONLY from GET /shopify/status
   (connection.webhooks, connection.inventory, inventory summary, orders summary,
   inbox counts). Nothing here is estimated. */
import { ago } from "./format.js";

const TOPICS = {
  products: ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE"],
  orders: ["ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED"],
};

const missingTopics = (conn, key) => TOPICS[key].filter((t) => !(conn?.webhooks?.registered || []).includes(t));

/* Registered webhooks only mean Shopify CAN send updates — never shown as success.
   Green requires evidence: matched SKUs, a received order, a recent clean sync. */
const STALE_MS = 15 * 60_000; // worker runs every 5 minutes

export const productSync = (conn, inventory) => {
  if (conn?.status !== "active") return { tone: "slate", label: "Not connected", detail: "Connect the store to match products." };
  const mapped = inventory?.mapped ?? 0;
  if (missingTopics(conn, "products").length) {
    return { tone: "amber", label: "Updates paused", detail: "Shopify isn't sending product changes. Re-register webhooks in Sync history." };
  }
  return mapped
    ? { tone: "green", label: `${mapped} matched`, detail: `${mapped} Shopify variant(s) matched to ERP products by SKU` }
    : { tone: "slate", label: "No matches yet", detail: "No Shopify SKU matches an ERP product yet. Use the same SKUs, then Sync now." };
};

export const orderSync = (conn, orders) => {
  if (conn?.status !== "active") return { tone: "slate", label: "Not connected", detail: "Connect the store to import orders." };
  if (missingTopics(conn, "orders").length) {
    return { tone: "amber", label: "Updates paused", detail: "Shopify isn't sending order updates. Re-register webhooks in Sync history." };
  }
  const last = orders?.recent?.[0];
  const attention = orders?.needsAttention || 0;
  if (attention) return { tone: "amber", label: `${attention} need attention`, detail: "Open the orders below to see what needs a person." };
  if (!last) return { tone: "slate", label: "No orders yet", detail: "Waiting for the first Shopify order." };
  return { tone: "green", label: "Receiving", detail: `Last order ${last.orderName ? `${last.orderName} ` : ""}updated ${ago(last.updatedAt)}` };
};

export const inventorySync = (conn, inventory, now = Date.now()) => {
  const inv = conn?.inventory || {};
  if (conn?.status !== "active") return { tone: "slate", label: "Not connected", detail: "Connect the store to push ERP stock." };
  if (!inv.enabled) return { tone: "slate", label: "Off", detail: "Choose a warehouse and location below to push ERP stock." };
  if (inv.lastError) return { tone: "red", label: "Failing", detail: inv.lastError };
  if (!inv.lastSyncAt) return { tone: "blue", label: "Not run yet", detail: "First sync runs within 5 minutes, or use Sync now." };
  const failing = Math.max(inventory?.failing?.length || 0, inv.lastResult?.failed || 0);
  if (failing) return { tone: "amber", label: `${failing} SKU(s) failing`, detail: `Last sync ${ago(inv.lastSyncAt)} — see Inventory sync for details.` };
  if (now - new Date(inv.lastSyncAt).getTime() > STALE_MS) {
    return { tone: "amber", label: "Sync overdue", detail: `Last sync ${ago(inv.lastSyncAt)} — expected every 5 minutes. Try Sync now.` };
  }
  return { tone: "green", label: "Synced", detail: `Last sync ${ago(inv.lastSyncAt)} · every 5 minutes` };
};

/* Plain-language meaning of each Shopify permission (shown for the granted scopes) */
export const SCOPE_HELP = {
  read_products: "See products and SKUs, to match them with your ERP products",
  read_orders: "Read new and updated orders, to create draft ERP sales orders",
  read_inventory: "See stock levels, to detect changes made in Shopify",
  write_inventory: "Set available stock at the one location you choose, from your ERP",
  read_locations: "List your store locations, so you can pick where stock is updated",
  read_fulfillments: "Know when orders ship, to keep ERP deliveries in step",
  write_fulfillments: "Fulfilment access (ReadyTech only reads fulfilments)",
};
export const scopeHelp = (scope) => SCOPE_HELP[scope] || "Additional access requested by the ReadyTech app";
