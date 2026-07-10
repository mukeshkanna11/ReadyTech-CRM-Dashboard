import { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Copy, Check, RefreshCw, Wand2, AlertTriangle } from "lucide-react";
import API from "../services/api";

const CHANNELS = [
  "WhatsApp Message",
  "SMS",
  "Customer Reply",
  "Payment Reminder",
  "Complaint Response",
  "Follow-up Message",
];

const TONES = ["Professional", "Friendly", "Empathetic", "Concise", "Persuasive"];

const buildPrompt = (channel, ctx, tone) =>
  `You are a CRM customer communication assistant. Write a ${tone.toLowerCase()} "${channel}" for a customer based on this context:
${ctx}

Keep it channel-appropriate (short for SMS/WhatsApp), clear and ready to send. Return only the message text.`;

export default function AICustomerCommunication() {
  const [channel, setChannel] = useState("WhatsApp Message");
  const [ctx, setCtx] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!ctx.trim()) {
      toast.error("Please describe the customer / situation");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);
    try {
      const res = await API.post("/ai/chat", { prompt: buildPrompt(channel, ctx, tone) });
      if (!res.data?.success) throw new Error(res.data?.message || "Request failed");
      setResult(res.data.answer || "");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to generate message.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="min-h-screen p-4 space-y-6 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      <div className="relative overflow-hidden text-white shadow-xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
        <div className="absolute rounded-full -right-24 -top-24 h-72 w-72 bg-indigo-500/20 blur-3xl" />
        <div className="relative flex items-center gap-4 p-6 sm:p-8">
          <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
            <MessageSquare size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">
              <Sparkles size={13} /> AI Tools
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Customer Communication</h1>
            <p className="mt-1 text-sm text-slate-300">
              Generate WhatsApp, SMS, replies, reminders and complaint responses.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="p-6 space-y-5 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-2">
          <Field label="Channel / Type">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={INPUT}>
              {CHANNELS.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>

          <Field label="Customer / Situation">
            <textarea
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              rows={4}
              placeholder="e.g. Remind customer Ravi about pending invoice #INV-1042 of ₹25,000 due in 3 days."
              className={`${INPUT} resize-none`}
            />
          </Field>

          <Field label="Tone">
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                    tone === t
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center justify-center w-full gap-2 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Generating…" : "Generate Message"}
          </button>
        </div>

        <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Generated Message</h3>
            {result && !loading && (
              <div className="flex items-center gap-2">
                <button
                  onClick={generate}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition border rounded-xl text-slate-700 border-slate-200 hover:bg-slate-50"
                >
                  <RefreshCw size={15} /> Regenerate
                </button>
                <button
                  onClick={copy}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition border rounded-xl text-slate-700 border-slate-200 hover:bg-slate-50"
                >
                  {copied ? <><Check size={15} className="text-green-600" /> Copied</> : <><Copy size={15} /> Copy</>}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-3.5 rounded-full bg-slate-100 animate-pulse" style={{ width: `${90 - i * 10}%` }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid mb-3 rounded-2xl h-12 w-12 place-items-center bg-red-50 text-red-500">
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm text-slate-600">{error}</p>
              <button onClick={generate} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Try again
              </button>
            </div>
          ) : result ? (
            <motion.pre
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-700"
            >
              {result}
            </motion.pre>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid mb-3 rounded-2xl h-12 w-12 place-items-center bg-indigo-50 text-indigo-500">
                <MessageSquare size={24} />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">No message generated yet</h4>
              <p className="max-w-xs mt-1 text-xs text-slate-400">
                Pick a channel, describe the situation and tone, then hit Generate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
