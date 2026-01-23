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
      const res = await API.get("/inventory/summary"); // Backend route
      setStocks(res.data || []);
    } catch (err) {
      console.error("Inventory fetch error", err);
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  /* ================= STOCK IN / OUT ================= */
  const handleStockIn = async (stock, qty = 1) => {
    try {
      await API.post("/inventory/stock-in", {
        product: stock.product._id,
        warehouse: stock.warehouse._id,
        quantity: qty,
      });
      toast.success(`Added ${qty} to stock`);
      fetchInventory();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add stock");
    }
  };

  const handleStockOut = async (stock, qty = 1) => {
    try {
      await API.post("/inventory/stock-out", {
        product: stock.product._id,
        warehouse: stock.warehouse._id,
        quantity: qty,
      });
      toast.success(`Removed ${qty} from stock`);
      fetchInventory();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove stock");
    }
  };

  /* ================= KPIs ================= */
  const totalProducts = stocks.length;
  const totalQuantity = stocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const lowStockCount = stocks.filter((s) => s.quantity < 10).length;

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
      {/* ================= HEADER ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Inventory Management
          </h1>
          <p className="text-sm text-slate-500">
            Real-time stock availability across warehouses
          </p>
        </div>

        <button
          onClick={fetchInventory}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Products" value={totalProducts} icon={Package} color="indigo" />
        <StatCard title="Total Stock Qty" value={totalQuantity} icon={Warehouse} color="emerald" />
        <StatCard title="Low Stock Alerts" value={lowStockCount} icon={AlertTriangle} color="red" />
      </div>

      {/* ================= TABLE CARD ================= */}
      <div className="bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b dark:border-slate-800">
          <h2 className="font-semibold text-slate-700 dark:text-white">Stock Details</h2>

          <div className="relative">
            <Search size={16} className="absolute text-slate-400 left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 py-2 pr-3 text-sm border rounded-lg pl-9 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredStocks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <Th>Product</Th>
                  <Th>Warehouse</Th>
                  <Th>Quantity</Th>
                  <Th>Status</Th>
                  <Th>Last Transaction</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((s) => {
                  const isLow = s.quantity < 10;
                  const lastTx = s.lastTransaction || {};

                  return (
                    <tr
                      key={s._id}
                      className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <Td>{s.product?.name || "-"}</Td>
                      <Td>{s.warehouse?.name || "-"}</Td>
                      <Td className="font-bold">
                        <span className={isLow ? "text-red-600" : "text-emerald-600"}>
                          {s.quantity}
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
                        <Clock size={14} /> {lastTx.type || "-"} ({lastTx.qty || "-"})
                      </Td>
                      <Td className="flex gap-2">
                        <button
                          onClick={() => handleStockIn(s, 1)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Plus size={12} /> IN
                        </button>
                        <button
                          onClick={() => handleStockOut(s, 1)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                        >
                          <Minus size={12} /> OUT
                        </button>
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

/* ======================================================
   REUSABLE COMPONENTS
====================================================== */
function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <div className="flex items-center gap-4 p-4 bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ color, text }) {
  const styles = {
    red: "bg-red-100 text-red-600",
    green: "bg-emerald-100 text-emerald-600",
  };
  return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${styles[color]}`}>{text}</span>;
}

function Th({ children }) {
  return <th className="p-3 font-semibold text-left text-slate-600 dark:text-slate-300">{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}

function LoadingState() {
  return <div className="p-6 text-center text-slate-500">Loading inventory data...</div>;
}

function EmptyState() {
  return <div className="p-6 text-center text-slate-500">No inventory records found.</div>;
}
