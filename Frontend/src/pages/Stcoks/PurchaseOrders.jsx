import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  RefreshCcw,
  Search,
  CheckCircle,
  Clock,
  IndianRupee,
  Package,
} from "lucide-react";
import API from "../../services/api";

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ================= FETCH ================= */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/purchase");
      setOrders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch purchase orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* ================= DERIVED DATA ================= */
  const filtered = useMemo(() => {
    return orders.filter(
      (o) =>
        o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        o.vendor?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [orders, search]);

  const totalPO = orders.length;
  const draftPO = orders.filter((o) => o.status === "DRAFT").length;
  const confirmedPO = orders.filter((o) => o.status !== "DRAFT").length;

  const totalSpend = orders.reduce((sum, po) => {
    return (
      sum +
      po.items.reduce((s, i) => s + i.qty * i.cost, 0)
    );
  }, 0);

  /* ================= UI ================= */
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
            Purchase Orders
          </h1>
          <p className="text-xs text-slate-500">
            Track procurement, vendor purchases & stock inflow
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Total POs" value={totalPO} icon={FileText} />
        <MiniStat label="Draft" value={draftPO} icon={Clock} color="amber" />
        <MiniStat label="Confirmed" value={confirmedPO} icon={CheckCircle} color="emerald" />
        <MiniStat
          label="Total Spend"
          value={`₹${totalSpend.toLocaleString()}`}
          icon={IndianRupee}
          color="indigo"
        />
      </div>

      {/* ACTION BAR */}
      <div className="flex items-center gap-2 p-3 bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
        <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO / Vendor..."
            className="w-full py-1.5 pl-8 pr-2 text-xs border rounded-md dark:bg-slate-800 dark:border-slate-700"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <Th>PO</Th>
                <Th>Vendor</Th>
                <Th>Items</Th>
                <Th>Qty</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const qty = po.items.reduce((s, i) => s + i.qty, 0);
                const amount = po.items.reduce(
                  (s, i) => s + i.qty * i.cost,
                  0
                );

                return (
                  <tr
                    key={po._id}
                    className="border-t dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Td className="font-medium">{po.poNumber}</Td>
                    <Td>{po.vendor?.name}</Td>
                    <Td>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Package size={12} />
                        {po.items.length} items
                      </div>
                    </Td>
                    <Td>{qty}</Td>
                    <Td className="font-semibold">
                      ₹{amount.toLocaleString()}
                    </Td>
                    <Td>
                      {po.status === "DRAFT" ? (
                        <Badge color="amber" text="Draft" />
                      ) : (
                        <Badge color="emerald" text="Confirmed" />
                      )}
                    </Td>
                    <Td className="text-slate-500">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= UI COMPONENTS ================= */

function MiniStat({ label, value, icon: Icon, color = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="flex items-center gap-2 p-2 bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
      <div className={`p-1.5 rounded ${map[color]}`}>
        <Icon size={14} />
      </div>
      <div>
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Badge({ text, color }) {
  const map = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded-full ${map[color]}`}>
      {text}
    </span>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 font-semibold text-left text-slate-600 dark:text-slate-300">
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function Loader() {
  return (
    <div className="p-6 text-sm text-center text-slate-500">
      Loading purchase orders...
    </div>
  );
}
function Empty() {
  return (
    <div className="p-6 text-sm text-center text-slate-400">
      No purchase orders found
    </div>
  );
}
