import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Phone,
  Mail,
  User,
  Activity,
  X,
  Filter,
  Users,
  TrendingUp,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Building2,
  CalendarClock,
  Target,
} from "lucide-react";
import LeadAIAssistant from "../components/LeadAIAssistant";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  status: "New",
  source: "Website",
  notes: "",
};

/* Lead status pipeline + colour tokens */
const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Closed"];
const LEAD_SOURCES = ["Website", "Referral", "Social Media", "Email", "Cold Call", "Event", "Other"];

const STATUS_STYLES = {
  New: "bg-blue-100 text-blue-700",
  Contacted: "bg-amber-100 text-amber-700",
  Qualified: "bg-green-100 text-green-700",
  Closed: "bg-slate-200 text-slate-600",
};

/* Derived priority (display-only, no backend field) */
const PRIORITY_STYLES = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};
const PRIORITY_DOT = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-slate-400",
};
const priorityOf = (status) =>
  status === "Qualified" ? "High" : status === "Contacted" ? "Medium" : "Low";

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [activeLead, setActiveLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [aiLead, setAiLead] = useState(null);

  const [page, setPage] = useState(1);

  /* ================= FETCH ================= */
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/leads?limit=1000");
      setLeads(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch {
      setError("We couldn't load your leads. Please check your connection and try again.");
      toast.error("Failed to load leads");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  /* ================= SAVE ================= */
  const saveLead = async (e) => {
    e.preventDefault();
    try {
      if (form._id) {
        await API.put(`/leads/${form._id}`, form);
        toast.success("Lead updated");
      } else {
        await API.post("/leads", form);
        toast.success("Lead created");
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      fetchLeads();
    } catch {
      toast.error("Save failed");
    }
  };

  /* ================= DELETE ================= */
  const deleteLead = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    try {
      await API.delete(`/leads/${id}`);
      toast.success("Lead deleted");
      fetchLeads();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= INLINE STATUS UPDATE ================= */
  const updateLeadStatus = async (lead, status) => {
    if (lead.status === status) return;
    // optimistic update
    setLeads((prev) =>
      prev.map((l) => (l._id === lead._id ? { ...l, status } : l))
    );
    try {
      await API.put(`/leads/${lead._id}`, { ...lead, status });
      toast.success(`Moved to ${status}`);
    } catch {
      toast.error("Status update failed");
      fetchLeads(); // revert to server truth
    }
  };

  /* ================= FILTER ================= */
  const sources = useMemo(
    () => ["All", ...Array.from(new Set(leads.map((l) => l.source).filter(Boolean)))],
    [leads]
  );

  const filteredLeads = useMemo(() => {
    return leads
      .filter((l) =>
        `${l.name} ${l.email} ${l.phone} ${l.company || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .filter((l) => (statusFilter === "All" ? true : l.status === statusFilter))
      .filter((l) => (sourceFilter === "All" ? true : l.source === sourceFilter))
      .filter((l) => (priorityFilter === "All" ? true : priorityOf(l.status) === priorityFilter));
  }, [leads, search, statusFilter, sourceFilter, priorityFilter]);

  const hasFilters =
    search || statusFilter !== "All" || sourceFilter !== "All" || priorityFilter !== "All";

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE) || 1;
  const paginatedLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filteredLeads.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredLeads.length);

  const pageNumbers = useMemo(() => {
    const arr = [];
    const end = Math.min(totalPages, Math.max(page + 2, 5));
    const start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter, priorityFilter]);

  /* ================= KPI ================= */
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "New").length;
  const qualifiedLeads = leads.filter((l) => l.status === "Qualified").length;
  const conversionRate = totalLeads ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setSourceFilter("All");
    setPriorityFilter("All");
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen p-4 space-y-6 sm:p-6 lg:p-8 lg:space-y-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">

      {/* ================= ENTERPRISE HERO HEADER ================= */}
<div className="relative overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">

  {/* Background Effects */}
  <div className="absolute rounded-full -right-28 -top-28 h-80 w-80 bg-indigo-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-violet-500/10 blur-3xl" />
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_45%)]" />

  <div className="relative p-6 sm:p-8">

    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

      {/* Left */}
      <div className="space-y-5">

        <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">

          <Sparkles size={13} />

          ReadyTech Solutions CRM

        </div>

        <div className="flex items-start gap-4">

          <div className="flex items-center justify-center w-16 h-16 shadow-xl rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-900/40">

            <Users size={30} />

          </div>

          <div>

            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              Lead Management
            </h1>

            <p className="max-w-3xl mt-3 text-sm leading-7 text-slate-300">

              Centralize customer acquisition, monitor lead pipelines,
              automate follow-ups, and improve conversion rates using the
              ReadyTech CRM platform. Manage every prospect from initial
              inquiry to successful deal closure with real-time visibility.

            </p>

          </div>

        </div>

        {/* Enterprise Highlights */}
        <div className="flex flex-wrap gap-3">

          {[
            "Lead Tracking",
            "Sales Pipeline",
            "CRM Automation",
            "Customer Engagement",
            "Analytics Dashboard",
          ].map((item) => (

            <span
              key={item}
              className="px-3 py-1 text-xs font-medium border rounded-full border-white/10 bg-white/10 backdrop-blur"
            >
              {item}
            </span>

          ))}

        </div>

      </div>

      {/* Right */}
      <div className="flex flex-col gap-5">

        {/* System Status */}
        <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

          <div className="flex items-center gap-2">

            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />

            <span className="text-sm font-semibold">
              CRM Services Online
            </span>

          </div>

          <p className="mt-2 text-xs text-slate-300">
            Lead synchronization, customer workflows and automation are
            operating normally.
          </p>

        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">

          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition rounded-xl bg-white/10 backdrop-blur hover:bg-white/20"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh Data
          </button>

          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
          >
            <Plus size={16} />
            Add New Lead
          </button>

        </div>

      </div>

    </div>

    {/* Bottom Statistics */}
    <div className="grid gap-4 pt-6 mt-8 border-t border-white/10 sm:grid-cols-2 xl:grid-cols-4">

      <div>
        <p className="text-xs tracking-wide uppercase text-slate-400">
          Total Leads
        </p>
        <h3 className="mt-1 text-2xl font-bold">
          {leads.length}
        </h3>
      </div>

      <div>
        <p className="text-xs tracking-wide uppercase text-slate-400">
          Qualified Leads
        </p>
        <h3 className="mt-1 text-2xl font-bold">
          {qualifiedLeads}
        </h3>
      </div>

      <div>
        <p className="text-xs tracking-wide uppercase text-slate-400">
          Conversion Rate
        </p>
        <h3 className="mt-1 text-2xl font-bold">
          {conversionRate}%
        </h3>
      </div>

      <div>
        <p className="text-xs tracking-wide uppercase text-slate-400">
          CRM Status
        </p>

        <div className="inline-flex items-center gap-2 px-3 py-1 mt-2 text-sm font-semibold rounded-full bg-emerald-500/20 text-emerald-300">

          <span className="w-2 h-2 rounded-full bg-emerald-400" />

          Operational

        </div>

      </div>

    </div>

  </div>

</div>

      {/* ================= ENTERPRISE KPI DASHBOARD ================= */}
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

  <Kpi
    title="Total Leads"
    value={totalLeads}
    icon={Users}
    accent="indigo"
    hint="All captured prospects"
    trend="+12%"
    trendType="up"
  />

  <Kpi
    title="New Leads"
    value={newLeads}
    icon={TrendingUp}
    accent="blue"
    hint="Awaiting first contact"
    trend="+8%"
    trendType="up"
  />

  <Kpi
    title="Qualified Leads"
    value={qualifiedLeads}
    icon={CheckCircle}
    accent="emerald"
    hint="Sales-ready opportunities"
    trend="+5%"
    trendType="up"
  />

  <Kpi
    title="Conversion Rate"
    value={`${conversionRate}%`}
    icon={Target}
    accent="violet"
    hint="Qualified vs Total Leads"
    trend={`${conversionRate}%`}
    trendType="neutral"
  />

</div>

     {/* ================= ENTERPRISE SEARCH & FILTERS ================= */}
<div className="overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

  {/* Header */}
  <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">

    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

      <div>

        <h2 className="text-xl font-bold text-slate-900">
          Search & Lead Filters
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Search prospects instantly and refine your sales pipeline using
          advanced CRM filters.
        </p>

      </div>

      <div className="flex items-center gap-3">

        <div className="px-4 py-2 bg-white border shadow-sm rounded-xl border-slate-200">

          <p className="text-xs text-slate-500">
            Results
          </p>

          <p className="text-lg font-bold text-slate-900">
            {filteredLeads.length}
          </p>

        </div>

        <div className="px-4 py-2 border rounded-xl border-emerald-100 bg-emerald-50">

          <div className="flex items-center gap-2">

            <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500" />

            <span className="text-xs font-semibold text-emerald-700">
              Live Search Enabled
            </span>

          </div>

        </div>

      </div>

    </div>

  </div>

  {/* Search & Filters */}
  <div className="p-6 space-y-5">

    {/* Search */}
    <div className="relative max-w-xl">

      <Search
        size={18}
        className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by Lead Name, Email, Phone Number, Company..."
        className="w-full py-3 pl-12 pr-12 text-sm transition-all duration-300 bg-white border shadow-sm outline-none rounded-2xl border-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      />

      {search && (
        <button
          onClick={() => setSearch("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>
      )}

    </div>

    {/* Filters */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-4 py-3 text-sm transition bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      >
        <option value="All">All Status</option>

        {LEAD_STATUSES.map((status) => (
          <option
            key={status}
            value={status}
          >
            {status}
          </option>
        ))}

      </select>

      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value)}
        className="px-4 py-3 text-sm transition bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      >
        <option value="All">
          All Priority
        </option>

        <option value="High">
          High
        </option>

        <option value="Medium">
          Medium
        </option>

        <option value="Low">
          Low
        </option>

      </select>

      <select
        value={sourceFilter}
        onChange={(e) => setSourceFilter(e.target.value)}
        className="px-4 py-3 text-sm transition bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      >
        {sources.map((source) => (

          <option
            key={source}
            value={source}
          >
            {source === "All"
              ? "All Sources"
              : source}
          </option>

        ))}

      </select>

      <button
        onClick={clearFilters}
        disabled={!hasFilters}
        className={`
          rounded-xl
          px-4
          py-3
          text-sm
          font-medium
          transition-all
          ${
            hasFilters
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }
        `}
      >
        Clear All Filters
      </button>

    </div>

    {/* Footer */}
    <div className="flex flex-col gap-3 pt-5 text-sm border-t border-slate-200 text-slate-600 md:flex-row md:items-center md:justify-between">

      <p>
        Showing
        <span className="mx-1 font-bold text-slate-900">
          {filteredLeads.length}
        </span>
        of
        <span className="mx-1 font-bold text-slate-900">
          {leads.length}
        </span>
        total leads.
      </p>

      <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-indigo-700 rounded-full bg-indigo-50">

        <Filter size={14} />

        Enterprise CRM Filters

      </div>

    </div>

  </div>

</div>

      {/* ============ TABLE ============ */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        {/* ERROR STATE */}
        {error ? (
          <div className="flex flex-col gap-4 p-6 border-b lg:flex-row lg:items-center lg:justify-between">

  <div>
    <h2 className="text-xl font-bold text-slate-900">
      Lead Directory
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      Manage customer leads, monitor sales progress, and track every interaction from one centralized workspace.
    </p>
  </div>

  <div className="flex gap-3">

    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
      <Download size={16}/>
      Export
    </button>

    <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
      <Upload size={16}/>
      Import
    </button>

  </div>

</div>
        ) : loading ? (
          /* LOADING STATE */
          <div className="p-4 space-y-3 sm:p-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="rounded-full h-9 w-9 shrink-0 bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-3 rounded bg-slate-100 animate-pulse" />
                  <div className="w-1/4 h-2.5 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="w-20 h-6 rounded-full bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : paginatedLeads.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="grid mb-4 text-indigo-500 rounded-2xl h-14 w-14 place-items-center bg-indigo-50">
              <Users size={26} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {hasFilters ? "No leads match your filters" : "No leads yet"}
            </h3>
            <p className="max-w-sm mt-1 text-sm text-slate-500">
              {hasFilters
                ? "Try adjusting or clearing your filters to see more results."
                : "Start building your pipeline by adding your first potential customer."}
            </p>
            {hasFilters ? (
              <button onClick={clearFilters} className="mt-5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Clear filters
              </button>
            ) : (
              <button
                onClick={() => { setForm(EMPTY_FORM); setDrawerOpen(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 mt-5 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700"
              >
                <Plus size={16} /> Add New Lead
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-20 border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left">Lead</th>
                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left md:table-cell">Contact</th>
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left">Status</th>
                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left lg:table-cell">Priority</th>
                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left sm:table-cell">Source</th>
                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-left xl:table-cell">Created</th>
                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedLeads.map((l) => {
                  const priority = priorityOf(l.status);
                  return (
                    <tr key={l._id} className="transition hover:bg-slate-50/70">
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => { setActiveLead(l); setProfileOpen(true); }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid text-sm font-semibold text-white rounded-full h-9 w-9 shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
                            {(l.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate text-slate-900">{l.name || "Unnamed"}</div>
                            <div className="text-xs truncate text-slate-500 md:hidden">{l.email || "—"}</div>
                            {l.company && <div className="hidden text-xs truncate text-slate-400 md:block">{l.company}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-6 py-4 space-y-1 text-xs md:table-cell text-slate-600">
                        <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {l.email || "—"}</div>
                        <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {l.phone || "—"}</div>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={l.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateLeadStatus(l, e.target.value)}
                          title="Change status"
                          className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-indigo-500/40 ${STATUS_STYLES[l.status] || "bg-slate-100 text-slate-600"}`}
                        >
                          {LEAD_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      </td>

                      <td className="hidden px-6 py-4 lg:table-cell">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
                          {priority}
                        </span>
                      </td>

                      <td className="hidden px-6 py-4 sm:table-cell text-slate-600">{l.source || "—"}</td>

                      <td className="hidden px-6 py-4 text-xs xl:table-cell text-slate-500">
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton onClick={() => setAiLead(l)} title="AI Assistant" className="text-indigo-600 hover:bg-indigo-50">
                            <Bot size={16} />
                          </IconButton>
                          <IconButton onClick={() => { setForm(l); setDrawerOpen(true); }} title="Edit" className="text-slate-500 hover:bg-slate-100">
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton onClick={() => deleteLead(l._id)} title="Delete" className="text-red-500 hover:bg-red-50">
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && !error && filteredLeads.length > 0 && (
          <div className="flex flex-col gap-3 px-6 py-4 border-t sm:flex-row sm:items-center sm:justify-between border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{rangeStart}–{rangeEnd}</span> of {filteredLeads.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="grid transition rounded-lg h-9 w-9 place-items-center text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition ${
                    n === page
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="grid transition rounded-lg h-9 w-9 place-items-center text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= ENTERPRISE CRM INFORMATION ================= */}
<div className="grid gap-6 xl:grid-cols-3">

  {/* About CRM */}
  <div className="overflow-hidden bg-white border shadow-sm xl:col-span-2 rounded-3xl border-slate-200">

    <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">

      <div className="flex items-center gap-4">

        <div className="flex items-center justify-center shadow-lg h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600">
          <Users size={26} className="text-white" />
        </div>

        <div>

          <h2 className="text-xl font-bold text-slate-900">
            About ReadyTech CRM Lead Management
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Intelligent customer acquisition and sales pipeline management.
          </p>

        </div>

      </div>

    </div>

    <div className="p-6 space-y-5">

      <p className="leading-7 text-slate-600">
        The <strong>Lead Management</strong> module in
        <span className="font-semibold text-indigo-600">
          {" "}ReadyTech CRM
        </span>{" "}
        helps organizations capture, organize, nurture, and convert
        potential customers into long-term business opportunities.
        Every interaction—from enquiries and website forms to phone calls
        and marketing campaigns—is stored in one centralized platform,
        allowing sales teams to improve productivity and close deals faster.
      </p>

      <div className="grid gap-4 md:grid-cols-2">

        <div className="p-5 border rounded-2xl border-slate-200 bg-slate-50">

          <h3 className="font-semibold text-slate-900">
            Business Benefits
          </h3>

          <ul className="mt-3 space-y-3 text-sm text-slate-600">

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500"/>
              Centralized lead database
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500"/>
              Smart lead qualification
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500"/>
              Automated follow-up process
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500"/>
              Sales pipeline tracking
            </li>

          </ul>

        </div>

        <div className="p-5 border rounded-2xl border-slate-200 bg-slate-50">

          <h3 className="font-semibold text-slate-900">
            Enterprise Features
          </h3>

          <ul className="mt-3 space-y-3 text-sm text-slate-600">

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-500"/>
              Customer interaction history
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-500"/>
              AI-powered lead insights
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-500"/>
              Team collaboration
            </li>

            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-500"/>
              Real-time analytics dashboard
            </li>

          </ul>

        </div>

      </div>

    </div>

  </div>

  {/* Quick Summary */}
  <div className="overflow-hidden text-white shadow-lg rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">

    <div className="px-6 py-5 border-b border-white/10">

      <h2 className="flex items-center gap-2 text-xl font-bold">
        <Sparkles size={20}/>
        CRM Overview
      </h2>

      <p className="mt-1 text-sm text-slate-300">
        ReadyTech Enterprise Platform
      </p>

    </div>

    <div className="p-6 space-y-5">

      <div className="flex items-start gap-3">

        <div className="p-2 rounded-xl bg-white/10">
          <Target size={18}/>
        </div>

        <div>

          <h4 className="font-semibold">
            Sales Growth
          </h4>

          <p className="mt-1 text-sm text-slate-300">
            Convert more prospects into customers with structured sales
            workflows.
          </p>

        </div>

      </div>

      <div className="flex items-start gap-3">

        <div className="p-2 rounded-xl bg-white/10">
          <Users size={18}/>
        </div>

        <div>

          <h4 className="font-semibold">
            Customer Management
          </h4>

          <p className="mt-1 text-sm text-slate-300">
            Maintain complete customer records and communication history.
          </p>

        </div>

      </div>

      <div className="flex items-start gap-3">

        <div className="p-2 rounded-xl bg-white/10">
          <TrendingUp size={18}/>
        </div>

        <div>

          <h4 className="font-semibold">
            Performance Analytics
          </h4>

          <p className="mt-1 text-sm text-slate-300">
            Monitor KPIs, conversion rates, and sales performance with
            real-time dashboards.
          </p>

        </div>

      </div>

      <div className="p-4 mt-6 border rounded-2xl border-white/10 bg-white/10">

        <div className="flex items-center justify-between">

          <span className="text-sm text-slate-300">
            CRM Status
          </span>

          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
            Operational
          </span>

        </div>

      </div>

    </div>

  </div>

</div>

      {/* ============ CREATE / EDIT DRAWER ============ */}
      <Drawer
        open={drawerOpen}
        title={form._id ? "Edit Lead" : "New Lead"}
        subtitle={form._id ? "Update this lead's details" : "Add a new lead to your pipeline"}
        icon={form._id ? Pencil : Plus}
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={saveLead} className="flex flex-col h-full">

  <div className="flex-1 px-6 py-6 space-y-8 overflow-y-auto">

    {/* ================= PERSONAL INFORMATION ================= */}

    <div className="p-5 bg-white border rounded-2xl border-slate-200">

      <h3 className="mb-5 text-lg font-semibold text-slate-900">
        👤 Personal Information
      </h3>

      <div className="grid gap-5 md:grid-cols-2">

        <Field label="Full Name" required>
          <input
            required
            value={form.name}
            onChange={(e)=>setForm({...form,name:e.target.value})}
            placeholder="John Smith"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Designation">
          <input
            value={form.designation || ""}
            onChange={(e)=>setForm({...form,designation:e.target.value})}
            placeholder="Sales Manager"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e)=>setForm({...form,email:e.target.value})}
            placeholder="john@company.com"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e)=>setForm({...form,phone:e.target.value})}
            placeholder="+91 9876543210"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

      </div>

    </div>

    {/* ================= COMPANY ================= */}

    <div className="p-5 bg-white border rounded-2xl border-slate-200">

      <h3 className="mb-5 text-lg font-semibold text-slate-900">
        🏢 Company Information
      </h3>

      <div className="grid gap-5 md:grid-cols-2">

        <Field label="Company">
          <input
            value={form.company || ""}
            onChange={(e)=>setForm({...form,company:e.target.value})}
            placeholder="ABC Technologies"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Industry">
          <input
            value={form.industry || ""}
            onChange={(e)=>setForm({...form,industry:e.target.value})}
            placeholder="Software"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Website">
          <input
            value={form.website || ""}
            onChange={(e)=>setForm({...form,website:e.target.value})}
            placeholder="https://company.com"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Company Size">
          <select
            value={form.companySize || ""}
            onChange={(e)=>setForm({...form,companySize:e.target.value})}
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          >
            <option value="">Select</option>
            <option>1-10</option>
            <option>11-50</option>
            <option>51-200</option>
            <option>201-500</option>
            <option>500+</option>
          </select>
        </Field>

      </div>

    </div>

    {/* ================= LEAD DETAILS ================= */}

    <div className="p-5 bg-white border rounded-2xl border-slate-200">

      <h3 className="mb-5 text-lg font-semibold text-slate-900">
        🎯 Lead Details
      </h3>

      <div className="grid gap-5 md:grid-cols-2">

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e)=>setForm({...form,status:e.target.value})}
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          >
            {LEAD_STATUSES.map((s)=>(
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Lead Source">
          <select
            value={form.source}
            onChange={(e)=>setForm({...form,source:e.target.value})}
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          >
            {LEAD_SOURCES.map((s)=>(
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            value={form.priority || "Medium"}
            onChange={(e)=>setForm({...form,priority:e.target.value})}
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>

        <Field label="Assigned To">
          <input
            value={form.assignedTo || ""}
            onChange={(e)=>setForm({...form,assignedTo:e.target.value})}
            placeholder="Sales Executive"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

      </div>

    </div>

    {/* ================= SALES ================= */}

    <div className="p-5 bg-white border rounded-2xl border-slate-200">

      <h3 className="mb-5 text-lg font-semibold text-slate-900">
        💰 Sales Information
      </h3>

      <div className="grid gap-5 md:grid-cols-2">

        <Field label="Expected Deal Value">
          <input
            type="number"
            value={form.expectedValue || ""}
            onChange={(e)=>setForm({...form,expectedValue:e.target.value})}
            placeholder="50000"
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

        <Field label="Follow-up Date">
          <input
            type="date"
            value={form.followUpDate || ""}
            onChange={(e)=>setForm({...form,followUpDate:e.target.value})}
            className="w-full px-4 py-3 border rounded-xl border-slate-200 bg-slate-50"
          />
        </Field>

      </div>

    </div>

    {/* ================= NOTES ================= */}

    <div className="p-5 bg-white border rounded-2xl border-slate-200">

      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        📝 Notes
      </h3>

      <textarea
        rows={5}
        value={form.notes}
        onChange={(e)=>setForm({...form,notes:e.target.value})}
        placeholder="Enter customer requirements, follow-up details, meeting notes..."
        className="w-full px-4 py-3 border resize-none rounded-xl border-slate-200 bg-slate-50"
      />

    </div>

  </div>

  {/* ================= FOOTER ================= */}

  <div className="flex items-center justify-between px-6 py-5 border-t border-slate-200 bg-slate-50">

    <p className="text-xs text-slate-500">
      ReadyTech CRM • Enterprise Lead Management
    </p>

    <div className="flex gap-3">

      <button
        type="button"
        onClick={()=>setDrawerOpen(false)}
        className="px-6 py-3 font-medium border rounded-xl border-slate-300"
      >
        Cancel
      </button>

      <button
        type="submit"
        className="px-8 py-3 font-semibold text-white shadow-lg rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-xl"
      >
        {form._id ? "Update Lead" : "Create Lead"}
      </button>

    </div>

  </div>

</form>
      </Drawer>

      {/* ============ PROFILE DRAWER ============ */}
      <Drawer
        open={profileOpen && !!activeLead}
        title={activeLead?.name || "Lead"}
        subtitle={activeLead?.company || "Lead profile"}
        icon={User}
        onClose={() => setProfileOpen(false)}
      >
        {activeLead && (
         <div className="flex flex-col h-full">

  <div className="flex-1 overflow-y-auto">

    {/* ================= HERO ================= */}

    <div className="p-6 text-white bg-gradient-to-r from-slate-950 via-indigo-900 to-blue-900">

      <div className="flex items-start gap-5">

        <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold rounded-full shadow-lg bg-white/10">
          {activeLead.name?.charAt(0)}
        </div>

        <div className="flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-2xl font-bold">
              {activeLead.name}
            </h2>

            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
              {activeLead.status}
            </span>

          </div>

          <p className="mt-1 text-slate-300">
            {activeLead.designation || "Lead"}
          </p>

          <p className="mt-2 text-sm text-slate-300">
            {activeLead.company || "ReadyTech CRM Customer"}
          </p>

          <div className="flex flex-wrap gap-2 mt-4">

            <span className="px-3 py-1 text-xs rounded-full bg-white/10">
              Lead ID : RTS-{activeLead._id?.slice(-6)}
            </span>

            <span className="px-3 py-1 text-xs rounded-full bg-indigo-500/20">
              Source : {activeLead.source || "Website"}
            </span>

            <span className="px-3 py-1 text-xs text-yellow-300 rounded-full bg-yellow-500/20">
              Priority : {activeLead.priority || "Medium"}
            </span>

          </div>

        </div>

      </div>

    </div>

    {/* ================= QUICK STATS ================= */}

    <div className="grid grid-cols-3 gap-4 p-6">

      <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">
        <p className="text-xs text-slate-500">Lead Score</p>
        <h3 className="mt-2 text-2xl font-bold text-indigo-600">
          {activeLead.leadScore || 82}
        </h3>
      </div>

      <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">
        <p className="text-xs text-slate-500">Expected Deal</p>
        <h3 className="mt-2 text-xl font-bold text-emerald-600">
          ₹{activeLead.expectedValue || "0"}
        </h3>
      </div>

      <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">
        <p className="text-xs text-slate-500">Follow-up</p>
        <h3 className="mt-2 text-sm font-semibold">
          {activeLead.followUpDate || "Not Scheduled"}
        </h3>
      </div>

    </div>

    {/* ================= CONTACT DETAILS ================= */}

    <div className="p-6 mx-6 bg-white border shadow-sm rounded-2xl">

      <h3 className="mb-5 text-lg font-semibold">
        Contact Information
      </h3>

      <div className="grid gap-4 md:grid-cols-2">

        <Detail icon={Mail} label="Email" value={activeLead.email} />

        <Detail icon={Phone} label="Phone" value={activeLead.phone} />

        <Detail icon={Building2} label="Company" value={activeLead.company} />

        <Detail icon={Globe} label="Website" value={activeLead.website} />

        <Detail icon={Briefcase} label="Industry" value={activeLead.industry} />

        <Detail
          icon={CalendarClock}
          label="Created"
          value={
            activeLead.createdAt
              ? new Date(activeLead.createdAt).toLocaleString()
              : "-"
          }
        />

      </div>

    </div>

    {/* ================= SALES INFORMATION ================= */}

    <div className="p-6 mx-6 mt-6 bg-white border shadow-sm rounded-2xl">

      <h3 className="mb-5 text-lg font-semibold">
        Sales Information
      </h3>

      <div className="grid gap-4 md:grid-cols-2">

        <Detail
          icon={Target}
          label="Lead Status"
          value={activeLead.status}
        />

        <Detail
          icon={Flag}
          label="Priority"
          value={activeLead.priority || "Medium"}
        />

        <Detail
          icon={User}
          label="Assigned To"
          value={activeLead.assignedTo || "Not Assigned"}
        />

        <Detail
          icon={IndianRupee}
          label="Expected Deal"
          value={`₹${activeLead.expectedValue || 0}`}
        />

      </div>

    </div>

    {/* ================= NOTES ================= */}

    <div className="p-6 mx-6 mt-6 mb-6 bg-white border shadow-sm rounded-2xl">

      <h3 className="mb-4 text-lg font-semibold">
        Notes
      </h3>

      <p className="leading-7 text-slate-600">
        {activeLead.notes || "No notes have been added for this lead yet."}
      </p>

    </div>

  </div>

  {/* ================= FOOTER ================= */}

  <div className="p-5 border-t bg-slate-50">

    <div className="flex flex-wrap gap-3">

      <button
        onClick={() => {
          setForm(activeLead);
          setProfileOpen(false);
          setDrawerOpen(true);
        }}
        className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium border rounded-xl hover:bg-white"
      >
        <Pencil size={16} />
        Edit Lead
      </button>

      <button
        className="flex items-center justify-center flex-1 gap-2 px-4 py-3 border rounded-xl hover:bg-white"
      >
        <Phone size={16} />
        Call
      </button>

      <button
        className="flex items-center justify-center flex-1 gap-2 px-4 py-3 border rounded-xl hover:bg-white"
      >
        <Mail size={16} />
        Email
      </button>

      <button
        onClick={() => setAiLead(activeLead)}
        className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600"
      >
        <Bot size={16} />
        Ask AI
      </button>

    </div>

  </div>

</div>
        )}
      </Drawer>

      {/* AI ASSISTANT PANEL */}
      {aiLead && <LeadAIAssistant lead={aiLead} onClose={() => setAiLead(null)} />}
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Kpi({
  title,
  value,
  icon: Icon,
  accent = "indigo",
  hint,
  trend,
  trendType = "up",
}) {
  const gradients = {
    indigo: "from-indigo-500 to-indigo-700",
    blue: "from-sky-500 to-blue-700",
    emerald: "from-emerald-500 to-green-700",
    violet: "from-violet-500 to-purple-700",
    red: "from-red-500 to-rose-700",
  };

  return (
    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-xl">

      {/* Background Glow */}
      <div
        className={`absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br ${gradients[accent]} opacity-10 blur-3xl`}
      />

      <div className="relative flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            {value}
          </h2>

          <p className="mt-2 text-xs text-slate-500">
            {hint}
          </p>

          <div
            className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              trendType === "up"
                ? "bg-emerald-50 text-emerald-700"
                : trendType === "down"
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {trend}
          </div>

        </div>

        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradients[accent]} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon size={24} />
        </div>

      </div>

    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  color = "slate",
  className = "",
}) {
  const colors = {
    slate:
      "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    blue:
      "text-blue-600 hover:bg-blue-50 hover:text-blue-700",
    green:
      "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
    red:
      "text-red-600 hover:bg-red-50 hover:text-red-700",
    violet:
      "text-violet-600 hover:bg-violet-50 hover:text-violet-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${colors[color]} ${className}`}
    >
      {children}
    </button>
  );
}

function Drawer({
  open,
  title,
  subtitle,
  icon: Icon,
  children,
  onClose,
}) {
  return (
    <AnimatePresence>

      {open && (
        <>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: .35,
              ease: "easeOut",
            }}
            className="fixed inset-y-0 right-0 z-[61] flex h-screen w-full max-w-3xl flex-col overflow-hidden bg-slate-50 shadow-[0_20px_80px_rgba(0,0,0,.35)]"
          >

            {/* Header */}

            <div className="px-8 py-6 text-white bg-gradient-to-r from-slate-950 via-indigo-900 to-blue-900">

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  {Icon && (
                    <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 backdrop-blur">

                      <Icon size={24} />

                    </div>
                  )}

                  <div>

                    <h2 className="text-2xl font-bold">
                      {title}
                    </h2>

                    {subtitle && (
                      <p className="mt-1 text-sm text-slate-300">
                        {subtitle}
                      </p>
                    )}

                  </div>

                </div>

                <button
                  onClick={onClose}
                  className="p-2 transition rounded-xl hover:bg-white/10"
                >
                  <X size={22} />
                </button>

              </div>

            </div>

            {/* Body */}

            <div className="flex-1 overflow-y-auto">
              {children}
            </div>

          </motion.aside>

        </>
      )}

    </AnimatePresence>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}) {
  return (
    <div>

      <div className="flex items-center justify-between mb-2">

        <label className="text-sm font-semibold text-slate-700">

          {label}

          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}

        </label>

        {hint && (
          <span className="text-xs text-slate-400">
            {hint}
          </span>
        )}

      </div>

      {children}

    </div>
  );
}