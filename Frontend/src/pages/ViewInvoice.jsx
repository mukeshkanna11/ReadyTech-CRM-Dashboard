import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  BadgeCheck,
  IndianRupee,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";

export default function ViewInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH INVOICE ================= */
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await API.get(`/invoices/${id}`);
        setInvoice(res.data);
      } catch (err) {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  /* ================= STATUS STYLE ================= */
  const getStatusStyle = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Sent":
        return "bg-blue-100 text-blue-700";
      case "Overdue":
        return "bg-red-100 text-red-600";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  /* ================= CALCULATIONS ================= */
  const subTotal =
    invoice?.items?.reduce(
      (acc, item) =>
        acc +
        Number(item.quantity || 0) *
          Number(item.price || 0),
      0
    ) || 0;

  const tax = Number(invoice?.tax || 0);
  const discount = Number(invoice?.discount || 0);
  const taxAmount = (subTotal * tax) / 100;
  const total = subTotal + taxAmount - discount;

  if (loading)
    return <div className="p-10 text-center">Loading...</div>;

  if (!invoice)
    return <div className="p-10 text-center">Invoice not found</div>;

  return (
    <div className="min-h-screen p-8 bg-slate-100">
      <div className="max-w-6xl p-8 mx-auto bg-white shadow-2xl rounded-3xl">

        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText size={28} />
            <div>
              <h1 className="text-2xl font-bold">
                Invoice #{invoice.invoiceNumber}
              </h1>
              <p className="text-sm text-gray-500">
                Detailed Invoice Information
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-gray-800 rounded-xl"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>

        {/* ================= STATUS BAR ================= */}
        <div className="flex items-center justify-between p-4 mb-8 border rounded-2xl bg-slate-50">
          <div className="flex items-center gap-4">
            <User size={18} />
            <div>
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-semibold">
                {invoice.customer?.name || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Calendar size={18} />
            <div>
              <p className="text-xs text-gray-500">Due Date</p>
              <p className="font-semibold">
                {invoice.dueDate
                  ? new Date(
                      invoice.dueDate
                    ).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          </div>

          <span
            className={`px-4 py-1 text-xs font-medium rounded-full ${getStatusStyle(
              invoice.status
            )}`}
          >
            <BadgeCheck size={14} className="inline mr-1" />
            {invoice.status}
          </span>
        </div>

        {/* ================= ITEMS TABLE ================= */}
        <div className="overflow-hidden border rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, index) => (
                <tr
                  key={index}
                  className="border-t hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    {item.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹ {Number(item.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-medium text-right">
                    ₹{" "}
                    {(
                      Number(item.quantity) *
                      Number(item.price)
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================= SUMMARY ================= */}
        <div className="flex justify-end mt-8">
          <div className="w-full max-w-sm p-6 border rounded-2xl bg-slate-50">
            <div className="flex justify-between mb-2 text-sm">
              <span>Subtotal</span>
              <span>₹ {subTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between mb-2 text-sm">
              <span>Tax ({tax}%)</span>
              <span>₹ {taxAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between mb-3 text-sm">
              <span>Discount</span>
              <span>₹ {discount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between pt-3 text-lg font-bold border-t">
              <span>Total</span>
              <span className="text-blue-600">
                ₹ {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* ================= NOTES ================= */}
        {invoice.notes && (
          <div className="p-5 mt-8 border rounded-2xl bg-slate-50">
            <h3 className="mb-2 font-semibold">Notes</h3>
            <p className="text-sm text-gray-600">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
