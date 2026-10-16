import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, UserPlus, Loader2 } from "lucide-react";

import { getNotifications, markNotificationsRead, timeAgo } from "../services/profileService";

/* =========================================================
   NOTIFICATIONS — real new-lead events (GET /api/user/me/notifications)
========================================================= */
export default function Notifications() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => getNotifications(50).then(setData).catch(() => setData({ items: [], unread: 0 })), []);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    try {
      await markNotificationsRead();
      setData((d) => ({ ...d, unread: 0, items: d.items.map((i) => ({ ...i, read: true })) }));
    } catch {
      /* interceptor toasts */
    }
  };

  const items = (data?.items || []).filter((n) => filter === "all" || !n.read);

  return (
    <div className="max-w-3xl p-4 mx-auto space-y-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">New leads created in your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 text-xs rounded-xl bg-slate-100">
            {["all", "unread"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${filter === f ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
                {f}{f === "unread" && data?.unread ? ` (${data.unread > 99 ? "99+" : data.unread})` : ""}
              </button>
            ))}
          </div>
          {data?.unread > 0 && (
            <button onClick={markAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white rounded-xl bg-indigo-600 hover:bg-indigo-700">
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {!data ? (
        <div className="grid h-40 place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center bg-white border rounded-2xl border-slate-200">
          <Bell size={28} className="mx-auto mb-3 text-slate-400" />
          <p className="text-sm text-slate-500">{filter === "unread" ? "You're all caught up." : "No notifications yet."}</p>
        </div>
      ) : (
        <ul className="overflow-hidden bg-white border divide-y shadow-sm rounded-2xl border-slate-200 divide-slate-100">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => navigate("/leads")}
                className={`flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 ${n.read ? "" : "bg-indigo-50/40"}`}>
                <span className="grid w-10 h-10 rounded-full shrink-0 place-items-center bg-emerald-50 text-emerald-600">
                  <UserPlus size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800">
                    New lead: <span className="font-semibold">{n.name}</span>
                  </span>
                  <span className="block text-xs truncate text-slate-500">
                    {[n.company, n.source].filter(Boolean).join(" · ") || "Lead"} · {new Date(n.createdAt).toLocaleString()}
                  </span>
                </span>
                <span className="text-xs shrink-0 text-slate-400">{timeAgo(n.createdAt)}</span>
                {!n.read && <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
