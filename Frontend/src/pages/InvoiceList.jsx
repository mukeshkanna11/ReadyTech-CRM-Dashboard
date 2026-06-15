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
import logoImg from "../assets/logo1.png";

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ================= SAFE ARRAY ================= */
  const safeArray = (res) => {
    const data = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(data) ? data : [];
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

  /* ================= COMPUTE STATUS ================= */
  const getComputedStatus = (invoice = {}) => {
    const status = (invoice?.status || "").toLowerCase();

    if (status === "paid") return "Paid";

    const dueDate = invoice?.dueDate || invoice?.due_date;

    if (dueDate && new Date(dueDate).getTime() < Date.now()) {
      return "Overdue";
    }

    return "Pending";
  };

  /* ================= FORMAT CURRENCY ================= */
  const formatCurrency = (amount) => {
    const val = Number(amount);
    return Number.isFinite(val) ? val.toFixed(2) : "0.00";
  };

  /* ================= TOTAL CALCULATION ================= */
  const calculateTotals = (invoice = {}) => {
    const items = Array.isArray(invoice?.items) ? invoice.items : [];

    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const qty = Number(item?.quantity || 0);
      const price = Number(item?.unitPrice ?? item?.rate ?? 0);
      const taxPercent = Number(item?.taxPercent || 0);

      const base = qty * price;
      const tax = (base * taxPercent) / 100;

      subtotal += base;
      totalTax += tax;
    });

    const discount = Number(invoice?.discountAmount || 0);
    const tds = Number(invoice?.tdsAmount || 0);
    const tcs = Number(invoice?.tcsAmount || 0);

    const grandTotal = subtotal + totalTax - discount - tds + tcs;

    const computedStatus = getComputedStatus(invoice);

    const balance =
      computedStatus === "Paid"
        ? 0
        : Number(invoice?.balance ?? grandTotal);

    return {
      subtotal,
      totalTax,
      discount,
      tds,
      tcs,
      grandTotal,
      balance,
      computedStatus,
    };
  };

  /* ================= NUMBER TO WORDS ================= */
  const numberToWords = (num) => {
    if (!num || num === 0) return "Zero Rupees Only";

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six",
      "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
      "Thirteen", "Fourteen", "Fifteen", "Sixteen",
      "Seventeen", "Eighteen", "Nineteen",
    ];

    const tens = [
      "", "", "Twenty", "Thirty", "Forty",
      "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
    ];

    const convert = (n) => {
      let str = "";

      if (n >= 100) {
        str += ones[Math.floor(n / 100)] + " Hundred ";
        n %= 100;
      }

      if (n >= 20) {
        str += tens[Math.floor(n / 10)] + " ";
        n %= 10;
      }

      if (n > 0) str += ones[n] + " ";

      return str.trim();
    };

    let result = "";
    const crore = Math.floor(num / 10000000);
    num %= 10000000;

    const lakh = Math.floor(num / 100000);
    num %= 100000;

    const thousand = Math.floor(num / 1000);
    num %= 1000;

    if (crore) result += convert(crore) + " Crore ";
    if (lakh) result += convert(lakh) + " Lakh ";
    if (thousand) result += convert(thousand) + " Thousand ";
    if (num) result += convert(num);

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

    /* ================= SOFT WATERMARK ================= */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.setTextColor(240, 240, 240); // VERY LIGHT GREY

    doc.text(
      balance <= 0 ? "PAID" : "INVOICE",
      pageWidth / 2,
      pageHeight / 2,
      { align: "center", angle: 45 }
    );

    doc.setTextColor(0, 0, 0);

    /* ================= HEADER ================= */
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 45, "F");

    if (logoImg) {
      doc.addImage(logoImg, "PNG", 15, 10, 22, 22);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("READY TECH SOLUTIONS", 45, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("GSTIN: 29IWQPS5331L1ZH", 45, 24);
    doc.text("Coimbatore, Tamil Nadu", 45, 29);
    doc.text("Email: info@readytechsolutions.in", 45, 34);

    /* ================= INVOICE TITLE ================= */
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", pageWidth - 20, 18, { align: "right" });

    /* ================= DATES BOX ================= */
    const invoiceDate =
      invoice?.invoiceDate ||
      invoice?.date ||
      invoice?.createdAt;

    const dueDate = invoice?.dueDate;

    const orderDate = invoice?.orderDate || invoiceDate;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    doc.text(
      `Invoice No: ${invoice?.invoiceNumber || "-"}`,
      pageWidth - 20,
      28,
      { align: "right" }
    );

    doc.text(
      `Invoice Date: ${invoiceDate ? new Date(invoiceDate).toLocaleDateString("en-IN") : "-"}`,
      pageWidth - 20,
      33,
      { align: "right" }
    );

    doc.text(
      `Order Date: ${orderDate ? new Date(orderDate).toLocaleDateString("en-IN") : "-"}`,
      pageWidth - 20,
      38,
      { align: "right" }
    );

    doc.text(
      `Due Date: ${dueDate ? new Date(dueDate).toLocaleDateString("en-IN") : "-"}`,
      pageWidth - 20,
      43,
      { align: "right" }
    );

    /* ================= BILL TO ================= */
    doc.setDrawColor(220);
    doc.roundedRect(15, 55, 90, 25, 3, 3);

    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", 20, 63);

    doc.setFont("helvetica", "normal");

    const customerName =
      invoice?.customer?.companyName ||
      invoice?.customer?.contactPerson ||
      invoice?.customerName ||
      "N/A";

    doc.text(customerName, 20, 70);

    /* ================= ITEMS TABLE ================= */
    autoTable(doc, {
      startY: 85,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: 30,
        fontStyle: "bold",
      },
      head: [["Description", "Qty", "Rate", "CGST", "SGST", "Total"]],
      body: (Array.isArray(invoice?.items) ? invoice.items : []).map(
        (item) => {
          const qty = Number(item?.quantity || 0);
          const price = Number(item?.unitPrice || 0);
          const taxPercent = Number(item?.taxPercent || 0);

          const base = qty * price;
          const tax = (base * taxPercent) / 100;

          return [
            item?.description || "Item",
            qty,
            formatCurrency(price),
            formatCurrency(tax / 2),
            formatCurrency(tax / 2),
            formatCurrency(base + tax),
          ];
        }
      ),
    });

    let y = doc.lastAutoTable.finalY + 10;

    /* ================= TOTAL BOX (PREMIUM) ================= */
    doc.setDrawColor(230);
    doc.roundedRect(pageWidth - 85, y, 70, 45, 3, 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text("Subtotal:", pageWidth - 80, y + 8);
    doc.text(formatCurrency(subtotal), pageWidth - 25, y + 8, {
      align: "right",
    });

    doc.text("Tax:", pageWidth - 80, y + 15);
    doc.text(formatCurrency(totalTax), pageWidth - 25, y + 15, {
      align: "right",
    });

    doc.text("Discount:", pageWidth - 80, y + 22);
    doc.text(formatCurrency(discount), pageWidth - 25, y + 22, {
      align: "right",
    });

    doc.setFont("helvetica", "bold");
    doc.text("Grand Total:", pageWidth - 80, y + 32);
    doc.text(formatCurrency(grandTotal), pageWidth - 25, y + 32, {
      align: "right",
    });

    doc.setFont("helvetica", "normal");
    doc.text("Balance:", pageWidth - 80, y + 40);
    doc.text(formatCurrency(balance), pageWidth - 25, y + 40, {
      align: "right",
    });

    /* ================= AMOUNT IN WORDS ================= */
    doc.setFontSize(10);
    doc.text(
      `Amount in Words: ${numberToWords(Math.round(grandTotal))}`,
      15,
      y + 55
    );

    /* ================= FOOTER ================= */
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "This is a computer generated invoice and does not require signature.",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    doc.save(`Invoice-${invoice?.invoiceNumber || "INV"}.pdf`);

    toast.success("Invoice downloaded successfully");
  } catch (err) {
    console.error(err);
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

  
 return (
  <div className="min-h-screen p-6 bg-slate-50 md:p-10">
    <div className="mx-auto max-w-7xl">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Invoice Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage, track and download invoices
          </p>
        </div>

        <button
          onClick={() => navigate("/invoices/create")}
          className="flex items-center gap-2 px-5 py-3 mt-4 text-white transition bg-blue-600 shadow-sm md:mt-0 rounded-xl hover:bg-blue-700"
        >
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* ================= CONTENT BOX ================= */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-100">

        {/* ================= LOADING ================= */}
        {loading ? (
          <div className="p-10 text-center text-slate-500">
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No invoices found
          </div>
        ) : (

          <div className="overflow-x-auto">

            {/* ================= TABLE ================= */}
            <table className="w-full">

              {/* HEADER */}
              <thead className="text-sm bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-4 font-medium text-left">Invoice</th>
                  <th className="px-6 py-4 font-medium text-left">Customer</th>
                  <th className="px-6 py-4 font-medium text-right">Total</th>
                  <th className="px-6 py-4 font-medium text-right">Balance</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Actions</th>
                </tr>
              </thead>

              {/* BODY */}
              <tbody className="divide-y divide-slate-100">

                {invoices.map((invoice) => {
                  const {
                    grandTotal,
                    balance,
                    computedStatus,
                  } = calculateTotals(invoice);

                  const customerName =
                    invoice?.customer?.companyName ||
                    invoice?.customer?.contactPerson ||
                    invoice?.customerName ||
                    "N/A";

                  return (
                    <tr
                      key={invoice._id}
                      className="transition hover:bg-slate-50"
                    >

                      {/* INVOICE NO */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {invoice?.invoiceNumber || "-"}
                        </div>
                        <div className="text-xs text-slate-400">
                          ID: {invoice?._id?.slice(-6)}
                        </div>
                      </td>

                      {/* CUSTOMER */}
                      <td className="px-6 py-4 text-slate-600">
                        {customerName}
                      </td>

                      {/* TOTAL */}
                      <td className="px-6 py-4 font-medium text-right text-slate-700">
                        ₹ {formatCurrency(grandTotal)}
                      </td>

                      {/* BALANCE */}
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-semibold ${
                            balance === 0
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          ₹ {formatCurrency(balance)}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(
                            computedStatus
                          )}`}
                        >
                          {computedStatus}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">

                          <Eye
                            size={18}
                            className="text-blue-500 cursor-pointer hover:text-blue-700"
                            onClick={() =>
                              navigate(`/invoices/${invoice._id}`)
                            }
                          />

                          <FileDown
                            size={18}
                            className="cursor-pointer text-emerald-500 hover:text-emerald-700"
                            onClick={() => downloadPDF(invoice)}
                          />

                          <CheckCircle
                            size={18}
                            className="text-green-500 cursor-pointer hover:text-green-700"
                            onClick={() =>
                              updateStatus(invoice, "Paid")
                            }
                          />

                          <AlertCircle
                            size={18}
                            className="text-yellow-500 cursor-pointer hover:text-yellow-700"
                            onClick={() =>
                              updateStatus(invoice, "Overdue")
                            }
                          />

                          <Trash2
                            size={18}
                            className="text-red-500 cursor-pointer hover:text-red-700"
                            onClick={() =>
                              deleteInvoice(invoice._id)
                            }
                          />
                        </div>
                      </td>

                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </div>
  );
};