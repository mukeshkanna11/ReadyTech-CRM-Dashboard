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
      const res = await API.post("/email/disconnect");
      const revokeUrl = res.data?.data?.revokeUrl;
      toast.success(revokeUrl ? `Disconnected. To fully remove access, also revoke ReadyTech at ${revokeUrl}` : "Email account disconnected", { duration: 8000 });
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

      {state === "ready" && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.providers.map((p) => {
            const mine = conn?.provider === p.id ? conn : null;
            return (
              <div key={p.id} className="p-5 space-y-3 text-sm bg-white border shadow-sm rounded-2xl border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">{p.name}</h2>
                  {mine && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mine.status === "connected" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {mine.status === "connected" ? "Connected" : "Reconnect required"}
                    </span>
                  )}
                </div>

                {mine && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Mail size={16} /> {mine.email}
                    </div>
                    <p className="text-xs text-slate-500">
                      Connected {new Date(mine.connectedAt).toLocaleString()}
                      {mine.lastUsedAt ? ` · last used ${new Date(mine.lastUsedAt).toLocaleString()}` : ""}
                    </p>
                    {mine.status !== "connected" && <p className="text-red-600">{mine.lastError}</p>}
                  </div>
                )}

                {!p.available ? (
                  <p className="p-3 rounded-xl bg-slate-50 text-slate-600">
                    Not available yet — ReadyTech is finishing a one-time setup.
                    {admin && p.setupStatus && <span className="block mt-1 text-xs">Setup status: {p.setupStatus}</span>}
                  </p>
                ) : !admin ? (
                  !mine && <p className="text-slate-500">Only workspace admins can connect an email account.</p>
                ) : mine ? (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {mine.status === "connected" ? (
                      <button disabled={!!busy} onClick={test} className="font-semibold text-indigo-600 disabled:opacity-50">
                        {busy === "test" ? "Sending…" : "Test Email"}
                      </button>
                    ) : (
                      <button disabled={!!busy} onClick={() => connect(p.id)} className="font-semibold text-indigo-600 disabled:opacity-50">
                        {busy === p.id ? "Redirecting…" : "Reconnect"}
                      </button>
                    )}
                    <button disabled={!!busy} onClick={disconnect} className="font-semibold text-red-600 disabled:opacity-50">
                      {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={!!busy}
                    onClick={() => connect(p.id)}
                    className="px-4 py-2 font-semibold text-white rounded-xl bg-indigo-600 disabled:opacity-50"
                  >
                    {busy === p.id ? "Redirecting…" : conn ? `Connect (replaces ${conn.email})` : "Connect"}
                  </button>
                )}
                <p className="text-xs text-slate-500">{p.limitations}</p>
              </div>
            );
          })}
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
