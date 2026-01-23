import { useEffect, useState } from "react";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import { Users, Calendar, Package, Search } from "lucide-react";

export default function SalesOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/sales");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch sales orders", err);
      toast.error("Failed to fetch sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "bg-yellow-100 text-yellow-800";
      case "APPROVED":
        return "bg-blue-100 text-blue-800";
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Filter & search logic
  const filteredOrders = orders.filter((so) => {
    const matchesSearch =
      so.soNumber.toLowerCase().includes(search.toLowerCase()) ||
      so.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || so.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary counts
  const summary = {
    total: orders.length,
    draft: orders.filter((o) => o.status === "DRAFT").length,
    approved: orders.filter((o) => o.status === "APPROVED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Sales Dashboard</h1>

      {/* ====== Top Summary Cards ====== */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {[
          { label: "Total Orders", value: summary.total, color: "bg-gray-100" },
          { label: "Draft", value: summary.draft, color: "bg-yellow-100 text-yellow-800" },
          { label: "Approved", value: summary.approved, color: "bg-blue-100 text-blue-800" },
          { label: "Delivered", value: summary.delivered, color: "bg-green-100 text-green-800" },
          { label: "Cancelled", value: summary.cancelled, color: "bg-red-100 text-red-800" },
        ].map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-xl shadow flex flex-col justify-center ${card.color} font-semibold`}
          >
            <span className="text-sm">{card.label}</span>
            <span className="mt-1 text-2xl">{card.value}</span>
          </div>
        ))}
      </div>

      {/* ====== Search & Filter ====== */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center w-full px-3 py-2 border rounded-lg md:w-1/3">
          <Search size={16} className="mr-2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by SO Number or Customer"
            className="w-full outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="px-3 py-2 border rounded-lg"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* ====== Table ====== */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-gray-400">No sales orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 shadow-md rounded-xl">
            <thead className="text-sm text-gray-600 uppercase bg-slate-100">
              <tr>
                <th className="p-3 text-left">SO Number</th>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Items</th>
                <th className="p-3 text-left">Qty</th>
                <th className="p-3 text-left">Total</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left">Approved / Delivered</th>
                <th className="p-3 text-left">Salesperson</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((so) => {
                const totalAmount = so.items.reduce(
                  (sum, item) => sum + item.qty * item.price,
                  0
                );
                const totalQty = so.items.reduce((sum, item) => sum + item.qty, 0);

                return (
                  <tr
                    key={so._id}
                    className="transition-colors duration-150 border-t cursor-pointer hover:bg-gray-50"
                    onClick={() => toast(`Clicked ${so.soNumber}`)}
                  >
                    <td className="p-3 font-medium">{so.soNumber}</td>
                    <td className="p-3">{so.customer?.name || "N/A"}</td>
                    <td className="p-3">{so.customer?.email || "N/A"}</td>
                    <td className="p-3 space-y-1">
                      {so.items.map((item) => (
                        <div key={item._id}>
                          {item.product?.name || "Deleted Product"} x {item.qty}
                        </div>
                      ))}
                    </td>
                    <td className="p-3 font-semibold">{totalQty}</td>
                    <td className="p-3 font-semibold">₹{totalAmount.toLocaleString()}</td>
                    <td
                      className={`p-2 px-3 rounded-full font-medium ${getStatusColor(
                        so.status
                      )}`}
                    >
                      {so.status}
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(so.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      Approved:{" "}
                      {so.approvedAt ? new Date(so.approvedAt).toLocaleDateString() : "-"}
                      <br />
                      Delivered:{" "}
                      {so.deliveredAt ? new Date(so.deliveredAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="flex items-center p-3 space-x-2 text-sm text-gray-700">
                      <Users size={16} /> {so.createdBy?.name || "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
