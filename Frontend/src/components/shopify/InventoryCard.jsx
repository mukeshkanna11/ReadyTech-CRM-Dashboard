import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowRight, Boxes, MapPin, PackageSearch, RefreshCw, Save, Warehouse } from "lucide-react";
import API from "../../services/api";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Notice, Skeleton, Stat } from "./ui";
import { ago, errorText, fmt } from "./format";

const rowStatus = (i) =>
  i.ambiguous ? ["amber", "Duplicate SKU"] : i.lastError ? ["red", "Error"] : i.willPush ? ["blue", "Will update"] : ["green", "Up to date"];

export default function InventoryCard({ conn, summary, admin, busy, run, onChanged, refreshKey }) {
  const saved = conn.inventory || {};
  const [options, setOptions] = useState(null); // { warehouses, locations }
  const [optionsError, setOptionsError] = useState(null);
  const [form, setForm] = useState({ enabled: false, warehouse: "", locationGid: "" });
  const [formError, setFormError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState("idle"); // idle | loading | ready | error
  const [confirm, setConfirm] = useState(null); // preview snapshot shown in the dialog

  /* Saved settings → form (and again whenever they change on the server) */
  useEffect(() => {
    setForm({ enabled: !!saved.enabled, warehouse: saved.warehouse || "", locationGid: saved.locationGid || "" });
  }, [saved.enabled, saved.warehouse, saved.locationGid]);

  const loadOptions = useCallback(() => {
    setOptionsError(null);
    Promise.all([API.get("/warehouses"), API.get("/shopify/inventory/locations")])
      .then(([w, l]) => setOptions({ warehouses: w.data?.warehouses || [], locations: l.data?.data || [] }))
      .catch((err) => setOptionsError(errorText(err, "Couldn't load warehouses or Shopify locations.")));
  }, []);
  useEffect(() => {
    if (admin) loadOptions();
  }, [admin, loadOptions]);

  const configured = Boolean(saved.warehouse && saved.locationGid);
  const loadPreview = useCallback(async () => {
    if (!admin || !configured) return null;
    setPreviewState((s) => (s === "ready" ? "ready" : "loading"));
    try {
      const res = await API.get("/shopify/inventory/preview");
      setPreview(res.data?.data);
      setPreviewState("ready");
      return res.data?.data;
    } catch {
      setPreviewState("error");
      return null;
    }
  }, [admin, configured]);
  useEffect(() => {
    loadPreview();
  }, [loadPreview, refreshKey, saved.lastSyncAt]);

  const dirty = form.enabled !== !!saved.enabled || form.warehouse !== (saved.warehouse || "") || form.locationGid !== (saved.locationGid || "");

  const save = (e) => {
    e.preventDefault();
    if (form.enabled && (!form.warehouse || !form.locationGid)) {
      setFormError("Choose an ERP warehouse and a Shopify location before turning sync on.");
      return;
    }
    if (form.locationGid && options && !options.locations.some((l) => l.id === form.locationGid)) {
      setFormError("The selected Shopify location is no longer active. Choose another one.");
      return;
    }
    setFormError(null);
    run("inventory", async () => {
      const res = await API.put("/shopify/inventory/settings", { enabled: form.enabled, warehouse: form.warehouse || null, locationGid: form.locationGid || null });
      toast.success(res.data?.message || "Inventory settings saved");
      onChanged();
    });
  };

  /* Fresh preview first, so the admin confirms the real quantities */
  const askSync = () =>
    run("preview", async () => {
      const snapshot = await loadPreview();
      if (!snapshot) throw Object.assign(new Error("preview"), { userMessage: "Couldn't calculate the stock to push. Please try again." });
      setConfirm(snapshot);
    });

  const sync = () =>
    run("sync", async () => {
      try {
        const res = await API.post("/shopify/inventory/sync");
        const { mapping } = res.data?.data || {};
        toast.success(`${res.data?.message || "Inventory synced"}${mapping ? ` · ${mapping.mapped} SKU(s) matched` : ""}`);
      } finally {
        setConfirm(null);
        onChanged();
      }
    });

  const whName = options?.warehouses.find((w) => w._id === saved.warehouse)?.name;
  const last = saved.lastResult;
  const totals = preview?.totals;

  return (
    <Card
      icon={Boxes}
      title="Inventory sync"
      subtitle="ReadyTech ERP is the stock master. Available stock of one ERP warehouse is set on one Shopify location (every 5 minutes, or on demand). Products match by SKU."
      actions={
        admin && saved.enabled && (
          <Button variant="primary" icon={RefreshCw} loading={busy === "preview" || busy === "sync"} disabled={!!busy || dirty} onClick={askSync} title={dirty ? "Save your changes first" : undefined}>
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </Button>
        )
      }
    >
      {/* Mapping */}
      <div className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center rounded-xl bg-slate-50">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
          <Warehouse size={15} className="text-slate-500" /> {whName || (saved.warehouse ? "ERP warehouse" : "No ERP warehouse")}
        </span>
        <ArrowRight size={15} className="hidden text-slate-400 sm:block" />
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
          <MapPin size={15} className="text-slate-500" /> {saved.locationName || "No Shopify location"}
        </span>
        <span className="sm:ml-auto"><Badge tone={saved.enabled ? "green" : "slate"}>{saved.enabled ? "Sync on" : "Sync off"}</Badge></span>
      </div>
      {configured && (
        <p className="text-xs text-slate-500">
          Only <strong>{saved.locationName || "the mapped location"}</strong> is updated. Other Shopify locations keep their own quantities, so a store-wide total can differ from the ERP.
        </p>
      )}

      {admin && (
        <form onSubmit={save} className="space-y-3" noValidate>
          {optionsError && (
            <Notice type="error" action={<button type="button" onClick={loadOptions} className="text-xs font-semibold underline">Retry</button>}>
              {optionsError}
            </Notice>
          )}
          {!options && !optionsError ? (
            <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : options && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">ERP warehouse</span>
                <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} className="w-full px-3 py-2 bg-white border rounded-xl border-slate-300">
                  <option value="">Choose…</option>
                  {options.warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Shopify location</span>
                <select value={form.locationGid} onChange={(e) => setForm({ ...form, locationGid: e.target.value })} className="w-full px-3 py-2 bg-white border rounded-xl border-slate-300">
                  <option value="">Choose…</option>
                  {options.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4 rounded accent-emerald-600" />
              Push ERP stock to Shopify
            </label>
            <Button type="submit" variant="primary" icon={Save} loading={busy === "inventory"} disabled={!!busy || !dirty}>
              {busy === "inventory" ? "Saving…" : "Save settings"}
            </Button>
          </div>
          {formError && <Notice type="error">{formError}</Notice>}
        </form>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="SKUs matched" value={totals?.mapped ?? summary?.mapped ?? 0} />
        <Stat label="Will update" value={totals ? totals.willPush : "—"} tone={totals?.willPush ? "amber" : undefined} hint="on next sync" />
        <Stat label="Up to date" value={totals ? totals.unchanged : "—"} tone="green" />
        <Stat label="Failing" value={totals ? totals.failing : summary?.failing?.length ?? 0} tone={(totals ? totals.failing : summary?.failing?.length) ? "red" : undefined} />
      </dl>

      {/* Last sync (the backend keeps the latest run per store) */}
      <div className="p-3 text-sm border rounded-xl border-slate-200">
        <p className="font-medium text-slate-800">
          Last sync <span className="font-normal text-slate-500" title={fmt(saved.lastSyncAt)}>· {ago(saved.lastSyncAt)}</span>
        </p>
        {last ? (
          <p className="mt-1 text-slate-600">
            <span className="text-emerald-700">{last.pushed} updated</span> · {last.unchanged} unchanged ·{" "}
            <span className={last.failed ? "text-red-600" : ""}>{last.failed} failed</span>
            {last.ambiguous?.length > 0 && <> · <span className="text-amber-700">{last.ambiguous.length} duplicate SKU(s) skipped</span></>}
          </p>
        ) : (
          <p className="mt-1 text-slate-500">No sync has run yet.</p>
        )}
      </div>

      {saved.lastError && (
        <Notice type="error" title="Last sync failed">
          {saved.lastError}
          <span className="block mt-1 text-xs">
            {/access denied|scope|permission/i.test(saved.lastError)
              ? "The store hasn't granted inventory permissions. Reconnect the store and approve them."
              : "Check the location and SKU mapping below, then run Sync now again."}
          </span>
        </Notice>
      )}
      {last?.ambiguous?.length > 0 && (
        <Notice type="warning" title="Duplicate SKUs in Shopify are never synced">
          {last.ambiguous.join(", ")} — give each Shopify variant a unique SKU.
        </Notice>
      )}

      {/* Per-SKU preview */}
      {admin && configured && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Stock by SKU</h3>
          {previewState === "loading" && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
          {previewState === "error" && (
            <Notice type="error" action={<button onClick={loadPreview} className="text-xs font-semibold underline">Retry</button>}>
              Couldn't calculate ERP stock for the mapped SKUs.
            </Notice>
          )}
          {previewState === "ready" && preview?.items.length === 0 && (
            <EmptyState icon={PackageSearch} title="No SKUs matched yet">
              Give ERP products the same SKU as their Shopify variants, then run Sync now to match them.
            </EmptyState>
          )}
          {previewState === "ready" && preview?.items.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-xs text-left uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">SKU</th>
                      <th className="py-2 pr-4 font-medium text-right">On hand</th>
                      <th className="py-2 pr-4 font-medium text-right">Reserved</th>
                      <th className="py-2 pr-4 font-medium text-right">Shopify sold*</th>
                      <th className="py-2 pr-4 font-medium text-right">Available</th>
                      <th className="py-2 pr-4 font-medium text-right">Last pushed</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.items.map((i) => {
                      const [tone, label] = rowStatus(i);
                      return (
                        <tr key={i._id} className="align-top">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium text-slate-900">{i.sku}</p>
                            <p className="text-xs text-slate-500">{i.product || "—"}</p>
                            {i.lastError && <p className="text-xs text-red-600 break-words">{i.lastError}</p>}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{i.onHand}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{i.reserved}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">{i.committed}</td>
                          <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-slate-900">{i.available}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600" title={fmt(i.lastPushedAt)}>{i.lastPushedQty ?? "—"}</td>
                          <td className="py-2.5"><Badge tone={tone}>{label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y md:hidden divide-slate-100">
                {preview.items.map((i) => {
                  const [tone, label] = rowStatus(i);
                  return (
                    <li key={i._id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate text-slate-900">{i.sku}</span>
                        <Badge tone={tone}>{label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{i.product || "—"}</p>
                      <p className="text-xs text-slate-600 tabular-nums">
                        {i.onHand} on hand − {i.reserved} reserved − {i.committed} sold = <strong>{i.available}</strong> · last pushed {i.lastPushedQty ?? "—"}
                      </p>
                      {i.lastError && <p className="text-xs text-red-600 break-words">{i.lastError}</p>}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-slate-500">
                Available = ERP on hand − reserved − *Shopify orders not yet reserved in the ERP, for the selected warehouse.
                {preview.truncated && " Showing the first 500 SKUs."}
              </p>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Push ERP stock to Shopify?"
        confirmLabel="Push stock now"
        busy={busy === "sync"}
        onCancel={() => setConfirm(null)}
        onConfirm={sync}
      >
        <p>
          Quantities from <strong>{whName || "the ERP warehouse"}</strong> will be set on <strong>{confirm?.locationName || "the mapped Shopify location"}</strong>.
          No other Shopify location is changed.
        </p>
        {confirm && (
          <ul className="grid grid-cols-3 gap-2 text-center">
            <li className="p-2 rounded-lg bg-slate-50"><p className="text-lg font-semibold text-amber-600">{confirm.totals.willPush}</p><p className="text-xs">to update</p></li>
            <li className="p-2 rounded-lg bg-slate-50"><p className="text-lg font-semibold text-emerald-600">{confirm.totals.unchanged}</p><p className="text-xs">unchanged</p></li>
            <li className="p-2 rounded-lg bg-slate-50"><p className="text-lg font-semibold text-slate-700">{confirm.totals.ambiguous}</p><p className="text-xs">skipped</p></li>
          </ul>
        )}
        <p className="text-xs text-slate-500">SKUs are re-matched with Shopify first, so newly matched products are included.</p>
      </ConfirmDialog>
    </Card>
  );
}
