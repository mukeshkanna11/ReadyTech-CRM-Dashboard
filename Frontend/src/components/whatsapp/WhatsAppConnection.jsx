import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Link2,
  Unlink,
  RefreshCw,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  Smartphone,
  Activity,
} from "lucide-react";

import { getMetaStatus } from "../../services/metaService";
import {
  syncWhatsApp,
  connectWhatsApp,
  disconnectWhatsApp,
  runEmbeddedSignup,
  prepareEmbeddedSignup,
} from "../../services/whatsappService";

/* =========================================================
   WHATSAPP CONNECTION
   Shared by the WhatsApp Inbox (/integrations/whatsapp) and the
   Meta Integration page. Pass `status` + `onChanged` to reuse a
   parent's /api/meta/status payload; otherwise it loads its own.
========================================================= */
export default function WhatsAppConnection({ status: parentStatus, onChanged, compact = false, quietDisconnect = false }) {
  const [ownStatus, setOwnStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const status = parentStatus !== undefined ? parentStatus : ownStatus;

  const reload = useCallback(async () => {
    if (onChanged) return onChanged();
    try {
      setOwnStatus(await getMetaStatus());
    } catch {
      /* interceptor already surfaced the error */
    }
  }, [onChanged]);

  useEffect(() => {
    if (parentStatus === undefined) reload();
  }, [parentStatus, reload]);

  const handleSync = async () => {
    try {
      setBusy("wa-sync");
      await syncWhatsApp();
      await reload();
      toast.success("WhatsApp connection is healthy");
    } catch {
      reload();
    } finally {
      setBusy("");
    }
  };

  /* Meta Embedded Signup — connect / change number / reconnect.
     Returns { blockers } so the card can show exact setup gaps. */
  const handleSignup = async (opts, success) => {
    try {
      setBusy("wa-signup");
      await runEmbeddedSignup(opts);
      await reload();
      toast.success(success);
      return { ok: true };
    } catch (err) {
      reload();
      if (!err.blockers?.length && !err.response && !err.surfaced) toast.error(err.message);
      return { blockers: err.blockers || [] };
    } finally {
      setBusy("");
    }
  };

  const runAction = async (key, fn, success) => {
    try {
      setBusy(key);
      await fn();
      await reload();
      if (success) toast.success(success);
      return true;
    } catch {
      reload();
      return false;
    } finally {
      setBusy("");
    }
  };

  return (
    <WhatsAppCard
      wa={status?.whatsapp}
      busy={busy}
      compact={compact}
      quietDisconnect={quietDisconnect}
      platform={!!status?.platformWhatsApp}
      onSync={handleSync}
      onSignup={handleSignup}
      onConnect={(form) => runAction("wa-connect", () => connectWhatsApp(form), "WhatsApp connected")}
      onDisconnect={() =>
        quietDisconnect
          ? runAction("wa-disconnect", () => disconnectWhatsApp({ silent: true }))
          : runAction("wa-disconnect", disconnectWhatsApp, "WhatsApp disconnected")
      }
    />
  );
}

/* WhatsApp Business — reads the existing /api/meta/status payload.
   Status shown is only what the server confirmed with Meta. */
const maskPhone = (n) => {
  if (!n) return null;
  // Keep formatting; show the first 4 and last 3 digits only
  const total = n.replace(/\D/g, "").length;
  if (total < 8) return n;
  let i = 0;
  return n.replace(/\d/g, (d) => (++i <= 4 || i > total - 3 ? d : "•"));
};

const ONBOARDING_LABEL = {
  embedded: "Embedded Signup",
  coexistence: "Coexistence (WhatsApp Business app)",
  manual: "System User token",
};

function WhatsAppCard({ wa, busy, onSync, platform, onConnect, onSignup, onDisconnect, compact, quietDisconnect }) {
  const connected = !!wa?.connected;
  const configured = !!wa?.phoneNumberId;
  const unhealthy = connected && wa?.health === "error";
  const needsReconnect = !connected && (configured || !!wa?.lastError);
  const [form, setForm] = useState({ phoneNumberId: "", wabaId: "", accessToken: "" });
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null); // "disconnect" | "change"
  const [blockers, setBlockers] = useState([]);
  const working = !!busy;
  const platformOff = !!wa?.platformDisabled;
  // Load Meta SDK + signed config on intent so the popup opens on click
  const warm = { onMouseEnter: () => prepareEmbeddedSignup().catch(() => {}), onFocus: () => prepareEmbeddedSignup().catch(() => {}), onPointerDown: () => prepareEmbeddedSignup().catch(() => {}) };
  // Compact (inbox banner): details collapsed until asked for
  const [showDetails, setShowDetails] = useState(!compact);

  const submit = async (e) => {
    e.preventDefault();
    if (await onConnect(form)) {
      setForm({ phoneNumberId: "", wabaId: "", accessToken: "" });
      setShowForm(false);
    }
  };

  const signup = async (opts, success) => {
    setBlockers([]);
    const r = await onSignup(opts, success);
    if (r?.blockers?.length) setBlockers(r.blockers);
  };

  // Inbox: disconnect straight away — no confirmation or messages
  const requestDisconnect = quietDisconnect
    ? async () => {
        await onDisconnect();
        prepareEmbeddedSignup().catch(() => {}); // ready for "Connect Another Number"
      }
    : () => setConfirm("disconnect");

  const confirmAction = async () => {
    const action = confirm;
    setConfirm(null);
    if (action === "disconnect") {
      await onDisconnect();
      prepareEmbeddedSignup().catch(() => {}); // ready for "Connect Another Number"
    }
    if (action === "change") await signup({}, "WhatsApp number changed successfully");
  };

  const badge = platform && configured
    ? connected ? ["Platform number", "bg-emerald-50 text-emerald-700"] : ["Platform number — not verified", "bg-amber-50 text-amber-700"]
    : unhealthy ? ["Needs attention", "bg-amber-50 text-amber-700"]
    : connected ? ["Connected", "bg-emerald-50 text-emerald-700"]
    : needsReconnect ? ["Disconnected", "bg-rose-50 text-rose-700"]
    : ["Not connected", "bg-slate-100 text-slate-500"];

  const btn = "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition rounded-xl disabled:opacity-50 disabled:cursor-not-allowed";
  const outline = `${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`;
  const primary = `${btn} text-white bg-emerald-600 hover:bg-emerald-700`;

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
              {wa?.verifiedName && <span className="ml-2 font-normal text-slate-500">· {wa.verifiedName}</span>}
            </p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              {wa?.displayPhoneNumber ? (
                <>
                  <ShieldCheck size={12} className="text-emerald-600" />
                  {maskPhone(wa.displayPhoneNumber)}
                </>
              ) : (
                "No number connected"
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge[1]}`}>{badge[0]}</span>

          {(connected || configured) && (
            <button onClick={onSync} disabled={working} className={outline}>
              <Activity size={13} className={busy === "wa-sync" ? "animate-pulse" : ""} />
              {busy === "wa-sync" ? "Testing…" : "Test Connection"}
            </button>
          )}

          {platform && (connected || configured) && (
            <button
              onClick={requestDisconnect}
              disabled={working}
              className={`${btn} border border-rose-200 text-rose-600 hover:bg-rose-50`}
            >
              <Unlink size={13} /> Disconnect
            </button>
          )}

          {!platform && (connected ? (
            <>
              <button onClick={() => setConfirm("change")} {...warm} disabled={working} className={outline}>
                <Smartphone size={13} /> Change Number
              </button>
              {unhealthy && (
                <button onClick={() => signup({}, "WhatsApp reconnected successfully")} {...warm} disabled={working} className={primary}>
                  <RefreshCw size={13} className={busy === "wa-signup" ? "animate-spin" : ""} /> Reconnect
                </button>
              )}
              <button
                onClick={requestDisconnect}
                disabled={working}
                className={`${btn} border border-rose-200 text-rose-600 hover:bg-rose-50`}
              >
                <Unlink size={13} /> Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => signup({}, needsReconnect ? "WhatsApp reconnected successfully" : "WhatsApp connected successfully")}
              {...warm}
              disabled={working}
              className={primary}
            >
              {busy === "wa-signup" ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
              {busy === "wa-signup" ? "Waiting for Meta…" : needsReconnect ? "Reconnect WhatsApp" : platformOff ? "Connect Another Number" : "Connect WhatsApp"}
            </button>
          ))}
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="p-3 mt-4 text-xs border rounded-xl border-amber-200 bg-amber-50 text-amber-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> WhatsApp signup cannot start — server setup is incomplete:
          </p>
          <ul className="mt-1.5 ml-5 space-y-0.5 list-disc">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      {!platform && !connected && (
        <div className="p-4 mt-4 border rounded-xl border-emerald-100 bg-emerald-50/40">
          <p className="text-xs text-slate-600">
            {platformOff && !needsReconnect
              ? "The platform number is disconnected for this workspace. Press Connect Another Number to sign in with Meta and pick or add this workspace's WhatsApp Business number — chats and leads are kept."
              : needsReconnect
              ? "This workspace's WhatsApp connection is no longer active. Reconnect to resume messaging — the inbox history is kept."
              : "Connect this workspace's own WhatsApp Business number with Meta's secure signup. You'll sign in with Facebook, pick or create a WhatsApp Business Account, and verify a number. Tokens stay on the server."}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
            <button
              onClick={() => signup({ coexistence: true }, "WhatsApp Business app number connected successfully")}
              {...warm}
              disabled={working}
              className="font-medium underline text-emerald-700 disabled:opacity-50"
            >
              Use my existing WhatsApp Business app number
            </button>
            <button onClick={() => setShowForm((v) => !v)} className="font-medium underline text-slate-500">
              {showForm ? "Hide advanced" : "Advanced: connect with a System User token"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Existing app numbers (Coexistence) need WhatsApp Business app 2.24.17+ and are offered only when Meta marks the number eligible.
          </p>
        </div>
      )}

      {!platform && !connected && showForm && (
        <form onSubmit={submit} className="grid gap-3 p-4 mt-4 border rounded-xl border-slate-200 bg-slate-50 sm:grid-cols-3">
          <p className="text-xs sm:col-span-3 text-slate-600">
            Phone Number ID and WABA ID from WhatsApp Manager, plus a permanent System User token with{" "}
            <code>whatsapp_business_messaging</code> + <code>whatsapp_business_management</code>.
            Verified with Meta and stored encrypted for this workspace only.{" "}
            <a href="https://business.facebook.com/wa/manage/home/" target="_blank" rel="noopener noreferrer" className="font-medium underline text-emerald-700">
              Open WhatsApp Manager
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
          <button disabled={working} className={`${primary} justify-center sm:col-span-3 py-2 text-sm`}>
            {busy === "wa-connect" ? "Verifying with Meta…" : "Verify & connect"}
          </button>
        </form>
      )}

      {platform && !configured && (
        <p className="p-3 mt-4 text-xs border rounded-xl border-slate-200 bg-slate-50 text-slate-600">
          Set <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_WABA_ID</code> and{" "}
          <code>WHATSAPP_VERIFY_TOKEN</code> on the server, then press Test Connection.
        </p>
      )}

      {compact && (connected || configured) && (
        <button onClick={() => setShowDetails((v) => !v)} className="mt-3 text-xs font-medium underline text-slate-500">
          {showDetails ? "Hide connection details" : "Show connection details"}
        </button>
      )}

      {showDetails && (connected || configured) && (
        <dl className="grid gap-4 pt-4 mt-4 text-sm border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Business name" value={wa?.verifiedName || "—"} />
          <Detail label="Phone number" value={maskPhone(wa?.displayPhoneNumber) || "—"} />
          <Detail
            label="Health"
            value={wa?.health === "healthy" ? "Healthy" : wa?.health === "error" ? "Error" : connected ? "Not tested" : "—"}
          />
          <Detail label="Quality rating" value={wa?.qualityRating || "—"} />
          <Detail label="Connected via" value={ONBOARDING_LABEL[wa?.onboardingType] || (platform ? "Platform .env" : "—")} />
          <Detail label="Connected on" value={formatDate(wa?.connectedAt) || "—"} />
          <Detail label="Webhook" value={wa?.webhookSubscribed ? "Subscribed" : "Not subscribed"} />
          <Detail label="Last tested" value={formatDate(wa?.lastTestedAt || wa?.lastSyncedAt) || "—"} />
          <Detail label="Last inbound" value={formatDate(wa?.lastInboundAt) || "—"} />
          <Detail label="Phone Number ID" value={wa?.phoneNumberId || "—"} />
          <Detail label="WABA ID" value={wa?.wabaId || "—"} />
        </dl>
      )}

      {wa?.lastError && (
        <p className="flex items-start gap-2 p-2.5 mt-3 text-xs border rounded-xl border-rose-200 bg-rose-50 text-rose-700">
          <XCircle size={14} className="mt-0.5 shrink-0" /> {wa.lastError}
        </p>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid p-4 bg-slate-900/50 backdrop-blur-sm place-items-center" onClick={() => setConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-3xl">
            <div className="px-6 py-5 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">
              <h3 className="text-lg font-bold">
                {confirm === "disconnect" ? "Disconnect WhatsApp?" : "Change WhatsApp number?"}
              </h3>
              <p className="mt-1 text-xs text-slate-300">{maskPhone(wa?.displayPhoneNumber)} · {wa?.verifiedName || "WhatsApp Business"}</p>
            </div>
            <p className="p-6 text-sm text-slate-600">
              {confirm === "disconnect"
                ? platform
                  ? "This workspace will stop using the platform (.env) WhatsApp number. It will not reconnect automatically. Chats and leads are kept, other workspaces are not affected, and you can connect another number right after."
                  : "This workspace will stop sending and receiving WhatsApp messages. Conversation history is kept, and you can reconnect at any time. Other workspaces are not affected."
                : "You'll authorize the new number with Meta. The current number keeps working until the new one is fully verified — if signup fails or is cancelled, nothing changes."}
            </p>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button
                onClick={() => setConfirm(null)}
                className="px-5 py-2.5 text-sm font-semibold bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={working}
                className={`px-5 py-2.5 text-sm font-semibold text-white shadow-lg rounded-xl disabled:opacity-60 ${
                  confirm === "disconnect" ? "bg-gradient-to-r from-red-600 to-rose-600" : "bg-gradient-to-r from-emerald-600 to-green-600"
                }`}
              >
                {confirm === "disconnect" ? "Disconnect" : "Continue to Meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-all text-slate-800">{value}</dd>
    </div>
  );
}

const formatDate = (value) => (value ? new Date(value).toLocaleString() : null);
