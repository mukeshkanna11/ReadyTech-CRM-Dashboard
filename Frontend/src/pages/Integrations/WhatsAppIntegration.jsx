import WhatsAppInbox from "./WhatsAppInbox";
import WhatsAppConnection from "../../components/whatsapp/WhatsAppConnection";

/* /integrations/whatsapp — this workspace's WhatsApp connection
   (Meta Embedded Signup) above the WhatsApp inbox. */
export default function WhatsAppIntegration() {
  return <WhatsAppInbox channel="whatsapp" banner={<WhatsAppConnection compact quietDisconnect />} />;
}
