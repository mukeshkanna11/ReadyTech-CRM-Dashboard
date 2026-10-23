import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mail, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import API from "../../services/api";

/* =========================================================
   EMAIL INTEGRATION — this workspace's own Gmail / Microsoft 365
   mailbox (OAuth). Used for CRM email sending (Leads → Email).
========================================================= */
const isAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.role === "admin";
  } catch {
    return false;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const ICONS = { google: GmailIcon, microsoft: OutlookIcon };
const SIGN_IN = { google: "Continue with Google", microsoft: "Continue with Microsoft" };

const StatusPill = ({ status }) => {
  const map = {
    connected: ["bg-emerald-50 text-emerald-700 ring-emerald-200", "Connected"],
    error: ["bg-amber-50 text-amber-700 ring-amber-200", "Reconnect required"],
    none: ["bg-slate-50 text-slate-600 ring-slate-200", "Not connected"],
    unavailable: ["bg-slate-50 text-slate-500 ring-slate-200", "Not available yet"],
  };
  const [cls, label] = map[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{label}</span>;
};

export default function EmailIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState(null); // { provider|null, available } after detection
  const [banner, setBanner] = useState(null); // { type: "success"|"error", text }
  const admin = isAdmin();

  const load = useCallback(() => {
    setState("loading");
    API.get("/email/status")
      .then((res) => {
        setData(res.data?.data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);

  /* Result of the OAuth redirect */
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (!connected) return;
    if (connected === "1") {
      const text = `${searchParams.get("email") || "Your email account"} is connected. CRM emails will now be sent from it.`;
      toast.success("Email account connected");
      setBanner({ type: "success", text });
    } else {
      setBanner({ type: "error", text: searchParams.get("message") || "We couldn't connect your email account. Please try again." });
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch {
      /* interceptor shows the error toast */
    } finally {
      setBusy(null);
    }
  };

  const redirectToSignIn = async (provider, hint) => {
    const res = await API.get(`/email/oauth/${provider}/url`, { params: hint ? { email: hint } : {} });
    window.location.href = res.data.data.url;
  };
  const connect = (provider, hint) => run(provider, () => redirectToSignIn(provider, hint));

  /* Email first → straight to the right provider's sign-in when we can tell */
  const continueWithEmail = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setBanner({ type: "error", text: "Please enter a valid email address." });
    setBanner(null);
    run("detect", async () => {
      const res = await API.get("/email/detect", { params: { email: value } });
      const { provider, available } = res.data?.data || {};
      if (provider && available) return redirectToSignIn(provider, value);
      setChoice({ provider, available });
    });
  };

  const disconnect = () => {
    if (!window.confirm(`Disconnect ${conn.email}? CRM emails will be sent from the default ReadyTech sender instead.`)) return;
    run("disconnect", async () => {
      await API.post("/email/disconnect");
      toast.success("Email account disconnected");
      setBanner(null);
      load();
    });
  };

  const test = () =>
    run("test", async () => {
      const res = await API.post("/email/test");
      toast.success(res.data?.message || "Test email sent");
      load();
    });

  const conn = data?.connection;
  const providers = data?.providers || [];
  const anyAvailable = providers.some((p) => p.available);
  const nameOf = (id) => providers.find((p) => p.id === id)?.name || "this provider";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-start gap-4">
          <div className="grid w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 place-items-center shrink-0">
            <Mail size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900">Email Integration</h1>
            <p className="mt-1 text-sm text-slate-500">
              Connect your workspace's Gmail or Outlook mailbox so emails to leads are sent from your own address.
            </p>
            <p className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-emerald-600" />
              You sign in securely with Google or Microsoft — ReadyTech never sees or stores your password.
            </p>
          </div>
        </div>
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2 p-4 text-sm rounded-xl border ${
            banner.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {banner.type === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs font-semibold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {state === "loading" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading email integration…
        </p>
      )}
      {state === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load email integration status.{" "}
          <button onClick={load} className="font-semibold underline">Retry</button>
        </p>
      )}

      {state === "ready" && admin && !conn && anyAvailable && (
        <form onSubmit={continueWithEmail} className="p-6 space-y-3 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">Connect your mailbox</h2>
            <p className="text-sm text-slate-500">Enter the email address you want CRM emails sent from.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setChoice(null);
              }}
              placeholder="you@company.com"
              autoComplete="email"
              className="flex-1 px-4 py-2.5 text-sm border rounded-xl border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === "detect" || busy === "google" || busy === "microsoft" ? (
                <><Loader2 size={16} className="animate-spin" /> Redirecting…</>
              ) : (
                <>Continue <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          {choice && choice.provider && !choice.available && (
            <p className="p-3 text-sm rounded-xl bg-slate-50 text-slate-600">
              {nameOf(choice.provider)} connection isn't available yet — ReadyTech is finishing a one-time setup. Please try again later.
            </p>
          )}
          {choice && !choice.provider && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Who provides this mailbox? Choose to sign in:</p>
              <div className="flex flex-wrap gap-2">
                {providers.filter((p) => p.available).map((p) => {
                  const Icon = ICONS[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!!busy}
                      onClick={() => connect(p.id, email.trim())}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Icon size={18} /> {SIGN_IN[p.id]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}

      {state === "ready" && (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => {
            const mine = conn?.provider === p.id ? conn : null;
            const Icon = ICONS[p.id];
            const status = mine ? mine.status : p.available ? "none" : "unavailable";
            return (
              <div
                key={p.id}
                className={`flex flex-col p-5 space-y-4 text-sm bg-white border shadow-sm rounded-2xl ${
                  mine?.status === "connected" ? "border-emerald-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid w-11 h-11 border rounded-xl border-slate-100 bg-slate-50 place-items-center">
                      <Icon />
                    </div>
                    <h2 className="font-semibold text-slate-900">{p.name}</h2>
                  </div>
                  <StatusPill status={status} />
                </div>

                {mine ? (
                  <div className="p-3 space-y-1 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-2 font-semibold break-all text-slate-900">
                      <Mail size={15} className="shrink-0" /> {mine.email}
                    </div>
                    <p className="text-xs text-slate-500">
                      Connected {new Date(mine.connectedAt).toLocaleString()}
                      {mine.lastUsedAt ? ` · last used ${new Date(mine.lastUsedAt).toLocaleString()}` : ""}
                    </p>
                    {mine.status !== "connected" && mine.lastError && <p className="text-amber-700">{mine.lastError}</p>}
                  </div>
                ) : (
                  <p className="flex-1 text-slate-500">{p.limitations}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                  {!p.available ? (
                    <p className="text-slate-500">
                      Not available yet — ReadyTech is finishing a one-time setup.
                    </p>
                  ) : !admin ? (
                    !mine && <p className="text-slate-500">Only workspace admins can connect an email account.</p>
                  ) : mine ? (
                    <>
                      {mine.status === "connected" ? (
                        <button
                          disabled={!!busy}
                          onClick={test}
                          className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {busy === "test" && <Loader2 size={15} className="animate-spin" />}
                          {busy === "test" ? "Sending…" : "Send Test Email"}
                        </button>
                      ) : (
                        <button
                          disabled={!!busy}
                          onClick={() => connect(p.id, mine.email)}
                          className="inline-flex items-center gap-2 px-4 py-2 font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {busy === p.id && <Loader2 size={15} className="animate-spin" />}
                          {busy === p.id ? "Redirecting…" : "Reconnect"}
                        </button>
                      )}
                      <button
                        disabled={!!busy}
                        onClick={disconnect}
                        className="px-4 py-2 font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
                      >
                        {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={!!busy}
                      onClick={() => {
                        if (conn && !window.confirm(`This will replace ${conn.email}. Continue?`)) return;
                        connect(p.id, EMAIL_RE.test(email.trim()) ? email.trim() : undefined);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 font-semibold bg-white border rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy === p.id && <Loader2 size={15} className="animate-spin" />}
                      {busy === p.id ? "Redirecting…" : conn ? "Switch to this account" : SIGN_IN[p.id]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state === "ready" && !conn && (
        <p className="text-sm text-slate-500">
          Until a mailbox is connected, CRM emails are sent from the default ReadyTech sender.
        </p>
      )}
    </div>
  );
}
