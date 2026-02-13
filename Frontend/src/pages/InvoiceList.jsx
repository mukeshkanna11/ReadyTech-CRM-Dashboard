import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Trash2,
  FileDown,
  FileText,
  CheckCircle,
  Clock,
  FileEdit,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */
  const fetchInvoices = async () => {
    try {
      const res = await API.get("/invoices");
      setInvoices(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch invoices");
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

  /* ================= NEW: UPDATE STATUS ================= */
  const updateStatus = async (id, status) => {
    try {
      await API.put(`/invoices/${id}/status`, { status });
      toast.success(`Invoice marked as ${status}`);
      fetchInvoices();
    } catch (err) {
      toast.error("Status update failed");
    }
  };

  /* ================= SAFE PDF DOWNLOAD ================= */
  const downloadPDF = (invoice) => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();

      const subTotal =
        invoice.items?.reduce(
          (acc, item) =>
            acc +
            Number(item.quantity || 0) *
              Number(item.price || 0),
          0
        ) || 0;

      const tax = Number(invoice.tax || 0);
      const discount = Number(invoice.discount || 0);
      const taxAmount = (subTotal * tax) / 100;
      const total = subTotal + taxAmount - discount;

      /* ================= HEADER ================= */
      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 35, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("INVOICE", pageWidth - 45, 22);

      doc.setFontSize(14);
      doc.text("ReadyTechSolutions", 14, 18);

      doc.setFontSize(9);
      doc.text(
        "2nd Floor, 149, Sri Nagar\nPeelamedu, Coimbatore - 641004\nPhone: 070107 97721",
        14,
        25
      );

      doc.setTextColor(0, 0, 0);

      /* ================= CUSTOMER BOX ================= */
      doc.roundedRect(14, 45, pageWidth - 28, 25, 3, 3);

      doc.setFontSize(11);
      doc.text(`Invoice No : ${invoice.invoiceNumber}`, 20, 55);
      doc.text(
        `Customer   : ${invoice.customer?.name || "N/A"}`,
        20,
        62
      );
      doc.text(
        `Due Date   : ${
          invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString()
            : "-"
        }`,
        pageWidth - 70,
        55
      );

      /* ================= TABLE ================= */
      autoTable(doc, {
        startY: 80,
        head: [["Product", "Qty", "Rate", "Amount"]],
        body:
          invoice.items?.map((item) => [
            item.name || "-",
            item.quantity || 0,
            `Rs. ${Number(item.price || 0).toFixed(2)}`,
            `Rs. ${(
              Number(item.quantity || 0) *
              Number(item.price || 0)
            ).toFixed(2)}`,
          ]) || [],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: {
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right" },
        },
      });

      const finalY = doc.lastAutoTable.finalY + 10;

      /* ================= TOTAL BOX ================= */
      doc.roundedRect(pageWidth - 85, finalY, 70, 35, 3, 3);

      doc.setFontSize(11);
      doc.text("Subtotal:", pageWidth - 80, finalY + 8);
      doc.text(
        `Rs. ${subTotal.toFixed(2)}`,
        pageWidth - 20,
        finalY + 8,
        { align: "right" }
      );

      doc.text(`Tax (${tax}%):`, pageWidth - 80, finalY + 15);
      doc.text(
        `Rs. ${taxAmount.toFixed(2)}`,
        pageWidth - 20,
        finalY + 15,
        { align: "right" }
      );

      doc.text("Discount:", pageWidth - 80, finalY + 22);
      doc.text(
        `Rs. ${discount.toFixed(2)}`,
        pageWidth - 20,
        finalY + 22,
        { align: "right" }
      );

      doc.setFontSize(13);
      doc.setTextColor(30, 64, 175);
      doc.text("Grand Total:", pageWidth - 80, finalY + 32);
      doc.text(
        `Rs. ${total.toFixed(2)}`,
        pageWidth - 20,
        finalY + 32,
        { align: "right" }
      );

      doc.setTextColor(0, 0, 0);

      doc.setFontSize(9);
      doc.text(
        "Thank you for choosing ReadyTechSolutions",
        pageWidth / 2,
        290,
        { align: "center" }
      );

      doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
      toast.success("Invoice Downloaded Successfully");
    } catch (error) {
      console.error(error);
      toast.error("PDF generation failed");
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Draft":
        return "bg-gray-200 text-gray-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="min-h-screen p-10 bg-slate-100">
      <div className="p-10 mx-auto bg-white shadow-xl max-w-7xl rounded-3xl">

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <FileText size={28} />
            <h1 className="text-3xl font-bold">
              Invoice Management
            </h1>
          </div>

          <button
            onClick={() => navigate("/invoices/create")}
            className="flex gap-2 px-6 py-3 text-white bg-blue-600 rounded-xl"
          >
            <Plus size={18} /> Create Invoice
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="w-full">
            <thead className="text-left text-gray-500">
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id} className="border-b">
                  <td className="py-4 font-semibold">
                    {invoice.invoiceNumber}
                  </td>
                  <td>{invoice.customer?.name}</td>
                  <td>
                    Rs. {Number(invoice.totalAmount || 0).toFixed(2)}
                  </td>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${getStatusStyle(
                        invoice.status
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="flex items-center gap-4 py-4">
                    <Eye
                      className="text-blue-600 cursor-pointer"
                      onClick={() =>
                        navigate(`/invoices/${invoice._id}`)
                      }
                    />

                    <FileDown
                      className="text-green-600 cursor-pointer"
                      onClick={() => downloadPDF(invoice)}
                    />

                    <CheckCircle
                      className="text-green-600 cursor-pointer"
                      onClick={() =>
                        updateStatus(invoice._id, "Paid")
                      }
                    />

                    <Clock
                      className="text-yellow-600 cursor-pointer"
                      onClick={() =>
                        updateStatus(invoice._id, "Pending")
                      }
                    />

                    <FileEdit
                      className="text-gray-600 cursor-pointer"
                      onClick={() =>
                        updateStatus(invoice._id, "Draft")
                      }
                    />

                    <Trash2
                      className="text-red-600 cursor-pointer"
                      onClick={() => deleteInvoice(invoice._id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
