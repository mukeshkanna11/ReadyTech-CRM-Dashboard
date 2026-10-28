import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, Inbox, RefreshCw, RotateCcw, Webhook } from "lucide-react";
import API from "../../services/api";
import { Badge, Button, Card, EmptyState, Notice, Skeleton, Stat } from "./ui";
import { ago, fmt } from "./format";

/* Mirrors the backend inbox (services/shopify/inbox.service.js); the API validates both */
const STATUSES = [
  ["pending", "Waiting", "blue"],
  ["processing", "Processing", "blue"],
  ["processed", "Processed", "green"],
  ["ignored", "Ignored", "slate"],
  ["dead", "Failed", "red"],
];
const TOPICS = [
  "orders/create", "orders/updated", "orders/cancelled", "refunds/create",
  "fulfillments/create", "fulfillments/update",
  "products/create", "products/update", "products/delete", "inventory_levels/update",
];
const statusMeta = (s) => STATUSES.find(([k]) => k === s) || [s, s, "slate"];

export default function WebhookEventsCard({ inbox, webhooks, admin, busy, run, onChanged, refreshKey }) {
  const [filters, setFilters] = useState({ status: "", topic: "" });
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error

  const loadEvents = useCallback(() => {
    if (!admin) return undefined;
    let cancelled = false; // rows stay visible while a refresh is in flight
    API.get("/shopify/events", { params: { ...filters, page, limit: 20 } })
      .then((res) => !cancelled && (setList(res.data?.data), setState("ready")))
      .catch(() => !cancelled && setState("error"));
    return () => (cancelled = true);
  }, [admin, filters, page]);

  useEffect(() => loadEvents(), [loadEvents, refreshKey]);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const registerWebhooks = () =>
    run("webhooks", async () => {
      const res = await API.post("/shopify/webhooks/register");
      toast.success(res.data?.message || "Webhooks registered");
      onChanged();
    });

  const retryEvent = (id) =>
    run(`retry-${id}`, async () => {
      await API.post(`/shopify/events/${id}/retry`);
      toast.success("Event queued for retry");
      onChanged();
      loadEvents();
    });

  const counts = inbox?.counts || {};
  const registered = webhooks?.registered || [];
  const healthy = registered.length > 0 && !webhooks?.lastError && !counts.dead;

  return (
    <Card
      icon={Webhook}
      title="Webhook health"
      subtitle="Order, product and inventory updates Shopify sends to this workspace."
      actions={
        admin && (
          <Button icon={RefreshCw} loading={busy === "webhooks"} disabled={!!busy} onClick={registerWebhooks}>
            {busy === "webhooks" ? "Registering…" : "Re-register webhooks"}
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={healthy ? "green" : registered.length ? "amber" : "red"}>
          {healthy ? "Healthy" : registered.length ? "Needs attention" : "Not subscribed"}
        </Badge>
        <span className="text-slate-500">
          {registered.length} topic(s) subscribed · last registered {ago(webhooks?.lastRegisteredAt)}
        </span>
      </div>

      {webhooks?.lastError && (
        <Notice type="warning" title="Webhook registration problem">
          {webhooks.lastError}
          {admin && <span className="block mt-1 text-xs">Re-register webhooks; if it keeps failing, reconnect the store to refresh its permissions.</span>}
        </Notice>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.map(([k, label]) => (
          <Stat key={k} label={label} value={counts[k] ?? 0} tone={k === "dead" && counts[k] ? "red" : undefined} />
        ))}
      </dl>

      {admin && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="px-3 py-2 text-sm bg-white border rounded-xl border-slate-300">
              <option value="">All statuses</option>
              {STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select aria-label="Filter by event type" value={filters.topic} onChange={(e) => setFilter("topic", e.target.value)} className="px-3 py-2 text-sm bg-white border rounded-xl border-slate-300">
              <option value="">All event types</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {state === "loading" && (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          )}
          {state === "error" && (
            <Notice type="error" action={<button onClick={loadEvents} className="text-xs font-semibold underline">Retry</button>}>
              Couldn't load webhook events.
            </Notice>
          )}
          {state === "ready" && list?.items?.length === 0 && (
            <EmptyState icon={Inbox} title="No events match">
              {filters.status || filters.topic ? "Try clearing the filters." : "Events appear here as Shopify sends them."}
            </EmptyState>
          )}

          {state === "ready" && list?.items?.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="text-xs text-left uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Event</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Received</th>
                      <th className="py-2 pr-4 font-medium">Attempts</th>
                      <th className="py-2 pr-4 font-medium">Error</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.items.map((e) => {
                      const [, label, tone] = statusMeta(e.status);
                      return (
                        <tr key={e._id} className="align-top">
                          <td className="py-2.5 pr-4 font-medium text-slate-900 whitespace-nowrap">{e.topic}</td>
                          <td className="py-2.5 pr-4"><Badge tone={tone}>{label}</Badge></td>
                          <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap" title={fmt(e.createdAt)}>{ago(e.createdAt)}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-slate-600">{e.attempts}</td>
                          <td className="py-2.5 pr-4 text-xs text-red-600 break-words max-w-xs">{e.lastError || ""}</td>
                          <td className="py-2.5 text-right">
                            {e.status === "dead" && (
                              <Button icon={RotateCcw} className="px-3 py-1 text-xs" loading={busy === `retry-${e._id}`} disabled={!!busy} onClick={() => retryEvent(e._id)}>
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <ul className="divide-y md:hidden divide-slate-100">
                {list.items.map((e) => {
                  const [, label, tone] = statusMeta(e.status);
                  return (
                    <li key={e._id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate text-slate-900">{e.topic}</span>
                        <Badge tone={tone}>{label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{fmt(e.createdAt)} · {e.attempts} attempt(s)</p>
                      {e.lastError && <p className="text-xs text-red-600 break-words">{e.lastError}</p>}
                      {e.status === "dead" && (
                        <Button icon={RotateCcw} className="w-full py-1.5 text-xs" loading={busy === `retry-${e._id}`} disabled={!!busy} onClick={() => retryEvent(e._id)}>
                          Retry
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
                <span>{list.total} event(s) · page {list.page} of {list.pages}</span>
                <div className="flex gap-2">
                  <Button aria-label="Previous page" icon={ChevronLeft} className="px-2.5 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
                  <Button aria-label="Next page" icon={ChevronRight} className="px-2.5 py-1.5" disabled={page >= list.pages} onClick={() => setPage((p) => p + 1)} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
