import { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkles, Search, Wand2, RefreshCw, AlertTriangle, Copy, Check, Link2, Tag } from "lucide-react";
import API from "../services/api";

const buildPrompt = (title, keyword) =>
  `You are an expert SEO strategist. For a page titled "${title}" targeting the primary keyword "${keyword}", return ONLY valid minified JSON (no markdown, no commentary) with this exact shape:
{"seoScore":<0-100 integer>,"metaTitle":"<=60 chars","metaDescription":"<=160 chars","keywords":["8-10 relevant keywords"],"urlSlug":"kebab-case-slug","faqs":[{"question":"...","answer":"..."}]}
Include 4-5 FAQs.`;

const parseJSON = (text) => {
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    return s >= 0 && e > s ? JSON.parse(text.slice(s, e + 1)) : null;
  } catch {
    return null;
  }
};

export default function AISEOTool() {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState("");

  const generate = async () => {
    if (!title.trim() || !keyword.trim()) {
      toast.error("Enter both a title and a keyword");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await API.post("/ai/chat", { prompt: buildPrompt(title, keyword) });
      if (!res.data?.success) throw new Error(res.data?.message || "Request failed");
      const parsed = parseJSON(res.data.answer || "");
      if (!parsed) throw new Error("Could not parse the AI response. Please try again.");
      setData(parsed);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to generate SEO analysis.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success("Copied");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const score = Math.max(0, Math.min(100, Number(data?.seoScore) || 0));
  const scoreTone = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const scoreBar = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="min-h-screen p-4 space-y-6 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      {/* HEADER */}
      <div className="relative overflow-hidden text-white shadow-xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
        <div className="absolute rounded-full -right-24 -top-24 h-72 w-72 bg-indigo-500/20 blur-3xl" />
        <div className="relative flex items-center gap-4 p-6 sm:p-8">
          <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
            <Search size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">
              <Sparkles size={13} /> AI Tools
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI SEO Tool</h1>
            <p className="mt-1 text-sm text-slate-300">
              Generate meta tags, keywords, slugs and FAQs optimised for search.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* FORM */}
        <div className="p-6 space-y-5 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-2">
          <Field label="Page / Product Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cloud CRM for Small Business" className={INPUT} />
          </Field>
          <Field label="Primary Keyword">
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. small business CRM" className={INPUT} />
          </Field>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center justify-center w-full gap-2 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {loading ? "Analysing…" : "Generate SEO"}
          </button>
        </div>

        {/* RESULT */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="p-6 space-y-3 bg-white border shadow-sm rounded-3xl border-slate-200">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-3.5 rounded-full bg-slate-100 animate-pulse" style={{ width: `${95 - i * 8}%` }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-6 py-20 text-center bg-white border shadow-sm rounded-3xl border-slate-200">
              <div className="grid mb-3 rounded-2xl h-12 w-12 place-items-center bg-red-50 text-red-500"><AlertTriangle size={24} /></div>
              <p className="text-sm text-slate-600">{error}</p>
              <button onClick={generate} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800">Try again</button>
            </div>
          ) : data ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Score */}
              <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">SEO Score</p>
                    <p className={`text-3xl font-bold ${scoreTone}`}>{score}<span className="text-lg text-slate-400">/100</span></p>
                  </div>
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 ${scoreTone}`}><Sparkles size={22} /></div>
                </div>
                <div className="w-full h-2 mt-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${scoreBar}`} style={{ width: `${score}%` }} />
                </div>
              </div>

              <Card title="Meta Title" onCopy={() => copy("title", data.metaTitle)} copied={copied === "title"}>
                <p className="text-sm text-slate-700">{data.metaTitle || "—"}</p>
                {data.metaTitle && <p className="mt-1 text-[11px] text-slate-400">{data.metaTitle.length} characters</p>}
              </Card>

              <Card title="Meta Description" onCopy={() => copy("desc", data.metaDescription)} copied={copied === "desc"}>
                <p className="text-sm leading-relaxed text-slate-700">{data.metaDescription || "—"}</p>
                {data.metaDescription && <p className="mt-1 text-[11px] text-slate-400">{data.metaDescription.length} characters</p>}
              </Card>

              <Card title="Keywords">
                <div className="flex flex-wrap gap-2">
                  {(data.keywords || []).map((k, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      <Tag size={11} /> {k}
                    </span>
                  ))}
                  {!data.keywords?.length && <span className="text-sm text-slate-400">—</span>}
                </div>
              </Card>

              <Card title="URL Slug" onCopy={() => copy("slug", data.urlSlug)} copied={copied === "slug"}>
                <p className="inline-flex items-center gap-1.5 text-sm font-mono text-slate-700">
                  <Link2 size={14} className="text-slate-400" />/{data.urlSlug || "—"}
                </p>
              </Card>

              <Card title="FAQ Suggestions">
                <div className="space-y-3">
                  {(data.faqs || []).map((f, i) => (
                    <div key={i} className="pl-3 border-l-2 border-indigo-200">
                      <p className="text-sm font-medium text-slate-800">{f.question}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{f.answer}</p>
                    </div>
                  ))}
                  {!data.faqs?.length && <span className="text-sm text-slate-400">—</span>}
                </div>
              </Card>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 py-20 text-center bg-white border shadow-sm rounded-3xl border-slate-200">
              <div className="grid mb-3 rounded-2xl h-12 w-12 place-items-center bg-indigo-50 text-indigo-500"><Search size={24} /></div>
              <h4 className="text-sm font-semibold text-slate-700">No analysis yet</h4>
              <p className="max-w-xs mt-1 text-xs text-slate-400">Enter a title and primary keyword, then generate your SEO report.</p>
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

function Card({ title, children, onCopy, copied }) {
  return (
    <div className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-400">{title}</h3>
        {onCopy && (
          <button onClick={onCopy} className="flex items-center gap-1 text-xs font-medium transition text-slate-500 hover:text-indigo-600">
            {copied ? <><Check size={13} className="text-green-600" /> Copied</> : <><Copy size={13} /> Copy</>}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
