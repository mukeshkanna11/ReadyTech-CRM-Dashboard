import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import {
  Users,
  Search,
  RefreshCcw,
  IndianRupee,
  FileText,
  Truck,
  Clock,
} from "lucide-react";

export default function SalesOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  /* ================= FETCH ================= */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/sales");
      setOrders(res.data || []);
    } catch {
      toast.error("Failed to fetch sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  /* ================= FILTER ================= */
  const filteredOrders = useMemo(() => {
    return orders.filter((so) => {
      const matchSearch =
        so.soNumber?.toLowerCase().includes(search.toLowerCase()) ||
        so.customer?.name?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || so.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  /* ================= KPI DATA ================= */
  const revenue = orders.reduce(
    (sum, so) =>
      sum +
      so.items.reduce((s, i) => s + i.qty * i.price, 0),
    0
  );

  const summary = {
    total: orders.length,
    draft: orders.filter((o) => o.status === "DRAFT").length,
    approved: orders.filter((o) => o.status === "APPROVED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    pendingDelivery: orders.filter((o) => o.status === "APPROVED").length,
  };

  /* ================= STATUS UI ================= */
  const statusStyle = {
    DRAFT: "bg-amber-100 text-amber-700",
    APPROVED: "bg-indigo-100 text-indigo-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
  };

  /* ================= UI ================= */
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sales Orders</h1>
          <p className="text-xs text-slate-500">
            Order processing, delivery & revenue tracking
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-md"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Total Orders" value={summary.total} icon={FileText} />
        <MiniStat
          label="Approved"
          value={summary.approved}
          icon={Clock}
          color="indigo"
        />
        <MiniStat
          label="Delivered"
          value={summary.delivered}
          icon={Truck}
          color="emerald"
        />
        <MiniStat
          label="Pending Delivery"
          value={summary.pendingDelivery}
          icon={Truck}
          color="amber"
        />
        <MiniStat
          label="Revenue"
          value={`₹${revenue.toLocaleString()}`}
          icon={IndianRupee}
          color="emerald"
        />
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border rounded-lg">
        <div className="relative w-64">
          <Search
            size={14}
            className="absolute left-2.5 top-2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SO / Customer"
            className="w-full py-1.5 pl-8 text-xs border rounded-md"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-1.5 px-2 text-xs border rounded-md"
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden bg-white border rounded-lg">
        {loading ? (
          <Loader />
        ) : filteredOrders.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <Th>SO</Th>
                  <Th>Customer</Th>
                  <Th>Items</Th>
                  <Th>Qty</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Salesperson</Th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((so) => {
                  const totalQty = so.items.reduce(
                    (s, i) => s + i.qty,
                    0
                  );
                  const totalAmt = so.items.reduce(
                    (s, i) => s + i.qty * i.price,
                    0
                  );

                  return (
                    <tr
                      key={so._id}
                      className="border-t cursor-pointer hover:bg-slate-50"
                      onClick={() => toast(`SO ${so.soNumber}`)}
                    >
                      <Td className="font-medium">{so.soNumber}</Td>
                      <Td>{so.customer?.name || "-"}</Td>
                      <Td className="text-slate-500">
                        {so.items.length} items
                      </Td>
                      <Td className="font-semibold">{totalQty}</Td>
                      <Td className="font-semibold">
                        ₹{totalAmt.toLocaleString()}
                      </Td>
                      <Td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            statusStyle[so.status]
                          }`}
                        >
                          {so.status}
                        </span>
                      </Td>
                      <Td className="text-slate-500">
                        {new Date(so.createdAt).toLocaleDateString()}
                      </Td>
                      <Td className="flex items-center gap-1">
                        <Users size={12} />
                        {so.createdBy?.name || "-"}
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

/* ================= UI PARTS ================= */

function MiniStat({ label, value, icon: Icon, color = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
      <div className={`p-2 rounded ${map[color]}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function Loader() {
  return (
    <div className="p-6 text-sm text-center text-slate-500">
      Loading sales orders...
    </div>
  );
}
function Empty() {
  return (
    <div className="p-6 text-sm text-center text-slate-500">
      No sales orders found
    </div>
  );
}
