import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Briefcase,
  Activity,
  Plus,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  Building2,
  BadgeCheck,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";

import LeadsTab from "../components/LeadsTab";
import OpportunitiesTab from "../components/OpportunitiesTab";
import ActivitiesTab from "../components/ActivitiesTab";

const API_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000/api"
    : "https://readytech-crm-dashboard.onrender.com/api";

const tabs = [
  {
    id: "leads",
    label: "Lead Management",
    icon: Users,
    description: "Capture, qualify and convert sales leads.",
  },
  
  {
    id: "opportunities",
    label: "Sales Pipeline",
    icon: Target,
    description: "Track opportunities and deal progress.",
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Monitor sales performance and business insights.",
  },
  {
    id: "customers",
    label: "Customers",
    icon: Building2,
    description: "Manage customer profiles and relationships.",
  }
];

export default function SalesforceModule() {
  const [activeTab, setActiveTab] = useState("leads");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
const [openLeadForm, setOpenLeadForm] = useState(false);



  const [stats, setStats] = useState({
  totalLeads: 0,
  totalOpportunities: 0,
  totalActivities: 0,
  closedDeals: 0,
  pendingActivities: 0,
  revenue: 0,

  newLeads: 0,
  contacted: 0,
  qualified: 0,
  converted: 0,
  lost: 0,

  activeLeads: 0,
  winRate: 0,
});

  const token = localStorage.getItem("token");

  const fetchDashboardStats = async () => {
  try {
    setLoading(true);

    const { data } = await axios.get(
  `${API_URL}/activities/dashboard/stats/summary`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
);

console.log("Dashboard Response:", data);

    const dashboardData =
      data?.stats ||
      data?.data ||
      data ||
      {};

    const totalLeads = Number(
      dashboardData.totalLeads || 0
    );

    const closedDeals = Number(
      dashboardData.closedDeals || 0
    );

    const activeLeads =
      totalLeads - closedDeals;

    const winRate =
      totalLeads > 0
        ? (
            (closedDeals / totalLeads) *
            100
          ).toFixed(1)
        : 0;

    setStats({
  totalLeads: dashboardData.total || 0,

  totalOpportunities: 0,

  totalActivities: dashboardData.total || 0,

  closedDeals: dashboardData.completed || 0,

  pendingActivities: dashboardData.pending || 0,

  revenue: 0,

  newLeads: dashboardData.total || 0,

  contacted: dashboardData.calls || 0,

  qualified: dashboardData.emails || 0,

  converted: dashboardData.completed || 0,

  lost: 0,

  activeLeads:
    (dashboardData.total || 0) -
    (dashboardData.completed || 0),

  winRate:
    dashboardData.total > 0
      ? (
          (dashboardData.completed /
            dashboardData.total) *
          100
        ).toFixed(1)
      : 0,
});
  } catch (error) {
    console.error(
      "Dashboard Error:",
      error
    );

    toast.error(
      error?.response?.data?.message ||
        "Failed to load dashboard"
    );
  } finally {
    setLoading(false);
  }
};
  
useEffect(() => {
  fetchDashboardStats();
}, []);

  const handleRefresh = async () => {
  await fetchDashboardStats();
  setRefreshKey((prev) => prev + 1);

  toast.success(
    "Dashboard refreshed successfully"
  );
};

  const conversionRate = useMemo(() => {
    if (!stats.totalLeads) return 0;

    return (
      (stats.closedDeals / stats.totalLeads) *
      100
    ).toFixed(1);
  }, [stats]);

  const kpis = useMemo(
  () => ({
    total: stats.totalLeads,
    newLeads: stats.newLeads,
    contacted: stats.contacted,
    qualified: stats.qualified,
    converted: stats.converted,
    lost: stats.lost,
    activeLeads: stats.activeLeads,
    conversionRate: stats.winRate,
  }),
  [stats]
);

  return (
  <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 lg:p-8">

   {/* ================= ENTERPRISE HERO ================= */}

<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900 shadow-2xl"
>

  {/* Background Effects */}

  <div className="absolute rounded-full -top-24 -right-24 h-72 w-72 bg-indigo-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-blue-500/10 blur-3xl" />
  <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

  <div className="relative z-10 p-8 lg:p-10">

    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

      {/* Left */}

      <div className="max-w-4xl">

        <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-xs font-semibold tracking-wider text-blue-100 uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">

          🚀 ReadyTech Solutions

          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
            Enterprise CRM
          </span>

        </div>

        <h1 className="text-4xl font-extrabold leading-tight text-white lg:text-5xl">

          ReadyTech CRM Dashboard

        </h1>

        <p className="max-w-3xl mt-5 text-lg leading-8 text-slate-300">

          Centralize customer relationships, manage leads, monitor sales
          performance, automate follow-ups, and drive business growth through
          an enterprise-grade CRM platform built by ReadyTech Solutions.

        </p>

        <div className="flex flex-wrap gap-3 mt-6">

          <span className="px-4 py-2 text-sm text-white rounded-full bg-white/10 backdrop-blur">
            Lead Management
          </span>

          <span className="px-4 py-2 text-sm text-white rounded-full bg-white/10 backdrop-blur">
            Sales Pipeline
          </span>

          <span className="px-4 py-2 text-sm text-white rounded-full bg-white/10 backdrop-blur">
            AI Insights
          </span>

          <span className="px-4 py-2 text-sm text-white rounded-full bg-white/10 backdrop-blur">
            Customer Analytics
          </span>

        </div>

      </div>

      {/* Right */}

      <div className="flex flex-col gap-4 lg:items-end">

        <div className="flex flex-wrap gap-3">

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 font-semibold transition bg-white shadow-xl rounded-2xl text-slate-900 hover:scale-105"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />
            Refresh Dashboard
          </button>

          <button
            onClick={() => {
              setActiveTab("leads");
              setOpenLeadForm(true);
            }}
            className="flex items-center gap-2 px-6 py-3 font-semibold text-white transition shadow-xl rounded-2xl bg-emerald-500 hover:bg-emerald-600 hover:scale-105"
          >
            <Plus size={18} />
            Create Lead
          </button>

        </div>

        {/* Enterprise KPI */}

        <div className="grid grid-cols-3 gap-4 mt-3">

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wide uppercase text-slate-300">
              CRM
            </p>

            <h3 className="mt-2 text-2xl font-bold text-white">
              Enterprise
            </h3>

          </div>

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wide uppercase text-slate-300">
              Platform
            </p>

            <h3 className="mt-2 text-2xl font-bold text-white">
              MERN
            </h3>

          </div>

          <div className="p-4 text-center border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <p className="text-xs tracking-wide uppercase text-slate-300">
              Company
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              ReadyTech
            </h3>

          </div>

        </div>

      </div>

    </div>

  </div>

</motion.div>

   {/* ================= ENTERPRISE KPI CARDS ================= */}

<div className="grid gap-6 mt-8 sm:grid-cols-2 xl:grid-cols-4">

  <Kpi
    title="Total Leads"
    value={kpis.total}
    subtitle="All customer enquiries"
    icon={Users}
    gradient="from-blue-600 via-indigo-600 to-violet-700"
    trend="+12.5%"
    trendUp
  />

  <Kpi
    title="Qualified Leads"
    value={kpis.activeLeads}
    subtitle="Ready for sales team"
    icon={BadgeCheck}
    gradient="from-cyan-500 via-sky-600 to-blue-700"
    trend="+8.2%"
    trendUp
  />

  <Kpi
    title="Converted Customers"
    value={kpis.converted}
    subtitle="Successful conversions"
    icon={CheckCircle2}
    gradient="from-emerald-500 via-green-600 to-emerald-700"
    trend="+5.8%"
    trendUp
  />

  <Kpi
    title="Conversion Rate"
    value={`${kpis.conversionRate}%`}
    subtitle="Overall sales performance"
    icon={Target}
    gradient="from-pink-500 via-violet-600 to-purple-700"
    trend="+2.1%"
    trendUp
  />

</div>


    {/* ================= ENTERPRISE NAVIGATION ================= */}

<div className="mt-10 overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  {/* Header */}

  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">

    <div>

      <h3 className="text-lg font-bold text-slate-900">
        CRM Workspace
      </h3>

      <p className="text-sm text-slate-500">
        Access all ReadyTech CRM business modules from one place.
      </p>

    </div>

    <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
      {tabs.length} Modules
    </span>

  </div>

  {/* Navigation */}

  <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">

    {tabs.map((tab) => {

      const Icon = tab.icon;
      const active = activeTab === tab.id;

      return (

        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
            active
              ? "border-indigo-600 bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shadow-xl"
              : "border-slate-200 bg-white hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
          }`}
        >

          {/* Active Glow */}

          {active && (
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          )}

          <div className="relative flex items-start justify-between">

            <div>

              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  active
                    ? "bg-white/15"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                <Icon size={22} />
              </div>

              <h4 className="mt-4 text-lg font-semibold">
                {tab.label}
              </h4>

              <p
                className={`mt-2 text-sm ${
                  active
                    ? "text-indigo-100"
                    : "text-slate-500"
                }`}
              >
                {tab.description ||
                  "Manage your CRM operations efficiently."}
              </p>

            </div>

            {active && (
              <div className="px-2 py-1 text-xs font-semibold rounded-full bg-white/20">
                Active
              </div>
            )}

          </div>

          <div className="flex items-center justify-between mt-5">

            <span
              className={`text-xs font-medium ${
                active
                  ? "text-indigo-100"
                  : "text-slate-400"
              }`}
            >
              Enterprise Module
            </span>

            <ArrowRight
              size={18}
              className={`transition ${
                active
                  ? "translate-x-1"
                  : "text-slate-400 group-hover:translate-x-1"
              }`}
            />

          </div>

        </button>

      );

    })}

  </div>

</div>

    {/* CONTENT */}
   {/* ================= ENTERPRISE CONTENT ================= */}

{/* ================= ENTERPRISE MODULE ================= */}

<motion.div
  key={activeTab}
  initial={{ opacity: 0, y: 15 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.35 }}
  className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
>

  {/* Header */}

  <div className="relative px-8 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 py-7">

    <div className="absolute w-56 h-56 rounded-full -right-16 -top-16 bg-white/5 blur-3xl" />
    <div className="absolute bottom-0 w-40 h-40 rounded-full -left-10 bg-indigo-500/20 blur-3xl" />

    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

      <div>

        <div className="flex items-center gap-2 mb-3">

          <span className="px-3 py-1 text-xs font-semibold tracking-wider text-blue-100 uppercase rounded-full bg-white/10">
            ReadyTech CRM
          </span>

          <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-emerald-500">
            Enterprise
          </span>

        </div>

        <h2 className="text-3xl font-bold text-white">
          {tabs.find((t) => t.id === activeTab)?.label}
        </h2>

        <p className="max-w-3xl mt-2 text-sm leading-7 text-slate-300">
          {tabs.find((t) => t.id === activeTab)?.description}
        </p>

      </div>

      <div className="flex flex-wrap gap-3">

        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition bg-white shadow-lg rounded-2xl text-slate-900 hover:scale-105"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>

        <button
          onClick={() => {
            if (activeTab === "leads") {
              setOpenLeadForm(true);
            }
          }}
          className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition shadow-lg rounded-2xl bg-emerald-500 hover:bg-emerald-600 hover:scale-105"
        >
          <Plus size={17} />
          New Record
        </button>

      </div>

    </div>

  </div>

  {/* Stats */}

  <div className="grid gap-6 px-8 py-5 border-b border-slate-200 bg-slate-50 md:grid-cols-4">

    <div>
      <p className="text-xs tracking-wider uppercase text-slate-400">
        Module
      </p>
      <h3 className="mt-2 text-lg font-bold text-slate-900">
        {tabs.find((t) => t.id === activeTab)?.label}
      </h3>
    </div>

    <div>
      <p className="text-xs tracking-wider uppercase text-slate-400">
        Status
      </p>
      <h3 className="mt-2 font-semibold text-emerald-600">
        ● Operational
      </h3>
    </div>

    <div>
      <p className="text-xs tracking-wider uppercase text-slate-400">
        Platform
      </p>
      <h3 className="mt-2 font-semibold text-slate-800">
        ReadyTech CRM
      </h3>
    </div>

    <div>
      <p className="text-xs tracking-wider uppercase text-slate-400">
        Last Refresh
      </p>
      <h3 className="mt-2 font-semibold text-slate-800">
        {new Date().toLocaleTimeString()}
      </h3>
    </div>

  </div>

  {/* Body */}

  <div className="p-8 bg-gradient-to-b from-white to-slate-50">

    {activeTab === "leads" && (
      <LeadsTab
        key={`leads-${refreshKey}`}
        openLeadForm={openLeadForm}
        setOpenLeadForm={setOpenLeadForm}
        onLeadCreated={fetchDashboardStats}
      />
    )}

    {activeTab === "opportunities" && (
      <OpportunitiesTab
        key={`opportunities-${refreshKey}`}
      />
    )}

    {activeTab === "activities" && (
      <ActivitiesTab
        key={`activities-${refreshKey}`}
      />
    )}

  </div>

</motion.div>

  </div>
);

function Kpi({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
  trendUp = true,
}) {
  return (
    <div className="relative overflow-hidden transition-all duration-300 bg-white shadow-lg group rounded-3xl hover:-translate-y-1 hover:shadow-2xl">

      {/* Background Glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition`}
      />

      <div className="relative p-6">

        <div className="flex items-start justify-between">

          <div>

            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>

            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              {value}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {subtitle}
            </p>

          </div>

          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
          >
            <Icon size={28} />
          </div>

        </div>

        <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">

          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              trendUp
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {trendUp ? "▲" : "▼"} {trend}
          </span>

          <span className="text-xs font-medium text-slate-400">
            This Month
          </span>

        </div>

      </div>

    </div>
  );
}
function InsightCard({
  title,
  value,
  icon: Icon,
  color = "text-indigo-600",
  bg = "from-indigo-500 to-blue-600",
  trend = "+12%",
  subtitle = "Compared to last month",
}) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.25 }}
      className="relative p-6 overflow-hidden transition-all bg-white border shadow-lg group rounded-3xl border-slate-200 hover:shadow-2xl"
    >
      {/* Background Glow */}
      <div
        className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${bg} opacity-10 blur-3xl`}
      />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-sm font-medium text-slate-500">
              {title}
            </p>

            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              {value}
            </h2>
          </div>

          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${bg} text-white shadow-lg`}
          >
            <Icon size={26} />
          </div>

        </div>

        <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">

          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
            ▲ {trend}
          </span>

          <span className="text-xs text-slate-400">
            {subtitle}
          </span>

        </div>

      </div>
    </motion.div>
  );
}

function SummaryRow({
  label,
  value,
  icon: Icon,
  color = "text-indigo-600",
}) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center justify-between p-5 transition bg-white border shadow-sm rounded-2xl border-slate-200 hover:border-indigo-300 hover:shadow-md"
    >

      <div className="flex items-center gap-4">

        {Icon && (
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-indigo-50">
            <Icon
              size={20}
              className={color}
            />
          </div>
        )}

        <div>

          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p className="text-xs text-slate-400">
            ReadyTech CRM Analytics
          </p>

        </div>

      </div>

      <div className="text-right">

        <h3 className="text-2xl font-bold text-slate-900">
          {value}
        </h3>

      </div>

    </motion.div>
  );
}

}