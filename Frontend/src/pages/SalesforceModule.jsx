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
    label: "Leads",
    icon: Users,
  },
  {
    id: "opportunities",
    label: "Opportunities",
    icon: Briefcase,
  },
  {
    id: "activities",
    label: "Activities",
    icon: Activity,
  },
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

    {/* HERO */}
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[36px] bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-8 lg:p-10 shadow-2xl"
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="text-3xl font-bold text-white lg:text-3xl">
            Salesforce CRM Dashboard
          </h1>

          <p className="max-w-3xl mt-4 text-lg text-blue-100">
            Manage leads, opportunities, customer engagement,
            sales activities and revenue performance from one
            enterprise-grade platform.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 font-semibold text-blue-700 transition bg-white shadow-xl rounded-2xl hover:scale-105"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={() => {
              setActiveTab("leads");
              setOpenLeadForm(true);
            }}
            className="flex items-center gap-2 px-5 py-3 font-semibold text-white transition shadow-xl rounded-2xl bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus size={18} />
            Add Lead
          </button>

        </div>
      </div>
    </motion.div>

    {/* KPI CARDS */}
    <div className="grid gap-6 mt-8 md:grid-cols-2 xl:grid-cols-4">

      <Kpi
        title="Total Leads"
        value={kpis.total}
        icon={Users}
        gradient="from-blue-600 to-indigo-700"
      />

      <Kpi
        title="Active Leads"
        value={kpis.activeLeads}
        icon={TrendingUp}
        gradient="from-cyan-500 to-sky-700"
      />

      <Kpi
        title="Converted"
        value={kpis.converted}
        icon={CheckCircle2}
        gradient="from-emerald-500 to-green-700"
      />

      <Kpi
        title="Conversion Rate"
        value={`${kpis.conversionRate}%`}
        icon={Target}
        gradient="from-pink-500 to-violet-700"
      />

    </div>


    {/* NAVIGATION */}
    <div className="p-4 mt-10 bg-white border shadow-xl rounded-3xl border-slate-100">

      <div className="flex flex-wrap gap-4">

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 rounded-2xl px-7 py-4 font-semibold transition-all duration-300 ${
                active
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}

      </div>

    </div>

    {/* CONTENT */}
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-[32px] border border-slate-100 bg-white p-8 shadow-2xl"
    >

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

    </motion.div>

  </div>
);

function Kpi({
  title,
  value,
  icon: Icon,
  gradient,
}) {
  return (
    <motion.div
      whileHover={{
        y: -8,
      }}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-7 text-white shadow-2xl`}
    >
      <div className="absolute w-24 h-24 rounded-full -right-4 -top-4 bg-white/10" />

      <Icon
        size={34}
        className="absolute right-6 top-6 opacity-20"
      />

      <p className="text-sm font-medium opacity-90">
        {title}
      </p>

      <h2 className="mt-4 text-4xl font-bold">
        {value}
      </h2>
    </motion.div>
  );
}

function InsightCard({
  title,
  value,
  icon: Icon,
  color,
}) {
  return (
    <motion.div
      whileHover={{
        y: -4,
      }}
      className="p-6 bg-white border shadow-xl rounded-3xl border-slate-100"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500">
          {title}
        </h3>

        <Icon
          size={22}
          className={color}
        />
      </div>

      <div
        className={`mt-4 text-4xl font-bold ${color}`}
      >
        {value}
      </div>
    </motion.div>
  );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between p-4 transition border rounded-2xl border-slate-100 bg-slate-50 hover:bg-slate-100">
      <span className="font-medium text-slate-600">
        {label}
      </span>

      <span className="text-lg font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}

}