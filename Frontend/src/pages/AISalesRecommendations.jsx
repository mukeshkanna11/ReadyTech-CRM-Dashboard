import { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Copy, Check, RefreshCw, Wand2, AlertTriangle } from "lucide-react";
import API from "../services/api";

const REC_TYPES = [
  "Upsell Suggestions",
  "Cross-sell Suggestions",
  "Next Best Product",
  "Revenue Opportunity Prediction",
  "Sales Insights",
];

const buildPrompt = (type, ctx) =>
  `You are an AI sales strategist for a CRM. Based on the following customer and product data, generate "${type}".
${ctx}

Provide clear, actionable recommendations with brief reasoning and, where relevant, an estimated revenue impact. Use concise bullet points.`;

export default function AISalesRecommendations() {
  const [type, setType] = useState("Upsell Suggestions");
  const [ctx, setCtx] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!ctx.trim()) {
      toast.error("Please add customer / product data");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");
    setCopied(false);
    try {
      const res = await API.post("/ai/chat", { prompt: buildPrompt(type, ctx) });
      if (!res.data?.success) throw new Error(res.data?.message || "Request failed");
      setResult(res.data.answer || "");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to generate recommendations.");
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
            <TrendingUp size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">
              <Sparkles size={13} /> AI Tools
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Sales Recommendations</h1>
            <p className="mt-1 text-sm text-slate-300">
              Upsell, cross-sell and revenue opportunities from your CRM data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="p-6 space-y-5 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-2">
          <Field label="Recommendation Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
              {REC_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>

          <Field label="Customer / Product Data">
            <textarea
              value={ctx}
              onChange={(e) => setCtx(e.target.value)}
              rows={6}
              placeholder="e.g. Customer: Acme Corp, plan: Basic CRM, 40 users, 8 months active. Recently bought Invoicing add-on. Products available: ERP, Analytics, Support Plus."
              className={`${INPUT} resize-none`}
            />
          </Field>

          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center justify-center w-full gap-2 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Analysing…" : "Generate Recommendations"}
          </button>
        </div>

        <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Recommendations</h3>
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
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-3.5 rounded-full bg-slate-100 animate-pulse" style={{ width: `${95 - i * 8}%` }} />
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
                <TrendingUp size={24} />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">No recommendations yet</h4>
              <p className="max-w-xs mt-1 text-xs text-slate-400">
                Pick a type, paste customer/product data, then hit Generate.
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
