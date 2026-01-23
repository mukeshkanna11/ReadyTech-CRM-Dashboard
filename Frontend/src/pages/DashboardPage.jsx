import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Package,
  AlertTriangle,
  ShoppingCart,
  ClipboardList,
  TrendingUp,
  UserCog,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

/* =========================================================
   FULL FEATURED ZOHO-STYLE ERP DASHBOARD
   — Updated Color Palette & Modern Design
========================================================= */

export default function DashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [role, setRole] = useState("Admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [counts, setCounts] = useState({
    products: 0,
    salesOrders: 0,
    purchaseOrders: 0,
    users: 0,
  });

  const [stockData, setStockData] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);

  /* ========================================================= */

  const safeFetch = async (url) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const [
        products,
        salesOrdersData,
        purchaseOrdersData,
        inventorySummary,
      ] = await Promise.all([
        safeFetch("/api/products"),
        safeFetch("/api/sales"),
        safeFetch("/api/purchase"),
        safeFetch("/api/inventory/summary"),
      ]);

      setProductsList(products || []);
      setPurchaseOrders(purchaseOrdersData || []);
      setSalesOrders(Array.isArray(salesOrdersData) ? salesOrdersData : []);

      /* ---------- COUNTS ---------- */
      setCounts({
        products: products?.length || 0,
        salesOrders: salesOrdersData?.length || 0,
        purchaseOrders: purchaseOrdersData?.length || 0,
        users: 38, // static or fetch from API
      });

      /* ---------- INVENTORY CHART ---------- */
      const stock = (inventorySummary || []).map((i) => {
        const product = products.find((p) => p._id === i._id?.product);
        return {
          name: product?.name || `P-${i._id?.product || "?"}`,
          qty: (i.inQty || 0) - (i.outQty || 0),
        };
      });
      setStockData(stock);

      /* ---------- SALES TREND ---------- */
      const monthly = {};
      (salesOrdersData || []).forEach((o) => {
        const m = new Date(o.createdAt).toLocaleString("default", { month: "short" });
        monthly[m] = (monthly[m] || 0) + (o.totalAmount || 0);
      });

      setSalesTrend(
        Object.keys(monthly).map((m) => ({ month: m, revenue: monthly[m] }))
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading dashboard…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  const lowStockProducts = stockData.filter((s) => s.qty < 10);
  const topStockProducts = [...stockData].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const kpis = [
    { title: "Products", value: counts.products, icon: Package, color: "from-blue-300 to-blue-500 text-white" },
    { title: "Low Stock", value: lowStockProducts.length, icon: AlertTriangle, color: "from-red-300 to-red-500 text-white" },
    { title: "Sales Orders", value: counts.salesOrders, icon: ShoppingCart, color: "from-purple-300 to-purple-500 text-white" },
    { title: "Purchase Orders", value: counts.purchaseOrders, icon: ClipboardList, color: "from-indigo-300 to-indigo-500 text-white" },
    { title: "Revenue Trend", value: "Live", icon: TrendingUp, color: "from-green-300 to-green-500 text-white" },
    { title: "Users", value: counts.users, icon: Users, color: "from-yellow-300 to-yellow-500 text-white" },
  ];

  return (
    <div className="relative min-h-screen p-6 space-y-6 overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* Floating Background */}
      <div className="absolute rounded-full -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-blue-200/20 to-blue-400/20 blur-3xl" />
      <div className="absolute rounded-full top-1/4 -right-32 w-96 h-96 bg-gradient-to-br from-purple-200/20 to-purple-400/20 blur-3xl" />

    {/* WELCOME BANNER */}
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 p-[1px] shadow-lg">
  <div className="relative flex flex-col gap-4 p-6 rounded-2xl bg-white/10 backdrop-blur-md md:flex-row md:items-center md:justify-between">

    {/* LEFT CONTENT */}
    <div>
      <h2 className="text-2xl font-semibold text-white">
        ReadyTechSolutions
      </h2>

      <p className="max-w-xl mt-1 text-sm text-blue-100">
        “Clarity drives growth. Stay in control of your operations, inventory,
        and sales — all in one place.”
      </p>

      {/* STATUS PILLS */}
      <div className="flex flex-wrap gap-2 mt-4 text-xs">
        <span className="px-3 py-1 text-white rounded-full bg-white/20">
          ERP Active
        </span>
        <span className="px-3 py-1 text-white rounded-full bg-white/20">
          Inventory Synced
        </span>
        <span className="px-3 py-1 text-white rounded-full bg-white/20">
          Sales Tracking Live
        </span>
      </div>
    </div>

    {/* RIGHT VISUAL */}
    <div className="relative flex items-center gap-4">
      <div className="hidden h-20 w-[1px] bg-white/20 md:block" />

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/15">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/30">
          📊
        </div>
        <div>
          <p className="text-xs text-blue-100">Today</p>
          <p className="text-sm font-semibold text-white">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            onClick={() => navigate(kpi.route)}
            className={`p-5 rounded-xl shadow-lg cursor-pointer hover:scale-105 transform transition bg-gradient-to-br ${kpi.color} relative`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">{kpi.title}</p>
                <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
              </div>
              <kpi.icon size={28} className="opacity-80" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue Trend */}
        <div className="p-6 bg-white border rounded-xl shadow-lg xl:col-span-2 h-[320px]">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Levels */}
        <div className="p-6 bg-white border rounded-xl shadow-lg h-[320px]">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Stock Levels</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stockData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#6366f1" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products & Low Stock */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Top Products */}
        <div className="p-6 bg-white border shadow-lg rounded-xl">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Top Products by Stock</h3>
          <ul className="divide-y divide-gray-200">
            {topStockProducts.map((p, idx) => (
              <li key={idx} className="flex justify-between px-1 py-2 rounded-md hover:bg-gray-50">
                <span>{p.name}</span>
                <span className="font-semibold">{p.qty}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-6 bg-white border shadow-lg rounded-xl">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">Low Stock Alerts</h3>
          <ul className="divide-y divide-red-100">
            {lowStockProducts.map((p, idx) => (
              <li key={idx} className="flex justify-between px-1 py-2 text-red-700 rounded-md hover:bg-red-50">
                <span>{p.name}</span>
                <span className="font-semibold">{p.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Latest Purchase Orders */}
      <div className="p-6 overflow-x-auto bg-white border shadow-lg rounded-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">Latest Purchase Orders</h3>
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">PO Number</th>
              <th className="px-4 py-2 text-left">Vendor</th>
              <th className="px-4 py-2 text-left">Items</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {purchaseOrders.slice(-5).map((po) => (
              <tr key={po._id} className="cursor-pointer hover:bg-gray-100">
                <td className="px-4 py-2">{po.poNumber}</td>
                <td className="px-4 py-2">{po.vendor?.name}</td>
                <td className="px-4 py-2">{po.items.length}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    po.status === "RECEIVED"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}>{po.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Tools */}
      <div className="p-6 bg-white border shadow-lg rounded-xl">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">{role} Tools</h3>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {role === "Admin" ? (
            <>
              <Tool label="User Management" />
              <Tool label="Inventory Valuation" />
              <Tool label="Reports" />
              <Tool label="Audit Logs" />
            </>
          ) : (
            <>
              <Tool label="Leads" />
              <Tool label="Opportunities" />
              <Tool label="Follow-ups" />
              <Tool label="Sales Performance" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================= */
function Tool({ label }) {
  return (
    <div className="px-4 py-3 font-medium text-center transition rounded-lg cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200">
      {label}
    </div>
  );
}
