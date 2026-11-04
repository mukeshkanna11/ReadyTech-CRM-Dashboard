import { Boxes, CheckCircle2, KeyRound, Link2, Package, Receipt, ShieldCheck, ShoppingBag, Unplug } from "lucide-react";
import { Badge, Button, Card, Notice } from "./ui";
import { ago, fmt } from "./format";
import { inventorySync, orderSync, productSync, scopeHelp } from "./syncStatus";

const STATUS = {
  active: ["green", "Connected"],
  error: ["amber", "Reconnect required"],
  uninstalled: ["slate", "App uninstalled in Shopify"],
  disconnected: ["slate", "Disconnected"],
};

function Metric({ label, value, hint }) {
  return (
    <div className="min-w-0 p-3 rounded-xl bg-slate-50">
      <dt className="text-xs font-medium tracking-wide uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold truncate text-slate-900 tabular-nums" title={typeof value === "string" ? value : undefined}>{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500 truncate">{hint}</dd>}
    </div>
  );
}

function SyncTile({ icon, title, status }) {
  const Icon = icon;
  return (
    <div className="flex flex-col p-4 bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon size={16} className="text-slate-500" /> {title}</p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="mt-2 text-xs break-words text-slate-500">{status.detail}</p>
    </div>
  );
}

/* Connected store: identity, actions, key numbers, per-area sync status and permissions.
   Every value comes from GET /shopify/status. */
export default function StoreOverview({ data, admin, busy, onReconnect, onDisconnect }) {
  const conn = data.connection;
  const active = conn.status === "active";
  const [tone, label] = STATUS[conn.status] || STATUS.disconnected;
  const missing = conn.missingScopes || [];
  const inv = conn.inventory || {};
  const dead = data.inbox?.counts?.dead || 0;

  return (
    <>
      <section className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="h-1.5 bg-[#5E8E3E]" />
        <div className="p-5 space-y-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex items-start flex-1 min-w-0 gap-3">
              <div className="grid w-11 h-11 text-white rounded-xl place-items-center shrink-0 bg-[#5E8E3E]"><ShoppingBag size={22} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="max-w-full min-w-0 text-lg font-semibold truncate text-slate-900">{conn.shop?.name || conn.shopDomain}</h2>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <a href={`https://${conn.shopDomain}`} target="_blank" rel="noreferrer" className="text-sm break-all text-slate-500 hover:text-slate-700 hover:underline">{conn.shopDomain}</a>
                <p className="mt-0.5 text-xs text-slate-400">
                  {active ? `Connected ${fmt(conn.connectedAt)}` : conn.status === "uninstalled" ? `Uninstalled ${fmt(conn.uninstalledAt)}` : conn.disconnectedAt ? `Disconnected ${fmt(conn.disconnectedAt)}` : conn.lastError}
                </p>
              </div>
            </div>
            {admin && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {data.available && (
                  <Button variant={active && !missing.length ? "secondary" : "shopify"} icon={Link2} loading={busy === "reconnect"} disabled={!!busy} onClick={onReconnect}>
                    {busy === "reconnect" ? "Opening Shopify…" : active ? "Reconnect" : "Reconnect store"}
                  </Button>
                )}
                {(active || conn.status === "error") && (
                  <Button variant="danger" icon={Unplug} loading={busy === "disconnect"} disabled={!!busy} onClick={onDisconnect}>
                    Disconnect
                  </Button>
                )}
              </div>
            )}
          </div>

          {active && missing.length > 0 && (
            <Notice type="error" title="Some Shopify permissions are missing">
              Not granted: <strong>{missing.join(", ")}</strong>. Features that need them will fail.
              {admin ? " Click Reconnect and approve the requested access in Shopify." : " Ask a workspace admin to reconnect the store."}
            </Notice>
          )}
          {conn.status === "error" && (
            <Notice type="warning" title="Shopify access expired or was revoked">
              {conn.lastError || "ReadyTech can't reach this store."} {admin ? "Reconnect the store to resume syncing." : "Ask a workspace admin to reconnect it."}
            </Notice>
          )}
          {conn.status === "uninstalled" && (
            <Notice type="warning" title="The ReadyTech app was uninstalled in Shopify">
              Nothing syncs until the store is connected again.
            </Notice>
          )}
          {active && dead > 0 && (
            <Notice type="warning" title={`${dead} Shopify update(s) couldn't be processed`}>
              {admin ? <>See <a href="#shopify-history" className="font-semibold underline">Sync history</a> below to review and retry them.</> : "A workspace admin can review and retry them."}
            </Notice>
          )}

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Last stock sync" value={inv.enabled ? ago(inv.lastSyncAt) : "Off"} hint={inv.lastSyncAt ? fmt(inv.lastSyncAt) : inv.enabled ? "Not run yet" : "Inventory sync is off"} />
            <Metric label="SKUs matched" value={data.inventory?.mapped ?? 0} hint="Shopify variants linked by SKU" />
            <Metric label="Orders to review" value={data.orders?.needsAttention ?? 0} hint={data.orders?.recent?.[0] ? `Last: ${data.orders.recent[0].orderName || "order"} · ${ago(data.orders.recent[0].updatedAt)}` : "No orders received yet"} />
            <Metric label="Stock location" value={inv.locationName || "Not chosen"} hint={inv.locationName ? "Shopify location updated from ERP" : "Choose one in Inventory sync"} />
          </dl>
        </div>
      </section>

      {active && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SyncTile icon={Package} title="Product sync" status={productSync(conn, data.inventory)} />
          <SyncTile icon={Receipt} title="Order sync" status={orderSync(conn, data.orders)} />
          <SyncTile icon={Boxes} title="Inventory sync" status={inventorySync(conn, data.inventory)} />
        </div>
      )}

      {active && conn.scopes?.length > 0 && (
        <Card icon={KeyRound} title="Permissions granted" subtitle="What this store allows ReadyTech to do. Change them any time by reconnecting, or remove the app in Shopify admin → Apps.">
          <ul className="grid gap-2 sm:grid-cols-2">
            {conn.scopes.map((s) => (
              <li key={s} className="flex items-start gap-2 p-3 text-sm rounded-xl bg-slate-50">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  <span className="block text-slate-800">{scopeHelp(s)}</span>
                  <code className="text-xs text-slate-400">{s}</code>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={13} /> API version {conn.apiVersion || "—"} · access {conn.tokenExpiresAt ? `renews ${fmt(conn.tokenExpiresAt)}` : "non-expiring"} · stored encrypted
          </p>
        </Card>
      )}
    </>
  );
}
