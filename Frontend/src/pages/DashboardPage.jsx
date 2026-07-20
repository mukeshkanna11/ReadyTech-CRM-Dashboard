import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  Users,
  UserPlus,
  Briefcase,
  Wallet,
  Trophy,
  ShieldCheck,
  PackageCheck,
  PackageX,
  Zap,
  Plus,
  RefreshCw,
  Bot,
  Boxes,
  Warehouse,
  ArrowUpRight,
  CalendarCheck,
  Phone,
  Mail,
  Activity as ActivityIcon,
  Star,
  Building2,
  IndianRupee,
} from "lucide-react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
// import InventoryAIAssistant from "../components/InventoryAIAssistant";

/* ==================================================== */
const API_BASE = "https://readytech-crm-dashboard.onrender.com/api";

const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Closed"];
const STATUS_COLORS = { New: "#3b82f6", Contacted: "#f59e0b", Qualified: "#22c55e", Closed: "#64748b" };

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const num = (n) => Number(n || 0).toLocaleString("en-IN");
const byDateDesc = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/* =====================================================
   PREMIUM EXECUTIVE CRM + ERP DASHBOARD
===================================================== */
export default function DashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [syncedAt, setSyncedAt] = useState(null);

  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [activities, setActivities] = useState([]);

  /* ================= SAFE FETCH (existing logic) ================= */
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

    if (Array.isArray(json)) return json;
    if (Array.isArray(json.data)) return json.data;
    // tolerate other list envelopes (e.g. { salesOrders }, { orders }, { results })
    return Object.values(json).find((v) => Array.isArray(v)) || [];
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

        // Core ERP endpoints (401 here still redirects to login)
        const [p, s, po, inv] = await Promise.all([
          safeFetch("/products"),
          safeFetch("/sales"),
          safeFetch("/purchase"),
          safeFetch("/inventory/summary"),
        ]);

        // CRM endpoints — degrade gracefully if unavailable for this role
        const [ld, cl, op, ac] = await Promise.all([
          safeFetch("/leads").catch(() => []),
          safeFetch("/clients").catch(() => []),
          safeFetch("/opportunities?limit=1000").catch(() => []),
          safeFetch("/activities?limit=1000").catch(() => []),
        ]);

        setProducts(p);
        setSalesOrders(s);
        setPurchaseOrders(po);
        setInventory(inv);
        setLeads(ld);
        setClients(cl);
        setOpportunities(op);
        setActivities(ac);
        setSyncedAt(new Date());
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
    return (
      <div className="grid min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 border-4 rounded-full border-slate-200" />
            <div className="absolute inset-0 border-4 border-transparent rounded-full border-t-indigo-600 animate-spin" />
            <div className="absolute inset-0 grid text-indigo-600 place-items-center">
              <BarChart3 size={20} />
            </div>
          </div>
          <p className="text-sm font-medium tracking-wide text-slate-500">
            Loading your dashboard…
          </p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="grid min-h-screen p-6 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 place-items-center">
        <div className="w-full max-w-md p-8 text-center bg-white border shadow-xl rounded-3xl border-slate-200">
          <div className="grid mx-auto mb-4 rounded-2xl h-14 w-14 place-items-center bg-red-50 text-red-500">
            <AlertTriangle size={26} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Unable to load dashboard</h3>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 mt-6 text-sm font-semibold text-white transition rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );

  /* ================= DERIVED (live) METRICS ================= */
  const orderAmount = (so) =>
    typeof so.totalAmount === "number" && so.totalAmount > 0
      ? so.totalAmount
      : (so.items || []).reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0);

  const productName = (ref) => {
    if (!ref) return null;
    if (typeof ref === "object") return ref.name || null;
    return products.find((x) => x._id === ref)?.name || null;
  };

  /* Revenue + monthly trend */
  const totalRevenue = salesOrders.reduce((s, so) => s + orderAmount(so), 0);
  const trendMap = {};
  salesOrders.forEach((so) => {
    if (!so.createdAt) return;
    const dt = new Date(so.createdAt);
    const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, "0")}`;
    if (!trendMap[key])
      trendMap[key] = { key, month: dt.toLocaleString("default", { month: "short" }), revenue: 0, orders: 0 };
    trendMap[key].revenue += orderAmount(so);
    trendMap[key].orders += 1;
  });
  const salesTrend = Object.values(trendMap).sort((a, b) => a.key.localeCompare(b.key));
  const monthlyAvg = salesTrend.length ? Math.round(totalRevenue / salesTrend.length) : 0;

  /* Inventory */
  const stockChart = inventory
    .map((i) => {
      const name = productName(i.product) || "Unknown";
      const qty = i.available ?? (i.inQty || 0) - (i.outQty || 0);
      const limit = i.lowStockLimit ?? i.product?.lowStockLimit ?? 10;
      return { name, qty, limit };
    })
    .filter((s) => s.name && s.name !== "Unknown");
  const totalUnits = stockChart.reduce((s, x) => s + x.qty, 0);
  const lowStock = stockChart.filter((s) => s.qty > 0 && s.qty <= s.limit);
  const outOfStock = stockChart.filter((s) => s.qty <= 0);
  const healthScore = stockChart.length
    ? Math.max(0, 100 - Math.round(((lowStock.length + outOfStock.length) / stockChart.length) * 100))
    : 100;
  const warehouseCount = new Set(
    inventory.map((i) => i.warehouse?._id || i.warehouse?.name).filter(Boolean)
  ).size;

  /* Low stock detail rows */
  const lowStockRows = inventory
    .map((i) => ({
      name: productName(i.product) || "Unknown",
      warehouse: i.warehouse?.name || "—",
      qty: i.available ?? (i.inQty || 0) - (i.outQty || 0),
      limit: i.lowStockLimit ?? i.product?.lowStockLimit ?? 10,
    }))
    .filter((r) => r.name !== "Unknown" && r.qty <= r.limit)
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 6);

  /* Sales */
  const delivered = salesOrders.filter((o) => o.status === "DELIVERED").length;
  const approved = salesOrders.filter((o) => o.status === "APPROVED").length;
  const recentSales = salesOrders.slice().sort(byDateDesc).slice(0, 5);

  /* CRM */
  const qualifiedLeads = leads.filter((l) => l.status === "Qualified").length;
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const openOpps = opportunities.filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost");
  const pipelineValue = openOpps.reduce((s, o) => s + (o.value || 0), 0);
  const wonRevenue = opportunities.filter((o) => o.stage === "Closed Won").reduce((s, o) => s + (o.value || 0), 0);
  const leadStatusData = LEAD_STATUSES.map((st) => ({
    name: st,
    value: leads.filter((l) => l.status === st).length,
  })).filter((d) => d.value > 0);

  /* Purchase */
  const poAmount = (p) =>
    typeof p.totalAmount === "number" && p.totalAmount > 0
      ? p.totalAmount
      : (p.items || []).reduce((s, i) => s + (i.qty || 0) * (i.cost || 0), 0);
  const pendingPO = purchaseOrders.filter((p) => p.status !== "RECEIVED").length;
  const completedPO = purchaseOrders.filter((p) => p.status === "RECEIVED").length;
  const purchaseSpend = purchaseOrders.reduce((s, p) => s + poAmount(p), 0);

  /* Top products / customers */
  const productAgg = {};
  salesOrders.forEach((so) =>
    (so.items || []).forEach((i) => {
      const name = productName(i.product) || i.name;
      if (!name) return;
      if (!productAgg[name]) productAgg[name] = { name, units: 0, revenue: 0 };
      productAgg[name].units += i.qty || 0;
      productAgg[name].revenue += (i.qty || 0) * (i.price || 0);
    })
  );
  const topProducts = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const customerAgg = {};
  salesOrders.forEach((so) => {
    const name = so.customer?.name || so.client?.companyName || "Unknown";
    if (!customerAgg[name]) customerAgg[name] = { name, revenue: 0, orders: 0 };
    customerAgg[name].revenue += orderAmount(so);
    customerAgg[name].orders += 1;
  });
  const topCustomers = Object.values(customerAgg)
    .filter((c) => c.name !== "Unknown")
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  /* Recent activity (fallback to newest leads) */
  const recentActivities = activities.length
    ? activities.slice().sort(byDateDesc).slice(0, 6).map((a) => ({
        id: a._id,
        icon: ACTIVITY_ICON[a.type] || <ActivityIcon size={15} className="text-slate-400" />,
        title: a.type || "Activity",
        desc: a.notes || "No notes",
        time: a.createdAt,
      }))
    : leads.slice().sort(byDateDesc).slice(0, 6).map((l) => ({
        id: l._id,
        icon: <UserPlus size={15} className="text-indigo-500" />,
        title: "New Lead",
        desc: `${l.name || "Unknown"}${l.source ? ` · ${l.source}` : ""}`,
        time: l.createdAt,
      }));

  /* ================= KPI GROUPS (all live) ================= */
  const kpiGroups = [
    {
      title: "Revenue",
      items: [
        { label: "Total Revenue", value: inr(totalRevenue), icon: Wallet, tone: "emerald" },
        { label: "Monthly Average", value: inr(monthlyAvg), icon: TrendingUp, tone: "indigo" },
        { label: "Won Deal Revenue", value: inr(wonRevenue), icon: Trophy, tone: "amber" },
        { label: "Purchase Spend", value: inr(purchaseSpend), icon: IndianRupee, tone: "violet" },
      ],
    },
    {
      title: "Sales",
      items: [
        { label: "Total Orders", value: num(salesOrders.length), icon: ShoppingCart, tone: "indigo" },
        { label: "Delivered", value: num(delivered), icon: PackageCheck, tone: "emerald" },
        { label: "Approved", value: num(approved), icon: CalendarCheck, tone: "sky" },
        { label: "Sales Revenue", value: inr(totalRevenue), icon: Wallet, tone: "violet" },
      ],
    },
    {
      title: "CRM",
      items: [
        { label: "Total Leads", value: num(leads.length), icon: Users, tone: "indigo", hint: `${qualifiedLeads} qualified` },
        { label: "Clients", value: num(clients.length), icon: Building2, tone: "sky", hint: `${activeClients} active` },
        { label: "Open Opportunities", value: num(openOpps.length), icon: Briefcase, tone: "violet" },
        { label: "Pipeline Value", value: inr(pipelineValue), icon: Wallet, tone: "emerald" },
      ],
    },
    {
      title: "ERP",
      items: [
        { label: "Products", value: num(products.length), icon: Package, tone: "indigo" },
        { label: "Warehouses", value: num(warehouseCount), icon: Warehouse, tone: "sky" },
        { label: "Inventory Items", value: num(stockChart.length), icon: Boxes, tone: "violet" },
        { label: "Purchase Orders", value: num(purchaseOrders.length), icon: ShoppingCart, tone: "amber" },
      ],
    },
    {
      title: "Inventory",
      items: [
        { label: "Total Units", value: num(totalUnits), icon: Boxes, tone: "indigo" },
        { label: "Low Stock", value: num(lowStock.length), icon: AlertTriangle, tone: "amber", danger: lowStock.length > 0 },
        { label: "Out of Stock", value: num(outOfStock.length), icon: PackageX, tone: "red", danger: outOfStock.length > 0 },
        { label: "Health Score", value: `${healthScore}%`, icon: ShieldCheck, tone: "emerald" },
      ],
    },
    {
      title: "Purchase",
      items: [
        { label: "Total POs", value: num(purchaseOrders.length), icon: ShoppingCart, tone: "violet" },
        { label: "Pending", value: num(pendingPO), icon: CalendarCheck, tone: "amber" },
        { label: "Completed", value: num(completedPO), icon: PackageCheck, tone: "emerald" },
        { label: "Total Spend", value: inr(purchaseSpend), icon: IndianRupee, tone: "indigo" },
      ],
    },
  ];

  const quickActions = [
    { label: "New Lead", icon: UserPlus, to: "/leads" },
    { label: "Add Client", icon: Building2, to: "/clients" },
    { label: "Products", icon: Package, to: "/products" },
    { label: "Inventory", icon: Boxes, to: "/stocks/inventory" },
    { label: "Sales Orders", icon: ShoppingCart, to: "/stocks/sales-orders" },
    { label: "Invoices", icon: BarChart3, to: "/invoices" },
  ];

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen p-4 space-y-6 sm:p-6 lg:p-8 lg:space-y-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      {/* ============ EXECUTIVE SUMMARY HERO ============ */}
      <div className="relative overflow-hidden text-white shadow-xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
        <div className="absolute rounded-full -top-24 -right-24 h-80 w-80 bg-indigo-500/20 blur-3xl" />
        <div className="absolute rounded-full -bottom-24 -left-24 h-80 w-80 bg-cyan-500/10 blur-3xl" />

        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 place-items-center">
                <BarChart3 size={28} />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  ReadyTech Executive Overview
                </div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Executive Dashboard</h1>
                <p className="max-w-2xl mt-2 text-sm leading-relaxed text-slate-300">
                  A unified real-time view across CRM and ERP — revenue, sales, pipeline,
                  inventory and procurement in one place.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <div className="px-4 py-2 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">
                <p className="text-xs text-slate-400">Last Synced</p>
                <p className="text-sm font-semibold">
                  {syncedAt ? syncedAt.toLocaleString() : "—"}
                </p>
              </div>
              {/* <button
                onClick={() => setAiOpen(true)}
                disabled={inventory.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition rounded-2xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bot size={16} /> AI Insights
              </button> */}
            </div>
          </div>

          {/* Headline metrics — glassmorphism */}
          <div className="grid grid-cols-2 gap-4 mt-8 lg:grid-cols-4">
            <HeroStat label="Total Revenue" value={inr(totalRevenue)} accent="text-emerald-300" />
            <HeroStat label="Pipeline Value" value={inr(pipelineValue)} accent="text-indigo-300" />
            <HeroStat label="Sales Orders" value={num(salesOrders.length)} accent="text-white" />
            <HeroStat label="Active Clients" value={num(activeClients)} accent="text-cyan-300" />
          </div>
        </div>
      </div>

      {/* ============ KPI GROUPS ============ */}
      {kpiGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-slate-500">
              {group.title} KPIs
            </h2>
            <div className="flex-1 border-t border-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {group.items.map((k) => (
              <Kpi key={k.label} {...k} />
            ))}
          </div>
        </section>
      ))}

      {/* ============ CHARTS ============ */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Monthly revenue trend */}
        <SectionCard
          className="xl:col-span-2"
          title="Monthly Revenue Trend"
          subtitle="Consolidated sales revenue by month"
          badge="Live"
        >
          {salesTrend.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip
                    formatter={(v) => inr(v)}
                    contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty icon={TrendingUp} title="No revenue yet" subtitle="Sales revenue will appear here once orders are placed." />
          )}
        </SectionCard>

        {/* Lead status distribution */}
        <SectionCard title="Lead Status" subtitle="Distribution across the funnel" badge="CRM">
          {leadStatusData.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadStatusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={3}>
                    {leadStatusData.map((d) => (
                      <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty icon={Users} title="No leads yet" subtitle="Lead insights will appear once leads are added." />
          )}
        </SectionCard>
      </div>

      {/* Inventory distribution */}
      <SectionCard title="Inventory Distribution" subtitle="Current stock levels by product" badge="Real Time">
        {stockChart.length ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="name" hide />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }} />
                <Bar dataKey="qty" fill="url(#stockFill)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty icon={Boxes} title="No inventory data" subtitle="Stock levels will appear here once inventory is recorded." />
        )}
      </SectionCard>

      {/* ============ RECENT SALES + ACTIVITY ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Recent Sales"
          subtitle="Latest customer orders"
          action={{ label: "View all", onClick: () => navigate("/stocks/sales-orders") }}
        >
          {recentSales.length ? (
            <ul className="divide-y divide-slate-100">
              {recentSales.map((so) => (
                <li key={so._id} className="flex items-center gap-3 py-3">
                  <span className="grid text-xs font-bold text-white rounded-xl h-9 w-9 shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
                    {(so.customer?.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-800">
                      {so.customer?.name || "Unknown Customer"}
                    </p>
                    <p className="text-xs truncate text-slate-500">{so.soNumber || "Sales Order"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">{inr(orderAmount(so))}</p>
                    <p className="text-[11px] text-slate-400">
                      {so.createdAt ? new Date(so.createdAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={ShoppingCart} title="No sales yet" subtitle="Recent orders will appear here." />
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activities"
          subtitle="Latest CRM interactions"
          action={{ label: "View all", onClick: () => navigate("/salesforce/activities") }}
        >
          {recentActivities.length ? (
            <ul className="divide-y divide-slate-100">
              {recentActivities.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="grid rounded-full h-9 w-9 shrink-0 bg-slate-50 place-items-center">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-800">{a.title}</p>
                    <p className="text-xs truncate text-slate-500">{a.desc}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {a.time ? new Date(a.time).toLocaleDateString() : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={ActivityIcon} title="No activity yet" subtitle="CRM activity will appear here." />
          )}
        </SectionCard>
      </div>

      {/* ============ TOP PRODUCTS + TOP CUSTOMERS ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Top Products" subtitle="Best performers by revenue">
          {topProducts.length ? (
            <ul className="space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="grid text-xs font-bold rounded-lg h-7 w-7 shrink-0 bg-indigo-50 text-indigo-600 place-items-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">{num(p.units)} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{inr(p.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Star} title="No product sales" subtitle="Top products appear once orders include items." />
          )}
        </SectionCard>

        <SectionCard title="Top Customers" subtitle="Highest revenue accounts">
          {topCustomers.length ? (
            <ul className="space-y-3">
              {topCustomers.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="grid text-xs font-bold text-white rounded-lg h-7 w-7 shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600 place-items-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{num(c.orders)} orders</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{inr(c.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Users} title="No customers yet" subtitle="Top customers appear once orders are placed." />
          )}
        </SectionCard>
      </div>

      {/* ============ LOW STOCK ALERTS ============ */}
      <SectionCard
        title="Low Stock Alerts"
        subtitle="Items at or below their reorder limit"
        badge={lowStockRows.length ? `${lowStock.length + outOfStock.length} items` : "Healthy"}
        badgeTone={lowStockRows.length ? "amber" : "emerald"}
        action={{ label: "Manage", onClick: () => navigate("/stocks/inventory") }}
      >
        {lowStockRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 font-medium text-left">Product</th>
                  <th className="hidden py-2 font-medium text-left sm:table-cell">Warehouse</th>
                  <th className="py-2 font-medium text-right">Available</th>
                  <th className="py-2 font-medium text-right">Limit</th>
                  <th className="py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockRows.map((r, i) => {
                  const out = r.qty <= 0;
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2.5 font-medium text-slate-800">{r.name}</td>
                      <td className="hidden py-2.5 text-slate-500 sm:table-cell">{r.warehouse}</td>
                      <td className={`py-2.5 text-right font-semibold ${out ? "text-red-600" : "text-amber-600"}`}>{r.qty}</td>
                      <td className="py-2.5 text-right text-slate-500">{r.limit}</td>
                      <td className="py-2.5 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${out ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {out ? "Out of Stock" : "Low"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={ShieldCheck} title="All stock healthy" subtitle="No products are below their reorder limit." tone="emerald" />
        )}
      </SectionCard>

      {/* ============ QUICK ACTIONS ============ */}
      <SectionCard title="Quick Actions" subtitle="Jump straight into daily workflows" icon={Zap}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="flex flex-col items-center gap-2 px-3 py-4 text-sm font-medium transition border group rounded-2xl border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 hover:-translate-y-0.5"
            >
              <span className="grid p-3 text-indigo-600 transition rounded-xl bg-indigo-50 place-items-center group-hover:scale-110">
                <a.icon size={18} />
              </span>
              <span className="text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ============ AI INSIGHTS PANEL (reused) ============ */}
      {aiOpen && <InventoryAIAssistant inventory={inventory} onClose={() => setAiOpen(false)} />}
    </div>
  );
}

/* ======================================================
   PRESENTATIONAL HELPERS
====================================================== */
const ACTIVITY_ICON = {
  Call: <Phone size={15} className="text-blue-500" />,
  Email: <Mail size={15} className="text-violet-500" />,
  Meeting: <CalendarCheck size={15} className="text-green-500" />,
};

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  red: "bg-red-50 text-red-600",
};

function HeroStat({ label, value, accent }) {
  return (
    <div className="p-4 border rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl">
      <p className="text-xs text-slate-300">{label}</p>
      <p className={`mt-1.5 text-xl font-bold sm:text-2xl truncate ${accent}`}>{value}</p>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "indigo", hint, danger }) {
  return (
    <div className="p-5 transition bg-white border shadow-sm rounded-3xl border-slate-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold truncate ${danger ? "text-red-600" : "text-slate-900"}`}>{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONES[tone] || TONES.indigo}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, badge, badgeTone = "indigo", icon: Icon, action, className = "", children }) {
  const badgeStyles = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`p-5 bg-white border shadow-sm rounded-3xl border-slate-200 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="grid p-2.5 text-indigo-600 rounded-xl bg-indigo-50 place-items-center">
              <Icon size={18} />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeStyles[badgeTone] || badgeStyles.indigo}`}>
              {badge}
            </span>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {action.label} <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ icon: Icon, title, subtitle, tone = "slate" }) {
  const tones = { slate: "bg-slate-50 text-slate-400", emerald: "bg-emerald-50 text-emerald-500" };
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`grid mb-3 rounded-2xl h-12 w-12 place-items-center ${tones[tone] || tones.slate}`}>
        <Icon size={24} />
      </div>
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      {subtitle && <p className="mt-1 text-xs text-slate-400 max-w-xs">{subtitle}</p>}
    </div>
  );
}
