import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ShoppingCart, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import API from "../../services/api";

/* =========================================================
   SHOPIFY INTEGRATION — this workspace's own Shopify store
   (OAuth). Each workspace connects and manages its store
   independently.
========================================================= */
const isAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";
  } catch {
    return false;
  }
};

const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

/* Integer minor units → "1180.00 INR" (exact, currency's own decimals) */
const money = (minor, digits = 2, currency = "") => {
  const neg = minor < 0;
  const abs = String(Math.abs(minor)).padStart(digits + 1, "0");
  const value = digits ? `${abs.slice(0, -digits)}.${abs.slice(-digits)}` : abs;
  return `${neg ? "-" : ""}${value} ${currency || ""}`.trim();
};

const STATUS = {
  active: ["bg-emerald-50 text-emerald-700 ring-emerald-200", "Connected"],
  error: ["bg-amber-50 text-amber-700 ring-amber-200", "Reconnect required"],
  uninstalled: ["bg-slate-50 text-slate-600 ring-slate-200", "App uninstalled in Shopify"],
  disconnected: ["bg-slate-50 text-slate-600 ring-slate-200", "Not connected"],
};

export default function ShopifyIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
  const [shop, setShop] = useState("");
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }
  const admin = isAdmin();

  const load = useCallback(() => {
    setState("loading");
    API.get("/shopify/status")
      .then((res) => {
        setData(res.data?.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);

  /* Result of the OAuth redirect, or a launch from Shopify admin (?shop=) */
  useEffect(() => {
    const connected = searchParams.get("connected");
    const launchShop = searchParams.get("shop");
    if (!connected && !launchShop) return;
    if (connected === "1") {
      toast.success("Shopify store connected");
      setBanner({ type: "success", text: `${launchShop || "Your store"} is connected to this workspace.` });
    } else if (connected === "0") {
      setBanner({ type: "error", text: searchParams.get("message") || "We couldn't connect your Shopify store. Please try again." });
    } else {
      setShop(launchShop);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setBanner(null);
    try {
      await fn();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.message || "Something went wrong. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  /* Shopify OAuth for a store address; the platform app credentials stay on the server */
  const startOAuth = (key, shopDomain) =>
    run(key, async () => {
      const res = await API.get("/shopify/oauth/url", { params: { shop: shopDomain } });
      window.location.href = res.data.data.url;
    });

  const connect = (e) => {
    e.preventDefault();
    startOAuth("connect", shop.trim());
  };

  const conn = data?.connection;
  const active = conn?.status === "active";

  const disconnect = () => {
    if (!window.confirm(`Disconnect ${conn.shopDomain}? The ReadyTech app will be removed from this Shopify store.`)) return;
    run("disconnect", async () => {
      await API.post("/shopify/disconnect");
      toast.success("Shopify store disconnected");
      load();
    });
  };

  const registerWebhooks = () =>
    run("webhooks", async () => {
      const res = await API.post("/shopify/webhooks/register");
      toast.success(res.data?.message || "Webhooks registered");
      load();
    });

  const retryEvent = (id) =>
    run(`retry-${id}`, async () => {
      await API.post(`/shopify/events/${id}/retry`);
      toast.success("Event queued for retry");
      load();
    });

  const [inv, setInv] = useState(null); // { warehouses, locations, enabled, warehouse, locationGid }

  /* Inventory sync options — admins of a connected store */
  useEffect(() => {
    if (!admin || conn?.status !== "active") return;
    Promise.all([API.get("/warehouses"), API.get("/shopify/inventory/locations")])
      .then(([w, l]) =>
        setInv({
          warehouses: w.data?.warehouses || [],
          locations: l.data?.data || [],
          enabled: !!conn.inventory?.enabled,
          warehouse: conn.inventory?.warehouse || "",
          locationGid: conn.inventory?.locationGid || "",
        })
      )
      .catch(() => setInv(null));
  }, [admin, conn?.status, conn?.inventory?.enabled, conn?.inventory?.warehouse, conn?.inventory?.locationGid]);

  const saveInventory = (e) => {
    e.preventDefault();
    run("inventory", async () => {
      const res = await API.put("/shopify/inventory/settings", { enabled: inv.enabled, warehouse: inv.warehouse || null, locationGid: inv.locationGid || null });
      toast.success(res.data?.message || "Saved");
      load();
    });
  };

  const syncInventory = () =>
    run("sync", async () => {
      const res = await API.post("/shopify/inventory/sync");
      toast.success(res.data?.message || "Inventory synced");
      load();
    });

  const inventory = data?.inventory;
  const inbox = data?.inbox;
  const orders = data?.orders;
  const [pillCls, pillLabel] = STATUS[conn?.status] || STATUS.disconnected;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-start gap-4">
          <div className="grid w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 place-items-center shrink-0">
            <ShoppingCart size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Shopify Integration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Connect your workspace's Shopify store to bring its orders, customers and stock into ReadyTech CRM &amp; ERP.
            </p>
            <p className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" />
              You approve access in Shopify — ReadyTech never sees your Shopify password, and access keys are stored encrypted.
            </p>
          </div>
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 p-4 text-sm rounded-xl border ${
            banner.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {banner.type === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {state === "loading" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading Shopify integration…
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load Shopify integration status.{" "}
          <button onClick={load} className="font-semibold underline">Retry</button>
        </p>
      )}

      {state === "ready" && conn && (
        <div className="p-6 space-y-4 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">{conn.shop?.name || conn.shopDomain}</h2>
              <p className="text-sm text-slate-500">{conn.shopDomain}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${pillCls}`}>{pillLabel}</span>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Connected</dt><dd className="text-slate-900">{fmt(conn.connectedAt)}</dd></div>
            <div><dt className="text-slate-500">Currency</dt><dd className="text-slate-900">{conn.shop?.currencyCode || "—"}</dd></div>
            <div><dt className="text-slate-500">API version</dt><dd className="text-slate-900">{conn.apiVersion || "—"}</dd></div>
            <div>
              <dt className="text-slate-500">Webhooks</dt>
              <dd className="text-slate-900">{conn.webhooks?.registered?.length ? conn.webhooks.registered.join(", ") : "None registered"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Permissions</dt>
              <dd className="text-slate-900 break-words">{conn.scopes?.join(", ") || "—"}</dd>
            </div>
            {conn.status === "uninstalled" && (
              <div className="sm:col-span-2"><dt className="text-slate-500">Uninstalled</dt><dd className="text-slate-900">{fmt(conn.uninstalledAt)}</dd></div>
            )}
          </dl>

          {(conn.lastError || conn.webhooks?.lastError) && (
            <p className="flex items-start gap-2 p-3 text-sm border rounded-xl bg-amber-50 border-amber-200 text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{conn.lastError || `Webhook setup: ${conn.webhooks.lastError}`}</span>
            </p>
          )}

          {admin && data?.available && (
            <button
              onClick={() => startOAuth("reconnect", conn.shopDomain)}
              disabled={!!busy}
              className="px-4 py-2 mr-2 text-sm font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "reconnect" ? "Opening Shopify…" : active ? "Reconnect (refresh access)" : "Reconnect store"}
            </button>
          )}
          {admin && (active || conn.status === "error") && (
            <button
              onClick={disconnect}
              disabled={!!busy}
              className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
            >
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect store"}
            </button>
          )}
        </div>
      )}

      {state === "ready" && active && inbox && (
        <div className="p-6 space-y-4 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Webhook events</h2>
              <p className="text-sm text-slate-500">Order, product and inventory updates received from Shopify for this workspace.</p>
            </div>
            {admin && (
              <button
                onClick={registerWebhooks}
                disabled={!!busy}
                className="px-4 py-2 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "webhooks" ? "Registering…" : "Re-register webhooks"}
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[["pending", "Waiting"], ["processing", "Processing"], ["processed", "Processed"], ["ignored", "Ignored"], ["dead", "Failed"]].map(([k, label]) => (
              <div key={k} className="p-3 rounded-xl bg-slate-50">
                <dt className="text-slate-500">{label}</dt>
                <dd className={`text-lg font-semibold ${k === "dead" && inbox.counts[k] ? "text-red-600" : "text-slate-900"}`}>{inbox.counts[k] ?? 0}</dd>
              </div>
            ))}
          </dl>

          {inbox.failures?.length > 0 && (
            <ul className="text-sm divide-y divide-slate-100">
              {inbox.failures.map((f) => (
                <li key={f._id} className="flex flex-wrap items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {f.topic} <span className="text-xs font-normal text-slate-500">· {f.status === "dead" ? `failed after ${f.attempts} attempts` : `retrying (attempt ${f.attempts})`}</span>
                    </p>
                    <p className="text-xs break-words text-slate-500">{f.lastError}</p>
                  </div>
                  {admin && f.status === "dead" && (
                    <button
                      onClick={() => retryEvent(f._id)}
                      disabled={!!busy}
                      className="px-3 py-1 text-xs font-semibold border rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy === `retry-${f._id}` ? "Retrying…" : "Retry"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === "ready" && active && (
        <div className="p-6 space-y-4 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">Inventory sync</h2>
            <p className="text-sm text-slate-500">
              ReadyTech ERP is the stock master: available stock of one ERP warehouse is pushed to one Shopify location every 5 minutes. Products are matched by SKU.
            </p>
          </div>

          {admin && inv && (
            <form onSubmit={saveInventory} className="grid gap-3 sm:grid-cols-3">
              <select value={inv.warehouse} onChange={(e) => setInv({ ...inv, warehouse: e.target.value })} className="px-3 py-2 text-sm border rounded-xl border-slate-300">
                <option value="">ERP warehouse…</option>
                {inv.warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
              <select value={inv.locationGid} onChange={(e) => setInv({ ...inv, locationGid: e.target.value })} className="px-3 py-2 text-sm border rounded-xl border-slate-300">
                <option value="">Shopify location…</option>
                {inv.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={inv.enabled} onChange={(e) => setInv({ ...inv, enabled: e.target.checked })} />
                Push ERP stock to Shopify
              </label>
              <div className="flex gap-2 sm:col-span-3">
                <button type="submit" disabled={!!busy} className="px-4 py-2 text-sm font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                  {busy === "inventory" ? "Saving…" : "Save"}
                </button>
                {conn.inventory?.enabled && (
                  <button type="button" onClick={syncInventory} disabled={!!busy} className="px-4 py-2 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "sync" ? "Syncing…" : "Sync now"}
                  </button>
                )}
              </div>
            </form>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Status</dt><dd className="text-slate-900">{conn.inventory?.enabled ? `On · ${conn.inventory.locationName || "location"}` : "Off"}</dd></div>
            <div><dt className="text-slate-500">Products matched by SKU</dt><dd className="text-slate-900">{inventory?.mapped ?? 0}</dd></div>
            <div>
              <dt className="text-slate-500">Last sync</dt>
              <dd className="text-slate-900">
                {fmt(conn.inventory?.lastSyncAt)}
                {conn.inventory?.lastResult && (
                  <span className="block text-xs text-slate-500">
                    {conn.inventory.lastResult.pushed} updated · {conn.inventory.lastResult.unchanged} unchanged · {conn.inventory.lastResult.failed} failed
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {(conn.inventory?.lastError || conn.inventory?.lastResult?.ambiguous?.length > 0 || inventory?.failing?.length > 0) && (
            <div className="p-3 space-y-1 text-sm border rounded-xl bg-amber-50 border-amber-200 text-amber-800">
              {conn.inventory?.lastError && <p>{conn.inventory.lastError}</p>}
              {conn.inventory?.lastResult?.ambiguous?.length > 0 && (
                <p>SKU used by several Shopify variants (not synced): {conn.inventory.lastResult.ambiguous.join(", ")}</p>
              )}
              {inventory?.failing?.map((f) => <p key={f._id}>{f.sku}: {f.lastError}</p>)}
            </div>
          )}
        </div>
      )}

      {state === "ready" && orders?.recent?.length > 0 && (
        <div className="p-6 space-y-4 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">Shopify orders</h2>
            <p className="text-sm text-slate-500">
              Imported as draft ERP sales orders. Stock, delivery and invoices stay manual for now.
              {orders.needsAttention > 0 && <span className="font-semibold text-amber-700"> {orders.needsAttention} need attention.</span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Order</th>
                  <th className="py-2 pr-4 font-medium">ERP sales order</th>
                  <th className="py-2 pr-4 font-medium">Payment</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.recent.map((o) => (
                  <tr key={o._id} className="align-top">
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {o.orderName || "—"}
                      {o.status === "cancelled" && <span className="ml-1 text-xs text-red-600">cancelled</span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{o.salesOrder ? `${o.salesOrder.soNumber} · ${o.salesOrder.status}` : "—"}</td>
                    <td className="py-2 pr-4 text-slate-700">{o.financialStatus || "—"}</td>
                    <td className="py-2 pr-4 text-slate-700">
                      {o.financials ? (
                        <>
                          {money(o.financials.total, o.financials.digits, o.financials.currency)}
                          <span className="block text-xs text-slate-500">
                            Items {money(o.financials.subtotal, o.financials.digits)}
                            {o.financials.totalDiscounts > 0 && ` · discount −${money(o.financials.totalDiscounts, o.financials.digits)}`}
                            {o.financials.shipping > 0 && ` · shipping ${money(o.financials.shipping - o.financials.shippingDiscounts, o.financials.digits)}`}
                            {` · tax ${money(o.financials.tax, o.financials.digits)}${o.financials.taxesIncluded ? " incl." : ""}`}
                            {o.financials.outstanding > 0 && ` · due ${money(o.financials.outstanding, o.financials.digits)}`}
                          </span>
                          {o.financials.unreconciled !== 0 && (
                            <span className="block text-xs text-amber-700">Shopify parts differ from total by {money(o.financials.unreconciled, o.financials.digits)}</span>
                          )}
                        </>
                      ) : "—"}
                      {o.refunded?.map((r) => (
                        <span key={r.currency} className="block text-xs text-amber-700">Refunded {money(r.amountMinor, r.digits, r.currency)}</span>
                      ))}
                    </td>
                    <td className="py-2 text-xs text-amber-800">{o.issues?.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state === "ready" && admin && !active && (
        data?.available ? (
          <form onSubmit={connect} className="p-6 space-y-3 bg-white border shadow-sm rounded-2xl border-slate-200">
            <div>
              <h2 className="font-semibold text-slate-900">{conn ? "Connect a different store" : "Connect your Shopify store"}</h2>
              <p className="text-sm text-slate-500">Enter your store's Shopify address. You'll approve access in Shopify, then return here.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
                className="flex-1 px-4 py-2.5 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!!busy}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "connect" && <Loader2 size={16} className="animate-spin" />}
                Connect with Shopify
              </button>
            </div>
          </form>
        ) : (
          <p className="p-4 text-sm border rounded-xl bg-slate-50 border-slate-200 text-slate-600">
            Shopify connection isn't available yet: ReadyTech still has to finish the one-time Shopify platform setup. You don't need any Shopify API keys — please try again later or contact ReadyTech support.
          </p>
        )
      )}

      {state === "ready" && !admin && !conn && (
        <p className="text-sm text-slate-500">No Shopify store is connected. Ask a workspace admin to connect one.</p>
      )}
    </div>
  );
}
