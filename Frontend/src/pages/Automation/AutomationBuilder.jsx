import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileText,
  GitBranch,
  Mail,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";

import {
  createAutomation,
  getAutomation,
  updateAutomation,
} from "../../services/automationService";

const MODULES = [
  "Lead",
  "Contact",
  "Client",
  "Opportunity",
  "Activity",
  "Quotation",
  "SalesOrder",
  "Invoice",
  "Payment",
  "Product",
  "Inventory",
  "Warehouse",
  "Vendor",
  "PurchaseOrder",
  "Expense",
  "Employee",
  "Payroll",
];

const EVENTS = [
  {
    value: "created",
    label: "Record Created",
    description: "Run when a new record is created",
  },
  {
    value: "updated",
    label: "Record Updated",
    description: "Run when an existing record is updated",
  },
  {
    value: "deleted",
    label: "Record Deleted",
    description: "Run when a record is deleted",
  },
  {
    value: "statusChanged",
    label: "Status Changed",
    description: "Run when record status changes",
  },
  {
    value: "stageChanged",
    label: "Stage Changed",
    description: "Run when pipeline stage changes",
  },
  {
    value: "fieldChanged",
    label: "Field Changed",
    description: "Run when a specific field changes",
  },
];

const OPERATORS = [
  ["equals", "Equals"],
  ["notEquals", "Does not equal"],
  ["contains", "Contains"],
  ["notContains", "Does not contain"],
  ["greaterThan", "Greater than"],
  ["greaterThanOrEqual", "Greater than or equal"],
  ["lessThan", "Less than"],
  ["lessThanOrEqual", "Less than or equal"],
  ["exists", "Exists"],
  ["notExists", "Does not exist"],
];

const ACTIONS = [
  {
    type: "sendNotification",
    label: "Send Notification",
    description: "Notify users inside CRM",
    icon: Bell,
  },
  {
    type: "createTask",
    label: "Create Task",
    description: "Create a follow-up task",
    icon: ClipboardList,
  },
  {
    type: "sendEmail",
    label: "Send Email",
    description: "Send an automated email",
    icon: Mail,
  },
  {
    type: "assignOwner",
    label: "Assign Owner",
    description: "Assign record to a user",
    icon: UserRound,
  },
  {
    type: "changeStatus",
    label: "Change Status",
    description: "Update record status",
    icon: GitBranch,
  },
  {
    type: "updateField",
    label: "Update Field",
    description: "Update a record field",
    icon: FileText,
  },
];

const createCondition = () => ({
  field: "",
  operator: "equals",
  value: "",
});

const createAction = () => ({
  type: "sendNotification",
  config: {
    message: "",
  },
  order: 1,
});

export default function AutomationBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    module: "Lead",
    trigger: {
      type: "event",
      event: "created",
    },
    conditionLogic: "AND",
    conditions: [],
    actions: [createAction()],
  });

  useEffect(() => {
    if (!editing) return;

    const loadAutomation = async () => {
      try {
        const data = await getAutomation(id);
        const automation = data?.automation;

        if (!automation) return;

        setForm({
          name: automation.name || "",
          description: automation.description || "",
          module: automation.module || "Lead",
          trigger: automation.trigger || {
            type: "event",
            event: "created",
          },
          conditionLogic: automation.conditionLogic || "AND",
          conditions: automation.conditions || [],
          actions:
            automation.actions?.length > 0
              ? automation.actions
              : [createAction()],
        });
      } catch (error) {
        console.error("Failed to load automation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAutomation();
  }, [id, editing]);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateTrigger = (key, value) => {
    setForm((prev) => ({
      ...prev,
      trigger: {
        ...prev.trigger,
        [key]: value,
      },
    }));
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, createCondition()],
    }));
  };

  const updateCondition = (index, key, value) => {
    setForm((prev) => {
      const conditions = [...prev.conditions];

      conditions[index] = {
        ...conditions[index],
        [key]: value,
      };

      return {
        ...prev,
        conditions,
      };
    });
  };

  const removeCondition = (index) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const addAction = () => {
    setForm((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          ...createAction(),
          order: prev.actions.length + 1,
        },
      ],
    }));
  };

  const updateActionType = (index, type) => {
    setForm((prev) => {
      const actions = [...prev.actions];

      actions[index] = {
        ...actions[index],
        type,
        config: {},
      };

      return {
        ...prev,
        actions,
      };
    });
  };

  const updateActionConfig = (index, key, value) => {
    setForm((prev) => {
      const actions = [...prev.actions];

      actions[index] = {
        ...actions[index],
        config: {
          ...actions[index].config,
          [key]: value,
        },
      };

      return {
        ...prev,
        actions,
      };
    });
  };

  const removeAction = (index) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions
        .filter((_, i) => i !== index)
        .map((action, i) => ({
          ...action,
          order: i + 1,
        })),
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      return Boolean(
        form.name.trim() &&
          form.module &&
          form.trigger?.event
      );
    }

    if (step === 2) {
      return form.conditions.every(
        (condition) =>
          condition.field &&
          condition.operator &&
          (["exists", "notExists"].includes(condition.operator)
            ? true
            : condition.value !== "")
      );
    }

    if (step === 3) {
      return (
        form.actions.length > 0 &&
        form.actions.every((action) => {
          if (action.type === "sendNotification") {
            return Boolean(action.config?.message);
          }

          if (action.type === "createTask") {
            return Boolean(action.config?.title);
          }

          if (action.type === "sendEmail") {
            return (
              Boolean(action.config?.to) &&
              Boolean(action.config?.subject)
            );
          }

          if (action.type === "assignOwner") {
            return Boolean(action.config?.userId);
          }

          if (action.type === "changeStatus") {
            return Boolean(action.config?.status);
          }

          if (action.type === "updateField") {
            return (
              Boolean(action.config?.field) &&
              action.config?.value !== undefined
            );
          }

          return true;
        })
      );
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      alert("Please complete all required fields.");
      return;
    }

    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleSave = async () => {
    if (!validateStep()) {
      alert("Please complete all required fields.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        actions: form.actions.map((action, index) => ({
          ...action,
          order: index + 1,
        })),
      };

      if (editing) {
        await updateAutomation(id, payload);
      } else {
        await createAutomation(payload);
      }

      navigate("/automations");
    } catch (error) {
      console.error("Failed to save automation:", error);

      alert(
        error?.response?.data?.message ||
          "Failed to save automation"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f8fc] p-8">
        <div className="h-10 mb-5 rounded-xl bg-slate-200 animate-pulse" />
        <div className="h-[500px] rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/automations")}
              className="flex items-center justify-center w-10 h-10 bg-white border rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ArrowLeft size={17} />
            </button>

            <div>
              <p className="text-xs font-bold tracking-wider text-indigo-600 uppercase">
                Automation Builder
              </p>

              <h1 className="mt-1 text-xl font-bold text-slate-900">
                {editing
                  ? "Edit Automation"
                  : "Create Automation"}
              </h1>
            </div>
          </div>

          {editing && (
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-600">
              <GitBranch size={13} />
              Workflow Editor
            </span>
          )}
        </div>

        {/* PROGRESS */}
        <div className="p-4 mb-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
          <div className="flex items-center max-w-2xl mx-auto">
            {[
              ["1", "Trigger"],
              ["2", "Conditions"],
              ["3", "Actions"],
            ].map(([number, label], index) => {
              const current = Number(number) === step;
              const complete = Number(number) < step;

              return (
                <div
                  key={number}
                  className="flex items-center flex-1"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        complete
                          ? "bg-indigo-600 text-white"
                          : current
                          ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-100"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {complete ? <Check size={14} /> : number}
                    </div>

                    <span
                      className={`hidden sm:block text-xs font-semibold ${
                        current || complete
                          ? "text-slate-800"
                          : "text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </div>

                  {index < 2 && (
                    <div
                      className={`flex-1 h-px mx-3 ${
                        complete
                          ? "bg-indigo-500"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

          <div className="overflow-hidden bg-white border shadow-sm border-slate-200 rounded-2xl">

            {step === 1 && (
              <TriggerStep
                form={form}
                updateForm={updateForm}
                updateTrigger={updateTrigger}
              />
            )}

            {step === 2 && (
              <ConditionStep
                form={form}
                addCondition={addCondition}
                updateCondition={updateCondition}
                removeCondition={removeCondition}
                updateForm={updateForm}
              />
            )}

            {step === 3 && (
              <ActionStep
                form={form}
                addAction={addAction}
                updateActionType={updateActionType}
                updateActionConfig={updateActionConfig}
                removeAction={removeAction}
              />
            )}

            {/* FOOTER */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50/70">
              <button
                onClick={() =>
                  step === 1
                    ? navigate("/automations")
                    : setStep((prev) => prev - 1)
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={15} />
                {step === 1 ? "Cancel" : "Back"}
              </button>

              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshIcon />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      {editing
                        ? "Save Changes"
                        : "Create Automation"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* LIVE PREVIEW */}
          <WorkflowPreview form={form} />
        </div>
      </div>
    </div>
  );
}

function TriggerStep({
  form,
  updateForm,
  updateTrigger,
}) {
  const selectedEvent = EVENTS.find(
    (event) => event.value === form.trigger.event
  );

  return (
    <div className="p-5 sm:p-7">
      <StepHeading
        icon={Zap}
        eyebrow="Step 01"
        title="Choose your trigger"
        description="Define when this automation should start running."
      />

      <div className="grid gap-5 mt-7">
        <Field label="Automation name" required>
          <input
            value={form.name}
            onChange={(e) =>
              updateForm("name", e.target.value)
            }
            placeholder="e.g. High Value Lead Alert"
            className={inputClass}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) =>
              updateForm("description", e.target.value)
            }
            rows={3}
            placeholder="Briefly describe what this automation does..."
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Module" required>
            <Select
              value={form.module}
              onChange={(value) =>
                updateForm("module", value)
              }
              options={MODULES.map((module) => ({
                value: module,
                label: module,
              }))}
            />
          </Field>

          <Field label="Trigger event" required>
            <Select
              value={form.trigger.event}
              onChange={(value) =>
                updateTrigger("event", value)
              }
              options={EVENTS.map((event) => ({
                value: event.value,
                label: event.label,
              }))}
            />

            {selectedEvent && (
              <p className="mt-2 text-xs text-slate-400">
                {selectedEvent.description}
              </p>
            )}
          </Field>
        </div>

        <div className="p-4 border border-indigo-100 rounded-2xl bg-indigo-50/60">
          <div className="flex gap-3">
            <div className="flex items-center justify-center flex-shrink-0 text-indigo-600 bg-white w-9 h-9 rounded-xl">
              <Sparkles size={16} />
            </div>

            <div>
              <p className="text-sm font-semibold text-indigo-900">
                Automation starts here
              </p>

              <p className="mt-1 text-xs leading-5 text-indigo-700/70">
                Whenever a {form.module} record is{" "}
                {selectedEvent?.label
                  .replace("Record ", "")
                  .toLowerCase() || "created"}
                , this workflow will evaluate its conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionStep({
  form,
  addCondition,
  updateCondition,
  removeCondition,
  updateForm,
}) {
  return (
    <div className="p-5 sm:p-7">
      <StepHeading
        icon={GitBranch}
        eyebrow="Step 02"
        title="Set conditions"
        description="Choose which records are eligible for this automation."
      />

      <div className="flex items-center gap-2 p-1 mt-7 bg-slate-100 rounded-xl w-fit">
        {["AND", "OR"].map((logic) => (
          <button
            key={logic}
            onClick={() =>
              updateForm("conditionLogic", logic)
            }
            className={`px-4 py-2 text-xs font-bold rounded-lg ${
              form.conditionLogic === logic
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500"
            }`}
          >
            {logic}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {form.conditions.length === 0 ? (
          <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300">
            <GitBranch
              size={25}
              className="mx-auto text-slate-300"
            />

            <p className="mt-3 text-sm font-semibold text-slate-600">
              No conditions added
            </p>

            <p className="mt-1 text-xs text-slate-400">
              This automation will run for every matching event.
            </p>
          </div>
        ) : (
          form.conditions.map((condition, index) => (
            <div
              key={index}
              className="p-4 border rounded-2xl border-slate-200 bg-slate-50/50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Condition {index + 1}
                </span>

                <button
                  onClick={() => removeCondition(index)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={condition.field}
                  onChange={(e) =>
                    updateCondition(
                      index,
                      "field",
                      e.target.value
                    )
                  }
                  placeholder="Field e.g. dealValue"
                  className={inputClass}
                />

                <Select
                  value={condition.operator}
                  onChange={(value) =>
                    updateCondition(
                      index,
                      "operator",
                      value
                    )
                  }
                  options={OPERATORS.map(
                    ([value, label]) => ({
                      value,
                      label,
                    })
                  )}
                />

                {!["exists", "notExists"].includes(
                  condition.operator
                ) && (
                  <input
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "value",
                        e.target.value
                      )
                    }
                    placeholder="Value"
                    className={inputClass}
                  />
                )}
              </div>

              {index < form.conditions.length - 1 && (
                <div className="flex justify-center mt-4">
                  <span className="px-3 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-full">
                    {form.conditionLogic}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={addCondition}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 mt-4 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50"
      >
        <Plus size={14} />
        Add Condition
      </button>
    </div>
  );
}

function ActionStep({
  form,
  addAction,
  updateActionType,
  updateActionConfig,
  removeAction,
}) {
  return (
    <div className="p-5 sm:p-7">
      <StepHeading
        icon={Sparkles}
        eyebrow="Step 03"
        title="Choose actions"
        description="Define what should happen when the conditions are satisfied."
      />

      <div className="space-y-4 mt-7">
        {form.actions.map((action, index) => {
          const actionMeta =
            ACTIONS.find(
              (item) => item.type === action.type
            ) || ACTIONS[0];

          const Icon = actionMeta.icon;

          return (
            <div
              key={index}
              className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center text-indigo-600 w-9 h-9 bg-indigo-50 rounded-xl">
                    <Icon size={16} />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Action {index + 1}
                    </p>

                    <p className="text-[11px] text-slate-400">
                      {actionMeta.description}
                    </p>
                  </div>
                </div>

                {form.actions.length > 1 && (
                  <button
                    onClick={() => removeAction(index)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <Select
                value={action.type}
                onChange={(value) =>
                  updateActionType(index, value)
                }
                options={ACTIONS.map((item) => ({
                  value: item.type,
                  label: item.label,
                }))}
              />

              <div className="mt-3">
                {action.type === "sendNotification" && (
                  <input
                    value={action.config?.message || ""}
                    onChange={(e) =>
                      updateActionConfig(
                        index,
                        "message",
                        e.target.value
                      )
                    }
                    placeholder="Notification message"
                    className={inputClass}
                  />
                )}

                {action.type === "createTask" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={action.config?.title || ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "title",
                          e.target.value
                        )
                      }
                      placeholder="Task title"
                      className={inputClass}
                    />

                    <input
                      type="number"
                      min="0"
                      value={action.config?.dueInDays ?? ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "dueInDays",
                          Number(e.target.value)
                        )
                      }
                      placeholder="Due in days"
                      className={inputClass}
                    />
                  </div>
                )}

                {action.type === "sendEmail" && (
                  <div className="grid gap-3">
                    <input
                      value={action.config?.to || ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "to",
                          e.target.value
                        )
                      }
                      placeholder="Recipient email or {{record.email}}"
                      className={inputClass}
                    />

                    <input
                      value={action.config?.subject || ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "subject",
                          e.target.value
                        )
                      }
                      placeholder="Email subject"
                      className={inputClass}
                    />
                  </div>
                )}

                {action.type === "assignOwner" && (
                  <input
                    value={action.config?.userId || ""}
                    onChange={(e) =>
                      updateActionConfig(
                        index,
                        "userId",
                        e.target.value
                      )
                    }
                    placeholder="User ID"
                    className={inputClass}
                  />
                )}

                {action.type === "changeStatus" && (
                  <input
                    value={action.config?.status || ""}
                    onChange={(e) =>
                      updateActionConfig(
                        index,
                        "status",
                        e.target.value
                      )
                    }
                    placeholder="New status"
                    className={inputClass}
                  />
                )}

                {action.type === "updateField" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={action.config?.field || ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "field",
                          e.target.value
                        )
                      }
                      placeholder="Field name"
                      className={inputClass}
                    />

                    <input
                      value={action.config?.value ?? ""}
                      onChange={(e) =>
                        updateActionConfig(
                          index,
                          "value",
                          e.target.value
                        )
                      }
                      placeholder="New value"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={addAction}
        className="inline-flex items-center gap-2 px-3.5 py-2.5 mt-4 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50"
      >
        <Plus size={14} />
        Add Action
      </button>
    </div>
  );
}

function WorkflowPreview({ form }) {
  const event =
    EVENTS.find(
      (item) => item.value === form.trigger.event
    )?.label || "Record Created";

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-5">
        <div className="p-5 shadow-xl bg-slate-950 rounded-2xl">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-indigo-300" />

            <p className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
              Live Preview
            </p>
          </div>

          <h3 className="mt-3 text-base font-bold text-white truncate">
            {form.name || "Untitled Automation"}
          </h3>

          <p className="mt-1 text-xs text-slate-400">
            {form.module}
          </p>

          <div className="mt-6 space-y-0">
            <PreviewNode
              icon={Zap}
              label="Trigger"
              value={event}
            />

            <PreviewLine />

            <PreviewNode
              icon={GitBranch}
              label="Conditions"
              value={
                form.conditions.length
                  ? `${form.conditions.length} condition${
                      form.conditions.length > 1
                        ? "s"
                        : ""
                    } · ${form.conditionLogic}`
                  : "Always"
              }
            />

            <PreviewLine />

            <PreviewNode
              icon={Sparkles}
              label="Actions"
              value={`${form.actions.length} action${
                form.actions.length > 1 ? "s" : ""
              }`}
            />
          </div>
        </div>

        <div className="p-4 mt-4 bg-white border rounded-2xl border-slate-200">
          <div className="flex items-center gap-2">
            <Clock3 size={15} className="text-slate-400" />

            <p className="text-xs font-bold text-slate-700">
              Execution
            </p>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            This workflow will be evaluated whenever the selected event occurs.
          </p>
        </div>
      </div>
    </aside>
  );
}

function PreviewNode({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3 p-3 border rounded-xl border-white/10 bg-white/5">
      <div className="flex items-center justify-center w-8 h-8 text-indigo-300 rounded-lg bg-indigo-500/10">
        <Icon size={14} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
          {label}
        </p>

        <p className="mt-0.5 text-xs font-semibold truncate text-slate-200">
          {value}
        </p>
      </div>
    </div>
  );
}

function PreviewLine() {
  return (
    <div className="w-px h-5 ml-7 bg-white/10" />
  );
}

function StepHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center text-indigo-600 w-9 h-9 bg-indigo-50 rounded-xl">
          <Icon size={17} />
        </div>

        <span className="text-[11px] font-bold tracking-widest text-indigo-600 uppercase">
          {eyebrow}
        </span>
      </div>

      <h2 className="mt-4 text-xl font-bold text-slate-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block mb-2 text-xs font-bold text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-rose-500">*</span>
        )}
      </span>

      {children}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-10`}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={15}
        className="absolute -translate-y-1/2 pointer-events-none right-3 top-1/2 text-slate-400"
      />
    </div>
  );
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition";

function RefreshIcon() {
  return (
    <span className="w-4 h-4 border-2 rounded-full border-white/40 border-t-white animate-spin" />
  );
}