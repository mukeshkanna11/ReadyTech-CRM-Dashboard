import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  X,
  Bot,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Layers,
  PackagePlus,
} from "lucide-react";
import {
  INVENTORY_AI_FEATURES,
  getInventoryInsight,
} from "../services/aiService";

/* ======================================================
   ICON MAP (feature registry -> lucide component)
====================================================== */
const ICONS = { BarChart3, AlertTriangle, Layers, PackagePlus };

/* ======================================================
   LIGHTWEIGHT MARKDOWN RENDERER (no external deps)
====================================================== */
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={key} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("*") && part.endsWith("*"))
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 text-[0.8em] font-mono rounded-md bg-slate-100 text-indigo-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    return <span key={key}>{part}</span>;
  });
}

function TableBlock({ rows, keyPrefix }) {
  const cells = (line) =>
    line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const isDivider = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line);

  const header = cells(rows[0]);
  const bodyRows = rows.slice(1).filter((r) => !isDivider(r)).map(cells);

  return (
    <div className="my-3 overflow-x-auto border rounded-xl border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            {header.map((h, i) => (
              <th
                key={`${keyPrefix}-h-${i}`}
                className="px-3 py-2 font-semibold text-left text-slate-600 whitespace-nowrap"
              >
                {renderInline(h, `${keyPrefix}-h-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((r, ri) => (
            <tr key={`${keyPrefix}-r-${ri}`} className="border-t border-slate-100">
              {r.map((c, ci) => (
                <td
                  key={`${keyPrefix}-r-${ri}-${ci}`}
                  className="px-3 py-2 text-slate-700 align-top"
                >
                  {renderInline(c, `${keyPrefix}-r-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Markdown({ text }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let list = null;
  let tableBuf = null;

  const flushList = (key) => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`list-${key}`}
        className={`my-2 space-y-1.5 ${
          list.ordered ? "list-decimal" : "list-disc"
        } pl-5 marker:text-indigo-500`}
      >
        {list.items.map((it, i) => (
          <li key={i} className="text-sm leading-relaxed text-slate-700">
            {renderInline(it, `li-${key}-${i}`)}
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  const flushTable = (key) => {
    if (!tableBuf) return;
    if (tableBuf.length >= 2) {
      blocks.push(<TableBlock key={`tbl-${key}`} rows={tableBuf} keyPrefix={`tbl-${key}`} />);
    } else {
      blocks.push(
        <p key={`p-${key}`} className="my-2 text-sm text-slate-700">
          {renderInline(tableBuf[0], `p-${key}`)}
        </p>
      );
    }
    tableBuf = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");

    // Table rows (contain a pipe)
    if (line.trim().includes("|") && line.trim().length > 1) {
      flushList(idx);
      if (!tableBuf) tableBuf = [];
      tableBuf.push(line.trim());
      return;
    }
    flushTable(idx);

    if (!line.trim()) {
      flushList(idx);
      return;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(line.trim())) {
      flushList(idx);
      blocks.push(<hr key={`hr-${idx}`} className="my-4 border-slate-200" />);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList(idx);
      const level = heading[1].length;
      const sizes = {
        1: "text-lg font-bold mt-4 mb-2",
        2: "text-base font-bold mt-4 mb-2",
        3: "text-sm font-semibold mt-3 mb-1.5 uppercase tracking-wide text-slate-500",
      };
      blocks.push(
        <p key={`h-${idx}`} className={`${sizes[level] || sizes[3]} text-slate-900`}>
          {renderInline(heading[2], `h-${idx}`)}
        </p>
      );
      return;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (!list || !list.ordered) {
        flushList(idx);
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[1]);
      return;
    }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      if (!list || list.ordered) {
        flushList(idx);
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      return;
    }

    flushList(idx);
    blocks.push(
      <p key={`p-${idx}`} className="my-2 text-sm leading-relaxed text-slate-700">
        {renderInline(line, `p-${idx}`)}
      </p>
    );
  });

  flushList("end");
  flushTable("end");
  return <div>{blocks}</div>;
}

/* ======================================================
   LOADING ANIMATION
====================================================== */
function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
        <Sparkles size={16} className="animate-pulse" />
        Analyzing inventory with Claude AI
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-pulse"
            style={{ width: `${90 - i * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ======================================================
   MAIN COMPONENT
====================================================== */
export default function InventoryAIAssistant({ inventory, onClose }) {
  const [activeType, setActiveType] = useState("insights");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const run = useCallback(
    async (type) => {
      if (!Array.isArray(inventory) || inventory.length === 0) {
        setError("No inventory data available to analyze.");
        return;
      }
      setLoading(true);
      setError("");
      setResult(null);
      setCopied(false);
      try {
        const data = await getInventoryInsight(type, inventory);
        if (!data?.success) throw new Error(data?.message || "Request failed");
        setResult(data);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Something went wrong. Please try again."
        );
      } finally {
        setLoading(false);
      }
    },
    [inventory]
  );

  useEffect(() => {
    run(activeType);
  }, [activeType, run]);

  const handleCopy = async () => {
    if (!result?.insight) return;
    try {
      await navigator.clipboard.writeText(result.insight);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  const count = Array.isArray(inventory) ? inventory.length : 0;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.aside
        className="fixed inset-y-0 right-0 z-[61] flex flex-col w-full max-w-full sm:max-w-lg bg-slate-50 shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {/* HEADER */}
        <div className="relative px-6 py-5 overflow-hidden text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
          <Sparkles className="absolute opacity-20 -right-2 -top-2" size={90} />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid p-2.5 rounded-2xl bg-white/15 place-items-center">
                <Bot size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">AI Assistant</h2>
                <p className="text-xs text-white/80">
                  Inventory insights · {count} item{count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 transition rounded-xl hover:bg-white/15"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* FEATURE TABS */}
        <div className="px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {INVENTORY_AI_FEATURES.map((f) => {
              const Icon = ICONS[f.icon] || Sparkles;
              const active = activeType === f.type;
              return (
                <button
                  key={f.type}
                  onClick={() => setActiveType(f.type)}
                  disabled={loading && active}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition border ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  title={f.description}
                >
                  <Icon size={14} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 px-6 py-5 overflow-y-auto">
          {loading && <LoadingState />}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="grid p-4 mb-4 rounded-full bg-red-50 place-items-center">
                <AlertTriangle className="text-red-500" size={28} />
              </div>
              <p className="mb-4 text-sm text-slate-600">{error}</p>
              <button
                onClick={() => run(activeType)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
              >
                <RefreshCw size={16} /> Try again
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <motion.div
              key={result.type}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200"
            >
              <Markdown text={result.insight} />
            </motion.div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-white border-t border-slate-200">
          <span className="text-[11px] text-slate-400 truncate">
            {result?.model ? `Powered by ${result.model}` : "Powered by Claude AI"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!result?.insight || loading}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition border rounded-xl text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-green-600" /> Copied
                </>
              ) : (
                <>
                  <Copy size={16} /> Copy
                </>
              )}
            </button>
            <button
              onClick={() => run(activeType)}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Regenerate
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
