import { useCallback, useEffect, useState } from "react";
import { Unlink, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

import WhatsAppInbox from "./WhatsAppInbox";
import WhatsAppConnection from "../../components/whatsapp/WhatsAppConnection";
import { getMetaStatus } from "../../services/metaService";
import { disconnectWhatsApp } from "../../services/whatsappService";

/* /integrations/whatsapp — this workspace's WhatsApp connection
   (Meta Embedded Signup) above the WhatsApp inbox. */
export default function WhatsAppIntegration() {
  const [status, setStatus] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getMetaStatus());
    } catch {
      /* interceptor already surfaced the error */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Workspace-level WhatsApp disconnect only (Meta account untouched).
  // State changes only after the backend confirms; the inbox then reloads
  // from the server (no stale conversations). Chats and leads are kept.
  const disconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      await disconnectWhatsApp({ silent: true });
      toast.success("WhatsApp disconnected");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't disconnect WhatsApp. Please try again.");
    } finally {
      await loadStatus();
      setRefreshKey((k) => k + 1);
      setDisconnecting(false);
    }
  };
  const wa = status?.whatsapp;
  const linked = !!(wa?.connected || wa?.phoneNumberId || (status?.platformWhatsApp && !wa?.platformDisabled));
  const onChanged = useCallback(async () => {
    await loadStatus();
    setRefreshKey((k) => k + 1);
  }, [loadStatus]);

  return (
    <WhatsAppInbox
      channel="whatsapp"
      refreshKey={refreshKey}
      banner={<WhatsAppConnection compact hideDisconnect status={status} onChanged={onChanged} />}
      headerActions={linked && (
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition bg-white border rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disconnecting ? <Loader2 size={15} className="animate-spin" /> : <Unlink size={15} />} {disconnecting ? "Disconnecting…" : "Disconnect WhatsApp"}
        </button>
      )}
    />
  );
}
