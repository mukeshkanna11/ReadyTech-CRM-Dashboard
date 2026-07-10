import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Eye,
  Trash2,
  FileDown,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  X,
  Printer,
  Wallet,
  FileText,
  TrendingUp,
  Clock,
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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

  const updateStatus = async (invoice, status) => {
  try {
    const res = await API.put(
      `/api/invoices/${invoice._id}/status`,
      {
        paymentStatus: status, // ✔ MUST be paymentStatus
      }
    );

    const updated = res.data.data;

    setInvoices((prev) =>
      prev.map((inv) =>
        inv._id === invoice._id ? updated : inv
      )
    );

    toast.success(`Marked as ${status}`);
  } catch (err) {
    console.error(err);
    toast.error("Failed to update status");
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

  
  /* ================= DERIVED (UI-only) ================= */
  const enriched = invoices.map((invoice) => {
    const t = calculateTotals(invoice);
    const name =
      invoice?.customer?.companyName ||
      invoice?.customer?.contactPerson ||
      invoice?.customerName ||
      "N/A";
    return { invoice, ...t, name };
  });

  const filtered = enriched.filter((e) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      `${e.invoice?.invoiceNumber || ""} ${e.name}`.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "All" || e.computedStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const summary = enriched.reduce(
    (a, e) => {
      a.total += 1;
      a.billed += e.grandTotal;
      a.outstanding += e.balance;
      if (e.computedStatus === "Paid") a.paid += 1;
      return a;
    },
    { total: 0, billed: 0, outstanding: 0, paid: 0 }
  );

  const hasFilters = search || statusFilter !== "All";

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto space-y-6 max-w-7xl">

        {/* ================= HEADER ================= */}
        <div className="relative overflow-hidden text-white shadow-xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
          <div className="absolute rounded-full -right-24 -top-24 h-72 w-72 bg-indigo-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
                <FileText size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invoice Management</h1>
                <p className="mt-1 text-sm text-slate-300">Manage, track and download invoices</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition rounded-xl bg-white/10 hover:bg-white/20"
              >
                <Printer size={16} /> Print
              </button>
              <button
                onClick={() => navigate("/invoices/create")}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition bg-white shadow-sm text-slate-900 rounded-xl hover:bg-slate-100 hover:scale-[1.03] active:scale-95"
              >
                <Plus size={16} /> Create Invoice
              </button>
            </div>
          </div>
        </div>

        {/* ================= SUMMARY CARDS ================= */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SummaryCard title="Total Invoices" value={summary.total} icon={FileText} tone="indigo" />
          <SummaryCard title="Total Billed" value={`₹ ${formatCurrency(summary.billed)}`} icon={TrendingUp} tone="violet" />
          <SummaryCard title="Outstanding" value={`₹ ${formatCurrency(summary.outstanding)}`} icon={Wallet} tone="amber" />
          <SummaryCard title="Paid" value={summary.paid} icon={CheckCircle} tone="emerald" />
        </div>

        {/* ================= FILTERS ================= */}
        <div className="flex flex-col gap-3 p-4 bg-white border shadow-sm rounded-2xl border-slate-200 sm:flex-row sm:items-center print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice number or customer…"
              className="w-full py-2.5 pr-4 text-sm transition border outline-none bg-slate-50 border-slate-200 pl-11 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm transition border outline-none bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("All"); }}
                className="flex items-center gap-1 px-3 py-2.5 text-sm transition text-slate-500 hover:text-slate-800"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* ================= CONTENT BOX ================= */}
        <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          {loading ? (
            <div className="p-4 space-y-3 sm:p-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1 h-4 rounded bg-slate-100 animate-pulse" />
                  <div className="w-24 h-4 rounded bg-slate-100 animate-pulse" />
                  <div className="h-6 rounded-full w-20 bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="grid mb-4 rounded-2xl h-14 w-14 place-items-center bg-indigo-50 text-indigo-500">
                <FileText size={26} />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                {hasFilters ? "No invoices match your filters" : "No invoices found"}
              </h3>
              <p className="max-w-sm mt-1 text-sm text-slate-500">
                {hasFilters ? "Try adjusting or clearing your filters." : "Create your first invoice to get started."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-slate-500 border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left">Invoice</th>
                    <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left md:table-cell">Customer</th>
                    <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-right">Total</th>
                    <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-right sm:table-cell">Balance</th>
                    <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-center">Status</th>
                    <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-center print:hidden">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map(({ invoice, grandTotal, balance, computedStatus, name }) => (
                    <tr key={invoice._id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid text-indigo-600 rounded-xl h-9 w-9 shrink-0 bg-indigo-50 place-items-center">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate text-slate-800">{invoice?.invoiceNumber || "-"}</div>
                            <div className="text-xs text-slate-400 md:hidden">{name}</div>
                            <div className="hidden text-xs text-slate-400 md:block">ID: {invoice?._id?.slice(-6)}</div>
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-6 py-4 md:table-cell text-slate-600">{name}</td>

                      <td className="px-6 py-4 font-semibold text-right text-slate-800">₹ {formatCurrency(grandTotal)}</td>

                      <td className="hidden px-6 py-4 text-right sm:table-cell">
                        <span className={`font-semibold ${balance === 0 ? "text-emerald-600" : "text-red-500"}`}>
                          ₹ {formatCurrency(balance)}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(computedStatus)}`}>
                          {computedStatus === "Paid" ? <CheckCircle size={12} /> : computedStatus === "Overdue" ? <AlertCircle size={12} /> : <Clock size={12} />}
                          {computedStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <IconBtn title="View" className="text-blue-500 hover:bg-blue-50" onClick={() => navigate(`/invoices/${invoice._id}`)}>
                            <Eye size={16} />
                          </IconBtn>
                          <IconBtn title="Download PDF" className="text-emerald-500 hover:bg-emerald-50" onClick={() => downloadPDF(invoice)}>
                            <FileDown size={16} />
                          </IconBtn>
                          <IconBtn title="Mark Paid" className="text-green-500 hover:bg-green-50" onClick={() => updateStatus(invoice, "Paid")}>
                            <CheckCircle size={16} />
                          </IconBtn>
                          <IconBtn title="Mark Overdue" className="text-amber-500 hover:bg-amber-50" onClick={() => updateStatus(invoice, "Overdue")}>
                            <AlertCircle size={16} />
                          </IconBtn>
                          <IconBtn title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => deleteInvoice(invoice._id)}>
                            <Trash2 size={16} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ================= UI HELPERS ================= */
function SummaryCard({ title, value, icon: Icon, tone }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="p-5 transition bg-white border shadow-sm rounded-2xl border-slate-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-bold truncate text-slate-900">{value}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[tone] || tones.indigo}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, className = "" }) {
  return (
    <button onClick={onClick} title={title} className={`grid h-8 w-8 place-items-center rounded-lg transition ${className}`}>
      {children}
    </button>
  );
}