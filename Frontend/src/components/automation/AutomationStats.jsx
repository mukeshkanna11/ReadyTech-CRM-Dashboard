// src/components/automation/AutomationStats.jsx

import React from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
  Zap,
} from "lucide-react";

const STAT_CONFIG = [
  {
    key: "total",
    label: "Total Automations",
    icon: Zap,
    iconClass: "bg-indigo-50 text-indigo-600",
  },
  {
    key: "active",
    label: "Active",
    icon: PlayCircle,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "paused",
    label: "Paused",
    icon: PauseCircle,
    iconClass: "bg-amber-50 text-amber-600",
  },
  {
    key: "executions",
    label: "Executions",
    icon: Activity,
    iconClass: "bg-violet-50 text-violet-600",
  },
];

export default function AutomationStats({ stats = {} }) {
  const normalized = {
    total: stats.total ?? stats.totalAutomations ?? 0,
    active: stats.active ?? stats.activeAutomations ?? 0,
    paused: stats.paused ?? stats.pausedAutomations ?? 0,
    executions: stats.executions ?? stats.totalExecutions ?? 0,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {STAT_CONFIG.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClass}`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </div>

              {stat.key === "executions" && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 size={12} />
                  Live
                </span>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500">
                {stat.label}
              </p>

              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {Number(normalized[stat.key]).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}