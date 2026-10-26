import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
/* lucide-react v1 no longer ships brand icons — using generic equivalents */
import {
  Globe,
  AtSign,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

import {
  getMetaStatus,
  getMetaOAuthUrl,
  refreshMetaConnection,
  disconnectMeta,
  subscribeMetaPage,
} from "../../services/metaService";
import {
  syncWhatsApp,
  connectWhatsApp,
  disconnectWhatsApp,
} from "../../services/whatsappService";

/* =========================================================
   META INTEGRATION
   ONE centralized Meta connection for CRM, ERP & AI Content.
========================================================= */
export default function MetaIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setStatus(await getMetaStatus());
    } catch {
      /* interceptor already surfaced the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /* OAuth redirect result */
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (!connected) return;

    if (connected === "1") {
      toast.success("Meta connected successfully");
    } else {
      toast.error(searchParams.get("message") || "Meta connection failed");
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleConnect = async () => {
    try {
      setBusy("connect");
      const url = await getMetaOAuthUrl();
      if (url) window.location.href = url;
    } catch {
      setBusy("");
    }
  };

  const handleRefresh = async () => {
    try {
      setBusy("refresh");
      setStatus(await refreshMetaConnection());
      toast.success("Connection refreshed");
    } catch {
      loadStatus();
    } finally {
      setBusy("");
    }
  };

  const handleWhatsAppSync = async () => {
    try {
      setBusy("wa-sync");
      await syncWhatsApp();
      await loadStatus();
      toast.success("WhatsApp account synced");
    } catch {
      loadStatus();
    } finally {
      setBusy("");
    }
  };

  const runAction = async (key, fn, success) => {
    try {
      setBusy(key);
      await fn();
      await loadStatus();
      toast.success(success);
      return true;
    } catch {
      loadStatus();
      return false;
    } finally {
      setBusy("");
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Meta for CRM, ERP and AI Content?")) return;

    try {
      setBusy("disconnect");
      setStatus(await disconnectMeta());
      toast.success("Meta disconnected");
    } catch {
      /* handled by interceptor */
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Loading Meta integration...
      </div>
    );
  }

 const connected = !!status?.connected;
const config = status?.config || { configured: true, missingEnv: [] };

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meta Integration</h1>
          <p className="mt-1 text-sm text-slate-500">
            One centralized Meta connection shared by CRM, ERP and AI Content.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill status={status?.status} connected={connected} />

          {connected ? (
            <>
              <button
                onClick={handleRefresh}
                disabled={!!busy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={busy === "refresh" ? "animate-spin" : ""}
                />
                Refresh
              </button>

              {/* Re-runs the official Facebook Login for this workspace (new Page / permissions) */}
              <button
                onClick={handleConnect}
                disabled={!!busy || !config?.configured}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Link2 size={16} />
                {busy === "connect" ? "Redirecting..." : "Reconnect"}
              </button>

              <button
                onClick={handleDisconnect}
                disabled={!!busy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50"
              >
                <Unlink size={16} />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!!busy || !config?.configured}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              <Link2 size={16} />
              {busy === "connect" ? "Redirecting..." : status?.token?.present ? "Reconnect Meta" : "Connect Meta"}
            </button>
          )}
        </div>
      </div>

      {/* ================= CONFIG WARNING ================= */}
      {!config?.configured && (
        <div className="flex items-start gap-3 p-4 text-sm border rounded-2xl border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Meta app not fully configured</p>
            <p className="mt-1">
              Missing backend environment variables:{" "}
              {config?.missingEnv?.join(", ") || "unknown"}
            </p>
          </div>
        </div>
      )}

      {status?.lastError && (
        <div className="flex items-start gap-3 p-4 text-sm border rounded-2xl border-rose-200 bg-rose-50 text-rose-700">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <p>{status.lastError}</p>
        </div>
      )}

      {/* ================= ASSET CARDS ================= */}
      <div className="grid gap-4 md:grid-cols-2">
        <AssetCard
          icon={Globe}
          tone="text-blue-600 bg-blue-50"
          title="Facebook Page"
          connected={status?.facebookPage?.connected}
          primary={status?.facebookPage?.name || "Not linked"}
          rows={[
            { label: "Page ID", value: status?.facebookPage?.id || "—" },
            {
              label: "Page token",
              value: status?.facebookPage?.tokenPresent
                ? "Stored securely"
                : "—",
            },
          ]}
        />

        <AssetCard
          icon={AtSign}
          tone="text-pink-600 bg-pink-50"
          title="Instagram Business"
          connected={status?.instagram?.connected}
          primary={
            status?.instagram?.username
              ? `@${status.instagram.username}`
              : "Not linked"
          }
          rows={[
            { label: "Account name", value: status?.instagram?.name || "—" },
            { label: "Instagram ID", value: status?.instagram?.id || "—" },
          ]}
        />
      </div>

      {/* ================= WHATSAPP BUSINESS ================= */}
      <WhatsAppCard
        wa={status?.whatsapp}
        busy={busy}
        onSync={handleWhatsAppSync}
        platform={!!status?.platformWhatsApp}
        onConnect={(form) => runAction("wa-connect", () => connectWhatsApp(form), "WhatsApp connected")}
        onDisconnect={() =>
          window.confirm("Disconnect this workspace's WhatsApp number?") &&
          runAction("wa-disconnect", disconnectWhatsApp, "WhatsApp disconnected")
        }
      />

      {/* ================= MESSENGER / INSTAGRAM DM WEBHOOK ================= */}
      {status?.facebookPage?.connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div>
            <p className="text-sm font-semibold text-slate-900">Messenger & Instagram DMs</p>
            <p className="text-xs text-slate-500">
              Subscribe {status.facebookPage.name} to this app&apos;s webhook so DMs reach the Unified Inbox.
              Messenger replies need the <code>pages_messaging</code> permission.
            </p>
          </div>
          <button
            onClick={() => runAction("page-sub", subscribeMetaPage, "Page subscribed to webhook")}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={busy === "page-sub" ? "animate-spin" : ""} />
            Subscribe Page
          </button>
        </div>
      )}

      {/* ================= SETUP CHECKLIST (server-verified) ================= */}
      {status?.setup?.length > 0 && <SetupChecklist items={status.setup} />}

      {/* ================= CONNECTION DETAILS ================= */}
      <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Connection details
          </h2>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail
            label="Business Portfolio ID"
            value={
              status?.businessPortfolioId ||
              config?.businessPortfolioId ||
              "—"
            }
          />
          <Detail label="Graph API version" value={config?.apiVersion || "—"} />
          <Detail
            label="OAuth redirect URI"
            value={config?.redirectUri || "Not set (META_REDIRECT_URI)"}
          />
          <Detail
            label="Access token"
            value={
              status?.token?.present
                ? status.token.expired
                  ? "Expired — reconnect required"
                  : "Stored securely (encrypted)"
                : "Not stored"
            }
          />
          <Detail
            label="Token expires"
            value={formatDate(status?.token?.expiresAt) || "Never"}
          />
          <Detail
            label="Connected at"
            value={formatDate(status?.connectedAt) || "—"}
          />
          <Detail
            label="Last synced"
            value={formatDate(status?.lastSyncedAt) || "—"}
          />
        </dl>

        <p className="mt-5 text-xs text-slate-500">
          Facebook and Instagram are already linked inside the Meta Business
          Portfolio. This module only reads that linkage — it never re-links or
          merges accounts. Tokens stay on the server and are never exposed to
          the browser.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   UI HELPERS
========================================================= */
function StatusPill({ status, connected }) {
  const tone = connected
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "error"
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-slate-100 text-slate-600 border-slate-200";

  const label = connected
    ? "Connected"
    : status === "error"
    ? "Error"
    : "Disconnected";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}
    >
      {connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {label}
    </span>
  );
}

function AssetCard({ icon: Icon, tone, title, connected, primary, rows }) {
  return (
    <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
            <Icon size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{primary}</p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            connected
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {connected ? "Active" : "Inactive"}
        </span>
      </div>

      <dl className="pt-4 mt-4 space-y-2 border-t border-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-xs">
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="font-medium truncate text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* WhatsApp Business — reads the existing /api/meta/status payload */
function WhatsAppCard({ wa, busy, onSync, platform, onConnect, onDisconnect }) {
  const connected = !!wa?.connected;
  const configured = !!wa?.phoneNumberId;
  const [form, setForm] = useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  const [showForm, setShowForm] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (await onConnect(form)) {
      setForm({ phoneNumberId: "", wabaId: "", accessToken: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid w-10 h-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              WhatsApp Business
            </p>
            <p className="text-xs text-slate-500">
              {wa?.displayPhoneNumber || "No number connected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              connected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {connected ? "Connected" : "Not connected"}
          </span>

          <button
            onClick={onSync}
            disabled={!!busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={busy === "wa-sync" ? "animate-spin" : ""}
            />
            Sync
          </button>

          {!platform && (
            connected && wa?.tokenPresent ? (
              <button
                onClick={onDisconnect}
                disabled={!!busy}
                className="px-3 py-1.5 text-xs font-medium border rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                {showForm ? "Cancel" : "Connect number"}
              </button>
            )
          )}
        </div>
      </div>

      {!platform && showForm && (
        <form onSubmit={submit} className="grid gap-3 p-4 mt-4 border rounded-xl border-emerald-100 bg-emerald-50/40 sm:grid-cols-3">
          <p className="text-xs sm:col-span-3 text-slate-600">
            Use this workspace&apos;s own WhatsApp Cloud API number: Phone Number ID and WABA ID from
            Meta Business Manager → WhatsApp Manager, and a permanent System User token with{" "}
            <code>whatsapp_business_messaging</code> + <code>whatsapp_business_management</code>.
            The token is verified with Meta and stored encrypted for this workspace only.{" "}
            <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline">
              Open WhatsApp Manager
            </a>{" · "}
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 underline">
              Cloud API setup guide
            </a>
          </p>
          {[
            ["phoneNumberId", "Phone Number ID", "text"],
            ["wabaId", "WABA ID (enables webhook)", "text"],
            ["accessToken", "System User access token", "password"],
          ].map(([key, label, type]) => (
            <label key={key} className="text-xs text-slate-600">
              {label}
              <input
                type={type}
                required={key !== "wabaId"}
                autoComplete="off"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2 mt-1 text-sm bg-white border rounded-lg outline-none border-slate-200 focus:border-emerald-400"
              />
            </label>
          ))}
          <button
            disabled={!!busy}
            className="px-4 py-2 text-sm font-medium text-white sm:col-span-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy === "wa-connect" ? "Verifying with Meta…" : "Verify & connect"}
          </button>
        </form>
      )}

      {!configured && !connected ? (
        !platform ? (
          <p className="p-3 mt-4 text-xs border rounded-xl border-slate-200 bg-slate-50 text-slate-600">
            No WhatsApp number is connected to this workspace yet. Press <b>Connect number</b> to link your own.
          </p>
        ) : (
        <p className="p-3 mt-4 text-xs border rounded-xl border-slate-200 bg-slate-50 text-slate-600">
          Set <code>WHATSAPP_PHONE_NUMBER_ID</code>,{" "}
          <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_WABA_ID</code> and{" "}
          <code>WHATSAPP_VERIFY_TOKEN</code> on the server, then press Sync.
        </p>
        )
      ) : (
        <dl className="grid gap-4 pt-4 mt-4 text-sm border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Business name" value={wa?.verifiedName || "—"} />
          <Detail label="Phone Number ID" value={wa?.phoneNumberId || "—"} />
          <Detail label="WABA ID" value={wa?.wabaId || "—"} />
          <Detail label="Quality rating" value={wa?.qualityRating || "—"} />
          <Detail
            label="Webhook"
            value={wa?.webhookSubscribed ? "Connected" : "Not connected"}
          />
          <Detail label="Last inbound" value={formatDate(wa?.lastInboundAt) || "—"} />
          <Detail label="Last synced" value={formatDate(wa?.lastSyncedAt) || "—"} />
        </dl>
      )}

      {wa?.lastError && (
        <p className="p-2.5 mt-3 text-xs border rounded-xl border-rose-200 bg-rose-50 text-rose-700">
          {wa.lastError}
        </p>
      )}
    </div>
  );
}

/* Each row comes from /api/meta/status — "ok" only when Meta confirmed it */
const SETUP_STYLE = {
  ok: { Icon: CheckCircle2, cls: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700", text: "Ready" },
  warning: { Icon: AlertTriangle, cls: "text-amber-500", badge: "bg-amber-50 text-amber-700", text: "Waiting" },
  missing: { Icon: XCircle, cls: "text-rose-500", badge: "bg-rose-50 text-rose-700", text: "Action needed" },
};

function SetupChecklist({ items }) {
  return (
    <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Setup status</h2>
      <ul className="divide-y divide-slate-100">
        {items.map((it) => {
          const st = SETUP_STYLE[it.state] || SETUP_STYLE.missing;
          return (
            <li key={it.key} className="flex items-start gap-3 py-2.5">
              <st.Icon size={16} className={`mt-0.5 shrink-0 ${st.cls}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{it.label}</p>
                <p className="text-xs break-words text-slate-500">{it.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.badge}`}>{st.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-all text-slate-800">
        {value}
      </dd>
    </div>
  );
}

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : null;
