import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Shield,
  UserCheck,
  Package,
  BarChart3,
  ClipboardList,
  Briefcase,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import API from "../services/api";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalClients: 0,
    totalProducts: 0,
    totalLeads: 0,
    openLeads: 0,
    inProgressLeads: 0,
    closedLeads: 0,
    recentLeads: [],
    tasks: [],
    topClients: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    const fetchData = async () => {
      try {
        const res = await API.get("/admin/summary");
        setSummary(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch dashboard data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  if (loading)
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-200 animate-pulse"
          />
        ))}
      </div>
    );

  return (
    <div className="px-6 py-8 space-y-10">

      {/* Dashboard Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">
          Dashboard Overview
        </h1>
        <p className="text-slate-500">
          Your company CRM performance snapshot
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <StatCard
          title="Users"
          value={summary.totalUsers}
          icon={<Users />}
          gradient="from-indigo-500 to-purple-600"
          onClick={() => navigate("/users")}
        />
        <StatCard
          title="Admins"
          value={summary.totalAdmins}
          icon={<Shield />}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatCard
          title="Clients"
          value={summary.totalClients}
          icon={<UserCheck />}
          gradient="from-sky-500 to-blue-600"
          onClick={() => navigate("/clients")}
        />
        <StatCard
          title="Products"
          value={summary.totalProducts}
          icon={<Package />}
          gradient="from-orange-500 to-red-500"
          onClick={() => navigate("/products")}
        />
        <StatCard
          title="Leads"
          value={summary.totalLeads}
          icon={<BarChart3 />}
          gradient="from-pink-500 to-rose-600"
          onClick={() => navigate("/leads")}
        />
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Leads Status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: "Open", value: summary.openLeads },
                  { name: "In Progress", value: summary.inProgressLeads },
                  { name: "Closed", value: summary.closedLeads },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={60}
                label
              >
                {["#4f46e5", "#10b981", "#f97316"].map((color, idx) => (
                  <Cell key={idx} fill={color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Recent Leads">
          {summary.recentLeads.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {summary.recentLeads.slice(0, 5).map((lead, i) => (
                <li
                  key={i}
                  className="p-2 rounded cursor-pointer hover:bg-slate-100"
                  onClick={() => navigate(`/leads/${lead._id}`)}
                >
                  <span className="font-semibold">{lead.client}</span> - {lead.source} •{" "}
                  <span className="text-xs text-slate-400">{lead.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No recent leads.</p>
          )}
        </Card>

        <Card title="Tasks">
          {summary.tasks.length ? (
            <ul className="space-y-2 text-sm text-slate-600">
              {summary.tasks.map((task, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> {task}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No tasks for now.</p>
          )}
        </Card>
      </div>

      {/* CRM Features and Benefits Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Why choose our CRM?</h2>
        <p>
          Our Free CRM helps small businesses manage leads, deals, contacts,
          tasks, and campaigns efficiently. Trusted by hundreds of companies, it
          can scale with your business.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card title="Lead & Contact Management">
            <p>Build lasting relationships with your leads and customers. Track activities, add notes, create tasks, and qualify leads easily.</p>
          </Card>
          <Card title="Deal & Account Management">
            <p>Track every deal, manage accounts efficiently, and drive revenue growth.</p>
          </Card>
          <Card title="Automation & Workflow">
            <p>Automate up to 5 repetitive tasks with workflows so your team can focus on high-value activities.</p>
          </Card>
          <Card title="Analytics & Reports">
            <p>Visualize your performance with charts and reports. Make data-driven decisions for sales and marketing.</p>
          </Card>
          <Card title="Cloud Storage & Integration">
            <p>Store your data securely in the cloud and integrate with other tools seamlessly.</p>
          </Card>
          <Card title="Email Marketing & Communication">
            <p>Send personalized campaigns, track engagement, and boost conversions effectively.</p>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mt-6">
        <button
          className="px-4 py-2 text-white bg-indigo-600 rounded shadow hover:bg-indigo-700"
          onClick={() => navigate("/leads")}
        >
          Add Lead
        </button>
        <button
          className="px-4 py-2 text-white bg-green-600 rounded shadow hover:bg-green-700"
          onClick={() => navigate("/clients")}
        >
          Add Client
        </button>
        <button
          className="px-4 py-2 text-white bg-orange-600 rounded shadow hover:bg-orange-700"
          onClick={() => navigate("/products")}
        >
          Add Product
        </button>
      </div>

      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

/* =================== Reusable Components =================== */
function StatCard({ title, value, icon, gradient, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-xl shadow-lg text-white bg-gradient-to-br ${gradient} relative cursor-pointer hover:scale-105 transition`}
    >
      <div className="absolute scale-150 top-4 right-4 opacity-20">{icon}</div>
      <div className="text-sm uppercase">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value ?? 0}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="p-5 bg-white shadow rounded-xl">
      <h3 className="flex items-center gap-2 mb-3 font-semibold text-slate-800">
        <ClipboardList size={18} /> {title}
      </h3>
      {children}
    </div>
  );
}
