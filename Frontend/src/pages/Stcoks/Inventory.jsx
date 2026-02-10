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
  TrendingUp,
} from "lucide-react";
import API from "../../services/api";
import { toast } from "react-hot-toast";

export default function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
  const lowStockItems = stocks.filter((s) => (s.available ?? 0) < 10);
  const healthyStock = stocks.filter((s) => (s.available ?? 0) >= 10).length;

  /* ================= SEARCH ================= */
  const filteredStocks = useMemo(() => {
    return stocks.filter(
      (s) =>
        s.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.warehouse?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [stocks, search]);

  return (
    <div className="space-y-6">
      {/* ================= OVERVIEW ================= */}
      <div className="p-5 bg-white border shadow-sm rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 text-indigo-600 bg-indigo-100 rounded-lg">
            <Warehouse size={24} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Inventory Management
            </h1>
            <p className="max-w-3xl mt-1 text-sm text-slate-600">
              Centralized real-time stock control across warehouses. This module
              ensures accurate inventory levels, prevents stock shortages,
              and supports sales & purchase operations seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* ================= KPIs ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          title="Total Products"
          value={totalProducts}
          icon={Package}
          color="indigo"
        />
        <StatCard
          title="Total Stock Qty"
          value={totalStockQty}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Healthy Stock"
          value={healthyStock}
          icon={Warehouse}
          color="blue"
        />
        <StatCard
          title="Low Stock Alerts"
          value={lowStockItems.length}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* ================= TABLE ================= */}
      <div className="bg-white border shadow rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <h2 className="font-semibold text-slate-700">
            Stock Availability
          </h2>

          <div className="flex gap-3">
            <div className="relative">
              <Search size={16} className="absolute text-slate-400 left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search product or warehouse"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 py-2 pr-3 text-sm border rounded-lg pl-9 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={fetchInventory}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredStocks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>Product</Th>
                  <Th>Warehouse</Th>
                  <Th>Available Qty</Th>
                  <Th>Status</Th>
                  <Th>Last Movement</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((s, idx) => {
                  const qty = s.available ?? 0;
                  const isLow = qty < 10;
                  const lastTx = s.lastTransaction || {};

                  return (
                    <tr
                      key={s._id || idx}
                      className="border-t hover:bg-slate-50"
                    >
                      <Td>{s.product?.name || "-"}</Td>
                      <Td>{s.warehouse?.name || "-"}</Td>
                      <Td className="font-semibold">
                        <span className={isLow ? "text-red-600" : "text-emerald-600"}>
                          {qty}
                        </span>
                      </Td>
                      <Td>
                        {isLow ? (
                          <StatusBadge color="red" text="Low Stock" />
                        ) : (
                          <StatusBadge color="green" text="In Stock" />
                        )}
                      </Td>
                      <Td className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock size={14} />
                        {lastTx.type || "—"} ({lastTx.qty || "—"})
                      </Td>
                      <Td className="flex gap-2">
                        <ActionBtn
                          label="IN"
                          icon={Plus}
                          color="emerald"
                          onClick={() => handleStockIn(s)}
                        />
                        <ActionBtn
                          label="OUT"
                          icon={Minus}
                          color="red"
                          onClick={() => handleStockOut(s)}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-blue-100 text-blue-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <div className="flex items-center gap-4 p-4 bg-white border shadow rounded-xl">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ color, text }) {
  const styles = {
    red: "bg-red-100 text-red-600",
    green: "bg-emerald-100 text-emerald-600",
  };
  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[color]}`}>
      {text}
    </span>
  );
}

function ActionBtn({ label, icon: Icon, color, onClick }) {
  const colors = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    red: "bg-red-600 hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded ${colors[color]}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

function Th({ children }) {
  return <th className="p-3 font-semibold text-left text-slate-600">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}

function LoadingState() {
  return (
    <div className="p-6 text-center text-slate-500">
      Loading inventory data…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-6 text-center text-slate-500">
      No inventory records available.
    </div>
  );
}
