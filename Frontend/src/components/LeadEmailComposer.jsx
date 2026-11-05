import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { AlertTriangle, AtSign, CheckCircle, Loader2, Mail, Pencil, Send, X } from "lucide-react";
import API from "../services/api";
import { isAdmin } from "../utils/auth";

/* Compose & send an email to a Lead — uses the existing
   POST /api/leads/:id/message (workspace's default connected mailbox,
   default ReadyTech sender otherwise) and GET /api/email/status for the
   sender shown. No credentials ever reach the browser. */

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10000;
const PROVIDER_LABEL = { google: "Gmail", microsoft: "Microsoft 365", zoho: "Zoho Mail", smtp: "SMTP" };

const validate = ({ to, subject, message }) => {
  const e = {};
  if (!to.trim()) e.to = "Recipient email is required";
  else if (!EMAIL_RE.test(to.trim())) e.to = "Enter a single valid email address";
  if (!subject.trim()) e.subject = "Subject is required";
  else if (subject.length > MAX_SUBJECT) e.subject = `Keep the subject under ${MAX_SUBJECT} characters`;
  if (!message.trim()) e.message = "Message is required";
  else if (message.length > MAX_MESSAGE) e.message = `Keep the message under ${MAX_MESSAGE.toLocaleString()} characters`;
  return e;
};

export default function LeadEmailComposer({ lead, onClose, onSent, onEditLead }) {
  const [form, setForm] = useState({ to: lead?.email || "", subject: "", message: "" });
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sender, setSender] = useState({ state: "loading" }); // loading | ready | unknown
  const admin = isAdmin();
  const subjectRef = useRef(null);
  const toRef = useRef(null);

  const errors = validate(form);
  const showErr = (k) => touched && errors[k];
  const hasLeadEmail = EMAIL_RE.test(String(lead?.email || "").trim());

  /* Sender = the workspace's default connected mailbox (no secrets in this response) */
  useEffect(() => {
    let alive = true;
    API.get("/email/status")
      .then((res) => alive && setSender({ state: "ready", account: res.data?.data?.connection || null }))
      .catch(() => alive && setSender({ state: "unknown" }));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    (hasLeadEmail ? subjectRef : toRef).current?.focus();
  }, [hasLeadEmail]);

  const close = () => {
    if (!sending) onClose();
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (error) setError("");
  };

  const send = async (e) => {
    e?.preventDefault();
    if (sending) return;
    setTouched(true);
    if (Object.keys(errors).length) return;

    setSending(true);
    setError("");
    try {
      const { data } = await API.post(`/leads/${lead._id}/message`, {
        channel: "email",
        to: form.to.trim(),
        subject: form.subject.trim(),
        message: form.message,
      });
      const from = data?.data?.from;
      toast.success(`Email sent to ${data?.data?.to || form.to.trim()}${from ? ` from ${from}` : ""}`);
      onSent?.();
      onClose();
    } catch (err) {
      const text = err?.response?.data?.message || (err?.request ? "Network error — check your connection and try again." : "Failed to send email");
      setError(text);
      toast.error(text);
    } finally {
      setSending(false);
    }
  };

  const account = sender.account;
  const mailboxBroken = account && account.status !== "connected";
  const input = (bad) =>
    `w-full px-4 py-3 text-sm bg-white border outline-none rounded-xl transition focus:ring-2 disabled:bg-slate-50 ${
      bad ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-indigo-500"
    }`;

  /* Sender panel: connected mailbox | broken mailbox | none (default sender) */
  const senderPanel = () => {
    if (sender.state === "loading") {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Checking your mailbox…
        </div>
      );
    }
    if (sender.state === "unknown") {
      return <p className="text-sm text-slate-500">Sent from your workspace's default mailbox.</p>;
    }
    if (!account) {
      return (
        <div className="flex flex-col gap-2 p-3 text-sm border sm:flex-row sm:items-center sm:justify-between rounded-xl bg-amber-50 border-amber-200 text-amber-800">
          <span className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            No mailbox connected — this email will go from the default ReadyTech sender.
          </span>
          {admin ? (
            <Link to="/integrations/email" onClick={close} className="shrink-0 font-semibold text-indigo-600 hover:underline">
              Connect mailbox →
            </Link>
          ) : (
            <span className="text-xs shrink-0">Ask your admin to connect one.</span>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="grid w-9 h-9 rounded-xl place-items-center bg-indigo-50 shrink-0">
            <Mail size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-slate-800">
              {account.displayName ? `${account.displayName} <${account.email}>` : account.email}
            </p>
            <p className="text-xs text-slate-500">
              {PROVIDER_LABEL[account.provider] || account.providerName}
              {!mailboxBroken && (
                <span className="inline-flex items-center gap-1 ml-2 text-emerald-600">
                  <CheckCircle size={12} /> Connected
                </span>
              )}
            </p>
          </div>
        </div>
        {mailboxBroken && (
          <div className="flex flex-col gap-2 p-3 text-sm border sm:flex-row sm:items-center sm:justify-between rounded-xl bg-red-50 border-red-200 text-red-700">
            <span className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {account.lastError || "This mailbox needs to be reconnected before it can send."}
            </span>
            {admin ? (
              <Link to="/integrations/email" onClick={close} className="shrink-0 font-semibold text-indigo-600 hover:underline">
                Reconnect →
              </Link>
            ) : (
              <span className="text-xs shrink-0">Ask your admin to reconnect it.</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={close}>
      <motion.form
        onSubmit={send}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send(e)}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-email-title"
        className="flex flex-col w-full max-w-2xl max-h-[92vh] overflow-hidden bg-white shadow-2xl rounded-3xl"
        noValidate
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 text-white bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-center min-w-0 gap-3">
            <div className="grid w-10 h-10 rounded-2xl place-items-center bg-white/15 shrink-0">
              <Send size={18} />
            </div>
            <div className="min-w-0">
              <h3 id="lead-email-title" className="text-lg font-semibold">Send Email</h3>
              <p className="text-sm truncate text-white/80">
                {lead?.name || "Lead"}{lead?.company ? ` · ${lead.company}` : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} disabled={sending} aria-label="Close" className="p-2 rounded-xl hover:bg-white/15 disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide uppercase text-slate-400">From</p>
            {senderPanel()}
          </div>

          <div>
            <label htmlFor="lead-email-to" className="block mb-1.5 text-sm font-medium text-slate-700">To</label>
            <div className="relative">
              <AtSign size={16} className="absolute -translate-y-1/2 left-3.5 top-1/2 text-slate-400" />
              <input
                id="lead-email-to"
                ref={toRef}
                type="email"
                value={form.to}
                onChange={set("to")}
                disabled={sending}
                placeholder="name@company.com"
                autoComplete="off"
                className={`${input(showErr("to"))} pl-10`}
              />
            </div>
            {showErr("to") && <p className="mt-1 text-xs text-red-600">{errors.to}</p>}
            {!hasLeadEmail && (
              <p className="flex flex-wrap items-center gap-1 mt-1.5 text-xs text-amber-700">
                This lead has no valid email address saved.
                {onEditLead && (
                  <button type="button" onClick={() => { if (!sending) onEditLead(); }} className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline">
                    <Pencil size={11} /> Add it to the lead
                  </button>
                )}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="lead-email-subject" className="block mb-1.5 text-sm font-medium text-slate-700">Subject</label>
            <input
              id="lead-email-subject"
              ref={subjectRef}
              value={form.subject}
              onChange={set("subject")}
              disabled={sending}
              maxLength={MAX_SUBJECT + 50}
              placeholder="What's this email about?"
              className={input(showErr("subject"))}
            />
            {showErr("subject") && <p className="mt-1 text-xs text-red-600">{errors.subject}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="lead-email-message" className="text-sm font-medium text-slate-700">Message</label>
              <span className={`text-xs ${form.message.length > MAX_MESSAGE ? "text-red-600" : "text-slate-400"}`}>
                {form.message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}
              </span>
            </div>
            <textarea
              id="lead-email-message"
              rows={9}
              value={form.message}
              onChange={set("message")}
              disabled={sending}
              placeholder={`Hi ${lead?.name?.split(" ")[0] || "there"},\n\n`}
              className={`${input(showErr("message"))} resize-y min-h-[160px] leading-6`}
            />
            {showErr("message") && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-3 px-6 py-4 border-t sm:flex-row sm:items-center sm:justify-between bg-slate-50">
          <p className="hidden text-xs sm:block text-slate-400">Plain text · logged to lead activity · Ctrl+Enter to send</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={close}
              disabled={sending}
              className="flex-1 px-5 py-2.5 text-sm font-medium bg-white border sm:flex-none rounded-xl hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || (touched && Object.keys(errors).length > 0)}
              className="flex items-center justify-center flex-1 gap-2 px-6 py-2.5 text-sm font-semibold text-white shadow-lg sm:flex-none rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Sending…" : "Send Email"}
            </button>
          </div>
        </div>
      </motion.form>
    </div>,
    document.body
  );
}
