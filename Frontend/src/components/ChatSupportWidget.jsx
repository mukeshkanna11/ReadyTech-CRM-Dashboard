import { useEffect, useRef, useState, useCallback } from "react";
import {
  Brain,
  X,
  Send,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import {
  startConversation,
  sendMessage,
  clearConversation,
} from "../services/chatSupport";

/* ======================================================
   CHAT SUPPORT WIDGET
   Floating brain launcher + AI assistant panel.
====================================================== */

const DEFAULT_SUGGESTIONS = [
  "Book a product demo",
  "What does the CRM include?",
  "How does GST invoicing work?",
  "I need help logging in",
];

const formatTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function ChatSupportWidget() {
  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);

  const [input, setInput] = useState("");
  const [booting, setBooting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [degraded, setDegraded] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const startedRef = useRef(false);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  /* ================= LOAD ON FIRST OPEN ================= */
  const boot = useCallback(async () => {
    setBooting(true);
    setError("");

    try {
      const res = await startConversation();
      setMessages(res?.data?.messages || []);
      if (Array.isArray(res?.suggestedQuestions) && res.suggestedQuestions.length) {
        setSuggestions(res.suggestedQuestions);
      }
    } catch {
      setError("Couldn't connect to support. Please try again.");
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      boot();
    }
    if (open) {
      // Let the panel paint before focusing so mobile keyboards behave.
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open, boot]);

  /* ================= CLOSE ON ESCAPE ================= */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /* ================= SEND ================= */
  const submit = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;

    setInput("");
    setError("");
    setDegraded(false);

    // Optimistic user bubble — replaced by the server copy on success.
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: "user",
        text,
        source: "user",
        createdAt: new Date().toISOString(),
      },
    ]);

    setSending(true);

    try {
      const res = await sendMessage(text);
      setMessages(res?.data?.messages || []);
      setDegraded(Boolean(res?.degraded));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(text); // don't lose what they typed
      setError(
        err?.response?.data?.message ||
          "Message failed to send. Check your connection and try again."
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onClear = async () => {
    if (sending) return;
    try {
      await clearConversation();
      setMessages([]);
      setError("");
      setDegraded(false);
    } catch {
      setError("Couldn't clear the conversation.");
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  /* ================= LAUNCHER ================= */
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="AI Support Assistant"
        aria-label="Open AI support assistant"
        className="fixed z-40 flex items-center justify-center text-white transition rounded-full shadow-xl bottom-6 right-6 h-14 w-14 bg-gradient-to-br from-indigo-600 to-violet-600 hover:scale-105 active:scale-95"
      >
        <Brain size={24} />
        <span className="absolute w-3 h-3 border-2 border-white rounded-full bg-emerald-400 right-1 top-1" />
      </button>
    );
  }

  /* ================= PANEL ================= */
  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm sm:hidden"
      />

      <div
        role="dialog"
        aria-label="AI support assistant"
        className="fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl
                   inset-x-0 bottom-0 top-0 rounded-none
                   sm:inset-auto sm:bottom-6 sm:right-6 sm:top-auto
                   sm:h-[min(620px,calc(100vh-3rem))] sm:w-[400px] sm:rounded-3xl
                   sm:border sm:border-slate-200"
      >
        {/* ============ HEADER ============ */}
        <div className="relative px-4 py-4 overflow-hidden text-white bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-900 shrink-0">
          <div className="absolute rounded-full -right-10 -top-10 h-28 w-28 bg-indigo-500/20 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 border rounded-2xl shrink-0 border-white/20 bg-white/10">
              <Brain size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                ReadyTech AI Assistant
              </p>
              <p className="flex items-center gap-1.5 text-xs text-indigo-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Online · replies instantly
              </p>
            </div>

            <button
              onClick={onClear}
              title="Clear conversation"
              aria-label="Clear conversation"
              className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-white/10 hover:bg-white/20"
            >
              <Trash2 size={15} />
            </button>

            <button
              onClick={() => setOpen(false)}
              title="Close"
              aria-label="Close support assistant"
              className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-white/10 hover:bg-white/20"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ============ MESSAGES ============ */}
        <div
          ref={scrollRef}
          className="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-slate-50"
        >
          {booting ? (
            /* Skeletons mirror the real bubble layout so nothing jumps */
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={i % 2 ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`h-12 animate-pulse rounded-2xl bg-slate-200 ${
                      i % 2 ? "w-40" : "w-56"
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Greeting */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm leading-relaxed text-slate-700">
                    Hi! I'm the ReadyTech assistant. Ask me about the CRM &amp;
                    ERP platform, pricing, a demo, or support.
                  </p>
                </div>
              </div>

              {messages.map((m) => {
                const mine = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={mine ? "flex justify-end" : "flex justify-start"}
                  >
                    <div className="max-w-[85%]">
                      <div
                        className={`px-3.5 py-2.5 shadow-sm ${
                          mine
                            ? "rounded-2xl rounded-br-md bg-indigo-600 text-white"
                            : "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {m.text}
                        </p>
                      </div>

                      <div
                        className={`mt-1 flex items-center gap-1.5 px-1 ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <span className="text-[10px] text-slate-400">
                          {formatTime(m.createdAt)}
                        </span>
                        {m.source === "faq" && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                            Instant
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          style={{ animationDelay: `${delay}ms` }}
                          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggested questions — only before the first exchange */}
              {!messages.length && !sending && (
                <div className="pt-2">
                  <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <Sparkles size={11} /> Suggested
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => submit(q)}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-700 transition border border-indigo-100 rounded-full bg-indigo-50 hover:bg-indigo-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ============ DEGRADED / ERROR ============ */}
        {degraded && (
          <div className="flex items-start gap-2 px-4 py-2 border-t border-amber-200 bg-amber-50 shrink-0">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              The AI assistant is temporarily unavailable — your message was
              saved and the team will follow up.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-rose-200 bg-rose-50 shrink-0">
            <AlertTriangle size={13} className="shrink-0 text-rose-600" />
            <p className="flex-1 text-[11px] text-rose-700">{error}</p>
            <button
              onClick={boot}
              className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {/* ============ INPUT ============ */}
        <div className="px-3 py-3 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={booting}
              placeholder="Ask about pricing, a demo, or support…"
              className="flex-1 max-h-28 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
            />

            <button
              onClick={() => submit()}
              disabled={sending || booting || !input.trim()}
              aria-label="Send message"
              className="flex items-center justify-center w-10 h-10 text-white transition shrink-0 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-400">
            AI-generated replies may be inaccurate. Press Enter to send.
          </p>
        </div>
      </div>
    </>
  );
}
