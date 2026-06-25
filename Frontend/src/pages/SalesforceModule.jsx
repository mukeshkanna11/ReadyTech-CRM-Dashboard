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

  const [stats, setStats] = useState({
    totalLeads: 0,
    totalOpportunities: 0,
    totalActivities: 0,
    closedDeals: 0,
    pendingActivities: 0,
    revenue: 0,
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

      if (data?.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load dashboard");
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
    toast.success("Dashboard refreshed");
  };

  const conversionRate = useMemo(() => {
    if (!stats.totalLeads) return 0;

    return (
      (stats.closedDeals / stats.totalLeads) *
      100
    ).toFixed(1);
  }, [stats]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 lg:p-8">

      {/* HERO HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 p-8 text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h1 className="text-4xl font-extrabold">
              Salesforce CRM Dashboard
            </h1>

            <p className="max-w-2xl mt-3 text-blue-100">
              Manage leads, opportunities, revenue,
              customer activities and business growth
              from one centralized platform.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 font-semibold text-blue-700 transition bg-white shadow-lg rounded-xl hover:scale-105"
            >
              <RefreshCw
                size={18}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              className="flex items-center gap-2 px-5 py-3 font-semibold text-white transition shadow-lg rounded-xl bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus size={18} />
              Add Lead
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI CARDS */}
      <div className="grid gap-5 mt-8 sm:grid-cols-2 xl:grid-cols-5">

        <Kpi
          title="Total Leads"
          value={stats.totalLeads}
          icon={Users}
          gradient="from-blue-500 to-indigo-600"
        />

        <Kpi
          title="Opportunities"
          value={stats.totalOpportunities}
          icon={Briefcase}
          gradient="from-emerald-500 to-teal-600"
        />

        <Kpi
          title="Closed Deals"
          value={stats.closedDeals}
          icon={CheckCircle2}
          gradient="from-purple-500 to-pink-600"
        />

        <Kpi
          title="Pending Activities"
          value={stats.pendingActivities}
          icon={Activity}
          gradient="from-orange-500 to-amber-500"
        />

        <Kpi
          title="Revenue"
          value={`₹${Number(
            stats.revenue || 0
          ).toLocaleString()}`}
          icon={DollarSign}
          gradient="from-green-500 to-emerald-600"
        />
      </div>

      {/* INSIGHTS */}
      <div className="grid gap-6 mt-8 lg:grid-cols-3">

        <InsightCard
          title="Lead Conversion"
          value={`${conversionRate}%`}
          icon={Target}
          color="text-indigo-600"
        />

        <InsightCard
          title="Revenue Growth"
          value={`₹${Number(
            stats.revenue || 0
          ).toLocaleString()}`}
          icon={TrendingUp}
          color="text-green-600"
        />

        <InsightCard
          title="Sales Performance"
          value={stats.closedDeals}
          icon={BarChart3}
          color="text-purple-600"
        />
      </div>

      {/* TAB NAVIGATION */}
      <div className="p-3 mt-8 bg-white shadow-xl rounded-3xl">

        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all duration-300 ${
                  active
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-100"
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
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-[32px] bg-white p-6 shadow-2xl"
      >
        {activeTab === "leads" && (
          <LeadsTab key={`leads-${refreshKey}`} />
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

      {/* FOOTER ANALYTICS */}
      <div className="grid gap-6 mt-8 lg:grid-cols-2">

        <div className="p-6 bg-white shadow-xl rounded-3xl">
          <h3 className="mb-5 text-lg font-bold">
            CRM Summary
          </h3>

          <div className="space-y-4">

            <SummaryRow
              label="Total Leads"
              value={stats.totalLeads}
            />

            <SummaryRow
              label="Opportunities"
              value={stats.totalOpportunities}
            />

            <SummaryRow
              label="Closed Deals"
              value={stats.closedDeals}
            />

            <SummaryRow
              label="Pending Activities"
              value={stats.pendingActivities}
            />
          </div>
        </div>

        <div className="p-6 text-white shadow-xl rounded-3xl bg-gradient-to-r from-green-500 to-emerald-600">

          <div className="flex items-center justify-between">

            <div>
              <p className="opacity-90">
                Total Revenue
              </p>

              <h2 className="mt-2 text-5xl font-extrabold">
                ₹
                {Number(
                  stats.revenue || 0
                ).toLocaleString()}
              </h2>
            </div>

            <ArrowUpRight size={50} />
          </div>

          <p className="mt-6 text-green-100">
            Revenue generated from successful
            opportunities and closed deals.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon: Icon,
  gradient,
}) {
  return (
    <motion.div
      whileHover={{
        y: -6,
        scale: 1.02,
      }}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl`}
    >
      <Icon
        className="absolute right-5 top-5 opacity-20"
        size={36}
      />

      <p className="text-sm opacity-90">
        {title}
      </p>

      <h2 className="mt-3 text-4xl font-bold">
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
    <div className="p-6 bg-white shadow-xl rounded-3xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {title}
        </h3>

        <Icon className={color} size={22} />
      </div>

      <div
        className={`mt-4 text-4xl font-bold ${color}`}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
      <span>{label}</span>

      <span className="font-bold">
        {value}
      </span>
    </div>
  );
}