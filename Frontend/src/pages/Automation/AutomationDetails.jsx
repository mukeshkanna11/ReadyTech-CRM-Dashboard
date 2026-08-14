import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Edit3,
  GitBranch,
  Pause,
  Play,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

import {
  activateAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomation,
  getAutomationExecutions,
  pauseAutomation,
} from "../../services/automationService";

export default function AutomationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [automation, setAutomation] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [automationData, executionData] =
        await Promise.all([
          getAutomation(id),
          getAutomationExecutions(id),
        ]);

      setAutomation(automationData?.automation);
      setExecutions(executionData?.executions || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const toggleStatus = async () => {
    if (automation.status === "active") {
      await pauseAutomation(id);
    } else {
      await activateAutomation(id);
    }

    await load();
  };

  const handleDuplicate = async () => {
    await duplicateAutomation(id);
    navigate("/automations");
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this automation?")) return;

    await deleteAutomation(id);
    navigate("/automations");
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f8fc] p-8">
        <div className="h-10 mb-5 rounded-xl bg-slate-200 animate-pulse" />
        <div className="h-[500px] bg-white border rounded-2xl border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex items-center justify-center min-h-full bg-[#f7f8fc]">
        <p className="text-sm text-slate-500">
          Automation not found.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/automations")}
              className="flex items-center justify-center w-10 h-10 bg-white border rounded-xl border-slate-200 text-slate-500"
            >
              <ArrowLeft size={17} />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-indigo-600" />

                <span className="text-xs font-bold tracking-wider text-indigo-600 uppercase">
                  Automation
                </span>
              </div>

              <h1 className="mt-1 text-xl font-bold text-slate-900">
                {automation.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                navigate(`/automations/${id}/edit`)
              }
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-600 bg-white border rounded-xl border-slate-200"
            >
              <Edit3 size={14} />
              Edit
            </button>

            <button
              onClick={toggleStatus}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl ${
                automation.status === "active"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {automation.status === "active" ? (
                <>
                  <Pause size={14} />
                  Pause
                </>
              ) : (
                <>
                  <Play size={14} />
                  Activate
                </>
              )}
            </button>

            <button
              onClick={handleDuplicate}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-600 bg-white border rounded-xl border-slate-200"
            >
              <Copy size={14} />
              Duplicate
            </button>

            <button
              onClick={handleDelete}
              className="inline-flex items-center justify-center w-10 h-10 bg-white border text-rose-600 rounded-xl border-rose-100"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 mb-5 lg:grid-cols-4">
          <Metric
            label="Status"
            value={automation.status}
            icon={
              automation.status === "active"
                ? CheckCircle2
                : Pause
            }
          />

          <Metric
            label="Executions"
            value={automation.executionCount || 0}
            icon={Activity}
          />

          <Metric
            label="Successful"
            value={automation.successCount || 0}
            icon={CheckCircle2}
          />

          <Metric
            label="Failed"
            value={automation.failureCount || 0}
            icon={XCircle}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* WORKFLOW */}
          <div className="space-y-5">

            <section className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <SectionTitle
                icon={Zap}
                title="Trigger"
              />

              <div className="flex items-center gap-4 p-4 mt-4 border border-indigo-100 rounded-2xl bg-indigo-50/50">
                <div className="flex items-center justify-center w-10 h-10 text-indigo-600 bg-white rounded-xl">
                  <Zap size={17} />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    {automation.module}
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {automation.trigger?.event}
                  </p>
                </div>
              </div>
            </section>

            <section className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <SectionTitle
                icon={GitBranch}
                title="Conditions"
              />

              {automation.conditions?.length ? (
                <div className="mt-4 space-y-3">
                  {automation.conditions.map(
                    (condition, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-2 p-3 text-xs border rounded-xl border-slate-200 bg-slate-50"
                      >
                        <span className="font-semibold text-slate-700">
                          {condition.field}
                        </span>

                        <span className="px-2 py-1 font-semibold text-indigo-600 rounded-lg bg-indigo-50">
                          {condition.operator}
                        </span>

                        <span className="font-semibold text-slate-600">
                          {condition.value}
                        </span>

                        {index <
                          automation.conditions.length -
                            1 && (
                          <span className="ml-auto text-[10px] font-bold text-slate-400">
                            {automation.conditionLogic}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  No conditions — runs for every matching event.
                </p>
              )}
            </section>

            <section className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <SectionTitle
                icon={Sparkles}
                title="Actions"
              />

              <div className="mt-4 space-y-3">
                {automation.actions?.map(
                  (action, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-4 border rounded-2xl border-slate-200"
                    >
                      <div className="flex items-center justify-center flex-shrink-0 text-indigo-600 w-9 h-9 bg-indigo-50 rounded-xl">
                        <Sparkles size={15} />
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {action.type}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {getActionSummary(action)}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>

          {/* SIDE */}
          <aside className="space-y-5">

            <section className="p-5 bg-slate-950 rounded-2xl">
              <p className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
                Workflow Summary
              </p>

              <h3 className="mt-2 text-lg font-bold text-white">
                {automation.name}
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                {automation.description ||
                  "No description provided."}
              </p>

              <div className="pt-4 mt-5 space-y-3 border-t border-white/10">
                <SummaryRow
                  label="Module"
                  value={automation.module}
                />

                <SummaryRow
                  label="Version"
                  value={`v${automation.version}`}
                />

                <SummaryRow
                  label="Created"
                  value={new Date(
                    automation.createdAt
                  ).toLocaleDateString()}
                />
              </div>
            </section>

            <section className="p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
              <SectionTitle
                icon={Clock3}
                title="Execution History"
              />

              <div className="mt-4 space-y-3">
                {executions.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No executions yet.
                  </p>
                ) : (
                  executions.slice(0, 8).map(
                    (execution) => (
                      <ExecutionRow
                        key={execution._id}
                        execution={execution}
                      />
                    )
                  )
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="p-4 bg-white border shadow-sm border-slate-200 rounded-2xl">
      <div className="flex items-center justify-center text-indigo-600 w-9 h-9 bg-indigo-50 rounded-xl">
        <Icon size={16} />
      </div>

      <p className="mt-3 text-lg font-bold capitalize text-slate-800">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {label}
      </p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 text-indigo-600 rounded-lg bg-indigo-50">
        <Icon size={15} />
      </div>

      <h2 className="text-sm font-bold text-slate-800">
        {title}
      </h2>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="font-semibold text-slate-200">
        {value}
      </span>
    </div>
  );
}

function ExecutionRow({ execution }) {
  const success = execution.status === "success";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-lg ${
          success
            ? "bg-emerald-50 text-emerald-600"
            : execution.status === "skipped"
            ? "bg-slate-100 text-slate-500"
            : "bg-rose-50 text-rose-600"
        }`}
      >
        {success ? (
          <CheckCircle2 size={14} />
        ) : (
          <XCircle size={14} />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold capitalize text-slate-700">
          {execution.status}
        </p>

        <p className="text-[10px] text-slate-400">
          {new Date(
            execution.createdAt
          ).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function getActionSummary(action) {
  if (action.type === "sendNotification") {
    return action.config?.message || "Notification";
  }

  if (action.type === "createTask") {
    return action.config?.title || "Create task";
  }

  if (action.type === "sendEmail") {
    return action.config?.subject || "Send email";
  }

  if (action.type === "changeStatus") {
    return `Change status to ${action.config?.status || "-"}`;
  }

  if (action.type === "assignOwner") {
    return `Assign to ${action.config?.userId || "-"}`;
  }

  if (action.type === "updateField") {
    return `Update ${action.config?.field || "-"}`;
  }

  return "Automation action";
}