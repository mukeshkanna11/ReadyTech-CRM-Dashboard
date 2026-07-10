import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Warehouse,
  AlertTriangle,
  Search,
  RefreshCcw,
  Plus,
  Minus,
  Clock,
  Boxes,
  PackageX,
  Filter,
  X,
  Bot,
} from "lucide-react";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import InventoryAIAssistant from "../../components/InventoryAIAssistant";

/* ======================================================
   STOCK STATUS TOKENS + HELPERS
====================================================== */
const STOCK_STATUS = {
  out: { label: "Out of Stock", badge: "bg-red-100 text-red-700", text: "text-red-600", bar: "bg-red-500" },
  low: { label: "Low Stock", badge: "bg-amber-100 text-amber-700", text: "text-amber-600", bar: "bg-amber-500" },
  ok: { label: "In Stock", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-600", bar: "bg-emerald-500" },
};

const limitOf = (s) => s.lowStockLimit ?? s.product?.lowStockLimit ?? 10;
const statusOf = (qty, limit) => (qty <= 0 ? "out" : qty <= limit ? "low" : "ok");

export default function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [aiOpen, setAiOpen] = useState(false);

  /* ================= FETCH INVENTORY ================= */
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await API.get("/inventory/summary");

      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      setStocks(list);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory data");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  /* ================= STOCK ACTIONS ================= */
  const handleStockIn = async (stock, qty = 1) => {
    try {
      await API.post("/inventory/stock-in", {
        product: stock.product._id,
        warehouse: stock.warehouse._id,
        quantity: qty,
      });
      toast.success(`Stock increased by ${qty}`);
      fetchInventory();
    } catch (err) {
      toast.error("Stock-in failed");
    }
  };

  const handleStockOut = async (stock, qty = 1) => {
    try {
      await API.post("/inventory/stock-out", {
        product: stock.product._id,
        warehouse: stock.warehouse._id,
        quantity: qty,
      });
      toast.success(`Stock reduced by ${qty}`);
      fetchInventory();
    } catch (err) {
      toast.error("Stock-out failed");
    }
  };

  /* ================= KPI DATA ================= */
  const totalProducts = stocks.length;
  const totalStockQty = stocks.reduce((sum, s) => sum + (s.available ?? 0), 0);
  const lowStockCount = stocks.filter((s) => {
    const q = s.available ?? 0;
    return q > 0 && q <= limitOf(s);
  }).length;
  const outOfStockCount = stocks.filter((s) => (s.available ?? 0) <= 0).length;

const warehouseCount = useMemo(
  () => new Set(stocks.map((s) => s.warehouse?._id || s.warehouse?.name)).size,
  [stocks]
);

const inventoryValue = stocks.reduce((sum, s) => {
  const price = s.product?.price || 0;
  const qty = s.available || 0;
  return sum + price * qty;
}, 0);
  
  /* ================= FILTERS ================= */
  const warehouses = useMemo(
    () => ["All", ...Array.from(new Set(stocks.map((s) => s.warehouse?.name).filter(Boolean)))],
    [stocks]
  );

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks.filter((s) => {
      const matchesSearch =
        !q ||
        s.product?.name?.toLowerCase().includes(q) ||
        s.product?.sku?.toLowerCase().includes(q) ||
        s.warehouse?.name?.toLowerCase().includes(q);
      const matchesWarehouse =
        warehouseFilter === "All" || s.warehouse?.name === warehouseFilter;
      const matchesStatus =
        statusFilter === "All" || statusOf(s.available ?? 0, limitOf(s)) === statusFilter;
      return matchesSearch && matchesWarehouse && matchesStatus;
    });
  }, [stocks, search, warehouseFilter, statusFilter]);

  const hasFilters = search || warehouseFilter !== "All" || statusFilter !== "All";

  return (
    <div className="space-y-6">
      {/* ================= PREMIUM INVENTORY HERO ================= */}
<div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 p-8 text-white shadow-2xl">

  {/* Background Effects */}
  <div className="absolute rounded-full -top-20 -right-20 h-72 w-72 bg-indigo-500/20 blur-3xl"></div>
  <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-cyan-500/10 blur-3xl"></div>

  <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

    {/* Left */}
    <div className="max-w-3xl">

      <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border rounded-full border-white/10 bg-white/10 backdrop-blur-xl">
        <Warehouse size={15} />
        ERP Inventory Module
      </div>

      <h1 className="mt-5 text-4xl font-bold tracking-tight">
        Inventory Management
      </h1>

      <p className="max-w-2xl mt-4 leading-7 text-slate-300">
        Monitor inventory across warehouses with real-time visibility,
        intelligent stock tracking, automated alerts and enterprise-grade
        inventory management for your business.
      </p>

      <div className="flex flex-wrap gap-3 mt-8">

        <button
          onClick={fetchInventory}
          className="px-6 py-3 font-semibold transition bg-white rounded-xl text-slate-900 hover:scale-105"
        >
          Refresh Inventory
        </button>

        <button
          className="px-6 py-3 font-semibold transition border rounded-xl border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
        >
          Export Report
        </button>

      </div>

    </div>

    {/* Right Stats */}
    <div className="grid grid-cols-2 gap-4 lg:w-[420px]">

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl">
        <p className="text-sm text-slate-300">
          Products
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {totalProducts}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl">
        <p className="text-sm text-slate-300">
          Warehouses
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {warehouseCount}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl">
        <p className="text-sm text-slate-300">
          Low Stock
        </p>

        <h2 className="mt-2 text-3xl font-bold text-amber-300">
          {lowStockCount}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur-xl">
        <p className="text-sm text-slate-300">
          Inventory Value
        </p>

        <h2 className="mt-2 text-2xl font-bold text-emerald-300">
          ₹{inventoryValue.toLocaleString()}
        </h2>
      </div>

    </div>

  </div>

</div>

      {/* ================= PREMIUM KPI DASHBOARD ================= */}

<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">

  <StatCard
    title="Total Products"
    value={totalProducts}
    subtitle="Registered Products"
    icon={Package}
    color="blue"
    trend="+8.5%"
  />

  <StatCard
    title="Stock Quantity"
    value={totalStockQty.toLocaleString()}
    subtitle="Available Units"
    icon={Boxes}
    color="emerald"
    trend="+12.4%"
  />

  <StatCard
    title="Low Stock Alerts"
    value={lowStockCount}
    subtitle="Requires Attention"
    icon={AlertTriangle}
    color="amber"
    trend="-3 Items"
  />

  <StatCard
    title="Out of Stock"
    value={outOfStockCount}
    subtitle="Immediate Reorder"
    icon={PackageX}
    color="red"
    trend="Critical"
  />

</div>

      {/* ================= PREMIUM INVENTORY TABLE ================= */}

<div className="overflow-hidden bg-white border shadow-2xl border-slate-200 rounded-3xl">

  

  <div className="p-6 border-b bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900">

    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

      <div>

        <h2 className="text-2xl font-bold text-white">
          Inventory Stock Overview
        </h2>

        <p className="mt-2 text-slate-300">
          Monitor warehouse stock, availability and movements in real time.
        </p>

      </div>

      <div className="flex gap-3">

        <button
          onClick={() => setAiOpen(true)}
          className="flex items-center gap-2 px-5 py-3 font-semibold text-white transition shadow-lg rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:scale-105"
        >
          <Bot size={18}/>
          AI Assistant
        </button>

        <button
          onClick={fetchInventory}
          className="flex items-center gap-2 px-5 py-3 font-semibold transition bg-white rounded-xl text-slate-800 hover:bg-slate-100"
        >
          <RefreshCcw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>

      </div>

    </div>

  </div>

  {/* ================= FILTER BAR ================= */}

  <div className="p-5 border-b bg-slate-50">

    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

      <div className="relative w-full xl:max-w-md">

        <Search
          className="absolute left-4 top-3.5 text-slate-400"
          size={18}
        />

        <input
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          placeholder="Search Product / SKU / Warehouse..."
          className="w-full py-3 pl-12 pr-4 transition bg-white border outline-none rounded-2xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

      </div>

      <div className="flex flex-wrap items-center gap-3">

        <select
          value={warehouseFilter}
          onChange={(e)=>setWarehouseFilter(e.target.value)}
          className="px-4 py-3 bg-white border rounded-xl border-slate-200"
        >
          {warehouses.map((w)=>(
            <option key={`warehouse-${w}`} value={w}>
              {w==="All" ? "All Warehouses" : w}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e)=>setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-white border rounded-xl border-slate-200"
        >
          <option value="All">All Status</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {hasFilters && (

          <button
            onClick={()=>{
              setSearch("");
              setWarehouseFilter("All");
              setStatusFilter("All");
            }}
            className="px-4 py-3 text-red-600 transition border border-red-200 rounded-xl hover:bg-red-50"
          >
            Clear
          </button>

        )}

      </div>

    </div>

    <div className="flex flex-wrap gap-3 mt-5">

      <div className="px-4 py-2 text-sm font-semibold text-indigo-700 rounded-full bg-indigo-50">
        Total Records : {stocks.length}
      </div>

      <div className="px-4 py-2 text-sm font-semibold rounded-full bg-emerald-50 text-emerald-700">
        Showing : {filteredStocks.length}
      </div>

    </div>

  </div>

  {/* ================= TABLE ================= */}

  {loading ? (

    <LoadingState/>

  ) : filteredStocks.length===0 ? (

    <EmptyState hasFilters={hasFilters}/>

  ) : (

<div className="overflow-x-auto">

<table className="min-w-full">

<thead>

<tr className="text-xs tracking-wider uppercase bg-slate-100 text-slate-600">

<Th>Product</Th>
<Th>Warehouse</Th>
<Th>Available</Th>
<Th>Status</Th>
<Th>Movement</Th>
<Th className="text-right">Actions</Th>

</tr>

</thead>

<tbody>

{filteredStocks.map((s,index)=>{

const qty=s.available??0;

const limit=limitOf(s);

const status=statusOf(qty,limit);

const tok=STOCK_STATUS[status];

const tx=s.lastTransaction||{};

return(

<tr

key={s._id || `${s.product?._id}-${s.warehouse?._id}-${index}`}

className={`

transition-all

duration-300

border-b

hover:bg-indigo-50/40

${index%2===0 ? "bg-white":"bg-slate-50/40"}

`}

>

<Td>

<div className="flex items-center gap-4">

<div className="flex items-center justify-center w-12 h-12 font-bold text-white shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600">

{s.product?.name?.charAt(0)?.toUpperCase()}

</div>

<div>

<p className="font-semibold text-slate-900">

{s.product?.name}

</p>

<p className="text-xs text-slate-500">

SKU : {s.product?.sku || "--"}

</p>

</div>

</div>

</Td>

<Td>

<div>

<p className="font-medium">

{s.warehouse?.name || "--"}

</p>

<p className="text-xs text-slate-400">

Warehouse

</p>

</div>

</Td>

<Td>

<div className="space-y-2">

<div className="flex justify-between">

<span className={`font-bold ${tok.text}`}>

{qty} Units

</span>

<span className="text-xs text-slate-400">

Limit {limit}

</span>

</div>

<StockBar
qty={qty}
limit={limit}
status={status}
/>

</div>

</Td>

<Td>

<span className={`rounded-full px-4 py-1 text-xs font-semibold ${tok.badge}`}>

{tok.label}

</span>

</Td>

<Td>

<div>

<p className="font-medium">

{tx.type || "--"}

</p>

<p className="text-xs text-slate-500">

{tx.qty || 0} Units

</p>

</div>

</Td>

<Td>

<div className="flex justify-end gap-2">

<ActionBtn
label="IN"
icon={Plus}
color="emerald"
onClick={()=>handleStockIn(s)}
/>

<ActionBtn
label="OUT"
icon={Minus}
color="red"
disabled={qty<=0}
onClick={()=>handleStockOut(s)}
/>

</div>

</Td>

</tr>

)

})}

</tbody>

</table>

</div>

)}

</div>

      {/* ================= AI Assistant Panel ================= */}
      {aiOpen && (
        <InventoryAIAssistant inventory={stocks} onClose={() => setAiOpen(false)} />
      )}
    </div>
  );
}

/* ================= COMPONENTS ================= */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
  trend,
}) {
  const colors = {
    blue: {
      bg: "from-blue-500 to-indigo-600",
      light: "bg-blue-50",
      text: "text-blue-600",
      badge: "bg-blue-100 text-blue-700",
      progress: "bg-blue-500",
    },
    emerald: {
      bg: "from-emerald-500 to-green-600",
      light: "bg-emerald-50",
      text: "text-emerald-600",
      badge: "bg-emerald-100 text-emerald-700",
      progress: "bg-emerald-500",
    },
    amber: {
      bg: "from-amber-500 to-orange-500",
      light: "bg-amber-50",
      text: "text-amber-600",
      badge: "bg-amber-100 text-amber-700",
      progress: "bg-amber-500",
    },
    red: {
      bg: "from-red-500 to-rose-600",
      light: "bg-red-50",
      text: "text-red-600",
      badge: "bg-red-100 text-red-700",
      progress: "bg-red-500",
    },
  };

  const c = colors[color];

  return (
    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl">

      {/* Hover Background */}
      <div className="absolute inset-0 transition duration-300 opacity-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 group-hover:opacity-100"></div>

      <div className="relative">

        {/* Header */}
        <div className="flex items-start justify-between">

          <div>

            <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
              {title}
            </p>

            <h2 className="mt-3 text-4xl font-bold text-slate-900">
              {value}
            </h2>

          </div>

          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${c.bg} text-white shadow-lg transition duration-300 group-hover:scale-110`}
          >
            <Icon size={30} />
          </div>

        </div>

        {/* Subtitle */}
        <div className="flex items-center justify-between mt-6">

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${c.badge}`}
          >
            {subtitle}
          </span>

          <span className={`text-sm font-semibold ${c.text}`}>
            {trend}
          </span>

        </div>

        {/* Progress */}
        <div className="mt-6">

          <div className="flex justify-between mb-2 text-xs text-slate-500">
            <span>Inventory Health</span>
            <span>90%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">

            <div
              className={`h-full rounded-full ${c.progress}`}
              style={{ width: "90%" }}
            />

          </div>

        </div>

      </div>

    </div>
  );
}

function StockBar({ qty, limit, status }) {
  const tok = STOCK_STATUS[status];
  // scale bar against 3x the low-stock limit so "healthy" reads full-ish
  const ceiling = Math.max(limit * 3, 30);
  const pct = qty <= 0 ? 0 : Math.max(6, Math.min(100, (qty / ceiling) * 100));
  return (
    <div className="w-24 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tok.bar}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ActionBtn({ label, icon: Icon, color, onClick, disabled }) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    red: "bg-red-600 hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white rounded-lg transition ${colors[color]} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

function Th({ children, className = "" }) {
  return <th className={`p-3 font-medium text-left ${className}`}>{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}

function LoadingState() {
  return <div className="p-8 text-center text-slate-500">Loading inventory data…</div>;
}

function EmptyState({ hasFilters }) {
  return (
    <div className="p-8 text-center text-slate-500">
      {hasFilters ? "No items match your filters." : "No inventory records available."}
    </div>
  );
}
