import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { RefreshCw, Link2, Unlink, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import WhatsAppInbox from "./WhatsAppInbox";
import {
  getMetaStatus,
  getMetaOAuthUrl,
  refreshInstagram,
  subscribeInstagram,
  disconnectInstagram,
  reconnectInstagramPage,
} from "../../services/metaService";

/* =========================================================
   INSTAGRAM INBOX — shared inbox UI locked to Instagram DMs,
   plus this workspace's real Instagram connection status.
========================================================= */
export default function InstagramInbox() {
  const [ig, setIg] = useState(null);
  const [busy, setBusy] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const status = (await getMetaStatus())?.instagramInbox || null;
      setIg(status);
      setLoadFailed(false);
      return status;
    } catch (err) {
      setIg(null);
      setLoadFailed(true);
      setError(err?.response?.data?.message || err?.message || "Could not load Instagram status");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Result of the Instagram OAuth redirect */
  useEffect(() => {
    const connected = params.get("connected");
    if (connected === null) return;
    // "Connected" only when the refreshed backend status confirms it
    if (connected === "1") {
      load().then((s) => {
        if (s?.connected) toast.success("Instagram account connected");
        else if (s) setError(s.lastError || "Instagram is not connected yet. Make sure you granted access to your Page and its Instagram account.");
      });
    } else setError(params.get("message") || "Instagram connection failed");
    setParams({}, { replace: true });
  }, [params, setParams, load]);

  // `mustConnect`: success only when the backend status confirms connected
  const run = async (key, fn, ok, mustConnect = false) => {
    try {
      setBusy(key);
      setError("");
      const data = await fn();
      if (data) {
        setIg(data);
        setRefreshKey((k) => k + 1); // reload the conversation list too
      }
      if (mustConnect && data && !data.connected) {
        setError(data.lastError || "Instagram is still not connected for this workspace");
      } else if (ok) {
        toast.success(ok);
      }
    } catch (err) {
      // Server/config failures (5xx) are never shown verbatim to clients
      setError(err?.response?.status >= 500
        ? "Instagram connection is temporarily unavailable. Please try again or contact support."
        : err?.response?.data?.message || err?.message || "Request failed");
      load();
    } finally {
      setBusy("");
    }
  };

  const connect = () =>
    ig?.pageReconnectable
      ? run("connect", reconnectInstagramPage, "Instagram reconnected", true)
      : run("connect", async () => {
      // Existing Meta Facebook Login → client picks their own Page + linked IG
      const url = await getMetaOAuthUrl(true);
      if (url) window.location.href = url;
    });

  const check = () => run("check", refreshInstagram, "Instagram status verified", true);

  /* Not confirmed connected by the backend: no list, filters, previews or
     chat panel — only the connect state. History stays in the database. */
  if (!ig || !ig.connected) {
    return <DisconnectedState ig={ig} loading={!ig && !loadFailed} busy={busy} error={error}
      onConnect={ig ? connect : load} onCheck={check} />;
  }

  return <WhatsAppInbox channel="instagram" refreshKey={refreshKey} banner={<ConnectionBanner ig={ig} busy={busy} onConnect={connect}
    onCheck={check}
    onSubscribe={() => run("sub", subscribeInstagram, "Webhook subscribed")}
    onDisconnect={() => window.confirm("Disconnect this workspace's Instagram account?") && run("disc", disconnectInstagram, "Instagram disconnected")} />} />;
}


function DisconnectedState({ ig, loading, busy, error, onConnect, onCheck }) {
  if (loading) {
    return <div className="flex items-center justify-center p-10 text-sm text-slate-500">Loading Instagram status…</div>;
  }

  return (
    <div className="flex items-center justify-center p-6 min-h-[60vh]">
      <div className="w-full max-w-md p-8 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-center justify-center mx-auto mb-4 text-white rounded-full w-14 h-14 bg-gradient-to-r from-fuchsia-500 to-pink-500">
          <Link2 size={24} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Instagram is disconnected</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect your Instagram Business account to view and manage Instagram DMs.
        </p>

        {error && (
          <p className="flex items-start gap-2 p-3 mt-4 text-xs text-left border rounded-xl border-rose-200 bg-rose-50 text-rose-700">
            <XCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
          </p>
        )}
        <button
          onClick={onConnect}
          disabled={!!busy}
          className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 mt-6 text-sm font-semibold text-white transition rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:opacity-90 disabled:opacity-50"
        >
          <Link2 size={16} className={busy === "connect" ? "animate-pulse" : ""} />
          {!ig ? "Retry" : busy === "connect" ? "Connecting…" : "Connect Instagram"}
        </button>

        {ig?.source && (
          <button onClick={onCheck} disabled={!!busy} className="inline-flex items-center gap-1.5 mt-3 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50">
            <RefreshCw size={12} className={busy === "check" ? "animate-spin" : ""} /> Check status
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectionBanner({ ig, busy, onConnect, onCheck, onSubscribe, onDisconnect }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [ig?.profilePictureUrl]);

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
    ok: `Connected as @${ig.username || "Instagram"}`,
    unverified: "Instagram token present — press Check status",
    expired: "Instagram token expired or revoked — reconnect",
    none: "No Instagram account connected to this workspace",
  }[state];

  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition disabled:opacity-50";

  return (
    <div className={`flex flex-wrap items-center gap-3 p-3 border shadow-sm rounded-2xl ${box}`}>
      {ig.profilePictureUrl && state === "ok" && !imageFailed ? (
        <img
          src={ig.profilePictureUrl}
          alt=""
          className="object-cover rounded-full w-9 h-9"
          onError={() => setImageFailed(true)}
        />
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
          {ig.connected && (ig.lastInboundAt
            ? `Last DM ${new Date(ig.lastInboundAt).toLocaleString()}.`
            : "No DM received yet.")}
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
            disabled={!!busy}
            className={`${btn} border-transparent text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:opacity-90`}
          >
            <Link2 size={13} /> {ig.source ? "Reconnect" : "Connect Instagram"}
          </button>
        )}

        {(ig.connected || ig.source || ig.tokenPresent) && (
          <button onClick={onDisconnect} disabled={!!busy} className={`${btn} border-rose-200 bg-white text-rose-600 hover:bg-rose-50`}>
            <Unlink size={13} /> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
