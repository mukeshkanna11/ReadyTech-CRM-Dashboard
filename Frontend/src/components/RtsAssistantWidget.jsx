import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Mic, Sparkles, X } from "lucide-react";

import API from "../services/api";
import useRtsVoice from "../hooks/useRtsVoice";
import RtsAssistantPanel from "./RtsAssistantPanel";

/* ======================================================
   RTS AI ASSISTANT WIDGET
   Separate from ChatSupportWidget (brain icon). Assistance
   only — never creates, converts or modifies leads/enquiries.
   Launcher sits above the brain icon; on desktop the panel
   opens above it too, so the brain stays clickable and its
   own panel (z-50) layers over this one (z-45).
====================================================== */

const ERP_PATHS = /^\/(stocks|hr)(\/|$)/i;

export default function RtsAssistantWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const historyRef = useRef([]);
  const voiceRef = useRef(null);

  const ask = async (question) => {
    const history = [...historyRef.current, { role: "user", text: question }];
    historyRef.current = history;
    setMessages(history);
    setBusy(true);

    let reply;
    try {
      const { data } = await API.post("/ai/help", {
        product: ERP_PATHS.test(pathname) ? "ERP" : "CRM",
        messages: history.filter((m) => !m.error),
      });
      reply = { role: "assistant", text: data?.data?.text || "Sorry, I have no answer for that." };
    } catch (err) {
      reply = {
        role: "assistant",
        error: true,
        text: err?.response?.data?.message || "RTS AI is unavailable right now. Please try again.",
      };
    }

    historyRef.current = [...historyRef.current, reply];
    setMessages(historyRef.current);
    setBusy(false);
    if (!reply.error) voiceRef.current?.speak(reply.text);
  };

  const voice = useRtsVoice({
    onCommand: (question) => {
      setOpen(true);
      if (question) ask(question);
    },
  });
  voiceRef.current = voice;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="RTS AI Assistant"
        aria-label="Open RTS AI Assistant"
        className="fixed z-40 flex items-center justify-center text-white transition rounded-full shadow-xl bottom-24 right-6 h-14 w-14 bg-gradient-to-br from-fuchsia-600 to-indigo-600 hover:scale-105 active:scale-95"
      >
        <Sparkles size={22} />
        {voice.enabled && (
          <span className="absolute flex items-center justify-center w-5 h-5 border-2 border-white rounded-full -right-0.5 -top-0.5 bg-emerald-500 animate-pulse">
            <Mic size={10} />
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="RTS AI Assistant"
      className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(600px,calc(100vh-8rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-slate-200"
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white shrink-0 bg-gradient-to-r from-fuchsia-600 to-indigo-600">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15">
          <Sparkles size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">RTS AI Assistant</p>
          <p className="text-xs text-indigo-100 truncate">CRM &amp; ERP help · guidance only</p>
        </div>
        <button
          onClick={() => {
            voice.stopSpeaking?.();
            setOpen(false);
          }}
          aria-label="Close RTS AI Assistant"
          className="p-2 transition rounded-lg hover:bg-white/15"
        >
          <X size={18} />
        </button>
      </div>

      <RtsAssistantPanel messages={messages} busy={busy} onSend={ask} voice={voice} />
    </div>
  );
}
