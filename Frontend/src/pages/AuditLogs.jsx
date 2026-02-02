import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Download,
  RefreshCw,
  ShieldCheck,
  Activity,
  Users,
  AlertTriangle,
} from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/audit");
      setLogs(data);
    } catch (err) {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* ================= FILTERED DATA ================= */
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const text = `${log.action} ${log.user?.name || log.user}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesAction =
        actionFilter === "ALL" || log.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const uniqueActions = useMemo(() => {
    return ["ALL", ...new Set(logs.map((l) => l.action))];
  }, [logs]);

  /* ================= KPI DATA ================= */
  const stats = useMemo(() => {
    return {
      total: logs.length,
      users: new Set(logs.map((l) => l.user?.email)).size,
      security: logs.filter((l) =>
        ["LOGIN", "LOGOUT", "PASSWORD_CHANGE"].includes(l.action)
      ).length,
      critical: logs.filter((l) =>
        ["DELETE", "ROLE_CHANGE"].includes(l.action)
      ).length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-4 p-6 text-white bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Audit & Security Logs
            </h1>
            <p className="text-sm text-slate-300">
              Complete visibility into user activity, security events, and system changes
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-xl"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white text-slate-900 rounded-xl hover:bg-slate-100">
              <Download size={16} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Activity} label="Total Events" value={stats.total} />
        <KpiCard icon={Users} label="Active Users" value={stats.users} />
        <KpiCard
          icon={ShieldCheck}
          label="Security Actions"
          value={stats.security}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Critical Changes"
          value={stats.critical}
          danger
        />
      </div>

      {/* ================= FILTERS ================= */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by user or action"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pl-10 pr-3 text-sm border rounded-xl focus:outline-none focus:ring"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-xl"
        >
          {uniqueActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="text-left bg-slate-50">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  Loading audit events...
                </td>
              </tr>
            )}

            {!loading && filteredLogs.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  No audit records found
                </td>
              </tr>
            )}

            {filteredLogs.map((log) => (
              <tr key={log._id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">
                    {log.user?.name || "System"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {log.user?.email}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">{log.module || "—"}</td>
                <td className="px-4 py-3">{log.ip || "—"}</td>
                <td className="max-w-sm px-4 py-3 truncate text-slate-600">
                  {log.description ||
                    JSON.stringify(log.details || {})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= INFO SECTION ================= */}
      <div className="p-4 text-sm border bg-slate-50 rounded-xl text-slate-600">
        <strong>Security Notice:</strong> Audit logs are immutable records used for
        compliance, forensic analysis, and security reviews. Any suspicious activity
        should be investigated immediately.
      </div>
    </div>
  );
}

/* ================= KPI CARD ================= */
function KpiCard({ icon: Icon, label, value, danger }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white border shadow-sm rounded-2xl">
      <div
        className={`p-3 rounded-xl ${
          danger ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-700"
        }`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
