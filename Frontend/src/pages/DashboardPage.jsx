import { useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  ClipboardList,
  Users,
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


/* ==================================================== */
const API_BASE = "https://readytech-crm-dashboard.onrender.com/api";

/* =====================================================
   PREMIUM ZOHO-STYLE ADMIN DASHBOARD
===================================================== */

export default function DashboardPage() {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventory, setInventory] = useState([]);

  const [stockChart, setStockChart] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);

  const navigate = useNavigate();
  
  /* ================= SAFE FETCH ================= */
  const safeFetch = async (url) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load data");
    const json = await res.json();
    return Array.isArray(json) ? json : json?.data || [];
  };

  /* ================= FETCH ALL ================= */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [p, s, po, inv] = await Promise.all([
          safeFetch("/api/products"),
          safeFetch("/api/sales"),
          safeFetch("/api/purchase"),
          safeFetch("/api/inventory/summary"),
        ]);

        setProducts(p);
        setSalesOrders(s);
        setPurchaseOrders(po);
        setInventory(inv);

        /* ---------- STOCK CALCULATION ---------- */
        const stock = inv.map((i) => {
          let productName = "Unknown";

          if (typeof i.product === "object") {
            productName = i.product?.name;
          } else {
            const found = p.find((x) => x._id === i.product);
            productName = found?.name;
          }

          return {
            name: productName,
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
          Object.keys(monthly).map((m) => ({
            month: m,
            revenue: monthly[m],
          }))
        );
      } catch (err) {
        setError("Dashboard data failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <div className="p-6 text-slate-500">Loading dashboard…</div>;

  if (error)
    return <div className="p-6 text-red-600">{error}</div>;

  const lowStock = stockChart.filter((s) => s.qty < 10);

  /* ================= KPI CONFIG ================= */
  const kpis = [
    {
      label: "Products",
      value: products.length,
      icon: Package,
    },
    {
      label: "Low Stock",
      value: lowStock.length,
      icon: AlertTriangle,
      danger: true,
    },
    {
      label: "Sales Orders",
      value: salesOrders.length,
      icon: ShoppingCart,
    },
    {
      label: "Purchase Orders",
      value: purchaseOrders.length,
      icon: ClipboardList,
    },
    {
      label: "Users",
      value: 38,
      icon: Users,
    },
    {
      label: "Revenue",
      value: "Live",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 bg-slate-100">
     {/* ================= DASHBOARD HEADER ================= */}
<div className="relative p-6 overflow-hidden bg-white border shadow-sm rounded-2xl">
  {/* Decorative background accents */}
  <div className="absolute w-48 h-48 bg-indigo-100 rounded-full -top-16 -right-16 blur-3xl opacity-60" />
  <div className="absolute w-48 h-48 rounded-full bg-sky-100 -bottom-16 -left-16 blur-3xl opacity-60" />

  <div className="relative space-y-5">
    {/* Top Row */}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Title & Description */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">
          ReadyTech Solutions
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">
          Business Performance Dashboard
        </h1>

        <p className="max-w-2xl mt-1 text-sm text-slate-500">
          Monitor sales momentum, inventory health, purchase efficiency and
          overall operational performance — all in one place.
        </p>
      </div>

      {/* System Status */}
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className="text-xs text-slate-400">Last synced</span>
        <span className="text-sm font-medium text-slate-600">
          {new Date().toLocaleString()}
        </span>

        <span className="inline-flex items-center gap-2 px-3 py-1 mt-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
          ● System Healthy
        </span>
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-slate-200" />

    {/* Bottom Row – Quick Insights & Actions */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Insight 1 */}
      <div className="p-4 border rounded-xl bg-slate-50">
        <p className="text-xs text-slate-500">Today’s Sales</p>
        <p className="mt-1 text-lg font-semibold text-slate-800">
          ₹ {salesTrend?.at(-1)?.revenue || 0}
        </p>
        <p className="text-xs text-slate-400">Based on latest orders</p>
      </div>

      {/* Insight 2 */}
      <div className="p-4 border rounded-xl bg-slate-50">
        <p className="text-xs text-slate-500">Inventory Health</p>
        <p className="mt-1 text-lg font-semibold text-green-600">
          {lowStock.length === 0 ? "Stable" : "Attention Needed"}
        </p>
        <p className="text-xs text-slate-400">
          {lowStock.length} low stock items
        </p>
      </div>

      {/* Insight 3 */}
      <div className="p-4 border rounded-xl bg-slate-50">
        <p className="text-xs text-slate-500">Pending Purchases</p>
        <p className="mt-1 text-lg font-semibold text-yellow-600">
          {purchaseOrders.filter(p => p.status !== "RECEIVED").length}
        </p>
        <p className="text-xs text-slate-400">Awaiting suppliers</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col justify-between p-4 border rounded-xl bg-indigo-50">
        <p className="text-xs font-medium text-indigo-600 uppercase">
          Quick Actions
        </p>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => navigate("/leads")}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            + Leads
          </button>

          <button
            onClick={() => navigate("/products")}
            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-100"
          >
            + Product
          </button>
        </div>
      </div>
    </div>
  </div>
</div>


      {/* ================= KPI OVERVIEW ================= */}
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
  {kpis.map((k, i) => (
    <div
      key={i}
      className={`relative p-5 bg-white border rounded-xl shadow-sm transition hover:shadow-md`}
    >
      {/* Accent Bar */}
      <div
        className={`absolute inset-x-0 top-0 h-1 rounded-t-xl ${
          k.danger ? "bg-red-500" : "bg-indigo-500"
        }`}
      />

      <div className="flex items-start justify-between">
        {/* Left Content */}
        <div>
          <p className="text-xs font-medium tracking-wide uppercase text-slate-500">
            {k.label}
          </p>

          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {k.value}
          </p>

          <p
            className={`mt-1 text-xs ${
              k.danger ? "text-red-600" : "text-slate-400"
            }`}
          >
            {k.subtitle}
          </p>
        </div>

        {/* Icon */}
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg ${
            k.danger
              ? "bg-red-50 text-red-600"
              : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <k.icon size={22} />
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-3 mt-4 text-xs border-t text-slate-400">
        <span>Updated today</span>
        <span
          className={`font-medium ${
            k.danger ? "text-red-600" : "text-green-600"
          }`}
        >
          {k.danger ? "Action Needed" : "Healthy"}
        </span>
      </div>
    </div>
  ))}
</div>


      {/* ================= BUSINESS ANALYTICS ================= */}
<div className="grid gap-6 xl:grid-cols-3">
  {/* ================= REVENUE ANALYTICS ================= */}
  <div className="p-6 bg-white border shadow-sm rounded-xl xl:col-span-2">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-800">
          Revenue Analytics
        </h3>
        <p className="text-xs text-slate-500">
          Monthly sales performance overview
        </p>
      </div>

      <span className="px-3 py-1 text-xs font-medium text-indigo-700 rounded-full bg-indigo-50">
        Live Data
      </span>
    </div>

    {/* KPI Strip */}
    <div className="grid gap-4 mb-6 sm:grid-cols-3">
      <div className="p-4 border rounded-lg bg-slate-50">
        <p className="text-xs text-slate-500">Total Revenue</p>
        <p className="text-lg font-semibold text-slate-800">
          ₹
          {salesTrend
            .reduce((a, b) => a + (b.revenue || 0), 0)
            .toLocaleString()}
        </p>
      </div>

      <div className="p-4 border rounded-lg bg-slate-50">
        <p className="text-xs text-slate-500">Average / Month</p>
        <p className="text-lg font-semibold text-slate-800">
          ₹
          {salesTrend.length
            ? Math.round(
                salesTrend.reduce(
                  (a, b) => a + (b.revenue || 0),
                  0
                ) / salesTrend.length
              ).toLocaleString()
            : 0}
        </p>
      </div>

      <div className="p-4 border rounded-lg bg-slate-50">
        <p className="text-xs text-slate-500">Trend Status</p>
        <p className="text-lg font-semibold text-green-600">
          Growing
        </p>
      </div>
    </div>

    {/* Chart */}
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={salesTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#4f46e5"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>

  {/* ================= INVENTORY ANALYTICS ================= */}
  <div className="p-6 bg-white border shadow-sm rounded-xl">
    {/* Header */}
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-slate-800">
        Inventory Insights
      </h3>
      <p className="text-xs text-slate-500">
        Current stock availability by product
      </p>
    </div>

    {/* Stock Summary */}
    <div className="grid gap-3 mb-6">
      <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
        <span className="text-sm text-slate-600">
          Total Products Tracked
        </span>
        <span className="font-semibold text-slate-800">
          {stockChart.length}
        </span>
      </div>

      <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
        <span className="text-sm text-slate-600">
          Low Stock Items
        </span>
        <span className="font-semibold text-red-600">
          {stockChart.filter((s) => s.qty < 10).length}
        </span>
      </div>
    </div>

    {/* Chart */}
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stockChart}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" hide />
          <YAxis />
          <Tooltip />
          <Bar
            dataKey="qty"
            fill="#6366f1"
            radius={[6, 6, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</div>


      {/* ================= RECENT PURCHASE ORDERS ================= */}
      <div className="p-6 bg-white border shadow-sm rounded-xl">
  {/* Header */}
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold text-slate-800">
        Recent Purchase Orders
      </h3>
      <p className="text-xs text-slate-500">
        Latest supplier orders and their current status
      </p>
    </div>

    <span className="px-3 py-1 text-xs font-medium text-indigo-700 rounded-full bg-indigo-50">
      Last 5 Orders
    </span>
  </div>

  {/* Content */}
  <div className="space-y-3">
    {purchaseOrders.length === 0 && (
      <div className="py-10 text-sm text-center text-slate-400">
        No purchase orders created yet
      </div>
    )}

    {purchaseOrders.slice(-5).reverse().map((po) => (
      <div
        key={po._id}
        className="flex flex-col gap-4 p-4 transition border rounded-lg sm:flex-row sm:items-center hover:bg-slate-50"
      >
        {/* PO Info */}
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800">
            {po.poNumber}
          </p>
          <p className="text-xs text-slate-500">
            Vendor: {po.vendor?.name || "Unknown Vendor"}
          </p>
        </div>

        {/* Items */}
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">
            {po.items?.length || 0}
          </span>{" "}
          items
        </div>

        {/* Amount */}
        <div className="text-sm font-semibold text-slate-800">
          ₹{po.totalAmount?.toLocaleString() || 0}
        </div>

        {/* Status */}
        <div>
          <span
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              po.status === "RECEIVED"
                ? "bg-green-100 text-green-700"
                : po.status === "CANCELLED"
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {po.status}
          </span>
        </div>

        {/* Date */}
        <div className="text-xs text-slate-400">
          {po.createdAt
            ? new Date(po.createdAt).toLocaleDateString()
            : "-"}
        </div>
      </div>
    ))}
  </div>
</div>

    </div>
  );
}
