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

import {
  Home,
  ChevronRight,
  Filter,
  Clock3,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Eye,
  FileText,
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
      {/* ========================= ENTERPRISE HERO ========================= */}

      <div className="relative overflow-hidden shadow-2xl rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">

        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_35%)]" />
        <div className="absolute rounded-full -top-24 -right-24 h-80 w-80 bg-indigo-500/20 blur-3xl" />
        <div className="absolute rounded-full -bottom-24 -left-24 h-80 w-80 bg-cyan-500/20 blur-3xl" />

        <div className="relative p-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-400">

            <Home size={15} />

            Dashboard

            <ChevronRight size={15} />

            Security

            <ChevronRight size={15} />

            <span className="font-medium text-white">
              Audit Logs
            </span>

          </div>

          {/* Hero */}
          <div className="flex flex-col gap-8 mt-6 xl:flex-row xl:items-center xl:justify-between">

            {/* Left */}
            <div className="max-w-3xl">

              <div className="flex items-center gap-5">

                <div className="flex items-center justify-center w-20 h-20 shadow-xl rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600">

                  <ShieldCheck size={38} />

                </div>

                <div>

                  <h1 className="text-4xl font-bold tracking-tight text-white">

                    Audit & Security Center

                  </h1>

                  <p className="mt-3 text-lg leading-relaxed text-slate-300">

                    Monitor user activities, authentication events,
                    permission changes, compliance records,
                    and system security from one centralized dashboard.

                  </p>

                </div>

              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-4 mt-8">

                <div className="flex items-center gap-2 px-5 py-2 text-sm rounded-full bg-emerald-500/20 text-emerald-300">

                  <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-400" />

                  System Protected

                </div>

                <div className="px-5 py-2 text-sm text-indigo-300 rounded-full bg-indigo-500/20">

                  24/7 Activity Monitoring

                </div>

                <div className="px-5 py-2 text-sm rounded-full bg-cyan-500/20 text-cyan-300">

                  Compliance Enabled

                </div>

              </div>

            </div>

            {/* Right */}
            <div className="grid grid-cols-2 gap-5">

              <div className="p-5 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">

                <p className="text-sm text-slate-400">

                  Security Events

                </p>

                <h2 className="mt-2 text-3xl font-bold text-white">

                  12,847

                </h2>

                <p className="mt-2 text-xs text-emerald-400">

                  ▲ +8.5% Today

                </p>

              </div>

              <div className="p-5 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">

                <p className="text-sm text-slate-400">

                  Active Users

                </p>

                <h2 className="mt-2 text-3xl font-bold text-white">

                  156

                </h2>

                <p className="mt-2 text-xs text-cyan-400">

                  Currently Online

                </p>

              </div>

              <div className="p-5 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">

                <p className="text-sm text-slate-400">

                  Threat Detection

                </p>

                <h2 className="mt-2 text-3xl font-bold text-emerald-400">

                  Secure

                </h2>

                <p className="mt-2 text-xs text-slate-400">

                  No Critical Alerts

                </p>

              </div>

              <div className="p-5 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">

                <p className="text-sm text-slate-400">

                  Last Sync

                </p>

                <h2 className="mt-2 text-xl font-bold text-white">

                  2 mins ago

                </h2>

                <p className="mt-2 text-xs text-slate-400">

                  Auto Updated

                </p>

              </div>

            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className="flex flex-col gap-4 p-5 mt-10 border rounded-2xl border-white/10 bg-white/5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">

            <div className="flex flex-wrap gap-3">

              <button
                onClick={fetchLogs}
                className="flex items-center gap-2 px-5 py-3 font-medium text-white transition rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105"
              >
                <RefreshCw size={18} />
                Refresh Logs
              </button>

              <button className="flex items-center gap-2 px-5 py-3 text-white border rounded-xl border-white/20 bg-white/10 hover:bg-white/20">
                <Download size={18} />
                Export Report
              </button>

              <button className="flex items-center gap-2 px-5 py-3 text-white border rounded-xl border-white/20 bg-white/10 hover:bg-white/20">
                <Filter size={18} />
                Advanced Filters
              </button>

            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300">

              <Clock3 size={18} />

              Live monitoring enabled • Last updated just now

            </div>

          </div>

        </div>

      </div>


      {/* ===================== ENTERPRISE KPI SECTION ===================== */}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">

        {/* Total Events */}
        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-blue-100">
                Total Events
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.total}
              </h2>

              <p className="mt-3 text-sm text-blue-100">
                +18.4% from yesterday
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <Activity size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-4/5 h-full bg-white rounded-full" />
          </div>

        </div>

        {/* Active Users */}
        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-green-100">
                Active Users
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.users}
              </h2>

              <p className="mt-3 text-sm text-green-100">
                Live Sessions
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <Users size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-3/4 h-full bg-white rounded-full" />
          </div>

        </div>

        {/* Security Actions */}
        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-cyan-100">
                Security Actions
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.security}
              </h2>

              <p className="mt-3 text-sm text-cyan-100">
                Authentication & Access
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <ShieldCheck size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="h-full w-[92%] rounded-full bg-white" />
          </div>

        </div>

        {/* Critical Changes */}
        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-red-500 via-rose-600 to-red-800 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-red-100">
                Critical Changes
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.critical}
              </h2>

              <p className="mt-3 text-sm text-red-100">
                High Priority Alerts
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <AlertTriangle size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-1/3 h-full bg-yellow-300 rounded-full" />
          </div>

        </div>

      </div>

      {/* ====================== ENTERPRISE FILTER BAR ====================== */}

      <div className="p-6 bg-white border shadow-xl rounded-3xl border-slate-200 dark:border-slate-700 dark:bg-slate-900">

        {/* Header */}
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Advanced Filters
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Filter audit events by user, action, severity and date.
            </p>

          </div>

          <div className="flex items-center gap-3">

            <span className="px-4 py-2 text-sm font-medium text-indigo-700 rounded-full bg-indigo-50 dark:bg-indigo-500/20 dark:text-indigo-300">
              {filteredLogs.length} Results
            </span>

            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

          </div>

        </div>

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

          {/* Search */}
          <div className="relative xl:col-span-2">

            <Search
              size={18}
              className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
            />

            <input
              type="text"
              placeholder="Search by user, email or activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-3 pl-12 pr-4 text-sm border rounded-xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />

          </div>

          {/* Action */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-3 text-sm border rounded-xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          {/* Severity */}
          <select
            className="px-4 py-3 text-sm border rounded-xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option>All Severity</option>
            <option>Critical</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>

          {/* Date */}
          <input
            type="date"
            className="px-4 py-3 text-sm border rounded-xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-3 pt-5 mt-5 border-t border-slate-200 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">

          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold">{filteredLogs.length}</span> audit events
          </div>

          <div className="flex gap-3">

            <button
              onClick={() => {
                setSearch("");
                setActionFilter("All");
              }}
              className="px-5 py-2 text-sm font-medium transition border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
            >
              Clear Filters
            </button>

            <button className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white transition rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg">
              <Filter size={16} />
              Apply Filters
            </button>

          </div>

        </div>

      </div>

      {/* ====================== ENTERPRISE AUDIT TABLE ====================== */}

      <div className="overflow-hidden bg-white border shadow-2xl border-slate-200 rounded-3xl dark:bg-slate-900 dark:border-slate-700">

        {/* Table Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">

          <div>

            <h3 className="text-xl font-bold text-white">
              Audit Activity Logs
            </h3>

            <p className="mt-1 text-sm text-slate-300">
              Complete history of user actions and security events
            </p>

          </div>

          <div className="flex gap-3">

            <button className="px-4 py-2 text-sm text-white transition rounded-xl bg-white/10 hover:bg-white/20">
              Export CSV
            </button>

            <button className="px-4 py-2 text-sm text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700">
              Live Monitoring
            </button>

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800">

              <tr className="text-xs font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-300">

                <th className="px-6 py-4 text-left">
                  Event
                </th>

                <th className="px-6 py-4 text-left">
                  User
                </th>

                <th className="px-6 py-4 text-left">
                  Action
                </th>

                <th className="px-6 py-4 text-left">
                  Module
                </th>

                <th className="px-6 py-4 text-left">
                  IP Address
                </th>

                <th className="px-6 py-4 text-left">
                  Time
                </th>

                <th className="px-6 py-4 text-center">
                  Status
                </th>

                <th className="px-6 py-4 text-center">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {loading && (

                <tr>

                  <td
                    colSpan={8}
                    className="py-16 text-center text-slate-500"
                  >
                    <Loader2
                      className="mx-auto mb-3 animate-spin"
                      size={34}
                    />

                    Loading security logs...

                  </td>

                </tr>

              )}

              {!loading &&
                filteredLogs.length === 0 && (

                  <tr>

                    <td
                      colSpan={8}
                      className="py-16 text-center"
                    >

                      <ShieldAlert
                        className="mx-auto mb-4 text-slate-300"
                        size={42}
                      />

                      <h3 className="text-lg font-semibold">
                        No Audit Records
                      </h3>

                      <p className="mt-2 text-slate-500">
                        No matching activity logs found.
                      </p>

                    </td>

                  </tr>

                )}

              {!loading &&
                filteredLogs.map((log) => (

                  <tr
                    key={log._id}
                    className="transition border-t hover:bg-slate-50 dark:hover:bg-slate-800"
                  >

                    {/* Event */}
                    <td className="px-6 py-4">

                      <div className="font-semibold">
                        {log.description || "System Event"}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        #{log._id.slice(-8)}
                      </div>

                    </td>

                    {/* User */}
                    <td className="px-6 py-4">

                      <div className="flex items-center gap-3">

                        <div className="flex items-center justify-center w-10 h-10 font-bold text-white rounded-full bg-gradient-to-r from-indigo-600 to-blue-600">

                          {(log.user?.name || "S")
                            .charAt(0)
                            .toUpperCase()}

                        </div>

                        <div>

                          <div className="font-semibold">

                            {log.user?.name || "System"}

                          </div>

                          <div className="text-xs text-slate-500">

                            {log.user?.email}

                          </div>

                        </div>

                      </div>

                    </td>

                    {/* Action */}
                    <td className="px-6 py-4">

                      <span className="px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">

                        {log.action}

                      </span>

                    </td>

                    {/* Module */}
                    <td className="px-6 py-4">

                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">

                        {log.module || "General"}

                      </span>

                    </td>

                    {/* IP */}
                    <td className="px-6 py-4 font-mono text-sm">

                      {log.ip || "--"}

                    </td>

                    {/* Time */}
                    <td className="px-6 py-4">

                      <div>

                        {new Date(
                          log.createdAt
                        ).toLocaleDateString()}

                      </div>

                      <div className="text-xs text-slate-500">

                        {new Date(
                          log.createdAt
                        ).toLocaleTimeString()}

                      </div>

                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${log.severity === "Critical"
                            ? "bg-red-100 text-red-700"
                            : log.severity === "High"
                              ? "bg-orange-100 text-orange-700"
                              : log.severity === "Medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                      >
                        {log.severity || "Info"}
                      </span>

                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">

                      <div className="flex justify-center gap-2">

                        <button className="p-2 transition rounded-xl bg-slate-100 hover:bg-slate-200">

                          <Eye size={17} />

                        </button>

                        <button className="p-2 text-indigo-700 transition bg-indigo-100 rounded-xl hover:bg-indigo-200">

                          <FileText size={17} />

                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </div>

      {/* ================= ENTERPRISE SECURITY NOTICE ================= */}

      <div className="relative p-6 overflow-hidden border shadow-lg rounded-3xl border-amber-300/40 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 dark:border-amber-500/20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">

        {/* Background Glow */}
        <div className="absolute w-40 h-40 rounded-full -right-10 -top-10 bg-amber-400/20 blur-3xl" />
        <div className="absolute w-40 h-40 rounded-full -left-10 -bottom-10 bg-red-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          {/* Left */}
          <div className="flex gap-4">

            <div className="flex items-center justify-center text-white shadow-lg h-14 w-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600">

              <ShieldAlert size={28} />

            </div>

            <div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Security & Compliance Notice
              </h3>

              <p className="max-w-3xl mt-2 leading-7 text-slate-600 dark:text-slate-300">
                Audit logs are immutable security records that capture authentication,
                configuration changes, permission updates, and critical system events.
                These logs support compliance audits, forensic investigations, incident
                response, and regulatory reporting.
              </p>

            </div>

          </div>

          {/* Right Status */}
          <div className="grid gap-3 sm:grid-cols-2">

            <div className="p-4 shadow rounded-2xl bg-white/70 dark:bg-slate-800">

              <div className="text-xs tracking-wide uppercase text-slate-500">
                Compliance
              </div>

              <div className="mt-2 font-semibold text-emerald-600">
                Monitoring Enabled
              </div>

            </div>

            <div className="p-4 shadow rounded-2xl bg-white/70 dark:bg-slate-800">

              <div className="text-xs tracking-wide uppercase text-slate-500">
                Retention
              </div>

              <div className="mt-2 font-semibold text-blue-600">
                Secure & Immutable
              </div>

            </div>

          </div>

        </div>

        {/* Bottom Alert */}
        <div className="relative flex flex-col gap-3 p-4 mt-6 border border-red-200 rounded-2xl bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-3">

            <AlertTriangle
              size={22}
              className="text-red-600"
            />

            <div>

              <p className="font-semibold text-red-700 dark:text-red-300">
                Immediate Investigation Required
              </p>

              <p className="text-sm text-red-600 dark:text-red-400">
                Unauthorized access attempts, privilege escalation, failed logins,
                and unexpected configuration changes should be reviewed immediately.
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">

            <CheckCircle2 size={18} />

            Audit Integrity Verified

          </div>

        </div>

      </div>
    </div>
  );
}

/* ================= ENTERPRISE KPI CARD ================= */

function KpiCard({
  icon: Icon,
  label,
  value,
  danger = false,
  trend = "+12.5%",
  subtitle = "Last 24 Hours",
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl
      ${danger
          ? "border-red-200 bg-gradient-to-br from-red-500 via-rose-600 to-red-700 text-white"
          : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
        }`}
    >
      {/* Background Glow */}
      <div
        className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl
        ${danger
            ? "bg-white/10"
            : "bg-indigo-400/20"
          }`}
      />

      <div className="relative flex items-start justify-between">

        <div>

          <p
            className={`text-sm font-medium ${danger
                ? "text-red-100"
                : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {label}
          </p>

          <h2
            className={`mt-3 text-4xl font-bold ${danger
                ? "text-white"
                : "text-slate-900 dark:text-white"
              }`}
          >
            {value}
          </h2>

          <div className="flex items-center gap-2 mt-5">

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold
              ${danger
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                }`}
            >
              {trend}
            </span>

            <span
              className={`text-xs ${danger
                  ? "text-red-100"
                  : "text-slate-500 dark:text-slate-400"
                }`}
            >
              {subtitle}
            </span>

          </div>

        </div>

        {/* Icon */}

        <div
          className={`rounded-2xl p-4 transition-all duration-300 group-hover:scale-110
          ${danger
              ? "bg-white/15"
              : "bg-gradient-to-br from-indigo-500 to-blue-600 text-white"
            }`}
        >
          <Icon size={30} />
        </div>

      </div>

      {/* Progress */}

      <div
        className={`mt-6 h-2 overflow-hidden rounded-full
        ${danger
            ? "bg-white/20"
            : "bg-slate-200 dark:bg-slate-700"
          }`}
      >
        <div
          className={`h-full rounded-full
          ${danger
              ? "w-2/5 bg-yellow-300"
              : "w-4/5 bg-gradient-to-r from-blue-500 to-indigo-600"
            }`}
        />
      </div>

    </div>
  );
}