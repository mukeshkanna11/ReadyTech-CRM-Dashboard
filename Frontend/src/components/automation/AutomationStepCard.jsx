// src/components/automation/AutomationStepCard.jsx

import React from "react";
import {
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Send,
  Zap,
} from "lucide-react";

const ICONS = {
  trigger: Zap,
  condition: GitBranch,
  action: Send,
};

const COLORS = {
  trigger: "bg-indigo-50 text-indigo-600 border-indigo-100",
  condition: "bg-violet-50 text-violet-600 border-violet-100",
  action: "bg-emerald-50 text-emerald-600 border-emerald-100",
};

export default function AutomationStepCard({
  type = "action",
  title,
  description,
  status = "completed",
  children,
  collapsed = false,
  onToggle,
}) {
  const Icon = ICONS[type] || Send;
  const color = COLORS[type] || COLORS.action;

  return (
    <div className="relative">
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-center gap-3 p-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${color}`}
          >
            <Icon size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate text-slate-900">
                {title}
              </h3>

              {status === "completed" && (
                <CheckCircle2
                  size={14}
                  className="shrink-0 text-emerald-500"
                />
              )}
            </div>

            {description && (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>

          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <ChevronDown
                size={16}
                className={`transition ${
                  collapsed ? "-rotate-90" : ""
                }`}
              />
            </button>
          )}
        </div>

        {!collapsed && children && (
          <div className="p-4 border-t border-slate-100">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}