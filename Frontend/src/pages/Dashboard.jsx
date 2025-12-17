import React, { useEffect, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import API from "../services/api";
import {
  LayoutDashboard,
  Users,
  Shield,
  UserCheck,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ClipboardList,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

/* =========================================================
   DASHBOARD LAYOUT
========================================================= */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar open={sidebarOpen} />
      <div className="flex flex-col flex-1">
        <Topbar onMenu={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-6">
          <Dashboard />
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */
function Sidebar({ open }) {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <aside
      className={`transition-all duration-300 flex flex-col bg-slate-900 text-slate-100 ${
        open ? "w-64" : "w-20"
      }`}
    >
      <div className="flex items-center justify-center h-16 text-xl font-bold border-b border-slate-700">
        {open ? "ReadyTech CRM" : "RT"}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <SideLink to="/dashboard" icon={<LayoutDashboard />} label="Dashboard" open={open} />
        <SideLink to="/users" icon={<Users />} label="Users" open={open} />
        <SideLink to="/clients" icon={<UserCheck />} label="Clients" open={open} />
        <SideLink to="/products" icon={<Package />} label="Products" open={open} />
        <SideLink to="/leads" icon={<BarChart3 />} label="Leads" open={open} />
        <SideLink to="/admins" icon={<Shield />} label="Admins" open={open} />
      </nav>

      <div className="p-3 border-t border-slate-700">
        <SideLink to="/settings" icon={<Settings />} label="Settings" open={open} />
        <button
          onClick={handleLogout}
          className="flex items-center w-full gap-3 px-3 py-2 transition rounded-lg text-slate-300 hover:bg-slate-800"
        >
          <LogOut size={18} />
          {open && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function SideLink({ to, icon, label, open }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
          isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
        }`
      }
    >
      {icon}
      {open && <span>{label}</span>}
    </NavLink>
  );
}

/* =========================================================
   TOPBAR
========================================================= */
function Topbar({ onMenu }) {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b shadow-sm">
      <button onClick={onMenu} className="p-2 transition rounded-lg hover:bg-slate-100">
        <Menu />
      </button>
      <div className="text-sm text-slate-600">
        Welcome, <span className="font-semibold">Admin</span>
      </div>
    </header>
  );
}

/* =========================================================
   DASHBOARD PAGE
========================================================= */
function Dashboard() {
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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await API.get("/admin/summary");
        setSummary(res.data);
      } catch (err) {
        console.error(err);
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("token");
          navigate("/login");
        } else {
          setError("Failed to fetch dashboard data. Please try again later.");
        }
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
          <div key={i} className="h-28 rounded-xl bg-slate-200 animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard Overview</h1>
        <p className="text-slate-500">CRM performance snapshot</p>
      </div>

      {error && <p className="text-red-500">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
        <StatCard title="Total Users" value={summary.totalUsers} icon={<Users />} gradient="from-indigo-500 to-purple-600" />
        <StatCard title="Admins" value={summary.totalAdmins} icon={<Shield />} gradient="from-emerald-500 to-teal-600" />
        <StatCard title="Clients" value={summary.totalClients} icon={<UserCheck />} gradient="from-sky-500 to-blue-600" />
        <StatCard title="Products" value={summary.totalProducts} icon={<Package />} gradient="from-orange-500 to-red-500" />
        <StatCard title="Leads" value={summary.totalLeads} icon={<BarChart3 />} gradient="from-pink-500 to-rose-600" />
      </div>

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
          <ul className="space-y-2 text-sm text-slate-600">
            {summary.recentLeads.length
              ? summary.recentLeads.map((lead, i) => (
                  <li key={i}>
                    • {lead.client} – {lead.source}
                  </li>
                ))
              : "No recent leads."}
          </ul>
        </Card>

        <Card title="Tasks">
          <ul className="space-y-2 text-sm text-slate-600">
            {summary.tasks.length ? summary.tasks.map((task, i) => <li key={i}>✔ {task}</li>) : "No tasks."}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */
function StatCard({ title, value, icon, gradient }) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient}`}>
      <div className="absolute scale-150 top-4 right-4 opacity-20">{icon}</div>
      <div className="text-sm tracking-wide uppercase">{title}</div>
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
