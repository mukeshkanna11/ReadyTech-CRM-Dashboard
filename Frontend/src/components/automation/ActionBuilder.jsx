// src/components/automation/ActionBuilder.jsx

import React from "react";
import {
  Bell,
  CalendarPlus,
  ChevronDown,
  ClipboardList,
  FileText,
  Mail,
  MessageSquare,
  Package,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Webhook,
  Zap,
} from "lucide-react";

const ACTION_TYPES = [
  {
    value: "send_email",
    label: "Send Email",
    description: "Send an email automatically",
    icon: Mail,
  },
  {
    value: "create_task",
    label: "Create Task",
    description: "Create a follow-up task",
    icon: ClipboardList,
  },
  {
    value: "assign_owner",
    label: "Assign Owner",
    description: "Assign record to a user",
    icon: UserPlus,
  },
  {
    value: "update_record",
    label: "Update Record",
    description: "Update CRM/ERP fields",
    icon: FileText,
  },
  {
    value: "send_notification",
    label: "Send Notification",
    description: "Notify your team",
    icon: Bell,
  },
  {
    value: "create_activity",
    label: "Create Activity",
    description: "Create CRM activity",
    icon: CalendarPlus,
  },
  {
    value: "send_whatsapp",
    label: "Send WhatsApp",
    description: "Send WhatsApp message",
    icon: MessageSquare,
  },
  {
    value: "reserve_stock",
    label: "Reserve Stock",
    description: "Reserve inventory quantity",
    icon: Package,
  },
  {
    value: "webhook",
    label: "Call Webhook",
    description: "Send data to external service",
    icon: Webhook,
  },
];

export default function ActionBuilder({
  actions = [],
  onChange,
}) {
  const addAction = () => {
    onChange?.([
      ...actions,
      {
        id: crypto.randomUUID(),
        type: "",
        config: {},
      },
    ]);
  };

  const updateAction = (id, key, value) => {
    onChange?.(
      actions.map((action) =>
        action.id === id
          ? {
              ...action,
              [key]: value,
            }
          : action
      )
    );
  };

  const updateConfig = (id, key, value) => {
    onChange?.(
      actions.map((action) =>
        action.id === id
          ? {
              ...action,
              config: {
                ...(action.config || {}),
                [key]: value,
              },
            }
          : action
      )
    );
  };

  const removeAction = (id) => {
    onChange?.(
      actions.filter((action) => action.id !== id)
    );
  };

  const renderConfig = (action) => {
    const type = action.type;

    if (type === "send_email") {
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={action.config?.to || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "to",
                event.target.value
              )
            }
            placeholder="Recipient / {{lead.email}}"
            className="h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />

          <input
            value={action.config?.subject || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "subject",
                event.target.value
              )
            }
            placeholder="Email subject"
            className="h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />

          <textarea
            value={action.config?.body || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "body",
                event.target.value
              )
            }
            placeholder="Email message..."
            rows={3}
            className="p-3 text-xs bg-white border rounded-lg outline-none md:col-span-2 border-slate-200 focus:border-indigo-400"
          />
        </div>
      );
    }

    if (type === "create_task") {
      return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={action.config?.title || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "title",
                event.target.value
              )
            }
            placeholder="Task title"
            className="h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />

          <select
            value={action.config?.priority || "medium"}
            onChange={(event) =>
              updateConfig(
                action.id,
                "priority",
                event.target.value
              )
            }
            className="h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>

          <input
            value={action.config?.dueIn || "1"}
            onChange={(event) =>
              updateConfig(
                action.id,
                "dueIn",
                event.target.value
              )
            }
            type="number"
            min="0"
            placeholder="Due in days"
            className="h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />
        </div>
      );
    }

    if (type === "assign_owner") {
      return (
        <select
          value={action.config?.owner || ""}
          onChange={(event) =>
            updateConfig(
              action.id,
              "owner",
              event.target.value
            )
          }
          className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
        >
          <option value="">Select owner</option>
          <option value="record_owner">Record Owner</option>
          <option value="sales_manager">Sales Manager</option>
          <option value="support_manager">Support Manager</option>
        </select>
      );
    }

    if (type === "send_notification") {
      return (
        <input
          value={action.config?.message || ""}
          onChange={(event) =>
            updateConfig(
              action.id,
              "message",
              event.target.value
            )
          }
          placeholder="Notification message..."
          className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
        />
      );
    }

    if (type === "send_whatsapp") {
      return (
        <div className="space-y-3">
          <input
            value={action.config?.to || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "to",
                event.target.value
              )
            }
            placeholder="Phone / {{lead.phone}}"
            className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />

          <textarea
            value={action.config?.message || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "message",
                event.target.value
              )
            }
            placeholder="WhatsApp message..."
            rows={3}
            className="w-full p-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />
        </div>
      );
    }

    if (type === "webhook") {
      return (
        <div className="space-y-3">
          <input
            value={action.config?.url || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "url",
                event.target.value
              )
            }
            placeholder="https://example.com/webhook"
            className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />

          <textarea
            value={action.config?.payload || ""}
            onChange={(event) =>
              updateConfig(
                action.id,
                "payload",
                event.target.value
              )
            }
            placeholder='{"leadId":"{{lead._id}}"}'
            rows={4}
            className="w-full p-3 font-mono text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
          />
        </div>
      );
    }

    if (type === "update_record") {
      return (
        <textarea
          value={action.config?.updates || ""}
          onChange={(event) =>
            updateConfig(
              action.id,
              "updates",
              event.target.value
            )
          }
          placeholder='status = "qualified"'
          rows={3}
          className="w-full p-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
        />
      );
    }

    if (type === "create_activity") {
      return (
        <input
          value={action.config?.title || ""}
          onChange={(event) =>
            updateConfig(
              action.id,
              "title",
              event.target.value
            )
          }
          placeholder="Activity title"
          className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
        />
      );
    }

    if (type === "reserve_stock") {
      return (
        <input
          value={action.config?.quantity || ""}
          onChange={(event) =>
            updateConfig(
              action.id,
              "quantity",
              event.target.value
            )
          }
          type="number"
          min="1"
          placeholder="Quantity to reserve"
          className="w-full h-10 px-3 text-xs bg-white border rounded-lg outline-none border-slate-200 focus:border-indigo-400"
        />
      );
    }

    return null;
  };

  return (
    <div className="bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600">
              <Send size={18} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Actions
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                Define what happens after conditions pass.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
            THEN
          </span>
        </div>
      </div>

      <div className="p-5">
        {actions.length === 0 ? (
          <div className="p-6 text-center border border-dashed rounded-xl border-slate-300 bg-slate-50/60">
            <Send
              size={22}
              className="mx-auto text-slate-300"
            />

            <p className="mt-2 text-xs font-semibold text-slate-600">
              No actions added
            </p>

            <p className="mt-1 text-[11px] text-slate-400">
              Add at least one action for this automation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((action, index) => (
              <React.Fragment key={action.id}>
                {index > 0 && (
                  <div className="flex justify-center">
                    <div className="h-5 border-l border-dashed border-slate-300" />
                  </div>
                )}

                <div className="p-4 border rounded-xl border-slate-200 bg-slate-50/60">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-emerald-100 text-emerald-600">
                      <Zap size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                          <select
                            value={action.type}
                            onChange={(event) =>
                              updateAction(
                                action.id,
                                "type",
                                event.target.value
                              )
                            }
                            className="w-full h-10 px-3 text-xs font-semibold bg-white border rounded-lg outline-none appearance-none border-slate-200 pr-9 text-slate-700 focus:border-indigo-400"
                          >
                            <option value="">
                              Select action
                            </option>

                            {ACTION_TYPES.map((item) => (
                              <option
                                key={item.value}
                                value={item.value}
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>

                          <ChevronDown
                            size={14}
                            className="absolute -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeAction(action.id)
                          }
                          className="flex items-center justify-center w-10 h-10 bg-white border rounded-lg shrink-0 border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {action.type && (
                        <div className="p-3 mt-3 bg-white border rounded-lg border-slate-100">
                          {renderConfig(action)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addAction}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-xs font-bold text-emerald-600 transition hover:bg-emerald-50"
        >
          <Plus size={14} />
          Add Action
        </button>
      </div>
    </div>
  );
}