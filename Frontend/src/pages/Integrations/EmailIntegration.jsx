import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Mail, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Server, Star,
  Send, Pencil, RefreshCw, Trash2, Plus, X, Eye, EyeOff, Lock,
} from "lucide-react";
import API from "../../services/api";

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
};
const input = "w-full px-3.5 py-2.5 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50";

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

/* ---------------- Page ---------------- */
export default function EmailIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState(null); // { provider|null, available } after detection
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }
  const [smtpDialog, setSmtpDialog] = useState(null); // { account?, email? }
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
      setBanner({ type: "success", text: `${searchParams.get("email") || "Your email account"} is connected.` });
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
    } finally {
      setBusy(null);
    }
  };

  const redirectToSignIn = async (provider, hint) => {
    const res = await API.get(`/email/oauth/${provider}/url`, { params: hint ? { email: hint } : {} });
    window.location.href = res.data.data.url;
  };
  const connect = (provider, hint) => {
    if (provider === "smtp") return setSmtpDialog({ email: hint || "" });
    return run(provider, () => redirectToSignIn(provider, hint));
  };

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
    if (!window.confirm(`Disconnect ${a.email}? ReadyTech will delete its saved access for this mailbox.`)) return;
    run(`del:${a.id}`, async () => {
      const res = await API.delete(`/email/accounts/${a.id}`);
      toast.success("Email account disconnected");
      const revoke = res.data?.data?.revokeUrl;
      setBanner({ type: "success", text: `${a.email} disconnected.${revoke ? " You can also remove ReadyTech's access from your account settings." : ""}` });
      await load(true);
    });
  };

  const sendTest = (a) =>
    run(`test:${a.id}`, async () => {
      const res = await API.post(`/email/accounts/${a.id}/test`);
      toast.success("Test email sent");
      setBanner({ type: "success", text: `${res.data?.message || "Test email sent"}. Check that inbox to confirm it arrived.` });
      await load(true);
    });

  const makeDefault = (a) =>
    run(`def:${a.id}`, async () => {
      const res = await API.post(`/email/accounts/${a.id}/default`);
      toast.success(res.data?.message || "Default sender updated");
      await load(true);
    });

  const accounts = data?.accounts || [];
  const providers = data?.providers || [];
  const nameOf = (id) => providers.find((p) => p.id === id)?.name || "this provider";
  const full = accounts.length >= MAX_ACCOUNTS;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="p-5 bg-white border shadow-sm sm:p-6 rounded-2xl border-slate-200">
        <div className="flex items-start gap-4">
          <div className="grid w-12 h-12 text-indigo-600 rounded-xl bg-indigo-50 place-items-center shrink-0">
            <Mail size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Mail Integration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Connect your company's mailboxes — Gmail, Outlook / Microsoft 365, Zoho Mail or any custom-domain email over SMTP — so emails to CRM leads and ERP customers are sent from your own address.
            </p>
            <p className="flex items-start gap-1.5 mt-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="mt-px text-emerald-600 shrink-0" />
              Accounts belong to this workspace only. OAuth sign-ins never share your password, and SMTP passwords are encrypted on our servers.
            </p>
          </div>
        </div>
      </div>

      {banner && (
        <div className={`flex items-start gap-2 p-4 text-sm rounded-xl border ${banner.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`} role="status">
          {banner.type === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
          <span className="flex-1 break-words">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {state === "loading" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading mail integration…
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load mail integration status. <button onClick={() => load()} className="font-semibold underline">Retry</button>
        </p>
      )}

      {state === "ready" && (
        <>
          {/* Connected accounts */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">Connected accounts</h2>
                <p className="text-xs text-slate-500">The default sender is used for lead and customer emails.</p>
              </div>
              {accounts.length > 0 && <span className="text-xs text-slate-500">{accounts.length} / {MAX_ACCOUNTS}</span>}
            </div>

            {accounts.length === 0 ? (
              <div className="p-6 text-sm text-center bg-white border border-dashed rounded-2xl border-slate-300 text-slate-500">
                No mailbox connected yet. Emails to leads and customers are sent from the default ReadyTech sender.
              </div>
            ) : (
              <ul className="space-y-3">
                {accounts.map((a) => {
                  const Icon = ICONS[a.provider] || SmtpIcon;
                  const oauthAvailable = providers.find((p) => p.id === a.provider)?.available;
                  return (
                    <li key={a.id} className={`p-4 bg-white border shadow-sm rounded-2xl ${a.status === "error" ? "border-amber-200" : a.isDefault ? "border-indigo-200" : "border-slate-200"}`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex items-start flex-1 min-w-0 gap-3">
                          <div className="grid border w-11 h-11 rounded-xl border-slate-100 bg-slate-50 place-items-center shrink-0"><Icon /></div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold break-all text-slate-900">{a.email}</span>
                              {a.isDefault && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                  <Star size={11} className="fill-current" /> Default
                                </span>
                              )}
                              <StatusPill status={a.status} />
                            </div>
                            <p className="text-xs text-slate-500">
                              {a.providerName}
                              {a.displayName ? ` · sends as "${a.displayName}"` : ""}
                              {a.smtp ? ` · ${a.smtp.host}:${a.smtp.port} (${a.smtp.security === "ssl" ? "SSL" : "STARTTLS"})` : ""}
                            </p>
                            <p className="text-xs text-slate-400">
                              Connected {fmt(a.connectedAt)}
                              {a.lastUsedAt ? ` · last used ${fmt(a.lastUsedAt)}` : ""}
                              {a.lastTestedAt ? ` · tested ${fmt(a.lastTestedAt)}` : ""}
                            </p>
                            {a.status !== "connected" && a.lastError && <p className="text-sm text-amber-700">{a.lastError}</p>}
                          </div>
                        </div>

                        {admin && (
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            {a.status === "error" && a.provider !== "smtp" ? (
                              <button disabled={!!busy || !oauthAvailable} onClick={() => connect(a.provider, a.email)} className={btn.primary}>
                                {busy === a.provider ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Reconnect
                              </button>
                            ) : (
                              <button disabled={!!busy} onClick={() => sendTest(a)} className={btn.ghost}>
                                {busy === `test:${a.id}` ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Test
                              </button>
                            )}
                            {a.provider === "smtp" ? (
                              <button disabled={!!busy} onClick={() => setSmtpDialog({ account: a })} className={a.status === "error" ? btn.primary : btn.ghost}>
                                <Pencil size={15} /> {a.status === "error" ? "Update settings" : "Edit"}
                              </button>
                            ) : (
                              a.status !== "error" && (
                                <button disabled={!!busy || !oauthAvailable} onClick={() => connect(a.provider, a.email)} className={btn.ghost} title="Sign in again to refresh access">
                                  {busy === a.provider ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Reconnect
                                </button>
                              )
                            )}
                            {!a.isDefault && (
                              <button disabled={!!busy} onClick={() => makeDefault(a)} className={btn.ghost}>
                                {busy === `def:${a.id}` ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />} Make default
                              </button>
                            )}
                            <button disabled={!!busy} onClick={() => disconnect(a)} className={btn.danger}>
                              {busy === `del:${a.id}` ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Disconnect
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Add account */}
          {!admin ? (
            <p className="text-sm text-slate-500">Only workspace admins can connect or manage email accounts.</p>
          ) : full ? (
            <p className="text-sm text-slate-500">This workspace has reached {MAX_ACCOUNTS} email accounts. Disconnect one to add another.</p>
          ) : (
            <section className="p-5 space-y-5 bg-white border shadow-sm sm:p-6 rounded-2xl border-slate-200">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Plus size={18} /> Add an email account</h2>
                <p className="text-sm text-slate-500">Enter the address you want to send from and we'll take you to the right sign-in, or pick a provider below.</p>
              </div>

              <form onSubmit={continueWithEmail} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setChoice(null);
                  }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={`${input} flex-1`}
                />
                <button type="submit" disabled={!!busy} className={btn.primary}>
                  {busy === "detect" ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : <>Continue <ArrowRight size={16} /></>}
                </button>
              </form>
              {choice?.provider && !choice.available && (
                <p className="p-3 text-sm rounded-xl bg-slate-50 text-slate-600">
                  {nameOf(choice.provider)} connection isn't available yet — ReadyTech is finishing a one-time setup. You can still connect this mailbox with SMTP below.
                </p>
              )}
              {choice && !choice.provider && <p className="text-sm text-slate-600">We couldn't tell who hosts this mailbox — choose your provider below.</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((p) => {
                  const Icon = ICONS[p.id] || SmtpIcon;
                  const hint = EMAIL_RE.test(email.trim()) ? email.trim() : undefined;
                  return (
                    <div key={p.id} className="flex flex-col gap-3 p-4 border rounded-xl border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center min-w-0 gap-3">
                          <div className="grid w-10 h-10 border rounded-lg border-slate-100 bg-slate-50 place-items-center shrink-0"><Icon size={24} /></div>
                          <h3 className="font-semibold text-slate-900">{p.name}</h3>
                        </div>
                        {!p.available && <StatusPill status="unavailable" />}
                      </div>
                      <p className="flex-1 text-xs text-slate-500">{p.limitations}</p>
                      {p.available ? (
                        <button disabled={!!busy} onClick={() => connect(p.id, hint)} className={`${btn.ghost} self-start`}>
                          {busy === p.id ? <><Loader2 size={15} className="animate-spin" /> Redirecting…</> : CONNECT_LABEL[p.id] || `Connect ${SHORT[p.id] || p.name}`}
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500">ReadyTech is finishing a one-time setup for this provider.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {smtpDialog && (
        <SmtpDialog
          account={smtpDialog.account}
          initialEmail={smtpDialog.email}
          onClose={() => setSmtpDialog(null)}
          onSaved={(message) => {
            setSmtpDialog(null);
            toast.success(message);
            setBanner({ type: "success", text: `${message}. The connection was verified with your mail server.` });
            load(true);
          }}
        />
      )}
    </div>
  );
}
