// src/components/automation/AutomationHeader.jsx

import React from "react";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Save,
  Sparkles,
  Play,
} from "lucide-react";

export default function AutomationHeader({
  title = "Automations",
  subtitle = "Build and manage intelligent CRM & ERP workflows",
  showBack = false,
  onBack,
  onCreate,
  onSave,
  onTest,
  saving = false,
  testing = false,
  breadcrumb = [],
}) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-[1600px] px-5 py-5 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto text-xs font-medium text-slate-400">
            {breadcrumb.map((item, index) => (
              <React.Fragment key={`${item}-${index}`}>
                {index > 0 && <ChevronRight size={13} />}

                <span
                  className={
                    index === breadcrumb.length - 1
                      ? "whitespace-nowrap text-slate-600"
                      : "whitespace-nowrap"
                  }
                >
                  {item}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center mt-1 transition bg-white border h-9 w-9 shrink-0 rounded-xl border-slate-200 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              >
                <ArrowLeft size={17} />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {title}
                </h1>

                <span className="hidden items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 sm:inline-flex">
                  <Sparkles size={10} />
                  Smart
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onTest && (
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={15} />
                {testing ? "Testing..." : "Test"}
              </button>
            )}

            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? "Saving..." : "Save Draft"}
              </button>
            )}

            {onCreate && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700"
              >
                <Plus size={16} />
                Create Automation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}