import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Mail } from "lucide-react";
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

export default function EmailIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [busy, setBusy] = useState(null);
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
    if (connected === "1") toast.success(`Connected ${searchParams.get("email") || "email account"}`);
    else toast.error(searchParams.get("message") || "Email connection failed");
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

  const connect = (provider) =>
    run(provider, async () => {
      const res = await API.get(`/email/oauth/${provider}/url`);
      window.location.href = res.data.data.url;
    });

  const disconnect = () => {
    if (!window.confirm(`Disconnect ${conn.email}? CRM emails will be sent via the default ReadyTech sender instead.`)) return;
    run("disconnect", async () => {
      await API.post("/email/disconnect");
      toast.success("Email account disconnected");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Email Integration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect this workspace's own Gmail or Microsoft 365 mailbox. CRM emails to leads are sent from it.
          </p>
        </div>
        {state === "ready" && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !conn ? "bg-slate-100 text-slate-600" : conn.status === "connected" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {!conn ? "Not connected" : conn.status === "connected" ? "Connected" : "Reconnect required"}
          </span>
        )}
      </div>

      {state === "loading" && <p className="text-sm text-slate-500">Loading email integration…</p>}
      {state === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load email integration status.{" "}
          <button onClick={load} className="font-semibold underline">Retry</button>
        </p>
      )}

      {state === "ready" && conn && (
        <div className="p-5 space-y-2 text-sm bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Mail size={18} /> {conn.email}
          </div>
          <p className="text-slate-500">
            {conn.providerName} · connected {new Date(conn.connectedAt).toLocaleString()}
            {conn.lastUsedAt ? ` · last used ${new Date(conn.lastUsedAt).toLocaleString()}` : ""}
          </p>
          {conn.status !== "connected" && <p className="text-red-600">{conn.lastError}</p>}
          {admin && (
            <div className="flex gap-4 pt-2">
              {conn.status === "connected" && (
                <button disabled={!!busy} onClick={test} className="font-semibold text-indigo-600 disabled:opacity-50">
                  {busy === "test" ? "Sending…" : "Send test email"}
                </button>
              )}
              {conn.status !== "connected" && (
                <button disabled={!!busy} onClick={() => connect(conn.provider)} className="font-semibold text-indigo-600 disabled:opacity-50">
                  Reconnect
                </button>
              )}
              <button disabled={!!busy} onClick={disconnect} className="font-semibold text-red-600 disabled:opacity-50">
                {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          )}
        </div>
      )}

      {state === "ready" && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.providers.map((p) => (
            <div key={p.id} className="p-5 space-y-3 text-sm bg-white border shadow-sm rounded-2xl border-slate-200">
              <h2 className="font-semibold text-slate-900">{p.name}</h2>
              {p.configured ? (
                admin ? (
                  <button
                    disabled={!!busy}
                    onClick={() => connect(p.id)}
                    className="px-4 py-2 font-semibold text-white rounded-xl bg-indigo-600 disabled:opacity-50"
                  >
                    {busy === p.id ? "Redirecting…" : conn ? `Connect instead of ${conn.email}` : "Connect"}
                  </button>
                ) : (
                  <p className="text-slate-500">Only workspace admins can connect an email account.</p>
                )
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 text-amber-800">
                  <p className="font-semibold">Setup required (server)</p>
                  <p className="mt-1">Missing: {p.missingEnv.join(", ")}</p>
                  <p className="mt-1">{p.setup}</p>
                </div>
              )}
              <p className="text-xs text-slate-500">Limitations: {p.limitations}</p>
            </div>
          ))}
        </div>
      )}

      {state === "ready" && !conn && (
        <p className="text-sm text-slate-500">
          Without a connected account, CRM emails are sent from the default ReadyTech sender (Resend).
        </p>
      )}
    </div>
  );
}
