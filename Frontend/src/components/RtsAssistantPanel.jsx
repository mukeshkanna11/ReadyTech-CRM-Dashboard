import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Brain, Mic, RotateCcw, Send, Square, Volume2, VolumeX, X } from "lucide-react";

import { VOICE_LANGS } from "../hooks/useRtsVoice";

/* ======================================================
   RTS AI ASSISTANT PANEL
   Help, navigation and read-only live figures — never submits
   enquiries or leads. `voice` comes from useRtsVoice (owned by
   the widget so "Hey RTS" keeps working while the panel is closed).
====================================================== */

const SUGGESTIONS = [
  "Today's sales?",
  "Find overdue payments",
  "Which products are low on stock?",
  "Go to invoices",
  "Explain this page",
];

/* Animated voice waveform (state indicator, not a live mic level meter) */
export function RtsWave({ state = "idle", light = false }) {
  const active = state !== "idle" && state !== "error";
  const speed = state === "listening" ? 0.9 : state === "speaking" ? 0.6 : 1.4;
  return (
    <span className="inline-flex items-center gap-[3px] h-5" aria-hidden="true">
      <style>{"@keyframes rtsWave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}"}</style>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[3px] h-full rounded-full ${light ? "bg-white" : "bg-gradient-to-t from-fuchsia-500 to-indigo-500"}`}
          style={{
            transform: "scaleY(.3)",
            animation: active ? `rtsWave ${speed}s ease-in-out ${i * 0.12}s infinite` : "none",
            opacity: state === "thinking" ? 0.7 : 1,
          }}
        />
      ))}
    </span>
  );
}

const METRIC_LABELS = {
  leads: "Leads", opportunities: "Opportunities", clients: "Clients", activities: "Activities",
  sales_orders: "Sales Orders", purchase_orders: "Purchase Orders", invoices: "Invoices",
  payments: "Payments", revenue: "Revenue", inventory: "Inventory", employees: "Employees",
  attendance: "Attendance", leaves: "Leave Requests", expenses: "Expense Claims",
};
const ENTITY_LABELS = {
  invoice: "Invoices", client: "Clients", lead: "Leads", sales_order: "Sales Orders",
  product: "Products", vendor: "Vendors", warehouse: "Warehouses", employee: "Employees",
};

const human = (key) => key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
const fmt = (v) => {
  if (typeof v === "number") return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString();
  return v == null || v === "" ? "—" : String(v);
};

function RecordsCard({ card }) {
  const records = Array.isArray(card.records) ? card.records : [];
  return (
    <div className="mt-2 overflow-hidden text-xs bg-white border rounded-xl border-indigo-100">
      <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 text-indigo-800">
        <span className="font-semibold">{ENTITY_LABELS[card.entity] || human(card.entity || "Records")}</span>
        <span className="text-indigo-500 truncate">
          {[card.query && `“${card.query}”`, card.status].filter(Boolean).join(" · ") || "latest"} · {card.count}
        </span>
      </div>
      {!records.length ? (
        <p className="px-3 py-2 text-slate-500">No matching records found.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {records.map((r, i) => (
            <li key={i} className="px-3 py-2">
              {Object.entries(r).filter(([, v]) => v !== "" && v != null).map(([k, v]) => (
                <span key={k} className="mr-3 inline-block">
                  <span className="text-slate-400">{human(k)}: </span>
                  <span className="font-medium text-slate-700">{fmt(v)}</span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DataCard({ card }) {
  if (card.type === "records") return <RecordsCard card={card} />;
  const summary = Object.entries(card.summary || {});
  const isEmpty = summary.length > 0 && summary.every(([, v]) => !v);
  const breakdowns = Object.entries(card.breakdown || {}).filter(([, b]) => b && Object.keys(b).length);
  const records = Array.isArray(card.records) ? card.records : [];

  return (
    <div className="mt-2 overflow-hidden text-xs bg-white border rounded-xl border-indigo-100">
      <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 text-indigo-800">
        <span className="font-semibold">{METRIC_LABELS[card.metric] || human(card.metric || "Data")}</span>
        <span className="text-indigo-500">{human(card.period || "")}</span>
      </div>
      {isEmpty ? (
        <p className="px-3 py-2 text-slate-500">No records found for this period.</p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-slate-100">
          {summary.map(([k, v]) => (
            <div key={k} className="px-3 py-1.5 bg-white">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{human(k)}</p>
              <p className="font-semibold text-slate-800">{fmt(v)}</p>
            </div>
          ))}
        </div>
      )}
      {breakdowns.map(([k, b]) => (
        <div key={k} className="px-3 py-1.5 border-t border-slate-100">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{human(k)}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(b).map(([name, count]) => (
              <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                {name}: {fmt(count)}
              </span>
            ))}
          </div>
        </div>
      ))}
      {records.length > 0 && (
        <ul className="border-t divide-y border-slate-100 divide-slate-100">
          {records.slice(0, 8).map((r, i) => (
            <li key={i} className="px-3 py-1.5 truncate text-slate-600">
              {Object.values(r).map(fmt).join(" · ")}
            </li>
          ))}
        </ul>
      )}
      {card.note && <p className="px-3 py-1.5 border-t border-slate-100 text-[10px] text-slate-400">{card.note}</p>}
    </div>
  );
}

export default function RtsAssistantPanel({ messages, busy, state = "idle", onSend, onRetry, onCancel, onNavigate, voice }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const submit = (e) => {
    e?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    onSend(value);
  };

  const last = messages[messages.length - 1];
  const langIdx = VOICE_LANGS.findIndex((l) => l.code === voice.lang);
  const nextLang = VOICE_LANGS[(langIdx + 1) % VOICE_LANGS.length];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-slate-50" aria-live="polite">
        {!messages.length && (
          <div className="p-4 text-sm bg-white border shadow-sm rounded-2xl border-slate-200 text-slate-700">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Brain size={16} className="text-indigo-600" /> Hi, I'm RTS AI
            </p>
            <p className="mt-1 leading-relaxed">
              Ask about your live CRM &amp; ERP figures, open any page, or learn how a feature works — in
              English, தமிழ் or Tanglish. I only read data; I never change it. To reach our team, use the{" "}
              <b>brain support</b> icon.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s)}
                  disabled={busy}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] ${m.role === "user" ? "" : "w-full sm:w-auto"}`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                    : m.error
                    ? "rounded-bl-md border border-rose-200 bg-rose-50 text-rose-700"
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {m.text}
              </div>
              {m.cards?.map((c, j) => <DataCard key={j} card={c} />)}
              {m.actions?.map((a) => (
                <button
                  key={a.path}
                  type="button"
                  onClick={() => onNavigate(a.path, a.label)}
                  className="mt-2 mr-2 inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                >
                  <ArrowUpRight size={12} /> {a.label}
                </button>
              ))}
              {m.error && m === last && (
                <button type="button" onClick={onRetry} disabled={busy} className="inline-flex items-center gap-1 mt-2 text-xs text-rose-600 hover:underline">
                  <RotateCcw size={12} /> Retry
                </button>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs bg-white border w-fit rounded-2xl border-slate-200 text-slate-500">
            <RtsWave state="thinking" /> Thinking — reading your workspace data…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Voice bar */}
      {(voice.supported || voice.ttsSupported || voice.error) && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs border-t shrink-0 border-slate-200 bg-indigo-50/60">
          {voice.supported && (
            <button
              type="button"
              onClick={voice.enabled ? voice.disable : voice.enable}
              title={voice.enabled ? 'Turn off "Hey RTS"' : 'Turn on "Hey RTS" (always listening while this tab is open)'}
              aria-pressed={voice.enabled}
              className={`shrink-0 rounded-lg border px-2 py-1 font-medium transition ${
                voice.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              Hey RTS {voice.enabled ? "on" : "off"}
            </button>
          )}
          {voice.supported && (
            <button
              type="button"
              onClick={() => voice.setLang(nextLang.code)}
              title={`Voice language: ${VOICE_LANGS[langIdx]?.name || voice.lang} (switch to ${nextLang.name})`}
              aria-label={`Voice language ${VOICE_LANGS[langIdx]?.name || voice.lang}`}
              className="px-2 py-1 font-medium bg-white border rounded-lg shrink-0 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {VOICE_LANGS[langIdx]?.label || voice.lang}
            </button>
          )}
          {voice.ttsSupported && (
            <button
              type="button"
              onClick={voice.speaking ? voice.stopSpeaking : voice.toggleMute}
              title={voice.speaking ? "Stop speaking" : voice.muted ? "Unmute replies" : "Mute replies"}
              aria-label={voice.speaking ? "Stop speaking" : voice.muted ? "Unmute replies" : "Mute replies"}
              className="flex items-center justify-center bg-white border rounded-lg shrink-0 h-7 w-7 border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              {voice.speaking ? <Square size={12} /> : voice.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}
          {state !== "idle" && state !== "executing" && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel"
              aria-label="Cancel"
              className="flex items-center justify-center bg-white border rounded-lg shrink-0 h-7 w-7 border-rose-200 text-rose-500 hover:bg-rose-50"
            >
              <X size={14} />
            </button>
          )}
          <p className={`min-w-0 flex-1 truncate ${voice.error ? "text-rose-600" : "text-slate-600"}`} title={voice.error || voice.heard}>
            {state !== "idle" && !voice.error && <span className="mr-1.5 inline-block align-middle"><RtsWave state={state} /></span>}
            {voice.error ||
              (voice.phase === "command"
                ? "Listening for command… speak now"
                : voice.phase === "detected"
                ? "Wake word detected"
                : voice.phase === "wake"
                ? 'Wake listening — say "Hey RTS, go to invoices"'
                : voice.supported
                ? 'Tap the mic to talk, or turn "Hey RTS" on'
                : "Voice input needs Chrome or Edge — typing works everywhere")}
            {!voice.error && voice.heard && voice.listening && (
              <span className="ml-1 italic text-slate-500">“{voice.heard}”</span>
            )}
          </p>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={submit} className="flex items-center gap-2 px-3 py-3 bg-white border-t shrink-0 border-slate-200">
        {voice.supported && (
          <button
            type="button"
            onClick={voice.listenNow}
            title={voice.phase === "command" ? "Stop listening" : "Speak a command now"}
            aria-label={voice.phase === "command" ? "Stop listening" : "Speak a command now"}
            aria-pressed={voice.phase === "command"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              voice.phase === "command" ? "animate-pulse border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Mic size={16} />
          </button>
        )}

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about data, pages or features…"
          aria-label="Ask RTS AI"
          maxLength={2000}
          className="flex-1 min-w-0 px-3 py-2.5 text-sm border outline-none rounded-xl border-slate-200 focus:border-indigo-400"
        />

        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send"
          className="flex items-center justify-center w-10 h-10 text-white shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
