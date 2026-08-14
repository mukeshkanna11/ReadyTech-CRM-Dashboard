// src/components/automation/AutomationFilters.jsx

import React from "react";
import {
  Filter,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

export default function AutomationFilters({
  search = "",
  setSearch,
  status = "all",
  setStatus,
  module = "all",
  setModule,
  view = "grid",
  setView,
  modules = [],
}) {
  const hasFilters =
    search || status !== "all" || module !== "all";

  const clearFilters = () => {
    setSearch?.("");
    setStatus?.("all");
    setModule?.("all");
  };

  return (
    <div className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) => setSearch?.(event.target.value)}
            placeholder="Search automations..."
            className="w-full h-10 pl-10 pr-4 text-sm transition border outline-none rounded-xl border-slate-200 bg-slate-50 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <Filter
            size={14}
            className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400"
          />

          <select
            value={status}
            onChange={(event) => setStatus?.(event.target.value)}
            className="h-10 min-w-[145px] appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Module */}
        <div className="relative">
          <SlidersHorizontal
            size={14}
            className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400"
          />

          <select
            value={module}
            onChange={(event) => setModule?.(event.target.value)}
            className="h-10 min-w-[150px] appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          >
            <option value="all">All Modules</option>

            {modules.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} />
            Clear
          </button>
        )}

        {/* View */}
        <div className="flex items-center h-10 p-1 border rounded-xl border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setView?.("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              view === "grid"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid size={15} />
          </button>

          <button
            type="button"
            onClick={() => setView?.("list")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              view === "list"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}