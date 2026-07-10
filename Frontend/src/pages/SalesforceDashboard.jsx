import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Target,
  Wallet,
  Trophy,
  RefreshCw,
  Plus,
  Briefcase,
  CalendarCheck,
  Phone,
  Mail,
  UserPlus,
  ArrowUpRight,
  Activity as ActivityIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import API from "../services/api";

/* ======================================================
   CONSTANTS (aligned with Leads & Opportunities modules)
====================================================== */
const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Closed"];
const OPP_STAGES = ["Prospecting", "Proposal", "Closed Won", "Closed Lost"];

const STATUS_COLORS = {
  New: "#3b82f6",
  Contacted: "#f59e0b",
  Qualified: "#22c55e",
  Closed: "#64748b",
};
const STAGE_COLORS = ["#6366f1", "#8b5cf6", "#22c55e", "#ef4444"];

const ACTIVITY_ICONS = {
  Call: <Phone size={15} className="text-blue-500" />,
  Email: <Mail size={15} className="text-violet-500" />,
  Meeting: <CalendarCheck size={15} className="text-green-500" />,
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ======================================================
   MAIN
====================================================== */
export default function SalesforceDashboard() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Reuse existing CRM endpoints; tolerate a missing/failed one.
      const pick = (r) => r?.data?.data || r?.data || [];
      const [l, o, a] = await Promise.all([
        API.get("/leads").then(pick).catch(() => []),
        API.get("/opportunities").then(pick).catch(() => []),
        API.get("/activities").then(pick).catch(() => []),
      ]);
      setLeads(Array.isArray(l) ? l : []);
      setOpportunities(Array.isArray(o) ? o : []);
      setActivities(Array.isArray(a) ? a : []);
    } catch (err) {
      setError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ================= DERIVED METRICS ================= */
  const metrics = useMemo(() => {
    const openOpps = opportunities.filter(
      (o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost"
    );
    const won = opportunities.filter((o) => o.stage === "Closed Won");
    const lost = opportunities.filter((o) => o.stage === "Closed Lost");
    const pipelineValue = openOpps.reduce((s, o) => s + (o.value || 0), 0);
    const wonRevenue = won.reduce((s, o) => s + (o.value || 0), 0);
    const closedCount = won.length + lost.length;
    const winRate = closedCount ? Math.round((won.length / closedCount) * 100) : 0;

    return {
      totalLeads: leads.length,
      qualifiedLeads: leads.filter((l) => l.status === "Qualified").length,
      openOpps: openOpps.length,
      pipelineValue,
      wonDeals: won.length,
      wonRevenue,
      winRate,
    };
  }, [leads, opportunities]);

  const leadStatusData = useMemo(
    () =>
      LEAD_STATUSES.map((status) => ({
        name: status,
        value: leads.filter((l) => l.status === status).length,
      })).filter((d) => d.value > 0),
    [leads]
  );

  const stageData = useMemo(
    () =>
      OPP_STAGES.map((stage) => ({
        stage,
        value: opportunities
          .filter((o) => o.stage === stage)
          .reduce((s, o) => s + (o.value || 0), 0),
      })),
    [opportunities]
  );

  const recentActivities = useMemo(() => {
    const byDate = (a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (activities.length) {
      return activities
        .slice()
        .sort(byDate)
        .slice(0, 6)
        .map((a) => ({
          id: a._id,
          icon: ACTIVITY_ICONS[a.type] || <ActivityIcon size={15} className="text-slate-400" />,
          title: a.type || "Activity",
          desc: a.notes || "No notes",
          time: a.createdAt,
        }));
    }
    // graceful fallback: newest leads as recent activity
    return leads
      .slice()
      .sort(byDate)
      .slice(0, 6)
      .map((l) => ({
        id: l._id,
        icon: <UserPlus size={15} className="text-indigo-500" />,
        title: "New Lead",
        desc: `${l.name || "Unknown"}${l.source ? ` · ${l.source}` : ""}`,
        time: l.createdAt,
      }));
  }, [activities, leads]);

  const kpis = [
    { label: "Total Leads", value: metrics.totalLeads, sub: `${metrics.qualifiedLeads} qualified`, icon: Users, accent: "indigo" },
    { label: "Open Opportunities", value: metrics.openOpps, sub: `${metrics.wonDeals} won`, icon: Target, accent: "violet" },
    { label: "Pipeline Value", value: inr(metrics.pipelineValue), sub: "Active deals", icon: Wallet, accent: "sky" },
    { label: "Won Revenue", value: inr(metrics.wonRevenue), sub: `${metrics.winRate}% win rate`, icon: Trophy, accent: "emerald" },
  ];

  const quickActions = [
    { label: "New Lead", icon: UserPlus, to: "/salesforce/leads" },
    { label: "New Opportunity", icon: Briefcase, to: "/salesforce/opportunities" },
    { label: "Log Activity", icon: CalendarCheck, to: "/salesforce/activities" },
    { label: "View Clients", icon: Users, to: "/clients" },
  ];

  /* ================= RENDER ================= */
  return (
    <div className="p-4 space-y-6 sm:p-6">
      {/* ================= ENTERPRISE CRM HEADER ================= */}

<div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900 shadow-2xl">

  {/* Background Effects */}

  <div className="absolute rounded-full -top-20 -right-20 h-72 w-72 bg-indigo-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-20 -left-20 h-72 w-72 bg-cyan-500/10 blur-3xl" />
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_40%)]" />

  <div className="relative p-8 lg:p-10">

    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

      {/* Left */}

      <div className="max-w-4xl">

        <div className="flex flex-wrap items-center gap-3 mb-4">

          <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-widest text-blue-100 uppercase rounded-full bg-white/10 backdrop-blur">

            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>

            ReadyTech Solutions

          </span>

          <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-emerald-500">
            Enterprise CRM
          </span>

          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-400/20 text-amber-200">
            Version 2.0
          </span>

        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">

          ReadyTech CRM Dashboard

        </h1>

        <p className="max-w-3xl mt-5 text-lg leading-8 text-slate-300">

          Manage customer relationships, sales opportunities, leads,
          follow-ups, and business performance through a centralized
          enterprise CRM platform designed for modern organizations.

        </p>

        {/* Feature Tags */}

        <div className="flex flex-wrap gap-3 mt-6">

          <span className="px-4 py-2 text-sm text-white border rounded-full border-white/10 bg-white/10 backdrop-blur">
            Lead Management
          </span>

          <span className="px-4 py-2 text-sm text-white border rounded-full border-white/10 bg-white/10 backdrop-blur">
            Sales Pipeline
          </span>

          <span className="px-4 py-2 text-sm text-white border rounded-full border-white/10 bg-white/10 backdrop-blur">
            Customer Analytics
          </span>

          <span className="px-4 py-2 text-sm text-white border rounded-full border-white/10 bg-white/10 backdrop-blur">
            AI Insights
          </span>

        </div>

      </div>

      {/* Right */}

      <div className="flex flex-col gap-4 lg:items-end">

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-3 px-6 py-3 font-semibold transition bg-white shadow-xl rounded-2xl text-slate-900 hover:scale-105 disabled:opacity-60"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
          Refresh Dashboard
        </button>

        {/* Quick Stats */}

        <div className="grid grid-cols-2 gap-4">

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wider uppercase text-slate-300">
              Platform
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              MERN Stack
            </h3>

          </div>

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wider uppercase text-slate-300">
              Status
            </p>

            <h3 className="mt-2 font-bold text-emerald-400">
              ● Online
            </h3>

          </div>

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wider uppercase text-slate-300">
              CRM
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Enterprise
            </h3>

          </div>

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wider uppercase text-slate-300">
              Company
            </p>

            <h3 className="mt-2 text-lg font-bold text-white">
              ReadyTech
            </h3>

          </div>

        </div>

      </div>

    </div>

  </div>

</div>

      {error && (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-red-700 border border-red-200 bg-red-50 rounded-2xl">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      )}

      {/* ============ KPI CARDS ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} loading={loading} delay={i * 0.05} />
        ))}
      </div>

      {/* ============ QUICK ACTIONS ============ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.to)}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition bg-white border shadow-sm group rounded-2xl border-slate-200 hover:border-indigo-300 hover:shadow-md"
          >
            <span className="flex items-center gap-2 text-slate-700">
              <span className="grid p-2 text-indigo-600 rounded-xl bg-indigo-50 place-items-center">
                <a.icon size={16} />
              </span>
              {a.label}
            </span>
            <Plus size={16} className="transition text-slate-400 group-hover:text-indigo-600" />
          </button>
        ))}
      </div>

      {/* ============ CHARTS ============ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Lead status distribution */}
        <ChartCard title="Lead Status Distribution" subtitle="Where your leads sit in the funnel">
          {leadStatusData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={leadStatusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {leadStatusData.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No lead data yet" />
          )}
        </ChartCard>

        {/* Pipeline value by stage */}
        <ChartCard title="Pipeline by Stage" subtitle="Deal value across each opportunity stage">
          {opportunities.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No opportunity data yet" />
          )}
        </ChartCard>
      </div>

      {/* ============ RECENT ACTIVITY ============ */}
      <div className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
            <p className="text-xs text-slate-500">Latest interactions across your CRM</p>
          </div>
          <button
            onClick={() => navigate("/salesforce/activities")}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View all <ArrowUpRight size={14} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : recentActivities.length ? (
          <ul className="divide-y divide-slate-100">
            {recentActivities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="grid rounded-full h-9 w-9 shrink-0 bg-slate-50 place-items-center">
                  {a.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-slate-800">{a.title}</p>
                  <p className="text-xs truncate text-slate-500">{a.desc}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {a.time ? new Date(a.time).toLocaleDateString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-sm text-center text-slate-500">No recent activity</p>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   PRESENTATIONAL HELPERS
====================================================== */
function KpiCard({ label, value, sub, icon: Icon, accent, loading, delay }) {
  const accents = {
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          {loading ? (
            <div className="w-20 h-6 mt-2 rounded bg-slate-100 animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-bold truncate text-slate-900">{value}</p>
          )}
          {sub && !loading && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${accents[accent] || accents.indigo}`}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200 sm:p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="grid text-sm h-[280px] place-items-center text-slate-400">
      {label}
    </div>
  );
}
