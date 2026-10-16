import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { RefreshCw, Link2, Unlink, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import WhatsAppInbox from "./WhatsAppInbox";
import {
  getMetaStatus,
  getInstagramOAuthUrl,
  refreshInstagram,
  subscribeInstagram,
  disconnectInstagram,
} from "../../services/metaService";

/* =========================================================
   INSTAGRAM INBOX — shared inbox UI locked to Instagram DMs,
   plus this workspace's real Instagram connection status.
========================================================= */
export default function InstagramInbox() {
  const [ig, setIg] = useState(null);
  const [busy, setBusy] = useState("");
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      setIg((await getMetaStatus())?.instagramInbox || null);
    } catch {
      setIg(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Result of the Instagram OAuth redirect */
  useEffect(() => {
    const connected = params.get("connected");
    if (connected === null) return;
    if (connected === "1") toast.success("Instagram account connected");
    else toast.error(params.get("message") || "Instagram connection failed");
    setParams({}, { replace: true });
  }, [params, setParams]);

  const run = async (key, fn, ok) => {
    try {
      setBusy(key);
      const data = await fn();
      if (data) setIg(data);
      if (ok) toast.success(ok);
    } catch {
      load(); // error toast comes from the API interceptor
    } finally {
      setBusy("");
    }
  };

  const connect = () =>
    run("connect", async () => {
      const url = await getInstagramOAuthUrl();
      if (url) window.location.href = url;
    });

  return <WhatsAppInbox channel="instagram" banner={<ConnectionBanner ig={ig} busy={busy} onConnect={connect}
    onCheck={() => run("check", refreshInstagram, "Instagram status verified")}
    onSubscribe={() => run("sub", subscribeInstagram, "Webhook subscribed")}
    onDisconnect={() => window.confirm("Disconnect this workspace's Instagram account?") && run("disc", disconnectInstagram, "Instagram disconnected")} />} />;
}

function ConnectionBanner({ ig, busy, onConnect, onCheck, onSubscribe, onDisconnect }) {
  if (!ig) return null;

  const state = ig.connected ? "ok" : ig.expired ? "expired" : ig.source ? "unverified" : "none";
  const tone = {
    ok: ["border-emerald-200 bg-emerald-50/60", CheckCircle2, "text-emerald-600"],
    unverified: ["border-amber-200 bg-amber-50/60", AlertTriangle, "text-amber-500"],
    expired: ["border-rose-200 bg-rose-50/60", XCircle, "text-rose-500"],
    none: ["border-slate-200 bg-white", Link2, "text-slate-400"],
  }[state];
  const [box, StateIcon, iconCls] = tone;

  const title = {
    ok: `Connected as @${ig.username}`,
    unverified: "Instagram token present — press Check status",
    expired: "Instagram token expired or revoked — reconnect",
    none: "No Instagram account connected to this workspace",
  }[state];

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition disabled:opacity-50";

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 border shadow-sm rounded-2xl ${box}`}>
      {ig.profilePictureUrl && state === "ok" ? (
        <img src={ig.profilePictureUrl} alt="" className="object-cover rounded-full w-9 h-9" />
      ) : (
        <StateIcon size={20} className={iconCls} />
      )}
      <div className="flex-1 min-w-0 text-xs text-slate-600">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="truncate">
          {ig.method === "facebook_page" && "Via your connected Facebook Page (Meta Integration). "}
          {ig.method === "instagram_login" && ig.source === "platform" && "Using the platform Instagram token (this workspace only). "}
          {ig.connected &&
            (!ig.webhookVerifiable
              ? "Webhook status can't be read without pages_manage_metadata. "
              : ig.webhookSubscribed ? "Webhook subscribed. " : "Webhook not subscribed. ")}
          {ig.connected && (ig.lastInboundAt ? `Last DM ${new Date(ig.lastInboundAt).toLocaleString()}.` : "No DM received yet.")}
          {!ig.oauthConfigured && ` Server missing: ${ig.missingEnv.join(", ")}.`}
          {ig.lastError && state !== "ok" && ` ${ig.lastError}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ig.source && (
          <button onClick={onCheck} disabled={!!busy} className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <RefreshCw size={13} className={busy === "check" ? "animate-spin" : ""} /> Check status
          </button>
        )}
        {ig.connected && !ig.webhookSubscribed && ig.webhookVerifiable && (
          <button onClick={onSubscribe} disabled={!!busy} className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            Subscribe webhook
          </button>
        )}
        {ig.method !== "facebook_page" && (
        <button
          onClick={onConnect}
          disabled={!!busy || !ig.oauthConfigured}
          title={ig.oauthConfigured ? "" : "Instagram Login is not configured on the server"}
          className={`${btn} border-transparent text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:opacity-90`}
        >
          <Link2 size={13} /> {ig.source ? "Reconnect" : "Connect Instagram"}
        </button>
        )}
        {ig.tokenPresent && (
          <button onClick={onDisconnect} disabled={!!busy} className={`${btn} border-rose-200 bg-white text-rose-600 hover:bg-rose-50`}>
            <Unlink size={13} /> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
