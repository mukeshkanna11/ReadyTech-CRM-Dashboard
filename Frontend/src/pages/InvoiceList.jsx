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
import logoImg from "../assets/logo.png"; // your company logo
import QRCode from "qrcode";



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
      setInvoices(safeArray(res));
    } catch (err) {
      console.error(err?.response?.data || err.message);
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
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  /* ================= UPDATE STATUS ================= */
  const updateStatus = async (invoice, status) => {
    try {
      await API.put(`/invoices/${invoice._id}/status`, { status });
      toast.success(`Marked as ${status}`);
      fetchInvoices();
    } catch (err) {
      console.error(err);
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

   /* ================= FORMAT CURRENCY ================= */
const formatCurrency = (amount) => {
  return Number(amount || 0).toFixed(2);
};

  /* ================= TOTAL CALCULATION ================= */
  const calculateTotals = (invoice) => {
    const items = Array.isArray(invoice.items) ? invoice.items : [];

    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || item.rate || 0);
      const taxPercent = Number(item.taxPercent || 0);
      const base = qty * price;
      const tax = Math.round((base * taxPercent) / 100);
      subtotal += base;
      totalTax += tax;
    });

    const discount = Math.round(Number(invoice.discountAmount || 0));
    const tds = Math.round(Number(invoice.tdsAmount || 0));
    const tcs = Math.round(Number(invoice.tcsAmount || 0));

    const grandTotal = subtotal + totalTax - discount - tds + tcs;
    const balance = invoice.status === "Paid" ? 0 : invoice.balance ?? grandTotal;

    return { subtotal, totalTax, discount, tds, tcs, grandTotal, balance, computedStatus: getComputedStatus(invoice) };
  };

 

/* ================= NUMBER TO WORDS (INDIAN FORMAT) ================= */
const numberToWords = (num) => {
  if (!num || num === 0) return "Zero Rupees Only";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty",
    "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  const convertBelowThousand = (n) => {
    let str = "";

    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }

    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }

    if (n > 0) {
      str += ones[n] + " ";
    }

    return str.trim();
  };

  let result = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore) result += convertBelowThousand(crore) + " Crore ";
  if (lakh) result += convertBelowThousand(lakh) + " Lakh ";
  if (thousand) result += convertBelowThousand(thousand) + " Thousand ";
  if (num) result += convertBelowThousand(num);

  return result.trim() + " Rupees Only";
};


/* ================= DOWNLOAD PDF ================= */
const downloadPDF = async (invoice) => {
  try {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const { subtotal, totalTax, discount, grandTotal, balance } =
      calculateTotals(invoice);

    /* ================= LIGHT WATERMARK BACKGROUND ================= */
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(100);
    doc.setTextColor(balance <= 0 ? 0 : 255, balance <= 0 ? 150 : 0, 0);

    doc.text(
      balance <= 0 ? "PAID" : "DUE",
      pageWidth / 2,
      pageHeight / 2,
      { align: "center", angle: 45 }
    );

    doc.setGState(new doc.GState({ opacity: 1 }));

    /* ================= HEADER ================= */
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 35, "F");

    if (logoImg) {
      doc.addImage(logoImg, "PNG", 15, 8, 22, 20);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("READY TECH SOLUTIONS", 45, 15);

    doc.setFontSize(9);
    doc.text("GSTIN: 29IWQPS5331L1ZH", 45, 22);
    doc.text("Coimbatore, Tamil Nadu", 45, 27);
    doc.text("Email: info@readytechsolutions.in", 45, 31);

    doc.setTextColor(0, 0, 0);
/* ================= INVOICE HEADER SECTION ================= */

doc.setFont("helvetica", "bold");
doc.setFontSize(20);
doc.text("TAX INVOICE", pageWidth - 20, 45, { align: "right" });

doc.setFont("helvetica", "normal");
doc.setFontSize(10);

/* ---------- FETCH INVOICE DATE SAFELY ---------- */
const rawInvoiceDate =
  invoice?.invoiceDate ||
  invoice?.date ||
  invoice?.createdAt ||
  invoice?.invoice_date ||
  null;

const invoiceDate = rawInvoiceDate
  ? new Date(rawInvoiceDate).toLocaleDateString("en-IN")
  : "-";

/* ---------- FETCH DUE DATE SAFELY ---------- */
const rawDueDate =
  invoice?.dueDate ||
  invoice?.due_date ||
  null;

const dueDate = rawDueDate
  ? new Date(rawDueDate).toLocaleDateString("en-IN")
  : "-";

/* ---------- RIGHT SIDE DETAILS ---------- */
doc.text(`Invoice No : ${invoice?.invoiceNumber || invoice?.invoice_no || "-"}`, pageWidth - 20, 53, { align: "right" });
doc.text(`Invoice Date : ${invoiceDate}`, pageWidth - 20, 59, { align: "right" });
doc.text(`Due Date : ${dueDate}`, pageWidth - 20, 65, { align: "right" });


/* ================= BILL TO SECTION ================= */

doc.setDrawColor(210);
doc.roundedRect(15, 50, 90, 22, 3, 3);

doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.text("Bill To", 20, 58);

doc.setFont("helvetica", "normal");
doc.setFontSize(11);

/* ---------- FETCH CUSTOMER NAME SAFELY ---------- */
const customerName =
  invoice?.customerName ||
  invoice?.clientName ||
  invoice?.name ||
  invoice?.customer?.name ||
  invoice?.client?.name ||
  invoice?.customer?.fullName ||
  "-";

doc.text(customerName, 20, 66);



    /* ================= ITEMS TABLE ================= */
    autoTable(doc, {
      startY: 80,
      theme: "grid",
      head: [["Description", "Qty", "Rate", "CGST", "SGST", "Total"]],
      body: (invoice.items || []).map((item) => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.unitPrice || 0);
        const taxPercent = Number(item.taxPercent || 0);

        const base = qty * price;
        const cgst = (base * taxPercent) / 200;
        const sgst = (base * taxPercent) / 200;
        const total = base + cgst + sgst;

        return [
          item.description || "Item",
          qty,
          formatCurrency(price),
          formatCurrency(cgst),
          formatCurrency(sgst),
          formatCurrency(total),
        ];
      }),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        halign: "left",
      },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
      headStyles: {
        fillColor: [37, 99, 235],
        halign: "center",
        fontStyle: "bold",
      },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(
          "This is a computer generated invoice.",
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      },
    });

    let finalY = doc.lastAutoTable.finalY + 10;

    if (finalY > pageHeight - 90) {
      doc.addPage();
      finalY = 20;
    }

    /* ================= TOTALS BOX ================= */
    doc.setDrawColor(180);
    doc.roundedRect(pageWidth - 85, finalY, 70, 42, 3, 3);

    const labelX = pageWidth - 80;
    const valueX = pageWidth - 20;

    const drawRight = (label, value, y) => {
      doc.text(label, labelX, y);
      doc.text(value, valueX, y, { align: "right" });
    };

    doc.setFontSize(10);

    drawRight("Subtotal:", formatCurrency(subtotal), finalY + 8);
    drawRight("Tax:", formatCurrency(totalTax), finalY + 15);
    drawRight("Discount:", formatCurrency(discount), finalY + 22);

    doc.setFont("helvetica", "bold");
    drawRight("Grand Total:", formatCurrency(grandTotal), finalY + 30);

    doc.setTextColor(220, 38, 38);
    drawRight("Balance Due:", formatCurrency(balance), finalY + 37);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    /* ================= AMOUNT IN WORDS ================= */
    doc.text(
      `Amount in Words: ${numberToWords(Math.round(grandTotal))}`,
      15,
      finalY + 55
    );

    /* ================= BANK DETAILS ================= */
    doc.setFont("helvetica", "bold");
    doc.text("Bank Details:", 15, finalY + 70);

    doc.setFont("helvetica", "normal");
    doc.text("Bank Name: HDFC Bank", 15, finalY + 77);
    doc.text("A/C No: 123456789012", 15, finalY + 83);
    doc.text("IFSC: HDFC0001234", 15, finalY + 89);

    /* ================= SIGNATURE ================= */
    doc.setFont("helvetica", "bold");
    doc.text("Authorized Signature", pageWidth - 60, pageHeight - 30);
    doc.line(pageWidth - 70, pageHeight - 35, pageWidth - 20, pageHeight - 35);

    doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
    toast.success("Invoice Generated Successfully");

  } catch (error) {
    console.error(error);
    toast.error("PDF generation failed");
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
          <h1 className="text-3xl font-bold">Invoice Management</h1>

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
          <table className="w-full border rounded-lg">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="px-2 py-3">Invoice</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {invoices.map((invoice) => {
                const { grandTotal, balance, computedStatus } = calculateTotals(invoice);
                const customerName = invoice.customer?.name || invoice.customerName || "N/A";

                return (
                  <tr key={invoice._id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-4 font-semibold">{invoice.invoiceNumber}</td>
                    <td>{customerName}</td>
                    <td>{formatCurrency(grandTotal)}</td>
                    <td>{formatCurrency(balance)}</td>
                    <td>
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusStyle(computedStatus)}`}>
                        {computedStatus}
                      </span>
                    </td>

                    <td className="flex gap-4 px-2 py-4">
                      <Eye className="text-blue-600 cursor-pointer" onClick={() => navigate(`/invoices/${invoice._id}`)} />
                      <FileDown className="text-green-600 cursor-pointer" onClick={() => downloadPDF(invoice)} />
                      <CheckCircle className="text-green-600 cursor-pointer" onClick={() => updateStatus(invoice, "Paid")} />
                      <AlertCircle className="text-red-600 cursor-pointer" onClick={() => updateStatus(invoice, "Overdue")} />
                      <Trash2 className="text-red-600 cursor-pointer" onClick={() => deleteInvoice(invoice._id)} />
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
