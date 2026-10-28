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

// on-hand = physical ledger qty; available = on-hand − reserved (ATP)
const onHandOf = (s) => s.onHand ?? s.available ?? 0;
const reservedOf = (s) => s.reserved ?? 0;
const availableOf = (s) => s.available ?? onHandOf(s) - reservedOf(s);

// "assigned" = stock row in a live warehouse, "missing" = ledger points at a
// deleted warehouse, "unassigned" = registered product with no ledger entry yet
const hasWarehouse = (s) => (s.warehouseStatus ?? "assigned") === "assigned";
const UNASSIGNED = "Unassigned";
const warehouseLabelOf = (s) =>
  s.warehouseStatus === "unassigned"
    ? UNASSIGNED
    : s.warehouseStatus === "missing"
    ? "Deleted warehouse"
    : s.warehouse?.name || "--";

export default function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [aiOpen, setAiOpen] = useState(false);
  const [warehouseList, setWarehouseList] = useState([]);
  const [action, setAction] = useState(null); // { type: "in"|"out"|"move", stock, qty, warehouse, error }
  const [busy, setBusy] = useState(null);

  /* ================= FETCH INVENTORY ================= */
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await API.get("/inventory/summary", {
        params: { includeUnstocked: true },
      });

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
    API.get("/warehouses")
      .then((res) => {
        const d = res.data;
        const list = Array.isArray(d) ? d : d?.warehouses || d?.data || [];
        setWarehouseList(list.filter((w) => w.status !== "Inactive"));
      })
      .catch(() => setWarehouseList([]));
  }, []);

  /* ================= STOCK ACTIONS ================= */
  const rowKey = (s) => `${s.product?._id}-${s.warehouse?._id || s.warehouseStatus}`;

  const ACTION_META = {
    in: { title: "Stock IN", button: "Add Stock", success: "Stock added successfully", color: "from-emerald-600 to-green-600" },
    out: { title: "Stock OUT", button: "Remove Stock", success: "Stock removed successfully", color: "from-red-600 to-rose-600" },
    move: { title: "Move Stock", button: "Move Stock", success: "Stock moved successfully", color: "from-indigo-600 to-violet-600" },
  };

  const needsWarehouse = (a) => a.type === "move" || !hasWarehouse(a.stock);
  const maxQtyOf = (a) =>
    a.type === "out" ? onHandOf(a.stock) : a.type === "move" ? availableOf(a.stock) : undefined;

  const openAction = (type, s) =>
    setAction({ type, stock: s, qty: type === "move" ? String(availableOf(s)) : "1", warehouse: "", error: "" });

  const closeAction = () => {
    if (!busy) setAction(null);
  };

  // Posts to an existing inventory API, then reloads persisted values
  const submitAction = async (e) => {
    e?.preventDefault();
    if (!action || busy) return;
    const { type, stock: s } = action;
    const qty = Number(action.qty);
    const max = maxQtyOf(action);
    const fail = (error) => setAction((a) => ({ ...a, error }));

    if (!Number.isFinite(qty) || qty <= 0) return fail("Enter a positive quantity");
    if (max !== undefined && qty > max) return fail(`Quantity cannot exceed ${max}`);
    if (needsWarehouse(action) && !action.warehouse) return fail("Select a warehouse");

    const [url, body] =
      type === "move"
        ? ["/inventory/transfer", { product: s.product._id, fromWarehouse: s.warehouse._id, toWarehouse: action.warehouse,
            quantity: qty, reason: "Recovered from deleted warehouse" }]
        : [type === "in" ? "/inventory/stock-in" : "/inventory/stock-out",
           { product: s.product._id, warehouse: action.warehouse || s.warehouse._id, quantity: qty }];

    try {
      setBusy(rowKey(s));
      await API.post(url, body);
      toast.success(ACTION_META[type].success);
      setAction(null);
      await fetchInventory();
    } catch (err) {
      const message = err.response?.data?.message || "Stock update failed";
      fail(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  /* ================= EXPORT (CSV / PDF) ================= */
  const downloadReport = async (format) => {
    try {
      const base = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem("token");
      const res = await fetch(`${base}/inventory/export?type=inventory&format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  /* ================= KPI DATA =================
     Rows are product × warehouse; KPIs roll them up per unique product
     so multi-warehouse products are counted once. */
  const productTotals = useMemo(() => {
    const map = new Map();
    stocks.forEach((s) => {
      const id = s.product?._id;
      if (!id) return;
      const t = map.get(id) || { onHand: 0, reserved: 0, available: 0, limit: limitOf(s) };
      t.onHand += onHandOf(s);
      t.reserved += reservedOf(s);
      t.available += availableOf(s);
      map.set(id, t);
    });
    return [...map.values()];
  }, [stocks]);

  const totalProducts = productTotals.length;
  const stockRecordCount = stocks.filter(hasWarehouse).length;
  const unassignedCount = stocks.filter((s) => s.warehouseStatus === "unassigned").length;
  const totalOnHand = stocks.reduce((sum, s) => sum + onHandOf(s), 0);
  const totalReserved = stocks.reduce((sum, s) => sum + reservedOf(s), 0);
  const totalAvailable = stocks.reduce((sum, s) => sum + availableOf(s), 0);
  const lowStockCount = productTotals.filter((t) => t.available > 0 && t.available <= t.limit).length;
  const outOfStockCount = productTotals.filter((t) => t.available <= 0).length;

  const warehouseCount = useMemo(
    () => new Set(stocks.filter(hasWarehouse).map((s) => s.warehouse._id)).size,
    [stocks]
  );

  const inventoryValue = stocks.reduce(
    (sum, s) => sum + (s.product?.price || 0) * onHandOf(s),
    0
  );
  
  /* ================= FILTERS ================= */
  const warehouses = useMemo(
    () => ["All", ...Array.from(new Set(stocks.map(warehouseLabelOf).filter((w) => w !== "--")))],
    [stocks]
  );

  const filteredStocks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks.filter((s) => {
      const matchesSearch =
        !q ||
        s.product?.name?.toLowerCase().includes(q) ||
        s.product?.sku?.toLowerCase().includes(q) ||
        warehouseLabelOf(s).toLowerCase().includes(q);
      const matchesWarehouse =
        warehouseFilter === "All" || warehouseLabelOf(s) === warehouseFilter;
      const matchesStatus =
        statusFilter === "All" || statusOf(availableOf(s), limitOf(s)) === statusFilter;
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
          onClick={() => downloadReport("csv")}
          className="px-6 py-3 font-semibold transition border rounded-xl border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
        >
          Export CSV
        </button>

        <button
          onClick={() => downloadReport("pdf")}
          className="px-6 py-3 font-semibold transition border rounded-xl border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
        >
          Export PDF
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

<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">

  <StatCard
    title="Total Products"
    value={totalProducts}
    subtitle="Registered Products"
    icon={Package}
    color="blue"
    trend={unassignedCount ? `${unassignedCount} not in a warehouse` : `${stockRecordCount} stock records`}
  />

  <StatCard
    title="On Hand"
    value={totalOnHand.toLocaleString()}
    subtitle="Physical Units"
    icon={Boxes}
    color="blue"
    trend={`${stockRecordCount} stock records`}
  />

  <StatCard
    title="Reserved"
    value={totalReserved.toLocaleString()}
    subtitle="Allocated Units"
    icon={Clock}
    color="amber"
    trend="Not available to sell"
  />

  <StatCard
    title="Available"
    value={totalAvailable.toLocaleString()}
    subtitle="On Hand − Reserved"
    icon={Boxes}
    color="emerald"
    trend={`₹${inventoryValue.toLocaleString()} value`}
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
        Products : {totalProducts}
      </div>

      <div className="px-4 py-2 text-sm font-semibold rounded-full bg-slate-100 text-slate-700">
        Stock Records : {stockRecordCount}
      </div>

      {unassignedCount > 0 && (
        <div className="px-4 py-2 text-sm font-semibold rounded-full bg-amber-50 text-amber-700">
          No Warehouse : {unassignedCount}
        </div>
      )}

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
<Th>On Hand</Th>
<Th>Reserved</Th>
<Th>Available</Th>
<Th>Status</Th>
<Th>Movement</Th>
<Th className="text-right">Actions</Th>

</tr>

</thead>

<tbody>

{filteredStocks.map((s,index)=>{

const onHand=onHandOf(s);

const reserved=reservedOf(s);

const available=availableOf(s);

const limit=limitOf(s);

const status=statusOf(available,limit);

const tok=STOCK_STATUS[status];

const tx=s.lastTransaction||{};

return(

<tr

key={`${s.product?._id}-${s.warehouse?._id || s.warehouseStatus}-${index}`}

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

{hasWarehouse(s) ? (

<>
<p className="font-medium">

{s.warehouse?.name || "--"}

</p>

<p className="text-xs text-slate-400">

Warehouse

</p>
</>

) : (

<>
<span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">

{warehouseLabelOf(s)}

</span>

<p className="mt-1 text-xs text-slate-400">

{s.warehouseStatus === "unassigned" ? "No stock recorded yet" : "Warehouse no longer exists"}

</p>
</>

)}

</div>

</Td>

<Td>

<span className="font-bold text-slate-900">{onHand}</span>
<span className="ml-1 text-xs text-slate-400">Units</span>

</Td>

<Td>

<span className={`font-semibold ${reserved > 0 ? "text-amber-600" : "text-slate-400"}`}>{reserved}</span>
<span className="ml-1 text-xs text-slate-400">Units</span>

</Td>

<Td>

<div className="space-y-2">

<div className="flex justify-between">

<span className={`font-bold ${tok.text}`}>

{available} Units

</span>

<span className="text-xs text-slate-400">

Limit {limit}

</span>

</div>

<StockBar
qty={available}
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

{tx.type ? tx.type.replace("_", " ") : "No movement"}

</p>

<p className="text-xs text-slate-500">

{tx.type ? `${tx.qty} Units · ${new Date(tx.date).toLocaleDateString()}` : "—"}

</p>

</div>

</Td>

<Td>

<div className="flex items-center justify-end gap-2">

{hasWarehouse(s) ? (
<>
<ActionBtn
label="IN"
icon={Plus}
color="emerald"
disabled={busy===rowKey(s)}
onClick={()=>openAction("in", s)}
/>

<ActionBtn
label="OUT"
icon={Minus}
color="red"
disabled={busy===rowKey(s) || onHand<=0}
onClick={()=>openAction("out", s)}
/>
</>
) : s.warehouseStatus === "unassigned" ? (
<ActionBtn
label="IN"
icon={Plus}
color="emerald"
disabled={busy===rowKey(s)}
title="Record stock into a warehouse"
onClick={()=>openAction("in", s)}
/>
) : (
<ActionBtn
label="MOVE"
icon={RefreshCcw}
color="emerald"
disabled={busy===rowKey(s) || available<=0}
title="Transfer the unreserved balance to a live warehouse"
onClick={()=>openAction("move", s)}
/>
)}

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
      {/* ================= STOCK ACTION MODAL ================= */}
      {action && (
        <div className="fixed inset-0 z-50 grid p-4 bg-slate-900/50 backdrop-blur-sm place-items-center" onClick={closeAction}>
          <form
            onSubmit={submitAction}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-3xl"
          >
            <div className="flex items-center justify-between px-6 py-5 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">
              <div>
                <h3 className="text-lg font-bold">{ACTION_META[action.type].title}</h3>
                <p className="mt-1 text-xs text-slate-300">
                  {action.stock.product?.name} · SKU {action.stock.product?.sku || "--"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAction}
                disabled={!!busy}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["On Hand", onHandOf(action.stock)],
                  ["Reserved", reservedOf(action.stock)],
                  ["Available", availableOf(action.stock)],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 rounded-2xl bg-slate-50">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                  {action.type === "move" ? "From" : "Warehouse"}
                </p>
                <p className="mt-1 font-medium text-slate-800">{warehouseLabelOf(action.stock)}</p>
              </div>

              {needsWarehouse(action) && (
                <label className="block">
                  <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                    {action.type === "move" ? "To Warehouse" : "Target Warehouse"}
                  </span>
                  <select
                    value={action.warehouse}
                    onChange={(e) => setAction((a) => ({ ...a, warehouse: e.target.value, error: "" }))}
                    disabled={!!busy}
                    className="w-full px-4 py-3 mt-2 bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">Select warehouse</option>
                    {warehouseList.map((w) => (
                      <option key={w._id} value={w._id}>{w.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                  Quantity{maxQtyOf(action) !== undefined ? ` (max ${maxQtyOf(action)})` : ""}
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  autoFocus
                  value={action.qty}
                  onChange={(e) => setAction((a) => ({ ...a, qty: e.target.value, error: "" }))}
                  disabled={!!busy}
                  className="w-full px-4 py-3 mt-2 bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>

              {action.error && (
                <div className="flex items-start gap-2 px-4 py-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  {action.error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                type="button"
                onClick={closeAction}
                disabled={!!busy}
                className="px-5 py-2.5 font-semibold transition bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!busy}
                className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-white transition shadow-lg rounded-xl bg-gradient-to-r ${ACTION_META[action.type].color} hover:scale-105 disabled:opacity-60 disabled:hover:scale-100`}
              >
                {busy && <RefreshCcw size={16} className="animate-spin" />}
                {busy ? "Saving…" : ACTION_META[action.type].button}
              </button>
            </div>
          </form>
        </div>
      )}

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

function ActionBtn({ label, icon: Icon, color, onClick, disabled, title }) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    red: "bg-red-600 hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
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
