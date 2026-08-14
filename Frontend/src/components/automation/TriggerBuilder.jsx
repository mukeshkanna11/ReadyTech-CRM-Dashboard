// src/components/automation/TriggerBuilder.jsx

import React from "react";
import {
  Bell,
  CalendarClock,
  ChevronDown,
  Database,
  FileText,
  Package,
  ShoppingCart,
  Target,
  Users,
  Zap,
} from "lucide-react";

const TRIGGER_TYPES = [
  {
    value: "record_created",
    label: "Record Created",
    description: "Run when a new record is created",
    icon: Database,
  },
  {
    value: "record_updated",
    label: "Record Updated",
    description: "Run when a record changes",
    icon: FileText,
  },
  {
    value: "record_deleted",
    label: "Record Deleted",
    description: "Run when a record is removed",
    icon: FileText,
  },
  {
    value: "status_changed",
    label: "Status Changed",
    description: "Run when status changes",
    icon: Target,
  },
  {
    value: "scheduled",
    label: "Scheduled",
    description: "Run at a specific time",
    icon: CalendarClock,
  },
  {
    value: "low_stock",
    label: "Low Stock",
    description: "Run when stock falls below threshold",
    icon: Package,
  },
  {
    value: "invoice_overdue",
    label: "Invoice Overdue",
    description: "Run when an invoice becomes overdue",
    icon: FileText,
  },
  {
    value: "task_due",
    label: "Task Due",
    description: "Run when a task reaches its due date",
    icon: Bell,
  },
];

const MODULES = [
  { value: "leads", label: "Leads", icon: Users },
  { value: "contacts", label: "Contacts", icon: Users },
  { value: "clients", label: "Clients", icon: Users },
  { value: "opportunities", label: "Opportunities", icon: Target },
  { value: "tasks", label: "Tasks", icon: Target },
  { value: "invoices", label: "Invoices", icon: FileText },
  { value: "products", label: "Products", icon: Package },
  { value: "sales_orders", label: "Sales Orders", icon: ShoppingCart },
];

export default function TriggerBuilder({
  value = {},
  onChange,
}) {
  const update = (key, newValue) => {
    onChange?.({
      ...value,
      [key]: newValue,
    });
  };

  return (
    <div className="bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 text-indigo-600 rounded-xl bg-indigo-50">
            <Zap size={19} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Trigger
            </h3>

            <p className="mt-0.5 text-xs text-slate-500">
              Choose when this automation should start.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Module */}
        <div>
          <label className="block mb-2 text-xs font-bold text-slate-700">
            Module
          </label>

          <div className="relative">
            <select
              value={value.module || ""}
              onChange={(event) =>
                update("module", event.target.value)
              }
              className="w-full px-4 pr-10 text-sm font-medium transition border outline-none appearance-none h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-700 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
            >
              <option value="">Select module</option>

              {MODULES.map((module) => (
                <option key={module.value} value={module.value}>
                  {module.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={16}
              className="absolute -translate-y-1/2 pointer-events-none right-4 top-1/2 text-slate-400"
            />
          </div>
        </div>

        {/* Trigger Type */}
        <div>
          <label className="block mb-3 text-xs font-bold text-slate-700">
            Trigger Event
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TRIGGER_TYPES.map((trigger) => {
              const Icon = trigger.icon;
              const selected = value.type === trigger.value;

              return (
                <button
                  type="button"
                  key={trigger.value}
                  onClick={() => update("type", trigger.value)}
                  className={`group flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100"
                      : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      selected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {trigger.label}
                    </p>

                    <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                      {trigger.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule */}
        {value.type === "scheduled" && (
          <div className="grid grid-cols-1 gap-4 p-4 border border-indigo-100 rounded-xl bg-indigo-50/50 sm:grid-cols-2">
            <div>
              <label className="block mb-2 text-xs font-bold text-slate-700">
                Frequency
              </label>

              <select
                value={value.frequency || "daily"}
                onChange={(event) =>
                  update("frequency", event.target.value)
                }
                className="w-full h-10 px-3 text-xs font-medium bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-xs font-bold text-slate-700">
                Time
              </label>

              <input
                type="time"
                value={value.time || "09:00"}
                onChange={(event) =>
                  update("time", event.target.value)
                }
                className="w-full h-10 px-3 text-xs font-medium bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}