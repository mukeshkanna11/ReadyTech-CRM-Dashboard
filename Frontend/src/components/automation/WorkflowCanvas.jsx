// src/components/automation/WorkflowCanvas.jsx

import React from "react";
import {
  ArrowDown,
  GitBranch,
  Send,
  Zap,
} from "lucide-react";

function Connector() {
  return (
    <div className="flex flex-col items-center justify-center h-12">
      <div className="border-l border-dashed h-7 border-slate-300" />
      <ArrowDown size={14} className="text-slate-400" />
    </div>
  );
}

export default function WorkflowCanvas({
  trigger,
  conditions = [],
  actions = [],
}) {
  return (
    <div className="p-5 border rounded-2xl border-slate-200 bg-slate-50/70">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Workflow Preview
          </p>

          <h3 className="mt-1 text-sm font-bold text-slate-900">
            Automation flow
          </h3>
        </div>

        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-500">
          Live Preview
        </span>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Trigger */}
        <div className="p-4 bg-white border border-indigo-100 shadow-sm rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 text-indigo-600 rounded-xl bg-indigo-50">
              <Zap size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                WHEN
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {trigger?.type || "Trigger not configured"}
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {trigger?.module || "Select a module"}
              </p>
            </div>
          </div>
        </div>

        <Connector />

        {/* Conditions */}
        <div className="p-4 bg-white border shadow-sm rounded-2xl border-violet-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50 text-violet-600">
              <GitBranch size={18} />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                IF
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {conditions.length
                  ? `${conditions.length} condition${
                      conditions.length > 1 ? "s" : ""
                    } configured`
                  : "No conditions"}
              </p>
            </div>
          </div>

          {conditions.length > 0 && (
            <div className="mt-3 space-y-2">
              {conditions.map((condition, index) => (
                <div
                  key={condition.id || index}
                  className="px-3 py-2 text-xs rounded-lg bg-slate-50 text-slate-600"
                >
                  <span className="font-semibold">
                    {condition.field || "Field"}
                  </span>{" "}
                  {condition.operator || "equals"}{" "}
                  <span className="font-semibold">
                    {condition.value || "value"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Connector />

        {/* Actions */}
        <div className="p-4 bg-white border shadow-sm rounded-2xl border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600">
              <Send size={18} />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                THEN
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {actions.length
                  ? `${actions.length} action${
                      actions.length > 1 ? "s" : ""
                    } configured`
                  : "No actions"}
              </p>
            </div>
          </div>

          {actions.length > 0 && (
            <div className="mt-3 space-y-2">
              {actions.map((action, index) => (
                <div
                  key={action.id || index}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-50 text-slate-600"
                >
                  {action.type || "Action not configured"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}