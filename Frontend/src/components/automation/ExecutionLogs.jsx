// src/components/automation/ExecutionLogs.jsx

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

const STATUS = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-rose-50 text-rose-700",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "bg-rose-50 text-rose-700",
  },
  running: {
    label: "Running",
    icon: Loader2,
    className: "bg-indigo-50 text-indigo-700",
  },
};

export default function ExecutionLogs({
  logs = [],
  loading = false,
  onRefresh,
  onView,
}) {
  return (
    <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex flex-col gap-3 p-5 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Execution History
          </h3>

          <p className="mt-0.5 text-xs text-slate-500">
            Monitor every automation execution.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-white border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <div className="text-center">
            <Loader2
              size={24}
              className="mx-auto text-indigo-600 animate-spin"
            />

            <p className="mt-3 text-xs font-medium text-slate-500">
              Loading execution logs...
            </p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex min-h-[260px] items-center justify-center px-5">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-400">
              <Clock3 size={20} />
            </div>

            <p className="mt-3 text-sm font-bold text-slate-700">
              No executions yet
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Execution history will appear here once the automation runs.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>

                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trigger
                </th>

                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Started
                </th>

                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Duration
                </th>

                <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {logs.map((log, index) => {
                const status =
                  STATUS[log.status] || STATUS.success;

                const Icon = status.icon;

                return (
                  <tr
                    key={log._id || log.id || index}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${status.className}`}
                      >
                        <Icon
                          size={12}
                          className={
                            log.status === "running"
                              ? "animate-spin"
                              : ""
                          }
                        />

                        {status.label}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-700">
                        {log.trigger ||
                          log.event ||
                          "Automation Trigger"}
                      </p>

                      {log.message && (
                        <p className="mt-1 max-w-xs truncate text-[11px] text-slate-400">
                          {log.message}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {log.startedAt
                        ? new Date(
                            log.startedAt
                          ).toLocaleString()
                        : log.createdAt
                        ? new Date(
                            log.createdAt
                          ).toLocaleString()
                        : "-"}
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-slate-600">
                      {log.duration
                        ? `${log.duration} ms`
                        : "-"}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onView?.(log)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}