// src/components/automation/AutomationCard.jsx

import React, { useState } from "react";
import {
  Activity,
  Clock3,
  Copy,
  Edit3,
  MoreHorizontal,
  Pause,
  Play,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";

export default function AutomationCard({
  automation,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
  onView,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive =
    automation?.status === "active" ||
    automation?.isActive === true;

  const trigger =
    automation?.trigger?.name ||
    automation?.trigger?.event ||
    automation?.trigger ||
    "No trigger configured";

  const conditions = Array.isArray(automation?.conditions)
    ? automation.conditions.length
    : 0;

  const actions = Array.isArray(automation?.actions)
    ? automation.actions.length
    : 0;

  const executions =
    automation?.executionCount ??
    automation?.executions ??
    automation?.stats?.executions ??
    0;

  return (
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-200/60"
      onClick={() => onView?.(automation)}
    >
      <div
        className={`h-1 w-full ${
          isActive
            ? "bg-gradient-to-r from-emerald-400 via-indigo-500 to-violet-500"
            : "bg-slate-200"
        }`}
      />

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center min-w-0 gap-3">
            <div className="flex items-center justify-center text-indigo-600 h-11 w-11 shrink-0 rounded-xl bg-indigo-50">
              <Zap size={20} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate text-slate-900">
                {automation?.name || "Untitled Automation"}
              </h3>

              <p className="mt-0.5 truncate text-xs text-slate-400">
                {automation?.module || "CRM"}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((value) => !value);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal size={17} />
            </button>

            {menuOpen && (
              <div
                onClick={(event) => event.stopPropagation()}
                className="absolute right-0 z-30 p-1 overflow-hidden bg-white border shadow-xl top-9 w-44 rounded-xl border-slate-200"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit?.(automation);
                  }}
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  <Edit3 size={14} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate?.(automation);
                  }}
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  <Copy size={14} />
                  Duplicate
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggle?.(automation);
                  }}
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  {isActive ? <Pause size={14} /> : <Play size={14} />}
                  {isActive ? "Pause" : "Activate"}
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete?.(automation);
                  }}
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />

            {isActive ? "Active" : "Paused"}
          </span>
        </div>

        <div className="p-3 mt-4 border rounded-xl border-slate-100 bg-slate-50/70">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Trigger
          </p>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center justify-center text-indigo-600 bg-white rounded-lg shadow-sm h-7 w-7">
              <Zap size={13} />
            </div>

            <span className="text-xs font-semibold truncate text-slate-700">
              {trigger}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 mt-4 bg-white border divide-x divide-slate-100 rounded-xl border-slate-100">
          <div className="p-3 text-center">
            <p className="text-[10px] font-medium text-slate-400">Conditions</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {conditions}
            </p>
          </div>

          <div className="p-3 text-center">
            <p className="text-[10px] font-medium text-slate-400">Actions</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{actions}</p>
          </div>

          <div className="p-3 text-center">
            <p className="text-[10px] font-medium text-slate-400">
              Executions
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {Number(executions).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-100">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock3 size={12} />
            {automation?.updatedAt
              ? new Date(automation.updatedAt).toLocaleDateString()
              : "Not updated"}
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.(automation);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <Settings2 size={13} />
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}