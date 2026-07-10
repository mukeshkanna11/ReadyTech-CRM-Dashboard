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

      {/* ============ HERO HEADER ============ */}
      <div className="relative overflow-hidden text-white shadow-xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">
        <div className="absolute rounded-full -right-24 -top-24 h-72 w-72 bg-indigo-500/20 blur-3xl" />
        <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
              <Users size={28} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">
                <Sparkles size={13} /> ReadyTech CRM
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lead Management</h1>
              <p className="max-w-2xl mt-2 text-sm leading-relaxed text-slate-300">
                Capture, nurture and convert prospects into revenue — track every
                interaction from first contact to deal closure.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchLeads}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition rounded-xl bg-white/10 hover:bg-white/20"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={() => { setForm(EMPTY_FORM); setDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition bg-white shadow-sm text-slate-900 rounded-xl hover:bg-slate-100 hover:scale-[1.03] active:scale-95"
            >
              <Plus size={16} /> Add New Lead
            </button>
          </div>
        </div>
      </div>

      {/* ============ KPI CARDS ============ */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi title="Total Leads" value={totalLeads} icon={Users} accent="indigo" hint="All captured leads" />
        <Kpi title="New Leads" value={newLeads} icon={TrendingUp} accent="blue" hint="Awaiting first contact" />
        <Kpi title="Qualified" value={qualifiedLeads} icon={CheckCircle} accent="green" hint="Sales-ready" />
        <Kpi title="Conversion Rate" value={`${conversionRate}%`} icon={Target} accent="violet" hint="Qualified / total" />
      </div>

      {/* ============ SEARCH & FILTERS ============ */}
      <div className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone or company…"
              className="w-full py-3 pr-4 text-sm transition border outline-none bg-slate-50 border-slate-200 pl-11 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-slate-400 sm:inline"><Filter size={16} /></span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm transition border outline-none bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="All">All Status</option>
              {LEAD_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm transition border outline-none bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="All">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm transition border outline-none bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
            >
              {sources.map((s) => (<option key={s} value={s}>{s === "All" ? "All Sources" : s}</option>))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2.5 text-sm transition text-slate-500 hover:text-slate-800"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredLeads.length}</span> of {leads.length} leads
        </p>
      </div>

      {/* ============ TABLE ============ */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        {/* ERROR STATE */}
        {error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="grid mb-4 rounded-2xl h-14 w-14 place-items-center bg-red-50 text-red-500">
              <AlertTriangle size={26} />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Unable to load leads</h3>
            <p className="max-w-sm mt-1 text-sm text-slate-500">{error}</p>
            <button
              onClick={fetchLeads}
              className="inline-flex items-center gap-2 px-5 py-2.5 mt-5 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <RefreshCw size={16} /> Try again
            </button>
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
                <div className="h-6 rounded-full w-20 bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : paginatedLeads.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="grid mb-4 rounded-2xl h-14 w-14 place-items-center bg-indigo-50 text-indigo-500">
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
              <thead className="border-b bg-slate-50 text-slate-500 border-slate-200">
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

      {/* ============ INFO STRIP ============ */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200">
          <h3 className="mb-2 text-base font-semibold text-slate-900">What are Leads in ReadyTech CRM?</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Leads are individuals or organizations that show interest in your services.
            ReadyTech CRM helps your sales team capture leads from websites, calls, emails
            and campaigns, track engagement, and convert them into real business opportunities.
          </p>
        </div>
        <div className="p-6 text-white shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl">
          <h3 className="flex items-center gap-2 mb-3 text-base font-semibold">
            How ReadyTech Helps <ArrowRight size={16} />
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-400" /> Centralized lead database</li>
            <li className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-400" /> Status-based sales pipeline</li>
            <li className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-400" /> Faster follow-ups & better conversions</li>
            <li className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-400" /> Clear visibility for sales managers</li>
          </ul>
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
          <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
            <Field label="Full Name" required>
              <input
                value={form.name}
                required
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Jane Cooper"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40" />
              </Field>
            </div>
            <Field label="Company">
              <input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40">
                  {LEAD_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </Field>
              <Field label="Source">
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40">
                  {LEAD_SOURCES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Add context, requirements or next steps…"
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40"
              />
            </Field>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 py-3 text-sm font-medium transition border rounded-xl border-slate-200 text-slate-600 hover:bg-white">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700">
              {form._id ? "Save Changes" : "Create Lead"}
            </button>
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
            <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[activeLead.status] || "bg-slate-100 text-slate-600"}`}>
                  {activeLead.status}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_STYLES[priorityOf(activeLead.status)]}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priorityOf(activeLead.status)]}`} />
                  {priorityOf(activeLead.status)} priority
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Detail icon={Mail} label="Email" value={activeLead.email} />
                <Detail icon={Phone} label="Phone" value={activeLead.phone} />
                <Detail icon={Building2} label="Company" value={activeLead.company} />
                <Detail icon={Activity} label="Source" value={activeLead.source} />
                <Detail icon={CalendarClock} label="Created" value={activeLead.createdAt ? new Date(activeLead.createdAt).toLocaleString() : null} />
              </div>

              <div>
                <h4 className="mb-1.5 text-xs font-semibold tracking-wide uppercase text-slate-400">Notes</h4>
                <p className="text-sm leading-relaxed text-slate-600">{activeLead.notes || "No notes added yet."}</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => { setForm(activeLead); setProfileOpen(false); setDrawerOpen(true); }}
                className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-medium transition border rounded-xl border-slate-200 text-slate-700 hover:bg-white"
              >
                <Pencil size={16} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setAiLead(activeLead)}
                className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-semibold text-white transition bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:opacity-90"
              >
                <Bot size={16} /> Ask AI
              </button>
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
function Kpi({ title, value, icon: Icon, accent, hint }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="p-5 transition bg-white border shadow-sm rounded-2xl border-slate-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${colors[accent] || colors.indigo}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title, className = "" }) {
  return (
    <button onClick={onClick} title={title} className={`grid h-8 w-8 place-items-center rounded-lg transition ${className}`}>
      {children}
    </button>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm break-words text-slate-700">{value || "—"}</p>
      </div>
    </div>
  );
}

function Drawer({ open, title, subtitle, icon: Icon, children, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="grid text-indigo-600 rounded-xl h-10 w-10 place-items-center bg-indigo-50">
                    <Icon size={18} />
                  </div>
                )}
                <div>
                  <h2 className="text-base font-semibold leading-tight text-slate-900">{title}</h2>
                  {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                </div>
              </div>
              <button onClick={onClose} className="grid transition rounded-lg h-9 w-9 place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
