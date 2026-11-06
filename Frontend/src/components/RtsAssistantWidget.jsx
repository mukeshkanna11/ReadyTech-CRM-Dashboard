import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, RotateCcw, Sparkles, X } from "lucide-react";

import API from "../services/api";
import useRtsVoice, { rtsLog } from "../hooks/useRtsVoice";
import RtsAssistantPanel, { RtsWave } from "./RtsAssistantPanel";
import { STATE_LABEL, isTamil, parseNavigation } from "./rtsCommands";

/* ======================================================
   RTS AI ASSISTANT WIDGET (Siri-style)
   Separate from ChatSupportWidget (brain icon). Mounted once in
   DashboardLayout, so "Hey RTS" works on every authenticated page,
   panel open or closed.
   - Page commands ("go to invoice") run on-device → React Router.
   - Everything else → /api/ai/help (live read-only data, record
     search, page help). Latest command wins; stale replies are
     dropped and never spoken.
   Never creates, converts or modifies leads/enquiries/records.
====================================================== */

const ERP_PATHS = /^\/(stocks|hr)(\/|$)/i;
const SAFE_PATH = /^\/[a-z0-9/_-]*(\?[a-z0-9=&%+._-]*)?$/i;
const isPhone = () => window.matchMedia?.("(max-width: 639px)").matches;

export default function RtsAssistantWidget() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState("");
  const historyRef = useRef([]);
  const voiceRef = useRef(null);
  const abortRef = useRef(null);
  const reqId = useRef(0);
  const execTimer = useRef(null);
  const [spoken, setSpoken] = useState(""); // last recognised voice command, shown on the launcher
  const spokenTimer = useRef(null);

  const push = (...items) => {
    historyRef.current = [...historyRef.current, ...items];
    setMessages(historyRef.current);
  };

  const execute = (path, label) => {
    if (!SAFE_PATH.test(path) || path.startsWith("//")) { rtsLog("navigation blocked (unsafe path):", path); return; }
    rtsLog("navigate →", path);
    setExecuting(label || "Opening");
    clearTimeout(execTimer.current);
    execTimer.current = setTimeout(() => setExecuting(""), 1600);
    navigate(path);
    if (isPhone()) setOpen(false); // full-screen panel would hide the page
  };

  const ask = async (question) => {
    // Latest command wins: cancel the in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = (reqId.current += 1);

    push({ role: "user", text: question });
    setBusy(true);

    let reply;
    try {
      const { data } = await API.post(
        "/ai/help",
        {
          product: ERP_PATHS.test(pathname) ? "ERP" : "CRM",
          page: pathname,
          tzOffset: new Date().getTimezoneOffset(),
          messages: historyRef.current.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
        },
        { timeout: 60000, silent: true, signal: controller.signal } // tool lookups can exceed the 15s default
      );
      const d = data?.data || {};
      reply = {
        role: "assistant",
        text: d.text || "Sorry, I have no answer for that.",
        cards: Array.isArray(d.cards) ? d.cards : [],
        actions: Array.isArray(d.actions) ? d.actions : [],
      };
    } catch (err) {
      if (err?.code === "ERR_CANCELED" || controller.signal.aborted) return; // superseded / cancelled
      reply = {
        role: "assistant",
        error: true,
        text:
          err?.response?.data?.message ||
          (err?.code === "ECONNABORTED" ? "RTS AI took too long to answer. Please try again." : "RTS AI is unavailable right now. Please try again."),
      };
    }
    if (id !== reqId.current) return; // a newer command arrived meanwhile

    push(reply);
    setBusy(false);
    abortRef.current = null;

    const nav = reply.actions?.find((a) => a.type === "navigate");
    if (nav) execute(nav.path, nav.label);
    if (!reply.error) voiceRef.current?.speak(reply.text);
  };

  /* Single entry point for voice, typed text and suggestion chips */
  const runCommand = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return;
    voiceRef.current?.stopSpeaking?.(); // new command interrupts speech

    const nav = parseNavigation(text);
    rtsLog("parsed:", JSON.stringify(text), nav ? `→ page ${nav.path}` : "→ /ai/help (live data / help)");
    if (nav) {
      abortRef.current?.abort();
      reqId.current += 1;
      setBusy(false);
      const say = isTamil(text) ? `${nav.name} திறக்கிறேன்.` : `Opening ${nav.name}.`;
      push({ role: "user", text }, { role: "assistant", text: say, actions: [{ type: "navigate", path: nav.path, label: nav.name }] });
      execute(nav.path, nav.name);
      voiceRef.current?.speak(say);
      return;
    }

    setOpen(true);
    ask(text);
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    reqId.current += 1;
    setBusy(false);
    voiceRef.current?.cancel?.();
  };

  const retry = () => {
    const h = historyRef.current;
    if (!h.at(-1)?.error || h.at(-2)?.role !== "user" || busy) return;
    const question = h.at(-2).text;
    historyRef.current = h.slice(0, -2);
    ask(question);
  };

  const clear = () => {
    cancel();
    historyRef.current = [];
    setMessages([]);
  };

  // Only real commands arrive here — the wake word itself never becomes a chat message
  const voice = useRtsVoice({
    onCommand: (command) => {
      // Keep the recognised words visible on the launcher while the command runs
      setSpoken(command);
      clearTimeout(spokenTimer.current);
      spokenTimer.current = setTimeout(() => setSpoken(""), 5000);
      runCommand(command);
    },
    // "Hey RTS" animates the floating launcher (Siri-style) and shows the live
    // transcript there — the panel is not forced open, so page commands run
    // straight on the current page. Data answers open the panel (runCommand).
    onWake: () => {
      setSpoken("");
      clearTimeout(spokenTimer.current);
    },
  });
  voiceRef.current = voice;

  const state = executing
    ? "executing"
    : voice.phase === "command"
    ? "listening"
    : voice.phase === "detected"
    ? "detected"
    : busy
    ? "thinking"
    : voice.speaking
    ? "speaking"
    : voice.phase === "error"
    ? "error"
    : "idle";

  const close = () => {
    voice.stopSpeaking?.();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { abortRef.current?.abort(); clearTimeout(execTimer.current); clearTimeout(spokenTimer.current); }, []);

  // Voice errors (e.g. mic blocked) show in the pill for 6s, then only as the red launcher badge
  const [errorHidden, setErrorHidden] = useState(false);
  useEffect(() => {
    setErrorHidden(false);
    if (!voice.error) return undefined;
    const t = setTimeout(() => setErrorHidden(true), 6000);
    return () => clearTimeout(t);
  }, [voice.error]);

  if (!open) {
    const listening = state === "listening" || state === "detected";
    // Recognition really running and waiting for "Hey RTS" → calm glow + "Say Hey RTS" status
    const shown = state === "idle" && voice.running && voice.phase === "wake" ? "wake" : state;
    const active = listening || shown === "wake" || state === "thinking" || state === "speaking" || state === "executing";
    const transcript = listening ? voice.heard : spoken;
    return (
      <>
        {shown !== "idle" && !(state === "error" && errorHidden) && (
          <button
            onClick={() => setOpen(true)}
            aria-live="polite"
            className="fixed z-40 flex items-center gap-2 py-2 pl-3 pr-4 text-sm text-white rounded-full shadow-2xl bottom-[10.5rem] right-6 max-w-[min(80vw,320px)] bg-slate-900/90 backdrop-blur"
          >
            {state === "error" ? <MicOff size={16} className="text-rose-300 shrink-0" /> : <RtsWave state={shown} light />}
            <span className="font-medium shrink-0">{state === "executing" ? `Opening ${executing}…` : STATE_LABEL[shown]}</span>
            {state === "error" && <span className="truncate text-rose-200">{voice.error}</span>}
            {state !== "error" && transcript && <span className="italic truncate text-slate-200">“{transcript}”</span>}
          </button>
        )}
        <button
          onClick={() => setOpen(true)}
          title={voice.phase === "wake" ? `RTS AI Assistant · ${STATE_LABEL.wake}` : "RTS AI Assistant"}
          aria-label="Open RTS AI Assistant"
          className={`fixed z-40 flex items-center justify-center text-white transition rounded-full shadow-xl bottom-24 right-6 h-14 w-14 hover:scale-105 active:scale-95 ${
            listening ? "scale-110" : ""
          }`}
        >
          {/* Siri-style glow: spinning colour ring + pulse while listening, slower while working */}
          {active && (
            <>
              {listening && <span className="absolute rounded-full -inset-2 bg-fuchsia-500/40 animate-ping" aria-hidden="true" />}
              <span
                className={`absolute rounded-full -inset-1 blur-[3px] animate-spin bg-[conic-gradient(from_0deg,#d946ef,#6366f1,#22d3ee,#f472b6,#d946ef)] ${
                  listening ? "[animation-duration:1.4s]" : "[animation-duration:3s] opacity-70"
                }`}
                aria-hidden="true"
              />
            </>
          )}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-600 to-indigo-600" aria-hidden="true" />
          <span className="relative">{active ? <RtsWave state={shown} light /> : <Sparkles size={22} />}</span>
          {(voice.enabled || voice.phase === "error") && (
            <span
              className={`absolute flex items-center justify-center w-5 h-5 border-2 border-white rounded-full -right-0.5 -top-0.5 ${
                voice.phase === "error" ? "bg-rose-500" : "bg-emerald-500"
              }`}
            >
              {voice.phase === "error" ? <MicOff size={10} /> : <Mic size={10} />}
            </span>
          )}
        </button>

      </>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="RTS AI Assistant"
      className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(660px,calc(100vh-8rem))] sm:w-[420px] sm:rounded-3xl sm:border sm:border-slate-200"
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white shrink-0 bg-gradient-to-r from-fuchsia-600 to-indigo-600">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15">
          {state === "idle" ? <Sparkles size={18} /> : <RtsWave state={state} light />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">RTS AI Assistant</p>
          <p className="text-xs text-indigo-100 truncate" aria-live="polite">
            {state === "idle"
              ? voice.phase === "wake" ? STATE_LABEL.wake : "CRM & ERP · live data · read-only"
              : state === "executing" ? `Opening ${executing}…` : STATE_LABEL[state]}
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} aria-label="New conversation" title="New conversation" className="p-2 transition rounded-lg hover:bg-white/15">
            <RotateCcw size={16} />
          </button>
        )}
        <button onClick={close} aria-label="Close RTS AI Assistant" className="p-2 transition rounded-lg hover:bg-white/15">
          <X size={18} />
        </button>
      </div>

      <RtsAssistantPanel
        messages={messages}
        busy={busy}
        state={state}
        onSend={runCommand}
        onRetry={retry}
        onCancel={cancel}
        onNavigate={(path, label) => execute(path, label)}
        voice={voice}
      />
    </div>
  );
}
