import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ShoppingCart, ShieldCheck, KeyRound, Link2, Unplug, RefreshCw, Store, Receipt } from "lucide-react";
import API from "../../services/api";
import { Badge, Button, Card, Notice, SkeletonCard } from "../../components/shopify/ui";
import { ago, errorText, fmt } from "../../components/shopify/format";
import WebhookEventsCard from "../../components/shopify/WebhookEventsCard";
import InventoryCard from "../../components/shopify/InventoryCard";

/* =========================================================
   SHOPIFY INTEGRATION — this workspace's own Shopify store
   (OAuth). Each workspace connects and manages its store
   independently. Every number here comes from the API.
========================================================= */
const REFRESH_MS = 60_000;

const isAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";
  } catch {
    return false;
  }
};

/* Integer minor units → "1180.00 INR" (exact, currency's own decimals) */
const money = (minor, digits = 2, currency = "") => {
  const neg = minor < 0;
  const abs = String(Math.abs(minor)).padStart(digits + 1, "0");
  const value = digits ? `${abs.slice(0, -digits)}.${abs.slice(-digits)}` : abs;
  return `${neg ? "-" : ""}${value} ${currency || ""}`.trim();
};

const STATUS = {
  active: ["green", "Connected"],
  error: ["amber", "Reconnect required"],
  uninstalled: ["slate", "App uninstalled in Shopify"],
  disconnected: ["slate", "Not connected"],
};

function HealthTile({ label, tone, value, detail }) {
  return (
    <div className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200">
      <p className="text-xs font-medium tracking-wide uppercase text-slate-500">{label}</p>
      <div className="mt-2"><Badge tone={tone}>{value}</Badge></div>
      <p className="mt-2 text-xs text-slate-500 break-words">{detail}</p>
    </div>
  );
}

export default function ShopifyIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
  const busyRef = useRef(null); // synchronous guard: blocks double clicks before re-render
  const [shop, setShop] = useState("");
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const admin = isAdmin();

  /* silent = background refresh: keep the current view, no skeleton */
  const load = useCallback((silent = false) => {
    if (!silent) setState((s) => (s === "ready" ? "ready" : "loading"));
    return API.get("/shopify/status")
      .then((res) => {
        setData(res.data?.data);
        setState("ready");
        setUpdatedAt(new Date());
      })
      .catch(() => !silent && setState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAll = useCallback((silent = false) => {
    setRefreshKey((k) => k + 1);
    return load(silent);
  }, [load]);

  // Stable callbacks for the cards (their effects depend on them)
  const reloadStatus = useCallback(() => load(true), [load]);
  const reloadAll = useCallback(() => refreshAll(true), [refreshAll]);

  /* Auto-refresh: read-only status only, paused while hidden or busy; cleared on unmount */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !busyRef.current) refreshAll(true);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshAll]);

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

  const run = useCallback(async (key, fn) => {
    if (busyRef.current) return;
    busyRef.current = key;
    setBusy(key);
    setBanner(null);
    try {
      await fn();
    } catch (err) {
      const text = err.userMessage || errorText(err);
      setBanner({ type: "error", text });
      toast.error(text);
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, []);

  /* Shopify OAuth for a store address; the platform app credentials stay on the server */
  const startOAuth = (key, shopDomain) =>
    run(key, async () => {
      const res = await API.get("/shopify/oauth/url", { params: { shop: shopDomain } });
      window.location.href = res.data.data.url;
    });

  const connect = (e) => {
    e.preventDefault();
    // The server normalises and validates the address (422 with guidance)
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

  const inbox = data?.inbox;
  const orders = data?.orders;
  const [statusTone, statusLabel] = STATUS[conn?.status] || STATUS.disconnected;
  const missing = conn?.missingScopes || [];
  const webhookTone = !active ? "slate" : conn.webhooks?.lastError || inbox?.counts?.dead ? "amber" : conn.webhooks?.registered?.length ? "green" : "red";
  const inv = conn?.inventory || {};
  const syncTone = !inv.enabled ? "slate" : inv.lastError ? "red" : inv.lastSyncAt ? "green" : "amber";

  return (
    <div className="max-w-6xl pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 bg-white border shadow-sm sm:p-6 sm:flex-row sm:items-start rounded-2xl border-slate-200">
        <div className="grid w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 place-items-center shrink-0">
          <ShoppingCart size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Shopify Integration</h1>
            {state === "ready" && <Badge tone={conn ? statusTone : "slate"}>{conn ? statusLabel : "Not connected"}</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Connect your workspace's Shopify store to bring its orders, customers and stock into ReadyTech CRM &amp; ERP.
          </p>
          <p className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            You approve access in Shopify — ReadyTech never sees your Shopify password, and access keys are stored encrypted.
          </p>
        </div>
        {state === "ready" && (
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            <Button icon={RefreshCw} onClick={() => refreshAll()} disabled={!!busy} className="px-3 py-1.5 text-xs">Refresh</Button>
            <span className="text-xs text-slate-400">Updated {ago(updatedAt)} · auto every minute</span>
          </div>
        )}
      </div>

      {banner && (
        <Notice type={banner.type} action={<button onClick={() => setBanner(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>}>
          {banner.text}
        </Notice>
      )}

      {state === "loading" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} rows={0} />)}</div>
          <SkeletonCard />
        </>
      )}
      {state === "error" && (
        <Notice type="error" action={<button onClick={() => load()} className="text-xs font-semibold underline">Retry</button>}>
          Couldn't load the Shopify integration status.
        </Notice>
      )}

      {/* Health summary */}
      {state === "ready" && conn && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile label="Connection" tone={statusTone} value={statusLabel} detail={conn.lastError || `Since ${fmt(conn.connectedAt)}`} />
          <HealthTile
            label="Permissions"
            tone={!active ? "slate" : missing.length ? "red" : "green"}
            value={!active ? "—" : missing.length ? `${missing.length} missing` : "All granted"}
            detail={missing.length ? missing.join(", ") : `${conn.scopes?.length || 0} scope(s) granted`}
          />
          <HealthTile
            label="Webhooks"
            tone={webhookTone}
            value={`${conn.webhooks?.registered?.length || 0} topics`}
            detail={inbox?.counts?.dead ? `${inbox.counts.dead} failed event(s)` : `Registered ${ago(conn.webhooks?.lastRegisteredAt)}`}
          />
          <HealthTile
            label="Inventory sync"
            tone={syncTone}
            value={!inv.enabled ? "Off" : inv.lastError ? "Failing" : inv.lastSyncAt ? "Running" : "Waiting"}
            detail={inv.enabled ? `Last sync ${ago(inv.lastSyncAt)}` : "Turn on below to push ERP stock"}
          />
        </div>
      )}

      {/* Connection details */}
      {state === "ready" && conn && (
        <Card
          icon={Store}
          title={conn.shop?.name || conn.shopDomain}
          subtitle={conn.shopDomain}
          actions={
            admin && (
              <>
                {data?.available && (
                  <Button variant={active && !missing.length ? "secondary" : "primary"} icon={Link2} loading={busy === "reconnect"} disabled={!!busy} onClick={() => startOAuth("reconnect", conn.shopDomain)}>
                    {busy === "reconnect" ? "Opening Shopify…" : active ? "Reconnect (refresh access)" : "Reconnect store"}
                  </Button>
                )}
                {(active || conn.status === "error") && (
                  <Button variant="danger" icon={Unplug} loading={busy === "disconnect"} disabled={!!busy} onClick={disconnect}>
                    {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                  </Button>
                )}
              </>
            )
          }
        >
          {active && missing.length > 0 && (
            <Notice type="error" title="Shopify permissions missing">
              This store hasn't granted: <strong>{missing.join(", ")}</strong>. Features that need them will fail.
              {admin ? " Click Reconnect and approve the requested access in Shopify." : " Ask a workspace admin to reconnect the store."}
            </Notice>
          )}
          {conn.status === "error" && (
            <Notice type="warning" title="Shopify access expired or was revoked">
              {conn.lastError || "ReadyTech can't reach this store."} {admin ? "Reconnect the store to restore syncing." : "Ask a workspace admin to reconnect it."}
            </Notice>
          )}
          {conn.status === "uninstalled" && (
            <Notice type="warning" title="The ReadyTech app was uninstalled in Shopify">
              Uninstalled {fmt(conn.uninstalledAt)}. Nothing syncs until the store is connected again.
            </Notice>
          )}

          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-slate-500">Connected</dt><dd className="font-medium text-slate-900">{fmt(conn.connectedAt)}</dd></div>
            <div><dt className="text-slate-500">Currency</dt><dd className="font-medium text-slate-900">{conn.shop?.currencyCode || "—"}</dd></div>
            <div><dt className="text-slate-500">API version</dt><dd className="font-medium text-slate-900">{conn.apiVersion || "—"}</dd></div>
            <div><dt className="text-slate-500">Access token</dt><dd className="font-medium text-slate-900">{conn.tokenExpiresAt ? `Renews ${fmt(conn.tokenExpiresAt)}` : active ? "Non-expiring" : "—"}</dd></div>
          </dl>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 text-slate-500"><KeyRound size={14} /> Granted permissions</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {conn.scopes?.length ? conn.scopes.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-slate-500">—</span>}
            </div>
          </div>
        </Card>
      )}

      {state === "ready" && active && (
        <InventoryCard conn={conn} summary={data?.inventory} admin={admin} busy={busy} run={run} onChanged={reloadAll} refreshKey={refreshKey} />
      )}

      {state === "ready" && active && (
        <WebhookEventsCard inbox={inbox} webhooks={conn.webhooks} admin={admin} busy={busy} run={run} onChanged={reloadStatus} refreshKey={refreshKey} />
      )}

      {state === "ready" && orders?.recent?.length > 0 && (
        <Card
          icon={Receipt}
          title="Shopify orders"
          subtitle={
            <>
              Imported as draft ERP sales orders. Stock, delivery and invoices stay manual for now.
              {orders.needsAttention > 0 && <span className="font-semibold text-amber-700"> {orders.needsAttention} need attention.</span>}
            </>
          }
        >
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-left uppercase text-slate-500">
                <tr>
                  <th className="py-2 pl-5 pr-4 font-medium sm:pl-0">Order</th>
                  <th className="py-2 pr-4 font-medium">ERP sales order</th>
                  <th className="py-2 pr-4 font-medium">Payment</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.recent.map((o) => (
                  <tr key={o._id} className="align-top">
                    <td className="py-2.5 pl-5 pr-4 font-medium text-slate-900 sm:pl-0">
                      {o.orderName || "—"}
                      {o.status === "cancelled" && <span className="ml-1 text-xs text-red-600">cancelled</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{o.salesOrder ? `${o.salesOrder.soNumber} · ${o.salesOrder.status}` : "—"}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{o.financialStatus || "—"}</td>
                    <td className="py-2.5 pr-4 text-slate-700">
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
                    <td className="py-2.5 pr-5 text-xs text-amber-800 sm:pr-0">{o.issues?.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {state === "ready" && admin && !active && (
        data?.available ? (
          <Card icon={Link2} title={conn ? "Connect a different store" : "Connect your Shopify store"} subtitle="Enter your store's Shopify address. You'll approve access in Shopify, then return here.">
            <form onSubmit={connect} className="flex flex-col gap-3 sm:flex-row" noValidate>
              <input
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                placeholder="your-store.myshopify.com"
                aria-label="Shopify store address"
                className="flex-1 px-4 py-2.5 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Button type="submit" variant="primary" loading={busy === "connect"} disabled={!!busy || !shop.trim()}>
                Connect with Shopify
              </Button>
            </form>
          </Card>
        ) : (
          <Notice type="info">
            Shopify connection isn't available yet: ReadyTech still has to finish the one-time Shopify platform setup. You don't need any Shopify API keys — please try again later or contact ReadyTech support.
          </Notice>
        )
      )}

      {state === "ready" && !admin && !conn && (
        <Notice type="info">No Shopify store is connected. Ask a workspace admin to connect one.</Notice>
      )}
    </div>
  );
}
