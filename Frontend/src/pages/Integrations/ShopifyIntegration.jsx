import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ShoppingBag, ShieldCheck, RefreshCw, Receipt } from "lucide-react";
import API from "../../services/api";
import { Badge, Button, Card, ConfirmDialog, Notice, SkeletonCard } from "../../components/shopify/ui";
import { ago, errorText } from "../../components/shopify/format";
import WebhookEventsCard from "../../components/shopify/WebhookEventsCard";
import InventoryCard from "../../components/shopify/InventoryCard";
import { clearShopifyReturn, markConnectIntent, takeConnectIntent } from "../../components/shopify/shopifyReturn";
import { normalizeShopInput } from "../../components/shopify/storeInput";
import ConnectCard from "../../components/shopify/ConnectCard";
import StoreOverview from "../../components/shopify/StoreOverview";

/* =========================================================
   SHOPIFY INTEGRATION — this workspace's own Shopify store
   (OAuth). Each workspace connects and manages its store
   independently. Every number here comes from the API.
========================================================= */
const REFRESH_MS = 60_000;
const SHOP_HINT = "Enter your store's myshopify.com address (Shopify admin → Settings → Domains), e.g. your-store.myshopify.com";

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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pendingShop, setPendingShop] = useState(null); // store returned by Shopify, awaiting confirmation
  const [pendingInstall, setPendingInstall] = useState(null); // { code, shop }: installed from Shopify, awaiting link
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

  /* Shopify OAuth for a store; the platform app credentials stay on the server.
     The server validates again and binds the attempt to this admin + workspace. */
  const startOAuth = useCallback((key, shopDomain) =>
    run(key, async () => {
      const normalized = normalizeShopInput(shopDomain);
      if (!normalized) throw Object.assign(new Error("Invalid shop"), { userMessage: SHOP_HINT });
      const res = await API.get("/shopify/oauth/url", { params: { shop: normalized }, silent: true });
      window.location.href = res.data.data.url;
    }), [run]);

  /* One-button connect: Shopify's install page signs the merchant in and lets them
     pick the store; it returns here with ?shop=… (via /shopify/return) */
  const install = () =>
    run("install", async () => {
      markConnectIntent();
      window.location.href = data.installUrl;
    });

  /* Result of the OAuth redirect, or a store returned by Shopify (?shop=) */
  useEffect(() => {
    const connected = searchParams.get("connected");
    const complete = searchParams.get("complete");
    const launchShop = searchParams.get("shop");
    const installed = searchParams.get("installed");
    if (!connected && !complete && !launchShop && !installed) return;
    if (installed) {
      // Installed from Shopify: link only after this admin explicitly confirms
      setPendingInstall({ code: installed, shop: normalizeShopInput(launchShop) });
    } else if (complete) {
      // Shopify approved: this signed-in admin finishes the connection
      // (run's synchronous guard also absorbs StrictMode's double effect)
      run("complete", async () => {
        try {
          const res = await API.post("/shopify/oauth/complete", { id: complete }, { silent: true });
          clearShopifyReturn();
          const { shopName, shopDomain } = res.data?.data || {};
          const label = shopName && shopDomain ? `${shopName} (${shopDomain})` : shopDomain || launchShop || "Your store";
          toast.success("Shopify store connected");
          setBanner({ type: "success", text: `${label} is connected to this workspace.` });
        } catch (err) {
          // 401: the session expired — the API client sends the user to login and
          // the kept return resumes this step afterwards. Anything else is final.
          if (err.response?.status !== 401) clearShopifyReturn();
          throw err;
        } finally {
          load();
        }
      });
    } else if (connected === "1") {
      toast.success("Shopify store connected");
      setBanner({ type: "success", text: `${launchShop || "Your store"} is connected to this workspace.` });
    } else if (connected === "0") {
      setBanner({ type: "error", text: searchParams.get("message") || "We couldn't connect your Shopify store. Please try again." });
    } else {
      const shopDomain = normalizeShopInput(launchShop);
      if (shopDomain) {
        setShop(shopDomain);
        setPendingShop(shopDomain); // shown for confirmation (and for retry if starting fails)
        // This admin clicked Connect Shopify here moments ago → continue straight to Shopify approval.
        // Otherwise (e.g. opened from Shopify admin) wait for an explicit confirmation.
        if (takeConnectIntent()) startOAuth("connect", shopDomain);
      }
    }
    if (!complete && !installed) clearShopifyReturn();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, run, load, startOAuth]);

  /* Link the Shopify-installed store to THIS workspace (explicit confirmation) */
  const linkInstall = () =>
    run("link", async () => {
      try {
        const res = await API.post("/shopify/oauth/link", { code: pendingInstall.code }, { silent: true });
        clearShopifyReturn();
        setPendingInstall(null);
        const { shopName, shopDomain } = res.data?.data || {};
        toast.success("Shopify store connected");
        setBanner({ type: "success", text: `${shopName && shopDomain ? `${shopName} (${shopDomain})` : shopDomain || "Your store"} is connected to this workspace.` });
      } catch (err) {
        // 401: session expired — login, then the kept return resumes this step. Otherwise final.
        if (err.response?.status !== 401) {
          clearShopifyReturn();
          setPendingInstall(null);
        }
        throw err;
      } finally {
        load();
      }
    });

  /* Back from Shopify without approving (back button restores this page from cache) */
  useEffect(() => {
    const onShow = (e) => {
      if (!e.persisted) return;
      busyRef.current = null;
      setBusy(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);



  const conn = data?.connection;
  const active = conn?.status === "active";

  const disconnect = () =>
    run("disconnect", async () => {
      try {
        await API.post("/shopify/disconnect");
        toast.success("Shopify store disconnected");
      } finally {
        setConfirmDisconnect(false);
        load();
      }
    });

  const inbox = data?.inbox;
  const orders = data?.orders;

  return (
    <div className="max-w-6xl pb-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 bg-white border shadow-sm sm:p-6 sm:flex-row sm:items-center rounded-2xl border-slate-200">
        <div className="grid w-12 h-12 text-white rounded-xl place-items-center shrink-0 bg-[#5E8E3E]">
          <ShoppingBag size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Shopify</h1>
            {state === "ready" && <Badge tone={active ? "green" : conn?.status === "error" ? "amber" : "slate"}>{active ? "Connected" : conn?.status === "error" ? "Reconnect required" : "Not connected"}</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Bring your store's orders and products into ReadyTech CRM &amp; ERP, and keep Shopify stock in step with your warehouse.
          </p>
          <p className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            Connected through Shopify's secure approval — your Shopify password is never shared and access keys are stored encrypted.
          </p>
        </div>
        {state === "ready" && conn && (
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

      {pendingInstall && (
        <Notice
          type="info"
          title="ReadyTech was installed on your Shopify store"
          action={
            admin && (
              <div className="flex flex-col gap-2 sm:flex-row shrink-0">
                <Button variant="shopify" loading={busy === "link"} disabled={!!busy} onClick={linkInstall}>Link to this workspace</Button>
                <Button disabled={!!busy} onClick={() => (clearShopifyReturn(), setPendingInstall(null))}>Not now</Button>
              </div>
            )
          }
        >
          {admin
            ? <>Link <strong className="break-all">{pendingInstall.shop || "the store"}</strong> to this ReadyTech workspace to start syncing. This link is valid for 10 minutes.</>
            : "Only a workspace admin can link the store. Ask an admin to open the app from Shopify again."}
        </Notice>
      )}
      {busy === "connect" && (
        <Notice type="info" title="Connecting to Shopify…">Taking you to Shopify to approve ReadyTech's access{pendingShop ? ` for ${pendingShop}` : ""}.</Notice>
      )}
      {busy === "complete" && (
        <Notice type="info" title="Finishing your Shopify connection…">Shopify approved access. Linking the store to this workspace — this takes a few seconds.</Notice>
      )}

      {state === "loading" && (
        <>
          <SkeletonCard rows={4} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <SkeletonCard key={i} rows={0} />)}</div>
        </>
      )}
      {state === "error" && (
        <Notice type="error" action={<button onClick={() => load()} className="text-xs font-semibold underline">Retry</button>}>
          Couldn't load the Shopify integration status. Check your connection and retry.
        </Notice>
      )}

      {/* Connected (or previously connected) store */}
      {state === "ready" && conn && (
        <StoreOverview
          data={data}
          admin={admin}
          busy={busy}
          onReconnect={() => startOAuth("reconnect", conn.shopDomain)}
          onDisconnect={() => setConfirmDisconnect(true)}
        />
      )}

      {state === "ready" && admin && !active && (
        data?.available ? (
          <ConnectCard
            shop={shop}
            setShop={setShop}
            busy={busy}
            reconnecting={Boolean(conn)}
            installUrl={data.installUrl}
            pendingShop={pendingShop}
            onCancelPending={() => setPendingShop(null)}
            onInstall={install}
            onConnect={(domain) => startOAuth("connect", domain)}
          />
        ) : (
          <Notice type="info" title="Shopify connection is almost ready">
            ReadyTech is finishing a one-time Shopify setup for the platform. You don't need any Shopify API keys — please try again later or contact ReadyTech support.
          </Notice>
        )
      )}

      {state === "ready" && active && (
        <InventoryCard conn={conn} summary={data?.inventory} admin={admin} busy={busy} run={run} onChanged={reloadAll} refreshKey={refreshKey} />
      )}

      {state === "ready" && active && (
        <div id="shopify-history" className="scroll-mt-6">
          <WebhookEventsCard inbox={inbox} webhooks={conn.webhooks} admin={admin} busy={busy} run={run} onChanged={reloadStatus} refreshKey={refreshKey} />
        </div>
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

      {state === "ready" && !admin && !conn && (
        <Notice type="info">No Shopify store is connected yet. Ask a workspace admin to connect your store.</Notice>
      )}

      <ConfirmDialog
        open={confirmDisconnect && Boolean(conn)}
        title={`Disconnect ${conn?.shopDomain || "this store"}?`}
        confirmLabel="Disconnect"
        busy={busy === "disconnect"}
        onConfirm={disconnect}
        onCancel={() => setConfirmDisconnect(false)}
      >
        <p>ReadyTech stops syncing products, orders and stock with this store and deletes its access key from this workspace.</p>
        <p>Imported orders, customers and ERP records stay in ReadyTech. To also remove the app from Shopify, uninstall it in Shopify admin → Apps.</p>
      </ConfirmDialog>
    </div>
  );
}
