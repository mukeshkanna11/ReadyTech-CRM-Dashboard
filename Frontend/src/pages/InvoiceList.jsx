import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Trash2,
  CheckCircle,
  FileText,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =========================================
     FETCH INVOICES
  ========================================= */
  const fetchInvoices = async () => {
    try {
      const res = await API.get("/invoices");
      setInvoices(res.data);
    } catch (error) {
      toast.error("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  /* =========================================
     DELETE INVOICE
  ========================================= */
  const deleteInvoice = async (id) => {
    if (!window.confirm("Are you sure you want to delete this invoice?"))
      return;

    try {
      await API.delete(`/invoices/${id}`);
      toast.success("Invoice Deleted");
      fetchInvoices();
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  /* =========================================
     MARK AS PAID
  ========================================= */
  const markAsPaid = async (id) => {
    try {
      await API.put(`/invoices/${id}/status`, {
        status: "Paid",
        paymentMode: "UPI",
      });
      toast.success("Marked as Paid");
      fetchInvoices();
    } catch (error) {
      toast.error("Update failed");
    }
  };

  /* =========================================
     STATUS BADGE STYLE
  ========================================= */
  const getStatusStyle = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Sent":
        return "bg-blue-100 text-blue-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="p-8 mx-auto bg-white shadow-2xl max-w-7xl rounded-3xl">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText size={28} />
            <h1 className="text-3xl font-bold">Invoice Management</h1>
          </div>

          <button
            onClick={() => navigate("/invoices/create")}
            className="flex items-center gap-2 px-6 py-3 text-white bg-indigo-600 shadow-lg hover:bg-indigo-700 rounded-2xl"
          >
            <Plus size={18} /> Create Invoice
          </button>
        </div>

        {/* TABLE */}
        {loading ? (
          <p className="text-gray-500">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="text-gray-500">No invoices found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-sm text-left text-gray-600">
                  <th className="px-4 py-2">Invoice No</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Due Date</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice._id}
                    className="transition shadow-sm bg-slate-50 hover:bg-slate-100 rounded-2xl"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {invoice.invoiceNumber}
                    </td>

                    <td className="px-4 py-3">
                      {invoice.customer?.name || "N/A"}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      ₹ {invoice.totalAmount?.toFixed(2)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                          invoice.status
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {invoice.dueDate
                        ? new Date(invoice.dueDate).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="flex justify-center gap-3 px-4 py-3">
                      {/* VIEW */}
                      <button
                        onClick={() =>
                          navigate(`/invoices/${invoice._id}`)
                        }
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <Eye size={18} />
                      </button>

                      {/* MARK PAID */}
                      {invoice.status !== "Paid" && (
                        <button
                          onClick={() => markAsPaid(invoice._id)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}

                      {/* DELETE */}
                      <button
                        onClick={() => deleteInvoice(invoice._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
