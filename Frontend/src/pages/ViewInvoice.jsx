import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Printer,
  Share2,
  Send,
  Globe,
  Mail,
  Phone,
  Clock,
  CreditCard,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";

/* ================= HELPERS ================= */
const money = (x) =>
  `₹ ${Number(x || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "-");

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "-");

const statusStyle = (status) => {
  switch (status) {
    case "Paid":
      return "bg-green-100 text-green-700 ring-1 ring-green-200";
    case "Overdue":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    case "Draft":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    case "Sent":
    case "Viewed":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
    case "Partially Paid":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    case "Cancelled":
      return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
};

/* ================= SMALL COMPONENTS ================= */
function MetaItem({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "text-slate-800" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label, variant = "light", loading }) {
  const base =
    "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
      : variant === "dark"
      ? "bg-slate-800 text-white hover:bg-slate-900"
      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50";
  return (
    <button onClick={onClick} disabled={loading} className={`${base} ${styles}`}>
      <Icon size={16} />
      {label}
    </button>
  );
}

/* ================= PAGE ================= */
export default function ViewInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /* ============ FETCH ============ */
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await API.get(`/invoices/${id}?view=1`);
        setInvoice(res.data?.data || res.data || null);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  /* ============ ACTIONS ============ */
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const base = import.meta.env.VITE_API_URL;
      const token = localStorage.getItem("token");
      const r = await fetch(`${base}/invoices/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoice?.invoiceNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    const title = `Invoice ${invoice?.invoiceNumber || ""}`.trim();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (err) {
      // user cancelled share or clipboard failed silently
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const res = await API.post(`/invoices/${id}/send`);
      toast.success(res.data?.message || "Invoice sent");
      setInvoice((prev) => (prev ? { ...prev, status: "Sent" } : prev));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  /* ============ STATES ============ */
  if (loading)
    return (
      <div className="p-10 text-center text-slate-500">Loading invoice...</div>
    );
  if (!invoice)
    return (
      <div className="p-10 text-center text-slate-500">Invoice not found</div>
    );

  /* ============ DERIVED ============ */
  const company = invoice.companyDetails || {};
  const billing = invoice.billingDetails || {};
  const shipping = invoice.shippingDetails || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const isIntra = invoice.taxType === "INTRA";
  const statusHistory = Array.isArray(invoice.statusHistory)
    ? invoice.statusHistory
    : [];
  const paymentHistory = Array.isArray(invoice.paymentHistory)
    ? invoice.paymentHistory
    : [];

  const companyAddress = [
    company.address,
    company.city,
    company.state,
    company.pincode,
    company.country,
  ]
    .filter(Boolean)
    .join(", ");

  const billingAddress = [
    billing.addressLine1,
    billing.addressLine2,
    billing.city,
    billing.state,
    billing.pincode,
    billing.country,
  ]
    .filter(Boolean)
    .join(", ");

  const shippingAddress = [
    shipping.addressLine1,
    shipping.addressLine2,
    shipping.city,
    shipping.state,
    shipping.pincode,
    shipping.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen p-4 md:p-8 bg-slate-100">
      {/* print styling */}
      <style>{`@media print { .no-print{display:none!important} body{background:#fff} }`}</style>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* ================= ACTION BAR ================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <ActionButton
            onClick={() => navigate(-1)}
            icon={ArrowLeft}
            label="Back"
            variant="light"
          />
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              onClick={handleDownload}
              icon={Download}
              label={downloading ? "Downloading..." : "Download PDF"}
              variant="light"
              loading={downloading}
            />
            <ActionButton
              onClick={handlePrint}
              icon={Printer}
              label="Print"
              variant="light"
            />
            <ActionButton
              onClick={handleShare}
              icon={Share2}
              label="Share"
              variant="light"
            />
            <ActionButton
              onClick={handleSendEmail}
              icon={Send}
              label={sending ? "Sending..." : "Send Email"}
              variant="primary"
              loading={sending}
            />
          </div>
        </div>

        {/* ================= INVOICE CARD ================= */}
        <div
          id="invoice-print"
          className="p-6 bg-white shadow-xl md:p-10 rounded-3xl ring-1 ring-slate-100"
        >
          {/* ---------- Company Header ---------- */}
          <div className="flex flex-col justify-between gap-6 pb-6 border-b border-slate-100 md:flex-row">
            <div className="flex items-start gap-4">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt="logo"
                  className="object-contain w-16 h-16 rounded-xl"
                />
              ) : null}
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {company.companyName || "Your Company"}
                </h2>
                {companyAddress && (
                  <p className="mt-1 text-sm text-slate-500 max-w-xs">
                    {companyAddress}
                  </p>
                )}
                <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                  {company.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail size={13} /> {company.email}
                    </p>
                  )}
                  {company.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone size={13} /> {company.phone}
                    </p>
                  )}
                  {company.website && (
                    <p className="flex items-center gap-1.5">
                      <Globe size={13} /> {company.website}
                    </p>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {company.gstNumber && <p>GSTIN: {company.gstNumber}</p>}
                  {company.panNumber && <p>PAN: {company.panNumber}</p>}
                </div>
              </div>
            </div>

            <div className="text-left md:text-right">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                TAX INVOICE
              </h1>
              <span
                className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${statusStyle(
                  invoice.status
                )}`}
              >
                {invoice.status || "Draft"}
              </span>
              {invoice.invoiceType && (
                <p className="mt-2 text-xs text-slate-400">
                  {invoice.invoiceType}
                </p>
              )}
            </div>
          </div>

          {/* ---------- Invoice Meta ---------- */}
          <div className="grid grid-cols-2 gap-4 py-6 border-b sm:grid-cols-3 lg:grid-cols-5 border-slate-100">
            <MetaItem
              label="Invoice #"
              value={invoice.invoiceNumber || "-"}
            />
            <MetaItem label="Invoice Date" value={fmtDate(invoice.issueDate)} />
            <MetaItem label="Due Date" value={fmtDate(invoice.dueDate)} />
            <MetaItem label="Order Date" value={fmtDate(invoice.orderDate)} />
            <MetaItem
              label="Payment Date"
              value={fmtDate(invoice.paymentDate)}
            />
          </div>

          {/* ---------- Bill To / Ship To ---------- */}
          <div className="grid grid-cols-1 gap-6 py-6 border-b md:grid-cols-2 border-slate-100">
            <div>
              <p className="text-xs font-semibold tracking-wide uppercase text-indigo-600">
                Bill To
              </p>
              <p className="mt-2 font-semibold text-slate-800">
                {billing.companyName || invoice.customer?.companyName || "-"}
              </p>
              {billing.contactPerson && (
                <p className="text-sm text-slate-600">{billing.contactPerson}</p>
              )}
              {billingAddress && (
                <p className="mt-1 text-sm text-slate-500">{billingAddress}</p>
              )}
              <div className="mt-1 text-sm text-slate-500">
                {billing.email && <p>Email: {billing.email}</p>}
                {billing.phone && <p>Phone: {billing.phone}</p>}
                {billing.gstNumber && <p>GSTIN: {billing.gstNumber}</p>}
                {billing.panNumber && <p>PAN: {billing.panNumber}</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-wide uppercase text-indigo-600">
                Ship To
              </p>
              <p className="mt-2 font-semibold text-slate-800">
                {shipping.companyName || billing.companyName || "-"}
              </p>
              {shipping.contactPerson && (
                <p className="text-sm text-slate-600">
                  {shipping.contactPerson}
                </p>
              )}
              {shippingAddress && (
                <p className="mt-1 text-sm text-slate-500">{shippingAddress}</p>
              )}
              {shipping.phone && (
                <p className="text-sm text-slate-500">Phone: {shipping.phone}</p>
              )}
              {invoice.placeOfSupply && (
                <p className="mt-2 text-sm">
                  <span className="text-slate-400">Place of Supply: </span>
                  <span className="font-medium text-slate-700">
                    {invoice.placeOfSupply}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* ---------- Items Table ---------- */}
          <div className="py-6 overflow-x-auto">
            <table className="w-full text-sm border rounded-2xl border-slate-100">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">HSN/SAC</th>
                  <th className="px-3 py-3 font-medium text-center">Qty</th>
                  <th className="px-3 py-3 font-medium text-right">Rate</th>
                  <th className="px-3 py-3 font-medium text-right">Taxable</th>
                  <th className="px-3 py-3 font-medium text-right">Tax %</th>
                  <th className="px-3 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No items
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = Number(item.quantity || 0);
                    const rate = Number(item.unitPrice || 0);
                    const taxable = Number(
                      item.taxableAmount ?? qty * rate
                    );
                    const amount = Number(
                      item.total ?? taxable + Number(item.taxAmount || 0)
                    );
                    return (
                      <tr
                        key={index}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-3 text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {item.description || "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {item.hsnCode || item.sacCode || "-"}
                        </td>
                        <td className="px-3 py-3 text-center">{qty}</td>
                        <td className="px-3 py-3 text-right">{money(rate)}</td>
                        <td className="px-3 py-3 text-right">
                          {money(taxable)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {Number(item.taxPercent || 0)}%
                        </td>
                        <td className="px-3 py-3 font-medium text-right text-slate-800">
                          {money(amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ---------- Tax Summary ---------- */}
          <div className="flex justify-end pb-6 border-b border-slate-100">
            <div className="w-full max-w-sm p-5 space-y-2 bg-slate-50 rounded-2xl">
              <SummaryRow label="Subtotal" value={money(invoice.subtotal)} />
              {Number(invoice.discountAmount || 0) > 0 && (
                <SummaryRow
                  label={`Discount${
                    invoice.discountType === "PERCENT"
                      ? ` (${Number(invoice.discountValue || 0)}%)`
                      : ""
                  }`}
                  value={`− ${money(invoice.discountAmount)}`}
                  valueClass="text-rose-600"
                />
              )}
              <SummaryRow
                label="Taxable Value"
                value={money(invoice.taxableAmount)}
              />
              {isIntra ? (
                <>
                  <SummaryRow
                    label={`CGST (${Number(invoice.cgstPercent || 0)}%)`}
                    value={money(invoice.cgstAmount)}
                  />
                  <SummaryRow
                    label={`SGST (${Number(invoice.sgstPercent || 0)}%)`}
                    value={money(invoice.sgstAmount)}
                  />
                </>
              ) : (
                <SummaryRow
                  label={`IGST (${Number(invoice.igstPercent || 0)}%)`}
                  value={money(invoice.igstAmount)}
                />
              )}
              {Number(invoice.roundOff || 0) !== 0 && (
                <SummaryRow
                  label="Round Off"
                  value={money(invoice.roundOff)}
                />
              )}
              <div className="flex items-center justify-between pt-2 mt-2 text-lg font-bold border-t border-slate-200">
                <span className="text-slate-900">Grand Total</span>
                <span className="text-indigo-600">
                  {money(invoice.grandTotal)}
                </span>
              </div>
              <SummaryRow
                label="Amount Paid"
                value={money(invoice.amountPaid)}
                valueClass="text-green-600"
              />
              <SummaryRow
                label="Balance Due"
                value={money(invoice.balanceDue)}
                valueClass="text-rose-600"
              />
            </div>
          </div>

          {/* ---------- Payment Details ---------- */}
          <div className="grid grid-cols-1 gap-4 py-6 border-b sm:grid-cols-3 border-slate-100">
            <div className="flex items-start gap-3">
              <CreditCard size={18} className="mt-0.5 text-slate-400" />
              <MetaItem
                label="Payment Method"
                value={invoice.paymentMode || "-"}
              />
            </div>
            <MetaItem
              label="Transaction ID"
              value={invoice.transactionId || invoice.paymentReference || "-"}
            />
            <MetaItem
              label="Payment Status"
              value={invoice.paymentStatus || "-"}
            />
          </div>

          {/* ---------- Notes & Terms ---------- */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-600">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                    Terms &amp; Conditions
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-600">
                    {invoice.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= HISTORY ================= */}
        {(statusHistory.length > 0 || paymentHistory.length > 0) && (
          <div className="p-6 bg-white shadow-sm no-print rounded-3xl ring-1 ring-slate-100">
            <h3 className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
              <Clock size={16} /> History
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {statusHistory.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-400">
                    Status History
                  </p>
                  <ul className="space-y-2">
                    {statusHistory.map((h, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between p-3 text-sm rounded-xl bg-slate-50"
                      >
                        <div>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyle(
                              h.status
                            )}`}
                          >
                            {h.status}
                          </span>
                          {h.note && (
                            <p className="mt-1 text-slate-500">{h.note}</p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {fmtDateTime(h.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {paymentHistory.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-400">
                    Payment History
                  </p>
                  <ul className="space-y-2">
                    {paymentHistory.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between p-3 text-sm rounded-xl bg-slate-50"
                      >
                        <div>
                          <p className="font-medium text-slate-800">
                            {money(p.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {[p.mode, p.reference || p.transactionId]
                              .filter(Boolean)
                              .join(" · ") || "-"}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {fmtDateTime(p.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
