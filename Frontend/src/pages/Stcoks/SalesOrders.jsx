import { useEffect, useState } from "react";
import API from "../../services/api";
import { toast } from "react-hot-toast";

export default function SalesOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/sales"); // make sure your backend route is correct
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
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sales Orders</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full bg-white shadow rounded-xl">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">SO Number</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Items</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Created At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((so) => {
              const total = so.items.reduce(
                (sum, item) => sum + item.qty * item.price,
                0
              );

              return (
                <tr key={so._id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{so.soNumber}</td>
                  <td className="p-3">{so.customerName}</td>
                  <td className="p-3">
                    {so.items.map((item) => (
                      <div key={item._id} className="mb-1">
                        {item.product.name} x {item.qty}
                      </div>
                    ))}
                  </td>
                  <td className="p-3 font-semibold">₹{total.toLocaleString()}</td>
                  <td className={`p-2 px-3 rounded-full font-medium ${getStatusColor(so.status)}`}>
                    {so.status}
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {new Date(so.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
