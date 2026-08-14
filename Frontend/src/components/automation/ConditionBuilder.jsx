// src/components/automation/ConditionBuilder.jsx

import React from "react";
import {
  ChevronDown,
  GitBranch,
  Plus,
  Trash2,
} from "lucide-react";

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "greater_or_equal", label: "Greater than or equal" },
  { value: "less_or_equal", label: "Less than or equal" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

const FIELDS = [
  "name",
  "email",
  "phone",
  "status",
  "source",
  "owner",
  "amount",
  "priority",
  "company",
  "createdAt",
];

export default function ConditionBuilder({
  conditions = [],
  onChange,
}) {
  const addCondition = () => {
    onChange?.([
      ...conditions,
      {
        id: crypto.randomUUID(),
        field: "",
        operator: "equals",
        value: "",
      },
    ]);
  };

  const updateCondition = (id, key, value) => {
    onChange?.(
      conditions.map((condition) =>
        condition.id === id
          ? {
              ...condition,
              [key]: value,
            }
          : condition
      )
    );
  };

  const removeCondition = (id) => {
    onChange?.(
      conditions.filter((condition) => condition.id !== id)
    );
  };

  return (
    <div className="bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50 text-violet-600">
              <GitBranch size={19} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Conditions
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                Define rules that must be satisfied.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
            IF
          </span>
        </div>
      </div>

      <div className="p-5">
        {conditions.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-xl border-slate-300 bg-slate-50/60">
            <GitBranch
              size={22}
              className="mx-auto text-slate-300"
            />

            <p className="mt-2 text-xs font-semibold text-slate-600">
              No conditions added
            </p>

            <p className="mt-1 text-[11px] text-slate-400">
              This automation will run whenever the trigger occurs.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition, index) => {
              const noValue =
                condition.operator === "is_empty" ||
                condition.operator === "is_not_empty";

              return (
                <React.Fragment key={condition.id}>
                  {index > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-400">
                        AND
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                  )}

                  <div className="p-3 border rounded-xl border-slate-200 bg-slate-50/60">
                    <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
                      {/* Field */}
                      <div className="relative">
                        <select
                          value={condition.field}
                          onChange={(event) =>
                            updateCondition(
                              condition.id,
                              "field",
                              event.target.value
                            )
                          }
                          className="w-full h-10 px-3 pr-8 text-xs font-medium bg-white border rounded-lg outline-none appearance-none border-slate-200 text-slate-700 focus:border-indigo-400"
                        >
                          <option value="">Select field</option>

                          {FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>

                        <ChevronDown
                          size={14}
                          className="absolute -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400"
                        />
                      </div>

                      {/* Operator */}
                      <div className="relative">
                        <select
                          value={condition.operator}
                          onChange={(event) =>
                            updateCondition(
                              condition.id,
                              "operator",
                              event.target.value
                            )
                          }
                          className="w-full h-10 px-3 pr-8 text-xs font-medium bg-white border rounded-lg outline-none appearance-none border-slate-200 text-slate-700 focus:border-indigo-400"
                        >
                          {OPERATORS.map((operator) => (
                            <option
                              key={operator.value}
                              value={operator.value}
                            >
                              {operator.label}
                            </option>
                          ))}
                        </select>

                        <ChevronDown
                          size={14}
                          className="absolute -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400"
                        />
                      </div>

                      {/* Value */}
                      <input
                        value={condition.value || ""}
                        disabled={noValue}
                        onChange={(event) =>
                          updateCondition(
                            condition.id,
                            "value",
                            event.target.value
                          )
                        }
                        placeholder={
                          noValue ? "No value required" : "Enter value..."
                        }
                        className="h-10 px-3 text-xs font-medium bg-white border rounded-lg outline-none border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-400"
                      />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() =>
                          removeCondition(condition.id)
                        }
                        className="flex items-center justify-center h-10 px-3 transition bg-white border rounded-lg border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={addCondition}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
        >
          <Plus size={14} />
          Add Condition
        </button>
      </div>
    </div>
  );
}