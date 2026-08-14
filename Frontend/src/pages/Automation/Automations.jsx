import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  GitBranch,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

import {
  activateAutomation,
  deleteAutomation,
  duplicateAutomation,
  getAutomations,
  pauseAutomation,
} from "../../services/automationService";

const moduleMeta = {
  Lead: {
    label: "Leads",
    icon: Zap,
  },
  Contact: {
    label: "Contacts",
    icon: Activity,
  },
  Client: {
    label: "Clients",
    icon: CheckCircle2,
  },
  Opportunity: {
    label: "Opportunities",
    icon: GitBranch,
  },
  Invoice: {
    label: "Invoices",
    icon: Clock3,
  },
  Product: {
    label: "Products",
    icon: Settings2,
  },
  Inventory: {
    label: "Inventory",
    icon: AlertCircle,
  },
  PurchaseOrder: {
    label: "Purchase Orders",
    icon: Copy,
  },
};

const statusMeta = {
  active: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    dot: "bg-emerald-500",
  },
  paused: {
    label: "Paused",
    className:
      "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
  },
  draft: {
    label: "Draft",
    className:
      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    dot: "bg-slate-400",
  },
};

function formatRelativeDate(date) {
  if (!date) return "Never";

  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Never";

  const diff = Date.now() - value.getTime();

  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 30) return `${days}d ago`;

  return value.toLocaleDateString();
}

function AutomationIcon({ module }) {
  const Icon = moduleMeta[module]?.icon || Zap;

  return (
    <div className="flex items-center justify-center text-indigo-600 w-11 h-11 rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
      <Icon size={19} />
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] || statusMeta.draft;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-semibold ${meta.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default function Automations() {
  const navigate = useNavigate();

  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [module, setModule] = useState("all");

  const [menuId, setMenuId] = useState(null);

  const fetchAutomations = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const params = {};

      if (search.trim()) params.search = search.trim();
      if (status !== "all") params.status = status;
      if (module !== "all") params.module = module;

      const data = await getAutomations(params);

      setAutomations(data?.automations || []);
    } catch (error) {
      console.error("Failed to fetch automations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAutomations();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, status, module]);

  const stats = useMemo(() => {
    return {
      total: automations.length,
      active: automations.filter((a) => a.status === "active").length,
      paused: automations.filter((a) => a.status === "paused").length,
      draft: automations.filter((a) => a.status === "draft").length,
      executions: automations.reduce(
        (sum, item) => sum + (item.executionCount || 0),
        0
      ),
      failures: automations.reduce(
        (sum, item) => sum + (item.failureCount || 0),
        0
      ),
    };
  }, [automations]);

  const handleActivate = async (id) => {
    try {
      await activateAutomation(id);
      await fetchAutomations(true);
      setMenuId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePause = async (id) => {
    try {
      await pauseAutomation(id);
      await fetchAutomations(true);
      setMenuId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateAutomation(id);
      await fetchAutomations(true);
      setMenuId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this automation?"
    );

    if (!confirmed) return;

    try {
      await deleteAutomation(id);
      await fetchAutomations(true);
      setMenuId(null);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-full bg-[#f7f8fc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">

        {/* HEADER */}
        <div className="flex flex-col gap-5 mb-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center text-white bg-indigo-600 shadow-lg w-9 h-9 rounded-xl shadow-indigo-200">
                <Zap size={18} />
              </div>

              <span className="text-xs font-bold tracking-widest text-indigo-600 uppercase">
                CRM Automation
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Automations
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              Build intelligent workflows that automate your CRM & ERP processes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAutomations(true)}
              className="inline-flex items-center justify-center w-10 h-10 bg-white border text-slate-500 border-slate-200 rounded-xl hover:bg-slate-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>

            <button
              onClick={() => navigate("/automations/create")}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
            >
              <Plus size={17} />
              Create Automation
            </button>
          </div>
        </div>

        {/* AI BANNER */}
        <div className="relative overflow-hidden mb-7 bg-slate-950 rounded-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.28),transparent_35%),radial-gradient(circle_at_80%_100%,rgba(168,85,247,0.18),transparent_35%)]" />

          <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center flex-shrink-0 text-indigo-300 w-11 h-11 rounded-xl bg-white/10 ring-1 ring-white/10">
                <Sparkles size={20} />
              </div>

              <div>
                <p className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
                  AI Automation Assistant
                </p>

                <h2 className="mt-1 text-base font-semibold text-white">
                  Describe your workflow and turn it into an automation.
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Example: “When a high-value lead is created, notify the sales manager and create a follow-up task.”
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/automations/create")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-white rounded-xl hover:bg-slate-100"
            >
              <Bot size={16} />
              Build Workflow
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 mb-7 lg:grid-cols-4">
          {[
            {
              label: "Total Automations",
              value: stats.total,
              icon: Zap,
            },
            {
              label: "Active",
              value: stats.active,
              icon: Play,
            },
            {
              label: "Draft / Paused",
              value: stats.draft + stats.paused,
              icon: Pause,
            },
            {
              label: "Total Executions",
              value: stats.executions,
              icon: Activity,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="p-4 bg-white border shadow-sm border-slate-200 rounded-2xl"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center text-indigo-600 w-9 h-9 bg-indigo-50 rounded-xl">
                    <Icon size={17} />
                  </div>

                  <ArrowUpRight
                    size={15}
                    className="text-slate-300"
                  />
                </div>

                <p className="mt-4 text-2xl font-bold text-slate-900">
                  {item.value}
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* TABLE CARD */}
        <div className="overflow-hidden bg-white border shadow-sm border-slate-200 rounded-2xl">

          {/* FILTER BAR */}
          <div className="flex flex-col gap-3 p-4 border-b border-slate-200 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                size={17}
                className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search automations..."
                className="w-full py-2.5 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              <FilterButton
                active={status === "all"}
                onClick={() => setStatus("all")}
              >
                All
              </FilterButton>

              <FilterButton
                active={status === "active"}
                onClick={() => setStatus("active")}
              >
                Active
              </FilterButton>

              <FilterButton
                active={status === "draft"}
                onClick={() => setStatus("draft")}
              >
                Draft
              </FilterButton>

              <FilterButton
                active={status === "paused"}
                onClick={() => setStatus("paused")}
              >
                Paused
              </FilterButton>

              <div className="relative">
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="px-3 pr-8 text-xs font-semibold bg-white border outline-none appearance-none h-9 border-slate-200 rounded-xl text-slate-600"
                >
                  <option value="all">All Modules</option>
                  <option value="Lead">Leads</option>
                  <option value="Opportunity">Opportunities</option>
                  <option value="Invoice">Invoices</option>
                  <option value="Product">Products</option>
                  <option value="Inventory">Inventory</option>
                </select>

                <ChevronDown
                  size={14}
                  className="absolute pointer-events-none right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <LoadingState />
          ) : automations.length === 0 ? (
            <EmptyState onCreate={() => navigate("/automations/create")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="text-left border-b bg-slate-50/70 border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Automation
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Module
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Trigger
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Executions
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                      Last Run
                    </th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {automations.map((automation) => (
                    <tr
                      key={automation._id}
                      onClick={() =>
                        navigate(`/automations/${automation._id}`)
                      }
                      className="transition cursor-pointer group hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <AutomationIcon module={automation.module} />

                          <div className="min-w-0">
                            <p className="font-semibold truncate text-slate-800">
                              {automation.name}
                            </p>

                            <p className="max-w-[320px] mt-0.5 text-xs truncate text-slate-500">
                              {automation.description ||
                                "No description provided"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm font-medium text-slate-600">
                        {moduleMeta[automation.module]?.label ||
                          automation.module}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                          <span className="flex items-center justify-center rounded-lg w-7 h-7 bg-slate-100">
                            <Zap size={13} />
                          </span>
                          {automation.trigger?.event || "Event"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={automation.status} />
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {automation.executionCount || 0}
                          </p>

                          {automation.failureCount > 0 && (
                            <p className="mt-0.5 text-[11px] text-rose-500">
                              {automation.failureCount} failed
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs font-medium text-slate-500">
                        {formatRelativeDate(
                          automation.lastExecutedAt
                        )}
                      </td>

                      <td
                        className="relative px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setMenuId(
                              menuId === automation._id
                                ? null
                                : automation._id
                            )
                          }
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreHorizontal size={18} />
                        </button>

                        {menuId === automation._id && (
                          <div className="absolute z-30 overflow-hidden bg-white border shadow-xl right-4 top-12 w-44 border-slate-200 rounded-xl">
                            <MenuItem
                              onClick={() =>
                                navigate(
                                  `/automations/${automation._id}/edit`
                                )
                              }
                            >
                              <Settings2 size={14} />
                              Edit
                            </MenuItem>

                            {automation.status === "active" ? (
                              <MenuItem
                                onClick={() =>
                                  handlePause(automation._id)
                                }
                              >
                                <Pause size={14} />
                                Pause
                              </MenuItem>
                            ) : (
                              <MenuItem
                                onClick={() =>
                                  handleActivate(automation._id)
                                }
                              >
                                <Play size={14} />
                                Activate
                              </MenuItem>
                            )}

                            <MenuItem
                              onClick={() =>
                                handleDuplicate(automation._id)
                              }
                            >
                              <Copy size={14} />
                              Duplicate
                            </MenuItem>

                            <MenuItem
                              danger
                              onClick={() =>
                                handleDelete(automation._id)
                              }
                            >
                              <Trash2 size={14} />
                              Delete
                            </MenuItem>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3.5 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full gap-2 px-3.5 py-2.5 text-xs font-semibold text-left hover:bg-slate-50 ${
        danger
          ? "text-rose-600"
          : "text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="p-6 space-y-3">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-16 rounded-xl bg-slate-100 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 mb-5 text-indigo-600 bg-indigo-50 rounded-2xl">
        <Zap size={28} />
      </div>

      <h3 className="text-lg font-bold text-slate-800">
        No automations yet
      </h3>

      <p className="max-w-md mt-2 text-sm text-slate-500">
        Automate repetitive CRM and ERP tasks with intelligent workflows.
      </p>

      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 mt-6 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
      >
        <Plus size={16} />
        Create your first automation
      </button>
    </div>
  );
}