import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Loader2, Mail, X } from "lucide-react";
import API from "../services/api";

/* Email one ERP customer (Client) — sent from the workspace's mailbox
   connected in Integrations → Email Integration, or the default
   ReadyTech sender. Same flow as Leads → Email. */
export default function EmailCustomerButton({ customer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await API.post(`/email/customers/${customer._id}`, form);
      const d = res.data?.data;
      setResult({ ok: true, text: `${res.data?.message}${d?.from ? ` from ${d.from}` : ""}` });
      setForm({ subject: "", message: "" });
    } catch (err) {
      setResult({ ok: false, text: err.response?.data?.message || "Failed to send email" });
    } finally {
      setSending(false);
    }
  };

  const input = "w-full px-3 py-2 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <>
      <button
        type="button"
        disabled={!customer.email}
        title={customer.email ? "Send email" : "No email address"}
        onClick={() => { setOpen(true); setResult(null); }}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
      >
        <Mail size={15} /> Send Email
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg p-5 space-y-3 bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Email {customer.contactPerson || customer.companyName || customer.email}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500">
              To: {customer.email} · Sent from your mailbox in{" "}
              <Link to="/integrations/email" className="font-semibold text-indigo-600">Email Integration</Link>, or the default ReadyTech sender.
            </p>
            <input required maxLength={200} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={input} />
            <textarea required rows={6} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={input} />
            {result && <p className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.text}</p>}
            <button disabled={sending} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-indigo-600 disabled:opacity-50">
              {sending && <Loader2 size={14} className="animate-spin" />} {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}
