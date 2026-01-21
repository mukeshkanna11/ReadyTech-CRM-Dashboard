import { useEffect, useState } from "react";
import API from "../../services/api";

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await API.get("/purchase"); // matches backend GET /api/purchase
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch purchase orders", err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Purchase Orders</h1>

      <table className="w-full bg-white shadow rounded-xl">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-3">PO Number</th>
            <th className="p-3">Vendor</th>
            <th className="p-3">Items</th>
            <th className="p-3">Quantity</th>
            <th className="p-3">Total Cost</th>
            <th className="p-3">Status</th>
            <th className="p-3">Created At</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => (
            <tr key={po._id} className="border-t">
              <td className="p-3">{po.poNumber}</td>
              <td className="p-3">{po.vendor.name}</td>
              <td className="p-3">
                {po.items.map((i) => i.product.name).join(", ")}
              </td>
              <td className="p-3">
                {po.items.reduce((sum, i) => sum + i.qty, 0)}
              </td>
              <td className="p-3">
                {po.items.reduce((sum, i) => sum + i.qty * i.cost, 0)}
              </td>
              <td className={`p-3 font-bold ${po.status === "DRAFT" ? "text-yellow-500" : "text-green-500"}`}>
                {po.status}
              </td>
              <td className="p-3 text-sm text-slate-500">
                {new Date(po.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
