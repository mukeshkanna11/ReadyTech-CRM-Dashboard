import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  Mail, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Server, Star,
  Send, Pencil, RefreshCw, Trash2, Plus, X, Eye, EyeOff, Lock, Settings, Unplug, Info,
} from "lucide-react";
import API from "../../services/api";
import MailWorkspace from "./mail/MailWorkspace";

/* =========================================================
   MAIL INTEGRATION — this workspace's own mailboxes: Gmail,
   Microsoft 365, Zoho Mail (OAuth) and any custom-domain
   mailbox over SMTP. Several accounts, one default sender.
   Credentials are verified and encrypted on the server only.
========================================================= */
const isAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ACCOUNTS = 10;

const GmailIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75V40h7a3 3 0 003-3V16.2z" />
    <path fill="#1e88e5" d="M3 16.2l3.61 1.71L13 23.7V40H6a3 3 0 01-3-3V16.2z" />
    <path fill="#e53935" d="M35 11.2L24 19.45 13 11.2 12 17l1 6.7 11 8.25 11-8.25 1-6.7z" />
    <path fill="#c62828" d="M3 12.3v3.9l10 7.5V11.2L9.88 8.86A4.3 4.3 0 003 12.3z" />
    <path fill="#fbc02d" d="M45 12.3v3.9l-10 7.5V11.2l3.12-2.34A4.3 4.3 0 0145 12.3z" />
  </svg>
);

const OutlookIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#1a5dab" d="M44 11H24v26h20a2 2 0 002-2V13a2 2 0 00-2-2z" />
    <path fill="#fff" d="M28 17h14v3H28zm0 6h14v3H28zm0 6h10v3H28z" opacity=".85" />
    <path fill="#0a74d6" d="M28 6L4 10v28l24 4z" />
    <ellipse cx="16" cy="24" fill="#fff" rx="6" ry="7.5" />
    <ellipse cx="16" cy="24" fill="#0a74d6" rx="3.4" ry="4.8" />
  </svg>
);

const ZohoIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="4" y="10" width="40" height="28" rx="5" fill="#e42527" />
    <path fill="#fff" d="M4 15l20 13 20-13v-2a3 3 0 00-3-3H7a3 3 0 00-3 3z" opacity=".9" />
    <path fill="#e42527" d="M17 17h14v2.4L21.6 27H31v2.6H17v-2.4L26.4 19.6H17z" />
  </svg>
);

const SmtpIcon = ({ size = 28 }) => (
  <div className="grid text-indigo-600 place-items-center" style={{ width: size, height: size }}>
    <Server size={Math.round(size * 0.8)} />
  </div>
);

const ICONS = { google: GmailIcon, microsoft: OutlookIcon, zoho: ZohoIcon, smtp: SmtpIcon };
const CONNECT_LABEL = {
  google: "Continue with Google",
  microsoft: "Continue with Microsoft",
  zoho: "Continue with Zoho",
  smtp: "Set up SMTP",
};
const SHORT = { google: "Gmail", microsoft: "Outlook / 365", zoho: "Zoho Mail", smtp: "SMTP" };

/* Common custom-domain hosts (port/security are standard for each) */
const PRESETS = [
  { id: "hostinger", label: "Hostinger", host: () => "smtp.hostinger.com", security: "ssl", port: 465 },
  { id: "cpanel", label: "cPanel", host: (d) => (d ? `mail.${d}` : ""), security: "ssl", port: 465 },
  { id: "godaddy", label: "GoDaddy", host: () => "smtpout.secureserver.net", security: "ssl", port: 465 },
  { id: "other", label: "Other", host: () => "", security: "starttls", port: 587 },
];
const PORTS = { ssl: [465], starttls: [587, 25, 2525] };

const fmt = (d) => (d ? new Date(d).toLocaleString() : null);

const StatusPill = ({ status }) => {
  const map = {
    connected: ["bg-emerald-50 text-emerald-700 ring-emerald-200", "Connected"],
    error: ["bg-amber-50 text-amber-700 ring-amber-200", "Action required"],
    unavailable: ["bg-slate-50 text-slate-500 ring-slate-200", "Not available yet"],
  };
  const [cls, label] = map[status] || map.unavailable;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 whitespace-nowrap ${cls}`}>{label}</span>;
};

const btn = {
  primary: "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-white border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50",
  primarySm: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50",
  ghostSm: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50",
  dangerSm: "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50",
};
const input = "w-full px-3.5 py-2.5 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50";

/* ---------------- Inbox sync (Gmail replies) status ---------------- */
const ago = (d) => {
  if (!d) return null;
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(d).toLocaleDateString();
};
function InboxSyncStatus({ cap, account, admin, busy, onEnable }) {
  const st = cap?.sync;
  if (cap?.inbox && st) {
    if (st.status === "syncing") return <span className="inline-flex items-center gap-1 font-medium text-indigo-600"><Loader2 size={11} className="animate-spin" /> Syncing…</span>;
    if (st.status === "error") return <span className="font-medium text-amber-700" title={st.lastError || ""}>Retrying{st.lastSuccessAt ? ` · last ${ago(st.lastSuccessAt)}` : ""}</span>;
    if (st.status === "needs_permission") return <span className="font-medium text-amber-700" title={st.lastError || ""}>Read access removed</span>;
    return <span className="font-medium text-emerald-700" title="Replies to emails sent from ReadyTech">Replies · {st.lastSuccessAt ? `synced ${ago(st.lastSuccessAt)}` : "first sync pending"}</span>;
  }
  if (st?.canEnable && account.status === "connected") {
    return admin ? (
      <button type="button" onClick={onEnable} disabled={!!busy} title="Adds read-only Gmail access so replies appear here. Only replies to emails sent from ReadyTech are imported."
        className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
        {busy === `inbox:${account.id}` ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Enable inbox sync
      </button>
    ) : <span className="text-slate-600">Off</span>;
  }
  return <span className="text-slate-600" title={cap?.inboxReason || ""}>Not available yet</span>;
}

/* ---------------- Disconnect confirmation ----------------
   Custom modal (no native confirm). Stays open while the request runs and
   only reports success once the backend has removed the account. */
function DisconnectDialog({ account, isLast, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const Icon = ICONS[account.provider] || SmtpIcon;

  const cancel = useCallback(() => !busy && onCancel(), [busy, onCancel]);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  const consequences = [
    "ReadyTech deletes the saved sign-in access for this mailbox right away.",
    isLast
      ? "Compose, send, reply and forward are disabled until you connect a mailbox again."
      : account.isDefault
      ? "Another connected account becomes the default sender."
      : "Your default sender stays the same.",
    "Sent emails, drafts and record links stay in ReadyTech.",
  ];

  return createPortal(
    <Motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && cancel()}
    >
      <Motion.div
        role="alertdialog" aria-modal="true" aria-labelledby="disconnect-title" aria-describedby="disconnect-desc"
        initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        className="relative w-full overflow-hidden bg-white shadow-2xl sm:max-w-md rounded-t-3xl sm:rounded-3xl ring-1 ring-slate-900/5"
      >
        {/* Accent header */}
        <div className="relative px-6 pt-7 pb-5 text-center bg-gradient-to-b from-red-50 via-white to-white">
          <button type="button" onClick={cancel} disabled={busy} aria-label="Close"
            className="absolute p-1.5 rounded-lg top-3 right-3 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
            <X size={18} />
          </button>
          <div className="relative w-16 h-16 mx-auto">
            <div className="grid w-16 h-16 bg-white border shadow-sm rounded-2xl border-slate-200 place-items-center"><Icon size={34} /></div>
            <span className="absolute grid text-white bg-red-500 rounded-full shadow -right-1.5 -bottom-1.5 w-7 h-7 place-items-center ring-4 ring-white"><Unplug size={14} /></span>
          </div>
          <h2 id="disconnect-title" className="mt-4 text-lg font-bold text-slate-900">Disconnect this email account?</h2>
          <div className="inline-flex items-center max-w-full gap-2 px-3 py-1 mt-2 text-sm rounded-full bg-slate-100 text-slate-700">
            <span className="font-semibold truncate">{account.email}</span>
            <span className="text-xs text-slate-500 shrink-0">· {account.providerName}</span>
          </div>
        </div>

        <div className="px-6 pb-2">
          <ul id="disconnect-desc" className="space-y-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            {consequences.map((c, i) => (
              <li key={c} className="flex gap-2.5 text-sm text-slate-600">
                {i === 1 && isLast ? <AlertTriangle size={16} className="mt-0.5 text-amber-500 shrink-0" /> : <Info size={16} className="mt-0.5 text-slate-400 shrink-0" />}
                <span>{c}</span>
              </li>
            ))}
          </ul>
          {error && (
            <p className="flex items-start gap-2 p-3 mt-3 text-sm text-red-700 border border-red-100 rounded-xl bg-red-50" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 px-6 pt-4 pb-6 sm:flex-row">
          <button type="button" onClick={cancel} disabled={busy} autoFocus
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-white border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
            Keep Connected
          </button>
          <button type="button" onClick={confirm} disabled={busy} aria-busy={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl bg-red-600 shadow-sm shadow-red-600/20 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-wait">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Disconnecting…</> : <><Unplug size={16} /> Disconnect Account</>}
          </button>
        </div>
      </Motion.div>
    </Motion.div>,
    document.body
  );
}

/* ---------------- SMTP setup / update dialog ---------------- */
function SmtpDialog({ account, initialEmail, onClose, onSaved }) {
  const editing = !!account;
  const domain = (initialEmail || account?.email || "").split("@")[1] || "";
  const [form, setForm] = useState(() =>
    editing
      ? { email: account.email, displayName: account.displayName || "", host: account.smtp?.host || "", security: account.smtp?.security || "ssl",
          port: account.smtp?.port || 465, username: account.smtp?.username || account.email, password: "" }
      : { email: initialEmail || "", displayName: "", host: "", security: "ssl", port: 465, username: "", password: "" }
  );
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const preset = (p) => setForm((f) => ({ ...f, host: p.host((f.email.split("@")[1] || domain).toLowerCase()), security: p.security, port: p.port }));
  const setSecurity = (security) => setForm((f) => ({ ...f, security, port: PORTS[security][0] }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(form.email.trim())) return setError("Enter a valid email address.");
    if (!form.host.trim()) return setError("Enter the SMTP host from your email provider.");
    if (!editing && !form.password) return setError("Enter the mailbox password.");
    setSaving(true);
    try {
      const body = { ...form, port: Number(form.port), username: form.username.trim() || form.email.trim() };
      const res = editing ? await API.put(`/email/accounts/${account.id}/smtp`, body) : await API.post("/email/smtp", body);
      onSaved(res.data?.message || "Email account connected");
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't verify these SMTP settings. Please check them and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form onSubmit={submit} className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white shadow-xl rounded-t-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="smtp-title">
        <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="grid w-10 h-10 rounded-xl bg-indigo-50 place-items-center"><SmtpIcon size={24} /></div>
            <div>
              <h2 id="smtp-title" className="font-semibold text-slate-900">{editing ? "Update SMTP account" : "Custom domain email (SMTP)"}</h2>
              <p className="text-xs text-slate-500">We test the login before saving anything.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!editing && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Quick setup</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" onClick={() => preset(p)} className="px-3 py-1.5 text-xs font-semibold border rounded-full border-slate-300 text-slate-700 hover:bg-slate-50">{p.label}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Email address</span>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="sales@yourcompany.com" autoComplete="off" className={input} required />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Sender name <span className="font-normal text-slate-400">(optional)</span></span>
              <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Your Company Sales" maxLength={100} className={input} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">SMTP host</span>
              <input value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.hostinger.com" autoComplete="off" spellCheck={false} className={input} required />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Encryption</span>
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100">
                {[["ssl", "SSL"], ["starttls", "STARTTLS"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setSecurity(v)} className={`py-1.5 text-sm font-semibold rounded-lg ${form.security === v ? "bg-white shadow-sm text-indigo-700" : "text-slate-600"}`}>{l}</button>
                ))}
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Port</span>
              <select value={form.port} onChange={(e) => set("port", Number(e.target.value))} className={input}>
                {PORTS[form.security].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Username <span className="font-normal text-slate-400">(usually your email)</span></span>
              <input value={form.username} onChange={(e) => set("username", e.target.value)} placeholder={form.email || "sales@yourcompany.com"} autoComplete="off" className={input} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Password</span>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password"
                  placeholder={editing ? "Leave blank to keep the saved password" : "Mailbox or app password"} className={`${input} pr-10`} required={!editing} />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute p-1 -translate-y-1/2 right-2 top-1/2 text-slate-500" aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <Lock size={13} className="mt-0.5 shrink-0 text-emerald-600" />
            Your password is encrypted on ReadyTech's servers, is only used to send email from this workspace and is never shown again.
          </p>
          {error && (
            <p className="flex items-start gap-2 p-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 px-5 py-4 bg-white border-t sm:flex-row sm:justify-end border-slate-100">
          <button type="button" onClick={onClose} disabled={saving} className={btn.ghost}>Cancel</button>
          <button type="submit" disabled={saving} className={btn.primary}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Verifying connection…</> : editing ? "Verify & update" : "Verify & connect"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Page: mail workspace with Email Settings always visible ---------------- */
export default function EmailIntegration() {
  return <MailWorkspace renderSettings={(props) => <MailSettings {...props} />} />;
}

/* ---------------- Email Settings (connected accounts) ---------------- */
function MailSettings({ onChanged, capabilities = [] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState(null); // { provider|null, available } after detection
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }
  const [smtpDialog, setSmtpDialog] = useState(null); // { account?, email? }
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(null); // account pending confirmation
  const admin = isAdmin();

  const load = useCallback((quiet) => {
    if (!quiet) setState("loading");
    return API.get("/email/status")
      .then((res) => {
        setData(res.data?.data);
        setState("ready");
      })
      .catch(() => !quiet && setState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Result of the OAuth redirect */
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (!connected) return;
    if (connected === "1") {
      toast.success("Email account connected");
      const inbox = searchParams.get("inbox");
      const who = searchParams.get("email") || "Your email account";
      setBanner(inbox === "0"
        ? { type: "error", text: `${who} is connected for sending, but inbox sync wasn't enabled because read access wasn't granted. Click "Enable inbox sync" and allow ReadyTech to read email to try again.` }
        : { type: "success", text: inbox === "1" ? `Inbox sync is on for ${who}. Replies to emails sent from ReadyTech will appear shortly.` : `${who} is connected.` });
    } else {
      setBanner({ type: "error", text: searchParams.get("message") || "We couldn't connect your email account. Please try again." });
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setBanner(null);
    try {
      await fn();
    } catch (err) {
      setBanner({ type: "error", text: err.response?.data?.message || "Something went wrong. Please try again." });
      load(true);
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  const redirectToSignIn = async (provider, hint, inbox) => {
    const res = await API.get(`/email/oauth/${provider}/url`, { params: { ...(hint && { email: hint }), ...(inbox && { inbox: "1" }) } });
    window.location.href = res.data.data.url;
  };
  const connect = (provider, hint) => {
    if (provider === "smtp") return setSmtpDialog({ email: hint || "" });
    return run(provider, () => redirectToSignIn(provider, hint));
  };
  /* Gmail: incremental consent that adds read access (replies only) */
  const enableInbox = (a) => run(`inbox:${a.id}`, () => redirectToSignIn("google", a.email, true));

  /* Email first → straight to the right provider when we can tell */
  const continueWithEmail = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setBanner({ type: "error", text: "Please enter a valid email address." });
    run("detect", async () => {
      const res = await API.get("/email/detect", { params: { email: value } });
      const { provider, available } = res.data?.data || {};
      if (provider === "smtp") return setSmtpDialog({ email: value });
      if (provider && available) return redirectToSignIn(provider, value);
      setChoice({ provider, available });
    });
  };

  const disconnect = (a) => {
    if (busy) return;
    setConfirmDisconnect(a);
  };

  /* Runs from the confirmation modal. Connection state changes only after the
     backend confirms; errors keep the modal open (and are thrown back to it). */
  const performDisconnect = async () => {
    const a = confirmDisconnect;
    if (!a || busy) return;
    setBusy(`del:${a.id}`);
    try {
      const res = await API.delete(`/email/accounts/${a.id}`, { silent: true });
      const revoke = res.data?.data?.revokeUrl;
      toast.success(`${a.email} disconnected`);
      setBanner({ type: "success", text: `${a.email} disconnected.${revoke ? " You can also remove ReadyTech's access from your account settings." : ""}` });
      setConfirmDisconnect(null);
      // Lock email actions now; they return only once the backend confirms a connection
      onChanged?.({ disconnected: a.id });
      await load(true);
    } catch (err) {
      const message = err.response?.data?.message || (err.response ? "We couldn't disconnect this account. Please try again." : "Can't reach the server. Check your connection and try again.");
      toast.error(message);
      load(true);
      throw new Error(message);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = (a) =>
    run(`test:${a.id}`, async () => {
      const res = await API.post(`/email/accounts/${a.id}/test`);
      toast.success("Test email sent");
      setBanner({ type: "success", text: `${res.data?.message || "Test email sent"}. Check that inbox to confirm it arrived.` });
      await load(true);
      onChanged?.();
    });

  const makeDefault = (a) =>
    run(`def:${a.id}`, async () => {
      const res = await API.post(`/email/accounts/${a.id}/default`);
      toast.success(res.data?.message || "Default sender updated");
      await load(true);
      onChanged?.();
    });

  const accounts = data?.accounts || [];
  const providers = data?.providers || [];
  const nameOf = (id) => providers.find((p) => p.id === id)?.name || "this provider";
  const full = accounts.length >= MAX_ACCOUNTS;
  const showAdd = admin && !full && (accounts.length === 0 || addOpen);
  const capOf = (id) => capabilities.find((c) => c.accountId === id);

  return (
    <section className="bg-white border shadow-sm rounded-2xl border-slate-200" aria-labelledby="mail-settings-title">
      {/* Panel header */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="grid text-indigo-600 w-9 h-9 rounded-xl bg-indigo-50 place-items-center shrink-0"><Settings size={18} /></div>
        <div className="flex-1 min-w-0">
          <h2 id="mail-settings-title" className="font-semibold text-slate-900">Email Settings</h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
            Mailboxes belong to this workspace only. Credentials are encrypted on our servers and never shown in the browser.
          </p>
        </div>
        {accounts.length > 0 && <span className="text-xs font-medium text-slate-400">{accounts.length} / {MAX_ACCOUNTS} accounts</span>}
        {admin && !full && accounts.length > 0 && (
          <button onClick={() => setAddOpen((o) => !o)} className={btn.ghost} aria-expanded={addOpen}>
            {addOpen ? <X size={15} /> : <Plus size={15} />} {addOpen ? "Close" : "Add account"}
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {banner && (
          <div className={`flex items-start gap-2 p-3 text-sm rounded-xl border ${banner.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`} role="status">
            {banner.type === "success" ? <CheckCircle2 size={17} className="shrink-0" /> : <AlertTriangle size={17} className="shrink-0" />}
            <span className="flex-1 break-words">{banner.text}</span>
            <button onClick={() => setBanner(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
          </div>
        )}

        {state === "loading" && (
          <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        )}
        {state === "error" && (
          <p className="text-sm text-red-600">
            Couldn't load your email accounts. <button onClick={() => load()} className="font-semibold underline">Retry</button>
          </p>
        )}

        {state === "ready" && accounts.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {accounts.map((a) => {
              const Icon = ICONS[a.provider] || SmtpIcon;
              const oauthAvailable = providers.find((p) => p.id === a.provider)?.available;
              const cap = capOf(a.id);
              return (
                <li key={a.id} className={`flex flex-col gap-3 p-4 border rounded-xl ${a.status === "error" ? "border-amber-200 bg-amber-50/40" : a.isDefault ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    <div className="grid w-10 h-10 bg-white border rounded-xl border-slate-100 place-items-center shrink-0"><Icon size={24} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold break-all text-slate-900">{a.email}</span>
                        {a.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            <Star size={10} className="fill-current" /> Default sender
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.providerName}
                        {a.displayName ? ` · sends as "${a.displayName}"` : ""}
                        {a.smtp ? ` · ${a.smtp.host}:${a.smtp.port} (${a.smtp.security === "ssl" ? "SSL" : "STARTTLS"})` : ""}
                      </p>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  <dl className="grid grid-cols-2 text-xs gap-x-4 gap-y-1">
                    <dt className="text-slate-400">Sending</dt>
                    <dd className={a.status === "connected" ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>{a.status === "connected" ? "Enabled" : "Paused — reconnect"}</dd>
                    <dt className="text-slate-400">Inbox sync</dt>
                    <dd className="min-w-0"><InboxSyncStatus cap={cap} account={a} admin={admin} busy={busy} onEnable={() => enableInbox(a)} /></dd>
                    <dt className="text-slate-400">Attachments</dt>
                    <dd className="text-slate-600">{cap?.attachments === false ? "Not supported yet" : "Supported"}</dd>
                    <dt className="text-slate-400">Last used</dt>
                    <dd className="text-slate-600">{fmt(a.lastUsedAt) || "Never"}</dd>
                  </dl>
                  {a.status !== "connected" && a.lastError && <p className="text-xs text-amber-800">{a.lastError}</p>}

                  {admin && (
                    <div className="flex flex-wrap gap-2 pt-3 mt-auto border-t border-slate-100">
                      {a.status === "error" && a.provider !== "smtp" ? (
                        <button disabled={!!busy || !oauthAvailable} onClick={() => connect(a.provider, a.email)} className={btn.primarySm}>
                          {busy === a.provider ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reconnect
                        </button>
                      ) : a.status === "connected" && (
                        <button disabled={!!busy} onClick={() => sendTest(a)} className={btn.ghostSm}>
                          {busy === `test:${a.id}` ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Test
                        </button>
                      )}
                      {a.provider === "smtp" && (
                        <button disabled={!!busy} onClick={() => setSmtpDialog({ account: a })} className={a.status === "error" ? btn.primarySm : btn.ghostSm}>
                          <Pencil size={14} /> {a.status === "error" ? "Update settings" : "Edit"}
                        </button>
                      )}
                      {!a.isDefault && (
                        <button disabled={!!busy} onClick={() => makeDefault(a)} className={btn.ghostSm}>
                          {busy === `def:${a.id}` ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Make default
                        </button>
                      )}
                      <button disabled={!!busy} onClick={() => disconnect(a)} className={`${btn.dangerSm} ml-auto`}>
                        {busy === `del:${a.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Disconnect
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {state === "ready" && !admin && accounts.length === 0 && (
          <p className="p-4 text-sm text-center border border-dashed rounded-xl border-slate-300 text-slate-500">No email account is connected. Ask a workspace admin to connect one.</p>
        )}
        {state === "ready" && !admin && accounts.length > 0 && <p className="text-xs text-slate-400">Only workspace admins can connect or manage email accounts.</p>}
        {state === "ready" && admin && full && <p className="text-xs text-slate-500">This workspace has reached {MAX_ACCOUNTS} email accounts. Disconnect one to add another.</p>}

        {/* Add / connect */}
        {state === "ready" && showAdd && (
          <div id="mail-add-account" className="p-4 space-y-4 border rounded-xl border-slate-200 bg-slate-50/50">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Plus size={16} /> {accounts.length ? "Add another email account" : "Connect your email account"}</h3>
              <p className="text-xs text-slate-500">Enter the address you send from and we'll take you to the right sign-in, or pick a provider.</p>
            </div>

            <form onSubmit={continueWithEmail} className="flex flex-col gap-2 sm:flex-row">
              <input id="mail-add-account-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setChoice(null); }}
                placeholder="you@company.com" autoComplete="email" className={`${input} flex-1 bg-white`} />
              <button type="submit" disabled={!!busy} className={btn.primary}>
                {busy === "detect" ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : <>Continue <ArrowRight size={16} /></>}
              </button>
            </form>
            {choice?.provider && !choice.available && (
              <p className="p-3 text-xs bg-white rounded-lg text-slate-600">
                {nameOf(choice.provider)} connection isn't available yet — ReadyTech is finishing a one-time setup. You can still connect this mailbox with SMTP below.
              </p>
            )}
            {choice && !choice.provider && <p className="text-xs text-slate-600">We couldn't tell who hosts this mailbox — choose your provider below.</p>}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {providers.map((p) => {
                const Icon = ICONS[p.id] || SmtpIcon;
                const hint = EMAIL_RE.test(email.trim()) ? email.trim() : undefined;
                return (
                  <div key={p.id} className={`flex flex-col gap-2 p-3 bg-white border rounded-xl border-slate-200 ${p.available ? "" : "opacity-75"}`}>
                    <div className="flex items-center gap-2">
                      <div className="grid w-8 h-8 border rounded-lg border-slate-100 bg-slate-50 place-items-center shrink-0"><Icon size={20} /></div>
                      <h4 className="flex-1 min-w-0 text-sm font-semibold truncate text-slate-900">{SHORT[p.id] || p.name}</h4>
                    </div>
                    <p className="flex-1 text-[11px] leading-snug text-slate-500">{p.limitations}</p>
                    {p.available ? (
                      <button disabled={!!busy} onClick={() => connect(p.id, hint)} className={`${btn.ghostSm} justify-center`}>
                        {busy === p.id ? <><Loader2 size={14} className="animate-spin" /> Redirecting…</> : CONNECT_LABEL[p.id] || `Connect ${SHORT[p.id] || p.name}`}
                      </button>
                    ) : (
                      <span className="inline-flex justify-center px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-500">Not available yet</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {confirmDisconnect && (
          <DisconnectDialog
            key={confirmDisconnect.id}
            account={confirmDisconnect}
            isLast={accounts.filter((x) => x.id !== confirmDisconnect.id && x.status === "connected").length === 0}
            onCancel={() => setConfirmDisconnect(null)}
            onConfirm={performDisconnect}
          />
        )}
      </AnimatePresence>

      {smtpDialog && (
        <SmtpDialog
          account={smtpDialog.account}
          initialEmail={smtpDialog.email}
          onClose={() => setSmtpDialog(null)}
          onSaved={(message) => {
            setSmtpDialog(null);
            setAddOpen(false);
            toast.success(message);
            setBanner({ type: "success", text: `${message}. The connection was verified with your mail server.` });
            load(true);
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
