import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Trash2,
  FileDown,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= SAFE ARRAY ================= */
  const safeArray = (res) => {
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  /* ================= FETCH ================= */
  const fetchInvoices = async () => {
    try {
      const res = await API.get("/invoices");
      const data = safeArray(res);
      setInvoices(data);
    } catch (err) {
      console.error(err?.response?.data);
      toast.error("Failed to fetch invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  /* ================= DELETE ================= */
  const deleteInvoice = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;

    try {
      await API.delete(`/invoices/${id}`);
      toast.success("Invoice deleted");
      fetchInvoices();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= UPDATE STATUS ================= */
  const updateStatus = async (invoice, status) => {
    try {
      await API.put(`/invoices/${invoice._id}/status`, { status });
      toast.success(`Marked as ${status}`);
      fetchInvoices();
    } catch {
      toast.error("Status update failed");
    }
  };

  /* ================= AUTO STATUS CHECK ================= */
  const getComputedStatus = (invoice) => {
    if (invoice.status === "Paid") return "Paid";

    if (
      invoice.dueDate &&
      new Date(invoice.dueDate) < new Date() &&
      invoice.status !== "Paid"
    ) {
      return "Overdue";
    }

    return invoice.status || "Pending";
  };

  /* ================= FORMAT ================= */
  const formatCurrency = (value) =>
    `₹ ${Number(value || 0).toFixed(2)}`;

  /* ================= TOTAL CALCULATION ================= */
  const calculateTotals = (invoice) => {
    const items = Array.isArray(invoice.items)
      ? invoice.items
      : [];

    const subtotal = items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || item.price || 0);
      return sum + qty * price;
    }, 0);

    const gstTotal = invoice.gstTotal
      ? Number(invoice.gstTotal)
      : (subtotal * 18) / 100;

    const discount = Number(invoice.discountAmount || 0);

    const grandTotal =
      invoice.grandTotal ||
      subtotal + gstTotal - discount;

    const computedStatus = getComputedStatus(invoice);

    const balance =
      computedStatus === "Paid"
        ? 0
        : invoice.balance ?? grandTotal;

    return {
      subtotal,
      gstTotal,
      discount,
      grandTotal,
      balance,
      computedStatus,
    };
  };

  /* ================= PROFESSIONAL PDF ================= */
  const downloadPDF = (invoice) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      const {
        subtotal,
        gstTotal,
        discount,
        grandTotal,
        balance,
        computedStatus,
      } = calculateTotals(invoice);

      const cgst = gstTotal / 2;
      const sgst = gstTotal / 2;

      /* ===== COMPANY HEADER ===== */
      doc.setFontSize(18);
      doc.text("READY TECH SOLUTIONS", 14, 20);

      doc.setFontSize(10);
      doc.text("Coimbatore, Tamil Nadu", 14, 28);
      doc.text("Email: info@readytechsolution.in", 14, 34);
      doc.text("Phone: +91 9876543210", 14, 40);

      doc.setFontSize(20);
      doc.text("TAX INVOICE", pageWidth - 60, 20);

      doc.setFontSize(11);
      doc.text(
        `Invoice No: ${invoice.invoiceNumber || "-"}`,
        pageWidth - 60,
        30
      );

      doc.text(
        `Date: ${
          invoice.issueDate
            ? new Date(invoice.issueDate).toLocaleDateString()
            : "-"
        }`,
        pageWidth - 60,
        36
      );

      doc.text(
        `Due: ${
          invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString()
            : "-"
        }`,
        pageWidth - 60,
        42
      );

      /* ===== BILL TO ===== */
      const customerName =
        invoice.customer?.name ||
        invoice.customerName ||
        "N/A";

      doc.setFontSize(12);
      doc.text("Bill To:", 14, 60);

      doc.setFontSize(11);
      doc.text(customerName, 14, 68);

      /* ===== ITEMS ===== */
      autoTable(doc, {
        startY: 80,
        head: [["Description", "Qty", "Rate", "Amount"]],
        body: (invoice.items || []).map((item) => {
          const qty = Number(item.quantity || 0);
          const price = Number(
            item.unitPrice || item.price || 0
          );
          return [
            item.description || "Item",
            qty,
            formatCurrency(price),
            formatCurrency(qty * price),
          ];
        }),
      });

      const finalY = doc.lastAutoTable?.finalY + 10;

      doc.setFontSize(11);
      doc.text(
        `Subtotal: ${formatCurrency(subtotal)}`,
        pageWidth - 70,
        finalY
      );
      doc.text(
        `CGST: ${formatCurrency(cgst)}`,
        pageWidth - 70,
        finalY + 8
      );
      doc.text(
        `SGST: ${formatCurrency(sgst)}`,
        pageWidth - 70,
        finalY + 16
      );
      doc.text(
        `Discount: ${formatCurrency(discount)}`,
        pageWidth - 70,
        finalY + 24
      );

      doc.setFontSize(14);
      doc.text(
        `Grand Total: ${formatCurrency(grandTotal)}`,
        pageWidth - 70,
        finalY + 36
      );

      doc.setFontSize(12);
      doc.text(
        `Balance Due: ${formatCurrency(balance)}`,
        pageWidth - 70,
        finalY + 46
      );

      doc.text(
        `Status: ${computedStatus}`,
        pageWidth - 70,
        finalY + 56
      );

      doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);

      toast.success("Invoice Downloaded");
    } catch (err) {
      console.error(err);
      toast.error("PDF failed");
    }
  };

  /* ================= STATUS STYLE ================= */
  const getStatusStyle = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Overdue":
        return "bg-red-100 text-red-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen p-10 bg-slate-100">
      <div className="p-10 mx-auto bg-white shadow-xl max-w-7xl rounded-3xl">

        <div className="flex items-center justify-between mb-10">
          <h1 className="text-3xl font-bold">
            Invoice Management
          </h1>

          <button
            onClick={() => navigate("/invoices/create")}
            className="flex gap-2 px-6 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-700"
          >
            <Plus size={18} /> Create Invoice
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-gray-500">No invoices found</p>
        ) : (
          <table className="w-full">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-3">Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => {
                const {
                  grandTotal,
                  balance,
                  computedStatus,
                } = calculateTotals(invoice);

                const customerName =
                  invoice.customer?.name ||
                  invoice.customerName ||
                  "N/A";

                return (
                  <tr
                    key={invoice._id}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-4 font-semibold">
                      {invoice.invoiceNumber}
                    </td>

                    <td>{customerName}</td>

                    <td>{formatCurrency(grandTotal)}</td>

                    <td>{formatCurrency(balance)}</td>

                    <td>
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${getStatusStyle(
                          computedStatus
                        )}`}
                      >
                        {computedStatus}
                      </span>
                    </td>

                    <td className="flex gap-4 py-4">
                      <Eye
                        className="text-blue-600 cursor-pointer"
                        onClick={() =>
                          navigate(`/invoices/${invoice._id}`)
                        }
                      />

                      <FileDown
                        className="text-green-600 cursor-pointer"
                        onClick={() =>
                          downloadPDF(invoice)
                        }
                      />

                      <CheckCircle
                        className="text-green-600 cursor-pointer"
                        onClick={() =>
                          updateStatus(invoice, "Paid")
                        }
                      />

                      <AlertCircle
                        className="text-red-600 cursor-pointer"
                        onClick={() =>
                          updateStatus(invoice, "Overdue")
                        }
                      />

                      <Trash2
                        className="text-red-600 cursor-pointer"
                        onClick={() =>
                          deleteInvoice(invoice._id)
                        }
                      />
                    </td>
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
