import { useState } from "react";
import {
  Users,
  Briefcase,
  Activity,
  Plus,
  RefreshCw,
  Filter,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

/* ================== TABS ================== */
import LeadsTab from "../components/LeadsTab";
import OpportunitiesTab from "../components/OpportunitiesTab";
import ActivitiesTab from "../components/ActivitiesTab";

export default function SalesforceModule() {
  const [activeTab, setActiveTab] = useState("opportunities");

  const tabs = [
    { id: "opportunities", label: "Opportunities", icon: Briefcase },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "leads", label: "Leads", icon: Users },
  ];

  return (
    <div className="min-h-screen p-8 space-y-10 bg-gradient-to-br from-slate-50 via-white to-slate-100">

      {/* ================= HERO HEADER ================= */}
      <div className="relative overflow-hidden shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
        <div className="p-8 text-white">
          <h1 className="text-4xl font-bold">Salesforce Department</h1>
          <p className="max-w-3xl mt-2 text-sm text-blue-100">
            End-to-end sales operations hub — track leads, manage opportunities,
            and monitor activities with complete visibility.
          </p>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white text-blue-700 rounded-xl hover:bg-blue-50">
              <Plus size={16} /> Add New
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white/20 backdrop-blur rounded-xl hover:bg-white/30">
              <RefreshCw size={16} /> Refresh
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-white/20 backdrop-blur rounded-xl hover:bg-white/30">
              <Filter size={16} /> Filter
            </button>
          </div>
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Total Leads"
          value="245"
          icon={Users}
          gradient="from-blue-500 to-indigo-600"
        />
        <Kpi
          title="Opportunities"
          value="78"
          icon={Briefcase}
          gradient="from-emerald-500 to-teal-600"
        />
        <Kpi
          title="Closed Deals"
          value="32"
          icon={CheckCircle2}
          gradient="from-purple-500 to-fuchsia-600"
        />
        <Kpi
          title="Pending Activities"
          value="14"
          icon={TrendingUp}
          gradient="from-orange-500 to-amber-500"
        />
      </div>

      {/* ================= TABS ================= */}
      <div className="flex flex-wrap gap-3 p-2 bg-white border shadow rounded-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition
                ${
                  active
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================= TAB CONTENT ================= */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="p-6 bg-white border shadow rounded-3xl"
      >
        {activeTab === "leads" && <LeadsTab />}
        {activeTab === "opportunities" && <OpportunitiesTab />}
        {activeTab === "activities" && <ActivitiesTab />}
      </motion.div>

      {/* ================= INSIGHTS ================= */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white border shadow rounded-3xl">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Top Performing Lead Sources
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>🌐 Website — <b>120 leads</b></li>
            <li>🤝 Referral — <b>65 leads</b></li>
            <li>📞 Cold Outreach — <b>45 leads</b></li>
          </ul>
        </div>

        <div className="p-6 bg-white border shadow rounded-3xl">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Recent Sales Activities
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>📧 John Doe contacted via email</li>
            <li>💼 Deal #123 moved to Negotiation</li>
            <li>⏰ Follow-up scheduled for Lead #78</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ================= KPI CARD ================= */
function Kpi({ title, value, icon: Icon, gradient }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`relative p-6 text-white rounded-3xl shadow-xl bg-gradient-to-br ${gradient}`}
    >
      <Icon className="absolute top-5 right-5 opacity-30" size={28} />
      <div className="text-sm opacity-90">{title}</div>
      <div className="mt-2 text-4xl font-bold">{value}</div>
    </motion.div>
  );
}
