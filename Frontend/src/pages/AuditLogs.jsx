import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import { Search, Filter, Download, RefreshCw } from "lucide-react";

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

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const text = `${log.action} ${log.user?.name || log.user}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesAction = actionFilter === "ALL" || log.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const uniqueActions = useMemo(() => {
    return ["ALL", ...new Set(logs.map((l) => l.action))];
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-slate-500">
            Track user activities, security events, and system changes
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl bg-slate-900 hover:bg-slate-800"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl hover:bg-slate-50"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
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

      {/* Table */}
      <div className="overflow-x-auto bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="text-left bg-slate-50">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                  Loading logs...
                </td>
              </tr>
            )}

            {!loading && filteredLogs.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
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
                  <div className="font-medium">{log.user?.name || "System"}</div>
                  <div className="text-xs text-slate-500">{log.user?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-100">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">{log.module || "—"}</td>
                <td className="px-4 py-3">{log.ip || "—"}</td>
                <td className="max-w-sm px-4 py-3 truncate text-slate-600">
                  {log.description || JSON.stringify(log.details || {})}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="text-xs text-slate-500">
        Audit logs are immutable and retained for compliance & security review.
      </div>
    </div>
  );
}
