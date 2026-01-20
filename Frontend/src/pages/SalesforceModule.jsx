import { useState } from "react";
import { Users, Briefcase, Activity, Plus, RefreshCw, Filter } from "lucide-react";

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
    <div className="p-6 space-y-6">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Salesforce Department
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Monitor and manage all CRM operations like leads, opportunities, and activities.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-white transition bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={16} /> Add New
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 transition bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700">
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-gray-700 transition bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700">
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <span className="text-sm text-gray-500 dark:text-gray-300">Total Leads</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">245</span>
        </div>
        <div className="flex flex-col p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <span className="text-sm text-gray-500 dark:text-gray-300">Opportunities</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">78</span>
        </div>
        <div className="flex flex-col p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <span className="text-sm text-gray-500 dark:text-gray-300">Closed Deals</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">32</span>
        </div>
        <div className="flex flex-col p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <span className="text-sm text-gray-500 dark:text-gray-300">Pending Activities</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">14</span>
        </div>
      </div>

      {/* ================= TABS ================= */}
      <div className="flex flex-wrap gap-2 mt-4 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition
              ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= TAB CONTENT ================= */}
      <div className="mt-4">
        {activeTab === "leads" && <LeadsTab />}
        {activeTab === "opportunities" && <OpportunitiesTab />}
        {activeTab === "activities" && <ActivitiesTab />}
      </div>

      {/* ================= ADDITIONAL INFORMATION ================= */}
      <div className="grid grid-cols-1 gap-4 mt-6 md:grid-cols-2">
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">Top Performing Lead Sources</h3>
          <ul className="pl-5 text-gray-600 list-disc dark:text-gray-300">
            <li>Website: 120 leads</li>
            <li>Referral: 65 leads</li>
            <li>Cold Outreach: 45 leads</li>
          </ul>
        </div>

        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-2 font-semibold text-gray-800 dark:text-white">Recent Activities</h3>
          <ul className="text-gray-600 dark:text-gray-300">
            <li>John Doe contacted via email</li>
            <li>Deal #123 moved to Negotiation</li>
            <li>Follow-up scheduled for Lead #78</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
