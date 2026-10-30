import { useCallback, useEffect, useState } from "react";
import { Unlink } from "lucide-react";

import WhatsAppInbox from "./WhatsAppInbox";
import WhatsAppConnection from "../../components/whatsapp/WhatsAppConnection";
import { getMetaStatus } from "../../services/metaService";
import { disconnectWhatsApp } from "../../services/whatsappService";

/* /integrations/whatsapp — this workspace's WhatsApp connection
   (Meta Embedded Signup) above the WhatsApp inbox. */
export default function WhatsAppIntegration() {
  const [status, setStatus] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);

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

  // Workspace-level WhatsApp disconnect only (Meta account untouched) —
  // no confirmation or messages; chats and leads are kept
  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectWhatsApp({ silent: true });
    } catch {
      /* intentionally silent */
    } finally {
      await loadStatus();
      setDisconnecting(false);
    }
  };

  return (
    <WhatsAppInbox
      channel="whatsapp"
      banner={<WhatsAppConnection compact hideDisconnect status={status} onChanged={loadStatus} />}
      headerActions={
        <button
          onClick={disconnect}
          disabled={disconnecting}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition bg-white border rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Unlink size={15} /> Disconnect WhatsApp
        </button>
      }
    />
  );
}
