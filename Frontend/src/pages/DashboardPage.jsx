import { useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  ClipboardList,
  Users,
  PackageCheck,
  Package2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Zap,
  Plus,
} from "lucide-react";
/* ==================================================== */
const API_BASE = "https://readytech-crm-dashboard.onrender.com/api";

/* =====================================================
   PREMIUM ZOHO-STYLE ADMIN DASHBOARD
===================================================== */

export default function DashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [stockChart, setStockChart] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);

  /* ================= SAFE FETCH ================= */
  const safeFetch = async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      navigate("/login");
      throw new Error("Session expired");
    }

    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "API error");

    return Array.isArray(json) ? json : json.data || [];
  };

  /* ================= FETCH DASHBOARD DATA ================= */
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");

        const [p, s, po, inv] = await Promise.all([
          safeFetch("/products"),
          safeFetch("/sales"),
          safeFetch("/purchase"),
          safeFetch("/inventory/summary"),
        ]);

        setProducts(p);
        setSalesOrders(s);
        setPurchaseOrders(po);
        setInventory(inv);

        /* ---------- STOCK CHART ---------- */
        const stock = inv.map((i) => {
          let name = "Unknown";
          if (typeof i.product === "object") name = i.product?.name;
          else name = p.find((x) => x._id === i.product)?.name;

          return {
            name,
            qty: (i.inQty || 0) - (i.outQty || 0),
          };
        });

        setStockChart(stock.filter((s) => s.name && s.name !== "Unknown"));

        /* ---------- SALES TREND ---------- */
        const monthly = {};
        s.forEach((o) => {
          if (!o.createdAt) return;
          const m = new Date(o.createdAt).toLocaleString("default", {
            month: "short",
          });
          monthly[m] = (monthly[m] || 0) + (o.totalAmount || 0);
        });

        setSalesTrend(
          Object.entries(monthly).map(([month, revenue]) => ({
            month,
            revenue,
          }))
        );
      } catch (err) {
        console.error("❌ Dashboard Error:", err);
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, navigate]);

  /* ================= UI STATES ================= */
  if (loading)
    return <div className="p-6 text-slate-500">Loading dashboard…</div>;

  if (error)
    return (
      <div className="p-6 text-red-600">
        {error}
        <button
          onClick={() => window.location.reload()}
          className="block mt-2 text-sm underline"
        >
          Retry
        </button>
      </div>
    );

  const lowStock = stockChart.filter((s) => s.qty < 10);

  /* ================= KPI CONFIG ================= */
  const kpis = [
    { label: "Products", value: products.length, icon: Package },
    {
      label: "Low Stock",
      value: lowStock.length,
      icon: AlertTriangle,
      danger: true,
    },
    { label: "Sales Orders", value: salesOrders.length, icon: ShoppingCart },
    {
      label: "Purchase Orders",
      value: purchaseOrders.length,
      icon: ClipboardList,
    },
    { label: "Users", value: "—", icon: Users },
    { label: "Revenue", value: "Live", icon: TrendingUp },
    
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 bg-slate-100">
    
{/* ================= PREMIUM DASHBOARD HEADER ================= */}
<div className="relative overflow-hidden border shadow-sm bg-gradient-to-br from-white via-slate-50 to-indigo-50 rounded-3xl border-slate-200">

  {/* Background Effects */}
  <div className="absolute top-0 right-0 rounded-full w-96 h-96 bg-indigo-500/10 blur-3xl" />
  <div className="absolute bottom-0 left-0 rounded-full w-80 h-80 bg-sky-500/10 blur-3xl" />
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_35%)]" />

  <div className="relative p-6 lg:p-8">

    {/* TOP SECTION */}
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

      {/* LEFT */}
      <div className="flex items-start gap-4">

        {/* Logo Block */}
        <div className="flex items-center justify-center flex-shrink-0 text-white shadow-lg w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl">
          <BarChart3 size={28} />
        </div>

        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider text-indigo-700 uppercase border border-indigo-100 rounded-full bg-indigo-50">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            ReadyTech Solutions
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Business Performance Dashboard
          </h1>

          <p className="max-w-3xl mt-2 text-sm leading-relaxed text-slate-500">
            Monitor sales growth, inventory performance, purchasing trends and
            operational efficiency through real-time analytics and actionable
            business insights.
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex flex-col items-start gap-3 lg:items-end">

        <div className="px-4 py-2 border bg-white/70 backdrop-blur-md rounded-2xl border-slate-200">
          <p className="text-xs text-slate-400">
            Last Synced
          </p>

          <p className="font-semibold text-slate-700">
            {new Date().toLocaleString()}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 border border-green-200 rounded-full bg-green-50">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          System Healthy
        </div>
      </div>
    </div>

    {/* KPI STRIP */}
    <div className="grid gap-4 mt-8 md:grid-cols-2 xl:grid-cols-4">

      {/* Sales */}
      <div className="p-5 transition-all duration-300 border bg-white/80 backdrop-blur-sm rounded-2xl border-slate-200 hover:shadow-lg">
        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Today's Sales
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              ₹ {salesTrend?.at(-1)?.revenue || 0}
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Latest revenue generated
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 text-green-600 bg-green-100 rounded-xl">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div className="p-5 transition-all duration-300 border bg-white/80 backdrop-blur-sm rounded-2xl border-slate-200 hover:shadow-lg">
        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Inventory Health
            </p>

            <h3
              className={`mt-2 text-2xl font-bold ${
                lowStock.length === 0
                  ? "text-green-600"
                  : "text-orange-500"
              }`}
            >
              {lowStock.length === 0
                ? "Stable"
                : "Attention"}
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              {lowStock.length} low stock items
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 text-blue-600 bg-blue-100 rounded-xl">
            <Package size={22} />
          </div>
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="p-5 transition-all duration-300 border bg-white/80 backdrop-blur-sm rounded-2xl border-slate-200 hover:shadow-lg">
        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Pending Purchases
            </p>

            <h3 className="mt-2 text-2xl font-bold text-amber-600">
              {
                purchaseOrders.filter(
                  (p) => p.status !== "RECEIVED"
                ).length
              }
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Awaiting supplier delivery
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-100 text-amber-600">
            <ShoppingCart size={22} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 text-white shadow-lg bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl">

        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} />
          <p className="text-sm font-semibold tracking-wide uppercase">
            Quick Actions
          </p>
        </div>

        <div className="flex gap-3 mt-4">

          <button
            onClick={() => navigate("/leads")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition bg-white rounded-xl text-slate-900 hover:bg-slate-100"
          >
            <Plus size={16} />
            Leads
          </button>

          <button
            onClick={() => navigate("/products")}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition border rounded-xl border-white/30 hover:bg-white/10"
          >
            <Package size={16} />
            Product
          </button>
        </div>

        <p className="mt-4 text-xs text-indigo-200">
          Create and manage business records instantly.
        </p>
      </div>
    </div>

  </div>
</div>


     {/* ================= PREMIUM KPI OVERVIEW ================= */}
<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">

  {kpis.map((k, i) => (
    <div
      key={i}
      className="relative p-5 overflow-hidden transition-all duration-300 border shadow-sm group rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Decorative Gradient */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20
        ${
          k.danger
            ? "bg-red-500"
            : "bg-indigo-500"
        }`}
      />

      {/* Top Section */}
      <div className="relative flex items-start justify-between">

        {/* Label */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-500">
            {k.label}
          </p>

          <div className="flex items-end gap-2 mt-3">

            <h3 className="text-3xl font-bold tracking-tight text-slate-900">
              {k.value}
            </h3>

            <span
              className={`
                mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
                ${
                  k.danger
                    ? "bg-red-100 text-red-600"
                    : "bg-green-100 text-green-600"
                }
              `}
            >
              {k.danger ? "Alert" : "Good"}
            </span>

          </div>

          <p
            className={`mt-2 text-xs leading-relaxed
              ${
                k.danger
                  ? "text-red-600"
                  : "text-slate-500"
              }
            `}
          >
            {k.subtitle}
          </p>
        </div>

        {/* Premium Icon */}
        <div
          className={`
            relative flex h-14 w-14 items-center justify-center
            rounded-2xl shadow-sm transition-all duration-300
            group-hover:scale-110
            ${
              k.danger
                ? "bg-gradient-to-br from-red-500 to-rose-600 text-white"
                : "bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white"
            }
          `}
        >
          <k.icon size={26} />
        </div>
      </div>

      {/* Divider */}
      <div className="my-5 border-t border-slate-100" />

      {/* Bottom Metrics */}
      <div className="flex items-center justify-between">

        <div>
          <p className="text-[11px] text-slate-400">
            Last Updated
          </p>

          <p className="mt-1 text-xs font-medium text-slate-600">
            Today
          </p>
        </div>

        <div
          className={`
            inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium
            ${
              k.danger
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600"
            }
          `}
        >
          <span
            className={`
              h-2 w-2 rounded-full
              ${
                k.danger
                  ? "bg-red-500"
                  : "bg-green-500"
              }
            `}
          />

          {k.danger
            ? "Needs Attention"
            : "Performing Well"}
        </div>

      </div>

      {/* Premium Bottom Glow */}
      <div
        className={`
          absolute bottom-0 left-0 h-1 w-full
          ${
            k.danger
              ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-400"
              : "bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400"
          }
        `}
      />
    </div>
  ))}
</div>


      {/* ================= BUSINESS ANALYTICS ================= */}
<div className="space-y-6">
  {/* ================= PREMIUM REVENUE ANALYTICS ================= */}

<div className="relative overflow-hidden border shadow-sm rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl">

  {/* Background Effects */}
  <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
  <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />

  <div className="relative p-6">

    {/* HEADER */}
    <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">

      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 text-xs font-semibold tracking-wider uppercase border rounded-full bg-emerald-50 text-emerald-700 border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Inventory Intelligence
        </div>

        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
          Inventory Insights
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Monitor inventory availability, stock movement and replenishment risks
          across all products.
        </p>
      </div>

      <div className="px-4 py-2 border rounded-2xl bg-white/80 border-slate-200">
        <p className="text-xs text-slate-400">
          Inventory Status
        </p>

        <p className="font-semibold text-emerald-600">
          Active Monitoring
        </p>
      </div>

    </div>

    {/* HERO INVENTORY CARD */}
    <div className="p-5 mb-6 text-white shadow-lg rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm text-emerald-100">
            Total Inventory Products
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            {stockChart.length}
          </h2>

          <p className="mt-2 text-sm text-emerald-100">
            Products currently tracked in inventory
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-2xl">

          <Package2 size={20} />

          <div>
            <p className="text-xs text-emerald-100">
              Inventory Health
            </p>

            <p className="font-semibold">
              {
                stockChart.filter((s) => s.qty < 10).length === 0
                  ? "Excellent"
                  : "Attention Required"
              }
            </p>
          </div>

        </div>

      </div>

    </div>

    {/* KPI CARDS */}
    <div className="grid gap-4 mb-8 md:grid-cols-3">

      {/* Total Products */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Products
            </p>

            <h4 className="mt-2 text-3xl font-bold text-slate-900">
              {stockChart.length}
            </h4>

            <p className="mt-1 text-xs text-slate-400">
              Active inventory records
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 text-indigo-600 bg-indigo-100 rounded-2xl">
            <Package size={24} />
          </div>

        </div>

      </div>

      {/* Low Stock */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Low Stock
            </p>

            <h4 className="mt-2 text-3xl font-bold text-red-600">
              {stockChart.filter((s) => s.qty < 10).length}
            </h4>

            <p className="mt-1 text-xs text-slate-400">
              Requires replenishment
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 text-red-600 bg-red-100 rounded-2xl">
            <AlertTriangle size={24} />
          </div>

        </div>

      </div>

      {/* Inventory Health */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
              Health Score
            </p>

            <h4 className="mt-2 text-3xl font-bold text-emerald-600">
              {
                stockChart.filter((s) => s.qty < 10).length === 0
                  ? "100%"
                  : `${Math.max(
                      0,
                      100 -
                        Math.round(
                          (stockChart.filter(
                            (s) => s.qty < 10
                          ).length /
                            Math.max(
                              stockChart.length,
                              1
                            )) *
                            100
                        )
                    )}%`
              }
            </h4>

            <p className="mt-1 text-xs text-slate-400">
              Inventory performance
            </p>
          </div>

          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600">
            <ShieldCheck size={24} />
          </div>

        </div>

      </div>

    </div>

    {/* CHART SECTION */}
    <div className="p-5 border bg-gradient-to-br from-slate-50 to-white rounded-3xl border-slate-200">

      <div className="flex items-center justify-between mb-5">

        <div>
          <h4 className="font-semibold text-slate-800">
            Inventory Distribution
          </h4>

          <p className="text-xs text-slate-500">
            Current stock levels by product
          </p>
        </div>

        <div className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
          Real Time
        </div>

      </div>

      <div className="h-[340px]">

        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stockChart}>

            <defs>
              <linearGradient
                id="inventoryGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#10B981"
                />
                <stop
                  offset="100%"
                  stopColor="#06B6D4"
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#E2E8F0"
            />

            <XAxis
              dataKey="name"
              hide
            />

            <YAxis
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "none",
                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.12)",
              }}
            />

            <Bar
              dataKey="qty"
              fill="url(#inventoryGradient)"
              radius={[10, 10, 0, 0]}
            />

          </BarChart>
        </ResponsiveContainer>

      </div>

    </div>

  </div>
</div>

<div className="relative overflow-hidden border shadow-sm rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl">

  {/* Background Effects */}
  <div className="absolute top-0 right-0 rounded-full w-72 h-72 bg-indigo-500/10 blur-3xl" />
  <div className="absolute bottom-0 left-0 rounded-full w-72 h-72 bg-sky-500/10 blur-3xl" />

  <div className="relative p-6">

    {/* HEADER */}
    <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">

      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-indigo-700 uppercase border border-indigo-100 rounded-full bg-indigo-50">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Revenue Intelligence
        </div>

        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
          Revenue Analytics
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Track monthly revenue performance, growth patterns and sales trends.
        </p>
      </div>

      <div className="flex items-center gap-3">

        <div className="px-4 py-2 border rounded-2xl bg-white/80 border-slate-200">
          <p className="text-xs text-slate-400">
            Data Status
          </p>

          <p className="font-semibold text-green-600">
            Live Tracking
          </p>
        </div>

      </div>
    </div>

    {/* FEATURED REVENUE CARD */}
    <div className="p-5 mb-6 text-white shadow-lg rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <p className="text-sm text-indigo-100">
            Total Revenue Generated
          </p>

          <h2 className="mt-2 text-4xl font-bold">
            ₹
            {salesTrend
              .reduce((a, b) => a + (b.revenue || 0), 0)
              .toLocaleString()}
          </h2>

          <p className="mt-2 text-sm text-indigo-200">
            Consolidated revenue across all periods
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-2xl">
          <TrendingUp size={18} />
          <span className="font-medium">
            Revenue Growing
          </span>
        </div>

      </div>
    </div>

    {/* KPI CARDS */}
    <div className="grid gap-4 mb-8 md:grid-cols-3">

      {/* Total Revenue */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
          Total Revenue
        </p>

        <h4 className="mt-2 text-2xl font-bold text-slate-900">
          ₹
          {salesTrend
            .reduce((a, b) => a + (b.revenue || 0), 0)
            .toLocaleString()}
        </h4>

        <p className="mt-1 text-xs text-slate-400">
          Lifetime generated sales
        </p>

      </div>

      {/* Average Revenue */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
          Monthly Average
        </p>

        <h4 className="mt-2 text-2xl font-bold text-slate-900">
          ₹
          {salesTrend.length
            ? Math.round(
                salesTrend.reduce(
                  (a, b) => a + (b.revenue || 0),
                  0
                ) / salesTrend.length
              ).toLocaleString()
            : 0}
        </h4>

        <p className="mt-1 text-xs text-slate-400">
          Average monthly revenue
        </p>

      </div>

      {/* Trend Status */}
      <div className="p-5 transition-all duration-300 border bg-slate-50 rounded-2xl border-slate-200 hover:shadow-lg">

        <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
          Trend Status
        </p>

        <div className="flex items-center gap-2 mt-2">

          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />

          <h4 className="text-2xl font-bold text-green-600">
            Growing
          </h4>

        </div>

        <p className="mt-1 text-xs text-slate-400">
          Revenue trend remains positive
        </p>

      </div>

    </div>

    {/* CHART SECTION */}
    <div className="p-5 border bg-gradient-to-br from-slate-50 to-white rounded-3xl border-slate-200">

      <div className="flex items-center justify-between mb-5">

        <div>
          <h4 className="font-semibold text-slate-800">
            Revenue Trend Analysis
          </h4>

          <p className="text-xs text-slate-500">
            Monthly revenue progression
          </p>
        </div>

        <div className="px-3 py-1 text-xs font-medium text-indigo-700 rounded-full bg-indigo-50">
          Updated Today
        </div>

      </div>

      <div className="h-[340px]">

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={salesTrend}>

            <defs>
              <linearGradient
                id="lineRevenue"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#6366F1"
                />
                <stop
                  offset="100%"
                  stopColor="#8B5CF6"
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              stroke="#E2E8F0"
            />

            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "none",
                boxShadow:
                  "0 10px 30px rgba(0,0,0,0.1)",
              }}
            />

            <Line
              type="monotone"
              dataKey="revenue"
              stroke="url(#lineRevenue)"
              strokeWidth={4}
              dot={{
                r: 5,
                fill: "#6366F1",
              }}
              activeDot={{
                r: 8,
              }}
            />

          </LineChart>
        </ResponsiveContainer>

      </div>

    </div>

  </div>
</div>

</div>


      {/* ================= PREMIUM PURCHASE ORDERS ================= */}
<div className="relative overflow-hidden border shadow-sm rounded-3xl border-slate-200 bg-white/90 backdrop-blur-xl">

  {/* Background Effects */}
  <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl" />
  <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl" />

  <div className="relative p-6">

    {/* HEADER */}
    <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">

      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 text-xs font-semibold tracking-wider uppercase border rounded-full text-violet-700 bg-violet-50 border-violet-100">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
          Procurement Intelligence
        </div>

        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
          Recent Purchase Orders
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Monitor supplier orders, procurement activity and delivery status.
        </p>
      </div>

      <div className="px-4 py-2 border rounded-2xl bg-white/80 border-slate-200">
        <p className="text-xs text-slate-400">
          Orders Showing
        </p>

        <p className="font-semibold text-violet-600">
          Last 5 Records
        </p>
      </div>

    </div>

    {/* SUMMARY STRIP */}
    <div className="grid gap-4 mb-8 md:grid-cols-3">

      <div className="p-5 border rounded-2xl bg-slate-50 border-slate-200">
        <p className="text-xs uppercase text-slate-500">
          Total Orders
        </p>
        <h4 className="mt-2 text-3xl font-bold text-slate-900">
          {purchaseOrders.length}
        </h4>
      </div>

      <div className="p-5 border rounded-2xl bg-slate-50 border-slate-200">
        <p className="text-xs uppercase text-slate-500">
          Pending Orders
        </p>
        <h4 className="mt-2 text-3xl font-bold text-amber-600">
          {
            purchaseOrders.filter(
              (p) => p.status !== "RECEIVED"
            ).length
          }
        </h4>
      </div>

      <div className="p-5 border rounded-2xl bg-slate-50 border-slate-200">
        <p className="text-xs uppercase text-slate-500">
          Completed Orders
        </p>
        <h4 className="mt-2 text-3xl font-bold text-green-600">
          {
            purchaseOrders.filter(
              (p) => p.status === "RECEIVED"
            ).length
          }
        </h4>
      </div>

    </div>

    {/* EMPTY STATE */}
    {purchaseOrders.length === 0 && (
      <div className="py-16 text-center border border-dashed rounded-3xl border-slate-300">
        <PackageCheck
          size={48}
          className="mx-auto mb-3 text-slate-300"
        />
        <h4 className="font-semibold text-slate-700">
          No Purchase Orders
        </h4>
        <p className="mt-1 text-sm text-slate-400">
          Purchase orders will appear here once created.
        </p>
      </div>
    )}

    {/* ORDER LIST */}
    <div className="space-y-4">

      {purchaseOrders
        .slice(-5)
        .reverse()
        .map((po) => (

          <div
            key={po._id}
            className="p-5 transition-all duration-300 bg-white border group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-xl"
          >

            <div className="flex flex-col gap-5 xl:flex-row xl:items-center">

              {/* Left */}
              <div className="flex items-center flex-1 gap-4">

                <div className="flex items-center justify-center text-white w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600">
                  <ShoppingCart size={24} />
                </div>

                <div>
                  <h4 className="font-semibold text-slate-900">
                    {po.poNumber}
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    Vendor:{" "}
                    {po.vendor?.name ||
                      "Unknown Vendor"}
                  </p>
                </div>

              </div>

              {/* Items */}
              <div className="text-center">

                <p className="text-xs uppercase text-slate-400">
                  Items
                </p>

                <p className="font-bold text-slate-800">
                  {po.items?.length || 0}
                </p>

              </div>

              {/* Amount */}
              <div className="text-center">

                <p className="text-xs uppercase text-slate-400">
                  Amount
                </p>

                <p className="font-bold text-slate-900">
                  ₹
                  {po.totalAmount?.toLocaleString() ||
                    0}
                </p>

              </div>

              {/* Status */}
              <div>

                <span
                  className={`px-4 py-2 rounded-full text-xs font-semibold ${
                    po.status === "RECEIVED"
                      ? "bg-green-100 text-green-700"
                      : po.status === "CANCELLED"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {po.status}
                </span>

              </div>

              {/* Date */}
              <div className="text-right">

                <p className="text-xs text-slate-400">
                  Created
                </p>

                <p className="font-medium text-slate-700">
                  {po.createdAt
                    ? new Date(
                        po.createdAt
                      ).toLocaleDateString()
                    : "-"}
                </p>

              </div>

            </div>

          </div>

        ))}
    </div>

  </div>
</div>

    </div>
  );
}
