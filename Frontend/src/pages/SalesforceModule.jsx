import { useState } from "react";
import { Users, Briefcase, Activity } from "lucide-react";
import LeadsTab from "../components/salesforce/LeadsTab";
import OpportunitiesTab from "../components/salesforce/OpportunitiesTab";
import ActivitiesTab from "../components/salesforce/ActivitiesTab";

export default function SalesforceModule() {
  const [tab, setTab] = useState("leads");

  const tabs = [
    { id: "leads", label: "Leads", icon: Users },
    { id: "opportunities", label: "Opportunities", icon: Briefcase },
    { id: "activities", label: Activity },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Salesforce</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm
              ${tab === t.id ? "border-b-2 border-black font-medium" : "text-gray-500"}
            `}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "leads" && <LeadsTab />}
      {tab === "opportunities" && <OpportunitiesTab />}
      {tab === "activities" && <ActivitiesTab />}
    </div>
  );
}
