import { useEffect, useRef, useState } from "react";
import { Brain, Mic, MicOff, Send, Square, Volume2, VolumeX } from "lucide-react";

/* ======================================================
   RTS AI ASSISTANT PANEL
   Help/assistance only — never submits enquiries or leads.
   `voice` comes from useRtsVoice (owned by the parent so
   "Hey RTS" keeps working while the panel is closed).
====================================================== */

const SUGGESTIONS = [
  "How do I add a new lead?",
  "Where can I create an invoice?",
  "How do I connect WhatsApp?",
];

export default function RtsAssistantPanel({ messages, busy, onSend, voice }) {
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto bg-slate-50">
        {!messages.length && (
          <div className="p-4 text-sm bg-white border shadow-sm rounded-2xl border-slate-200 text-slate-700">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Brain size={16} className="text-indigo-600" /> Hi, I'm RTS AI
            </p>
            <p className="mt-1 leading-relaxed">
              Ask me how to use Ready Tech CRM &amp; ERP modules. I only give guidance — to reach
              our team, use the <b>brain support</b> icon.
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
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                  : m.error
                  ? "rounded-bl-md border border-rose-200 bg-rose-50 text-rose-700"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-1 px-3 py-3 bg-white border w-fit rounded-2xl border-slate-200">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full animate-bounce bg-indigo-400" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Voice status */}
      {(voice.enabled || voice.error) && (
        <div className="px-4 py-2 text-xs border-t shrink-0 border-slate-200 bg-indigo-50/60">
          {voice.error ? (
            <p className="text-rose-600">{voice.error}</p>
          ) : (
            <p className="truncate text-slate-600">
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${voice.awake ? "bg-emerald-500 animate-pulse" : "bg-indigo-400"}`} />
              {voice.awake ? "Listening… ask your question" : 'Say "Hey RTS" followed by your question'}
              {voice.heard && <span className="ml-1 italic text-slate-500">“{voice.heard}”</span>}
            </p>
          )}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={submit} className="flex items-center gap-2 px-3 py-3 bg-white border-t shrink-0 border-slate-200">
        {voice.supported && (
          <button
            type="button"
            onClick={voice.enabled ? voice.disable : voice.enable}
            title={voice.enabled ? "Turn off voice mode" : 'Turn on voice mode ("Hey RTS")'}
            aria-label={voice.enabled ? "Turn off voice mode" : "Turn on voice mode"}
            aria-pressed={voice.enabled}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
              voice.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {voice.enabled ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
        )}

        {voice.ttsSupported && (
          <button
            type="button"
            onClick={voice.speaking ? voice.stopSpeaking : voice.toggleMute}
            title={voice.speaking ? "Stop speaking" : voice.muted ? "Unmute replies" : "Mute replies"}
            aria-label={voice.speaking ? "Stop speaking" : voice.muted ? "Unmute replies" : "Mute replies"}
            className="flex items-center justify-center w-10 h-10 transition border shrink-0 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            {voice.speaking ? <Square size={14} /> : voice.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about CRM / ERP features…"
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
