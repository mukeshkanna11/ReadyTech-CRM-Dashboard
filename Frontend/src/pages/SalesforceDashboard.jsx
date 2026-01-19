import { useEffect, useState } from "react";
import API from "../services/api";

export default function SalesforceDashboard() {
  const [stats, setStats] = useState({
    leads: 0,
    opportunities: 0,
    revenue: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const leads = await API.get("/leads");
      const opps = await API.get("/opportunities");

      const totalRevenue = opps.data.data.reduce(
        (sum, o) => sum + (o.value || 0),
        0
      );

      setStats({
        leads: leads.data.data.length,
        opportunities: opps.data.data.length,
        revenue: totalRevenue,
      });
    };

    loadStats();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Stat title="Total Leads" value={stats.leads} />
      <Stat title="Opportunities" value={stats.opportunities} />
      <Stat title="Revenue" value={`₹ ${stats.revenue}`} />
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="p-4 bg-white border rounded-xl">
      <p className="text-sm text-gray-500">{title}</p>
      <h2 className="text-2xl font-semibold">{value}</h2>
    </div>
  );
}
