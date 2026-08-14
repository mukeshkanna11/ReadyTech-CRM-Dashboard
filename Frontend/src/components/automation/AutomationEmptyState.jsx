// src/components/automation/AutomationEmptyState.jsx

import React from "react";
import {
  ArrowRight,
  Bot,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";

export default function AutomationEmptyState({
  onCreate,
  onTemplates,
}) {
  return (
    <div className="relative px-6 overflow-hidden text-center bg-white border border-dashed rounded-2xl border-slate-300 py-14">
      <div className="absolute top-0 w-48 h-48 -translate-x-1/2 rounded-full pointer-events-none left-1/2 bg-indigo-100/40 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-center w-16 h-16 mx-auto text-indigo-600 shadow-sm rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50">
          <Bot size={28} strokeWidth={1.6} />
        </div>

        <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
          <Sparkles size={11} />
          Smart Workflow Automation
        </div>

        <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
          Automate your repetitive work
        </h3>

        <p className="max-w-lg mx-auto mt-2 text-sm leading-6 text-slate-500">
          Connect CRM and ERP events with conditions and actions.
          Let your team focus on important work while your system
          handles repetitive processes automatically.
        </p>

        <div className="flex flex-col justify-center gap-2 mt-6 sm:flex-row">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
          >
            <Plus size={15} />
            Create Automation
          </button>

          <button
            type="button"
            onClick={onTemplates}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Zap size={15} />
            Browse Templates
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}