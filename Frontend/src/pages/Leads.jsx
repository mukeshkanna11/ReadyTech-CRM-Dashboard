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
  X,
  Filter,
  Users,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Bot,
  ChevronLeft,
  ChevronRight,
  Building2,
  CalendarClock,
  Target,
  Globe,
  Briefcase,
  Flag,
  IndianRupee,
  Download,
  Upload,
} from "lucide-react";
import {

  BarChart3,

  Megaphone,

  Zap,


} from "lucide-react";
import LeadAIAssistant from "../components/LeadAIAssistant";

const PAGE_SIZE = 8;

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",

  status: "New",

  source: "Website",

  priority: "Medium",

  value: "",

  department: "Sales",

  notes: "",
};

/* =========================================================
   BACKEND ENUM VALUES
========================================================= */

const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Google Ads",
  "Email Campaign",
  "WhatsApp",
  "Phone Call",
  "Walk-In",
  "Other",
];

const LEAD_PRIORITIES = [
  "Low",
  "Medium",
  "High",
];

const LEAD_DEPARTMENTS = [
  "Sales",
  "Marketing",
  "Support",
  "ERP",
  "CRM",
  "Digital Marketing",
];

/* =========================================================
   STATUS STYLES
========================================================= */

const STATUS_STYLES = {
  New: "bg-blue-100 text-blue-700",

  Contacted:
    "bg-amber-100 text-amber-700",

  Qualified:
    "bg-green-100 text-green-700",

  Proposal:
    "bg-purple-100 text-purple-700",

  Negotiation:
    "bg-orange-100 text-orange-700",

  Won:
    "bg-emerald-100 text-emerald-700",

  Lost:
    "bg-red-100 text-red-700",
};

/* =========================================================
   PRIORITY STYLES
========================================================= */

const PRIORITY_STYLES = {
  High:
    "bg-rose-100 text-rose-700",

  Medium:
    "bg-amber-100 text-amber-700",

  Low:
    "bg-slate-100 text-slate-600",
};

const PRIORITY_DOT = {
  High:
    "bg-rose-500",

  Medium:
    "bg-amber-500",

  Low:
    "bg-slate-400",
};

const priorityOf = (lead) =>
  lead?.priority || "Medium";

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Leads() {
  const [leads, setLeads] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [sourceFilter, setSourceFilter] =
    useState("All");

  const [priorityFilter, setPriorityFilter] =
    useState("All");

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [activeLead, setActiveLead] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [aiLead, setAiLead] =
    useState(null);

  const [page, setPage] =
    useState(1);


  /* =========================================================
     FETCH LEADS
  ========================================================= */

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await API.get(
        "/leads?limit=1000"
      );

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];

      setLeads(data);
    } catch (err) {
      console.error(
        "FETCH LEADS ERROR:",
        err
      );

      setError(
        "We couldn't load your leads. Please check your connection and try again."
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to load leads"
      );

      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  /* =========================================================
     SAVE LEAD
  ========================================================= */

  const saveLead = async (e) => {
    e.preventDefault();

    try {
      if (!form.name?.trim()) {
        toast.error("Lead name is required");
        return;
      }

      /*
       * IMPORTANT:
       * Payload contains ONLY backend LeadSchema fields.
       *
       * owner is intentionally NOT sent here.
       * Backend controller should use req.user._id.
       */

      const payload = {
        name: form.name.trim(),

        email:
          form.email?.trim() || "",

        phone:
          form.phone?.trim() || "",

        company:
          form.company?.trim() || "",

        status:
          form.status || "New",

        source:
          form.source || "Website",

        priority:
          form.priority || "Medium",

        value:
          Number(form.value || 0),

        department:
          form.department || "Sales",

        notes:
          form.notes?.trim() || "",
      };

      console.log(
        "LEAD PAYLOAD:",
        payload
      );

      if (form._id) {
        await API.put(
          `/leads/${form._id}`,
          payload
        );

        toast.success(
          "Lead updated successfully"
        );
      } else {
        await API.post(
          "/leads",
          payload
        );

        toast.success(
          "Lead created successfully"
        );
      }

      setDrawerOpen(false);

      setForm({
        ...EMPTY_FORM,
      });

      await fetchLeads();
    } catch (err) {
      console.error(
        "SAVE LEAD ERROR:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to save lead"
      );
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const deleteLead = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this lead?"
      )
    ) {
      return;
    }

    try {
      await API.delete(
        `/leads/${id}`
      );

      toast.success(
        "Lead deleted successfully"
      );

      await fetchLeads();
    } catch (err) {
      console.error(
        "DELETE LEAD ERROR:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          "Delete failed"
      );
    }
  };

const convertLead = async (lead) => {
  if (!lead?._id) return;

  try {
    const res = await API.post(
      `/leads/${lead._id}/convert`,
      {
        title: `${lead.name} Opportunity`,
        value: Number(lead.value || 0),
      }
    );

    toast.success(
      res.data?.message ||
        "Lead converted successfully"
    );

    setProfileOpen(false);

    await fetchLeads();
  } catch (err) {
    console.error("CONVERT LEAD ERROR:", err);

    toast.error(
      err?.response?.data?.message ||
        "Failed to convert lead"
    );
  }
};
  
  /* =========================================================
     INLINE STATUS UPDATE
  ========================================================= */

  const updateLeadStatus = async (
    lead,
    status
  ) => {
    if (
      !lead?._id ||
      lead.status === status
    ) {
      return;
    }

    const previousStatus =
      lead.status;

    /* Optimistic update */

    setLeads((prev) =>
      prev.map((item) =>
        item._id === lead._id
          ? {
              ...item,
              status,
            }
          : item
      )
    );

    try {
      await API.put(
        `/leads/${lead._id}`,
        {
          status,
        }
      );

      toast.success(
        `Lead moved to ${status}`
      );
    } catch (err) {
      console.error(
        "STATUS UPDATE ERROR:",
        err
      );

      /* Rollback */

      setLeads((prev) =>
        prev.map((item) =>
          item._id === lead._id
            ? {
                ...item,
                status:
                  previousStatus,
              }
            : item
        )
      );

      toast.error(
        err?.response?.data?.message ||
          "Status update failed"
      );
    }
  };

  /* =========================================================
     SOURCES
  ========================================================= */

  const sources = useMemo(() => {
    const existingSources =
      leads
        .map((lead) => lead.source)
        .filter(Boolean);

    return [
      "All",
      ...Array.from(
        new Set(existingSources)
      ),
    ];
  }, [leads]);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredLeads = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return leads
      .filter((lead) => {
        if (!searchValue) {
          return true;
        }

        return `
          ${lead.name || ""}
          ${lead.email || ""}
          ${lead.phone || ""}
          ${lead.company || ""}
        `
          .toLowerCase()
          .includes(searchValue);
      })

      .filter((lead) =>
        statusFilter === "All"
          ? true
          : lead.status === statusFilter
      )

      .filter((lead) =>
        sourceFilter === "All"
          ? true
          : lead.source === sourceFilter
      )

      .filter((lead) =>
        priorityFilter === "All"
          ? true
          : priorityOf(lead) ===
            priorityFilter
      );
  }, [
    leads,
    search,
    statusFilter,
    sourceFilter,
    priorityFilter,
  ]);

  const hasFilters =
    Boolean(search) ||
    statusFilter !== "All" ||
    sourceFilter !== "All" ||
    priorityFilter !== "All";

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages =
    Math.ceil(
      filteredLeads.length /
        PAGE_SIZE
    ) || 1;

  const paginatedLeads =
    filteredLeads.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );

  const rangeStart =
    filteredLeads.length
      ? (page - 1) *
          PAGE_SIZE +
        1
      : 0;

  const rangeEnd =
    Math.min(
      page * PAGE_SIZE,
      filteredLeads.length
    );

  const pageNumbers = useMemo(() => {
    const arr = [];

    const end = Math.min(
      totalPages,
      Math.max(page + 2, 5)
    );

    const start = Math.max(
      1,
      end - 4
    );

    for (
      let i = start;
      i <= end;
      i++
    ) {
      arr.push(i);
    }

    return arr;
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    sourceFilter,
    priorityFilter,
  ]);

  /* =========================================================
     KPI
  ========================================================= */

  const totalLeads =
    leads.length;

  const newLeads =
    leads.filter(
      (lead) =>
        lead.status === "New"
    ).length;

  const qualifiedLeads =
    leads.filter(
      (lead) =>
        lead.status ===
        "Qualified"
    ).length;

  const wonLeads =
    leads.filter(
      (lead) =>
        lead.status === "Won"
    ).length;

  const conversionRate =
    totalLeads
      ? Math.round(
          (wonLeads /
            totalLeads) *
            100
        )
      : 0;

  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setSourceFilter("All");
    setPriorityFilter("All");
  };

  /* =========================================================
     OPEN CREATE
  ========================================================= */

  const openCreateDrawer = () => {
    setForm({
      ...EMPTY_FORM,
    });

    setDrawerOpen(true);
  };

  /* =========================================================
     OPEN EDIT
  ========================================================= */

  const openEditDrawer = (lead) => {
    setForm({
      ...EMPTY_FORM,

      ...lead,

      value:
        lead.value ?? "",
    });

    setDrawerOpen(true);
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-screen p-4 space-y-6 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 sm:p-6 lg:p-8 lg:space-y-8">

      {/* =====================================================
          HERO
      ===================================================== */}

      <div className="relative overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900">

        <div className="absolute rounded-full -right-28 -top-28 h-80 w-80 bg-indigo-500/20 blur-3xl" />

        <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-violet-500/10 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_45%)]" />

        <div className="relative p-6 sm:p-8">

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

            <div className="space-y-5">

              <div className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase border rounded-full border-white/10 bg-white/10 backdrop-blur">

                <Sparkles size={13} />

                ReadyTech Solutions CRM

              </div>

              <div className="flex items-start gap-4">

                <div className="flex items-center justify-center w-16 h-16 shadow-xl rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">

                  <Users size={30} />

                </div>

                <div>

                  <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
                    Lead Management
                  </h1>

                  <p className="max-w-3xl mt-3 text-sm leading-7 text-slate-300">
                    Centralize customer acquisition,
                    monitor lead pipelines,
                    manage follow-ups,
                    and improve conversion
                    rates using the ReadyTech
                    CRM platform.
                  </p>

                </div>

              </div>

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

            <div className="flex flex-col gap-5">

              <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

                <div className="flex items-center gap-2">

                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />

                  <span className="text-sm font-semibold">
                    CRM Services Online
                  </span>

                </div>

                <p className="mt-2 text-xs text-slate-300">
                  Lead synchronization and
                  customer workflows are
                  operating normally.
                </p>

              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  onClick={fetchLeads}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-medium transition rounded-xl bg-white/10 backdrop-blur hover:bg-white/20"
                >
                  <RefreshCw
                    size={16}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh Data
                </button>

                <button
                  onClick={openCreateDrawer}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition bg-white shadow-lg rounded-xl text-slate-900 hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  <Plus size={16} />

                  Add New Lead
                </button>

              </div>

            </div>

          </div>

          {/* HERO STATS */}

          <div className="grid gap-4 pt-6 mt-8 border-t border-white/10 sm:grid-cols-2 xl:grid-cols-4">

            <HeroStat
              label="Total Leads"
              value={totalLeads}
            />

            <HeroStat
              label="New Leads"
              value={newLeads}
            />

            <HeroStat
              label="Qualified Leads"
              value={qualifiedLeads}
            />

            <HeroStat
              label="Won Leads"
              value={wonLeads}
            />

          </div>

        </div>
      </div>

      {/* =====================================================
          KPI
      ===================================================== */}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

        <Kpi
          title="Total Leads"
          value={totalLeads}
          icon={Users}
          accent="indigo"
          hint="All captured prospects"
          trend="Live"
          trendType="up"
        />

        <Kpi
          title="New Leads"
          value={newLeads}
          icon={TrendingUp}
          accent="blue"
          hint="Awaiting first contact"
          trend="Pipeline"
          trendType="up"
        />

        <Kpi
          title="Qualified Leads"
          value={qualifiedLeads}
          icon={CheckCircle}
          accent="emerald"
          hint="Sales-ready opportunities"
          trend="Qualified"
          trendType="up"
        />

        <Kpi
          title="Conversion Rate"
          value={`${conversionRate}%`}
          icon={Target}
          accent="violet"
          hint="Won vs Total Leads"
          trend={`${wonLeads} Won`}
          trendType="neutral"
        />

      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Search & Lead Filters
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search prospects and refine
                your sales pipeline.
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

                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

                  <span className="text-xs font-semibold text-emerald-700">
                    Live Search
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        <div className="p-6 space-y-5">

          {/* SEARCH */}

          <div className="relative max-w-xl">

            <Search
              size={18}
              className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search by name, email, phone or company..."
              className="w-full py-3 pl-12 pr-12 text-sm transition bg-white border shadow-sm outline-none rounded-2xl border-slate-200 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            />

            {search && (
              <button
                onClick={() =>
                  setSearch("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            )}

          </div>

          {/* FILTER GRID */}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="px-4 py-3 text-sm bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            >

              <option value="All">
                All Status
              </option>

              {LEAD_STATUSES.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}

            </select>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value
                )
              }
              className="px-4 py-3 text-sm bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            >

              <option value="All">
                All Priority
              </option>

              {LEAD_PRIORITIES.map(
                (priority) => (
                  <option
                    key={priority}
                    value={priority}
                  >
                    {priority}
                  </option>
                )
              )}

            </select>

            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(
                  e.target.value
                )
              }
              className="px-4 py-3 text-sm bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            >

              {sources.map(
                (source) => (
                  <option
                    key={source}
                    value={source}
                  >
                    {source === "All"
                      ? "All Sources"
                      : source}
                  </option>
                )
              )}

            </select>

            <button
              onClick={clearFilters}
              disabled={!hasFilters}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                hasFilters
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              Clear All Filters
            </button>

          </div>

          <div className="flex flex-col gap-3 pt-5 text-sm border-t border-slate-200 text-slate-600 md:flex-row md:items-center md:justify-between">

            <p>
              Showing{" "}
              <span className="font-bold text-slate-900">
                {filteredLeads.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-900">
                {leads.length}
              </span>{" "}
              total leads.
            </p>

            <div className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-indigo-700 rounded-full bg-indigo-50">

              <Filter size={14} />

              Enterprise CRM Filters

            </div>

          </div>

        </div>
      </div>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">

        {error ? (

          <div className="flex flex-col gap-5 p-8 text-center">

            <div className="grid mx-auto text-red-500 rounded-2xl h-14 w-14 place-items-center bg-red-50">

              <AlertTriangle
                size={26}
              />

            </div>

            <div>

              <h3 className="text-lg font-semibold text-slate-900">
                Unable to load leads
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {error}
              </p>

            </div>

            <button
              onClick={fetchLeads}
              className="inline-flex items-center gap-2 px-5 py-2.5 mx-auto text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
            >
              <RefreshCw
                size={16}
              />

              Try Again
            </button>

          </div>

        ) : loading ? (

          <div className="p-6 space-y-4">

            {[...Array(6)].map(
              (_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4"
                >

                  <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />

                  <div className="flex-1 space-y-2">

                    <div className="w-1/3 h-3 rounded bg-slate-100 animate-pulse" />

                    <div className="w-1/4 h-2.5 rounded bg-slate-100 animate-pulse" />

                  </div>

                  <div className="w-20 h-6 rounded-full bg-slate-100 animate-pulse" />

                </div>
              )
            )}

          </div>

        ) : paginatedLeads.length === 0 ? (

          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">

            <div className="grid mb-4 text-indigo-500 rounded-2xl h-14 w-14 place-items-center bg-indigo-50">

              <Users size={26} />

            </div>

            <h3 className="text-base font-semibold text-slate-800">

              {hasFilters
                ? "No leads match your filters"
                : "No leads yet"}

            </h3>

            <p className="max-w-sm mt-1 text-sm text-slate-500">

              {hasFilters
                ? "Try adjusting or clearing your filters."
                : "Start building your pipeline by adding your first lead."}

            </p>

            {hasFilters ? (

              <button
                onClick={
                  clearFilters
                }
                className="mt-5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Clear filters
              </button>

            ) : (

              <button
                onClick={
                  openCreateDrawer
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 mt-5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
              >
                <Plus size={16} />

                Add New Lead
              </button>

            )}

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead className="border-b bg-slate-50">

                <tr>

                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase">
                    Lead
                  </th>

                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase md:table-cell">
                    Contact
                  </th>

                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase">
                    Status
                  </th>

                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase lg:table-cell">
                    Priority
                  </th>

                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase sm:table-cell">
                    Source
                  </th>

                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase xl:table-cell">
                    Deal Value
                  </th>

                  <th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase xl:table-cell">
                    Created
                  </th>

                  <th className="px-6 py-3.5 text-xs font-semibold tracking-wider text-right uppercase">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {paginatedLeads.map(
                  (lead) => {
                    const priority =
                      priorityOf(
                        lead
                      );

                    return (
                      <tr
                        key={
                          lead._id
                        }
                        className="transition hover:bg-slate-50/70"
                      >

                        {/* LEAD */}

                        <td
                          className="px-6 py-4 cursor-pointer"
                          onClick={() => {
                            setActiveLead(
                              lead
                            );

                            setProfileOpen(
                              true
                            );
                          }}
                        >

                          <div className="flex items-center gap-3">

                            <div className="grid text-sm font-semibold text-white rounded-full h-9 w-9 shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">

                              {(
                                lead.name ||
                                "?"
                              )
                                .charAt(
                                  0
                                )
                                .toUpperCase()}

                            </div>

                            <div className="min-w-0">

                              <div className="font-medium truncate text-slate-900">
                                {lead.name ||
                                  "Unnamed"}
                              </div>

                              <div className="text-xs truncate text-slate-500 md:hidden">
                                {lead.email ||
                                  "—"}
                              </div>

                              {lead.company && (
                                <div className="hidden text-xs truncate text-slate-400 md:block">
                                  {
                                    lead.company
                                  }
                                </div>
                              )}

                            </div>

                          </div>

                        </td>

                        {/* CONTACT */}

                        <td className="hidden px-6 py-4 space-y-1 text-xs md:table-cell text-slate-600">

                          <div className="flex items-center gap-2">

                            <Mail
                              size={14}
                              className="text-slate-400"
                            />

                            {lead.email ||
                              "—"}

                          </div>

                          <div className="flex items-center gap-2">

                            <Phone
                              size={14}
                              className="text-slate-400"
                            />

                            {lead.phone ||
                              "—"}

                          </div>

                        </td>

                        {/* STATUS */}

                        <td className="px-6 py-4">

                          <select
                            value={
                              lead.status ||
                              "New"
                            }
                            onClick={(e) =>
                              e.stopPropagation()
                            }
                            onChange={(e) =>
                              updateLeadStatus(
                                lead,
                                e.target.value
                              )
                            }
                            className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                              STATUS_STYLES[
                                lead.status
                              ] ||
                              "bg-slate-100 text-slate-600"
                            }`}
                          >

                            {LEAD_STATUSES.map(
                              (
                                status
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {
                                    status
                                  }
                                </option>
                              )
                            )}

                          </select>

                        </td>

                        {/* PRIORITY */}

                        <td className="hidden px-6 py-4 lg:table-cell">

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}
                          >

                            <span
                              className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`}
                            />

                            {priority}

                          </span>

                        </td>

                        {/* SOURCE */}

                        <td className="hidden px-6 py-4 sm:table-cell text-slate-600">

                          {lead.source ||
                            "—"}

                        </td>

                        {/* VALUE */}

                        <td className="hidden px-6 py-4 xl:table-cell">

                          <span className="font-semibold text-emerald-600">

                            ₹
                            {Number(
                              lead.value ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}

                          </span>

                        </td>

                        {/* CREATED */}

                        <td className="hidden px-6 py-4 text-xs xl:table-cell text-slate-500">

                          {lead.createdAt
                            ? new Date(
                                lead.createdAt
                              ).toLocaleDateString()
                            : "—"}

                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-4">

                          <div className="flex items-center justify-end gap-1">

                            <IconButton
                              onClick={() =>
                                setAiLead(
                                  lead
                                )
                              }
                              title="AI Assistant"
                              className="text-indigo-600 hover:bg-indigo-50"
                            >
                              <Bot
                                size={
                                  16
                                }
                              />
                            </IconButton>

                            <IconButton
                              onClick={() =>
                                openEditDrawer(
                                  lead
                                )
                              }
                              title="Edit"
                              className="text-slate-500 hover:bg-slate-100"
                            >
                              <Pencil
                                size={
                                  16
                                }
                              />
                            </IconButton>

                            <IconButton
                              onClick={() =>
                                deleteLead(
                                  lead._id
                                )
                              }
                              title="Delete"
                              className="text-red-500 hover:bg-red-50"
                            >
                              <Trash2
                                size={
                                  16
                                }
                              />
                            </IconButton>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

        {/* PAGINATION */}

        {!loading &&
          !error &&
          filteredLeads.length >
            0 && (

            <div className="flex flex-col gap-3 px-6 py-4 border-t sm:flex-row sm:items-center sm:justify-between border-slate-200 bg-slate-50">

              <span className="text-xs text-slate-500">

                Showing{" "}

                <span className="font-semibold text-slate-700">
                  {rangeStart}–
                  {rangeEnd}
                </span>{" "}

                of{" "}
                {
                  filteredLeads.length
                }

              </span>

              <div className="flex items-center gap-1">

                <button
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current -
                            1
                        )
                    )
                  }
                  disabled={
                    page <= 1
                  }
                  className="grid transition rounded-lg h-9 w-9 place-items-center text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft
                    size={18}
                  />
                </button>

                {pageNumbers.map(
                  (number) => (
                    <button
                      key={number}
                      onClick={() =>
                        setPage(
                          number
                        )
                      }
                      className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium ${
                        number ===
                        page
                          ? "bg-indigo-600 text-white"
                          : "text-slate-600 hover:bg-white"
                      }`}
                    >
                      {number}
                    </button>
                  )
                )}

                <button
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current +
                            1
                        )
                    )
                  }
                  disabled={
                    page >=
                    totalPages
                  }
                  className="grid transition rounded-lg h-9 w-9 place-items-center text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  <ChevronRight
                    size={18}
                  />
                </button>

              </div>

            </div>
          )}

      </div>

      {/* =====================================================
          CRM INFORMATION
      ===================================================== */}

      <div className="grid gap-6 xl:grid-cols-3">

        <div className="overflow-hidden bg-white border shadow-sm xl:col-span-2 rounded-3xl border-slate-200">

          <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">

            <div className="flex items-center gap-4">

              <div className="flex items-center justify-center shadow-lg h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600">

                <Users
                  size={26}
                  className="text-white"
                />

              </div>

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  About ReadyTech CRM Lead Management
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Intelligent customer acquisition
                  and sales pipeline management.
                </p>

              </div>

            </div>

          </div>

          <div className="p-6 space-y-5">

            <p className="leading-7 text-slate-600">

              The{" "}
              <strong>
                Lead Management
              </strong>{" "}
              module helps organizations
              capture, organize, qualify,
              nurture, and convert potential
              customers into business
              opportunities.

            </p>

            <div className="grid gap-4 md:grid-cols-2">

              <InfoBox
                title="Business Benefits"
                items={[
                  "Centralized lead database",
                  "Smart lead qualification",
                  "Sales pipeline tracking",
                  "Lead conversion management",
                ]}
              />

              <InfoBox
                title="Enterprise Features"
                items={[
                  "Customer interaction history",
                  "Priority management",
                  "Department-based leads",
                  "Real-time CRM analytics",
                ]}
              />

            </div>

          </div>

        </div>

        <div className="overflow-hidden text-white shadow-lg rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">

          <div className="px-6 py-5 border-b border-white/10">

            <h2 className="flex items-center gap-2 text-xl font-bold">

              <Sparkles size={20} />

              CRM Overview

            </h2>

            <p className="mt-1 text-sm text-slate-300">
              ReadyTech Enterprise Platform
            </p>

          </div>

          <div className="p-6 space-y-5">

            <OverviewItem
              icon={Target}
              title="Sales Growth"
              description="Convert more prospects into customers with structured sales workflows."
            />

            <OverviewItem
              icon={Users}
              title="Customer Management"
              description="Maintain complete customer records and communication history."
            />

            <OverviewItem
              icon={TrendingUp}
              title="Performance Analytics"
              description="Monitor conversion rates and sales performance."
            />

            <div className="p-4 border rounded-2xl border-white/10 bg-white/10">

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

      <Drawer
  open={drawerOpen}
  title={form._id ? "Edit Lead" : "New Lead"}
  subtitle={
    form._id
      ? "Update this lead's details"
      : "Add a new lead to your pipeline"
  }
  icon={form._id ? Pencil : Plus}
  onClose={() => setDrawerOpen(false)}
>

  <form
    onSubmit={saveLead}
    className="flex flex-col h-full min-h-0"
  >

    {/* SCROLLABLE CONTENT */}
    <div className="flex-1 min-h-0 px-6 py-6 space-y-6 overflow-y-auto">

            {/* PERSONAL INFORMATION */}
<FormSection
  title="Personal Information"
  icon="👤"
>
  <div className="space-y-6">

    {/* Section intro */}
    <div className="flex items-start gap-3 p-4 border bg-gradient-to-r from-slate-50 to-white border-slate-200 rounded-2xl">
      <div className="flex items-center justify-center w-10 h-10 text-lg bg-white border shadow-sm rounded-xl border-slate-200">
        👤
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Contact Details
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Enter the lead's basic contact and company information.
        </p>
      </div>
    </div>

    {/* Fields */}
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

      {/* Full Name */}
      <Field label="Full Name" required>
        <div className="relative group">
          <div className="absolute -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">👤</span>
            </div>
          </div>

          <input
            required
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            placeholder="John Smith"
            className="w-full h-12 pr-4 text-sm font-medium transition-all duration-200 bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
      </Field>

      {/* Email */}
      <Field label="Email">
        <div className="relative group">
          <div className="absolute -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">✉️</span>
            </div>
          </div>

          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
            placeholder="john@company.com"
            className="w-full h-12 pr-4 text-sm font-medium transition-all duration-200 bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
      </Field>

      {/* Phone */}
      <Field label="Phone">
        <div className="relative group">
          <div className="absolute -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">📱</span>
            </div>
          </div>

          <input
            value={form.phone}
            onChange={(e) =>
              setForm({
                ...form,
                phone: e.target.value,
              })
            }
            placeholder="+91 9876543210"
            className="w-full h-12 pr-4 text-sm font-medium transition-all duration-200 bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
      </Field>

      {/* Company */}
      <Field label="Company">
        <div className="relative group">
          <div className="absolute -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">🏢</span>
            </div>
          </div>

          <input
            value={form.company}
            onChange={(e) =>
              setForm({
                ...form,
                company: e.target.value,
              })
            }
            placeholder="ABC Technologies"
            className="w-full h-12 pr-4 text-sm font-medium transition-all duration-200 bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
      </Field>

    </div>

    {/* Required info */}
    <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
      <span className="text-red-500">*</span>
      <span>Required field</span>
    </div>

  </div>
</FormSection>


            {/* LEAD DETAILS */}
<FormSection
  title="Lead Details"
  icon="🎯"
>
  <div className="space-y-6">

    {/* Section intro */}
    <div className="flex items-start gap-3 p-4 border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-white rounded-2xl">
      <div className="flex items-center justify-center w-10 h-10 text-lg bg-white border border-indigo-100 shadow-sm rounded-xl">
        🎯
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Qualification & Classification
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">
          Define the lead status, source, priority, and responsible department.
        </p>
      </div>
    </div>

    {/* Lead fields */}
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

      {/* STATUS */}
      <Field label="Status">
        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">📊</span>
            </div>
          </div>

          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
            className="w-full h-12 pr-10 text-sm font-medium transition-all duration-200 bg-white border outline-none appearance-none cursor-pointer pl-14 text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="absolute -translate-y-1/2 pointer-events-none right-4 top-1/2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

        </div>
      </Field>

      {/* LEAD SOURCE */}
      <Field label="Lead Source">
        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">📣</span>
            </div>
          </div>

          <select
            value={form.source}
            onChange={(e) =>
              setForm({
                ...form,
                source: e.target.value,
              })
            }
            className="w-full h-12 pr-10 text-sm font-medium transition-all duration-200 bg-white border outline-none appearance-none cursor-pointer pl-14 text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          >
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>

          <div className="absolute -translate-y-1/2 pointer-events-none right-4 top-1/2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

        </div>
      </Field>

      {/* PRIORITY */}
      <Field label="Priority">
        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">⚡</span>
            </div>
          </div>

          <select
            value={form.priority}
            onChange={(e) =>
              setForm({
                ...form,
                priority: e.target.value,
              })
            }
            className="w-full h-12 pr-10 text-sm font-medium transition-all duration-200 bg-white border outline-none appearance-none cursor-pointer pl-14 text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          >
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <div className="absolute -translate-y-1/2 pointer-events-none right-4 top-1/2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

        </div>
      </Field>

      {/* DEPARTMENT */}
      <Field label="Department">
        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-indigo-50 group-focus-within:border-indigo-200">
              <span className="text-sm">🏢</span>
            </div>
          </div>

          <select
            value={form.department}
            onChange={(e) =>
              setForm({
                ...form,
                department: e.target.value,
              })
            }
            className="w-full h-12 pr-10 text-sm font-medium transition-all duration-200 bg-white border outline-none appearance-none cursor-pointer pl-14 text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          >
            {LEAD_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <div className="absolute -translate-y-1/2 pointer-events-none right-4 top-1/2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </div>

        </div>
      </Field>

    </div>

  </div>
</FormSection>

           {/* SALES INFORMATION */}
<FormSection
  title="Sales Information"
  icon="💰"
>
  <div className="space-y-6">

    {/* Section intro */}
    <div className="flex items-start gap-3 p-4 border bg-gradient-to-r from-emerald-50/70 via-white to-white border-emerald-100 rounded-2xl">
      <div className="flex items-center justify-center w-10 h-10 text-lg bg-white border shadow-sm rounded-xl border-emerald-100">
        💰
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Deal Value
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">
          Add the estimated monetary value of this lead opportunity.
        </p>
      </div>
    </div>

    {/* Deal Value */}
    <div className="max-w-xl">
      <Field label="Deal Value">

        <div className="relative group">

          {/* Currency icon */}
          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 transition-all border rounded-lg bg-slate-50 border-slate-200 group-focus-within:bg-emerald-50 group-focus-within:border-emerald-200">
              <IndianRupee
                size={16}
                className="text-slate-500 group-focus-within:text-emerald-600"
              />
            </div>
          </div>

          <input
            type="number"
            min="0"
            value={form.value}
            onChange={(e) =>
              setForm({
                ...form,
                value: e.target.value,
              })
            }
            placeholder="50,000"
            className="w-full h-12 pr-16 text-sm font-semibold transition-all duration-200 bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />

          {/* Currency label */}
          <div className="absolute -translate-y-1/2 right-3 top-1/2">
            <span className="px-2 py-1 text-[10px] font-bold tracking-wide rounded-md text-slate-500 bg-slate-100">
              INR
            </span>
          </div>

        </div>

      </Field>

      {/* Value preview */}
      {form.value && Number(form.value) > 0 && (
        <div className="flex items-center gap-2 px-1 mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

          <span className="text-xs text-slate-500">
            Estimated deal value:
          </span>

          <span className="text-xs font-semibold text-emerald-600">
            ₹
            {Number(form.value).toLocaleString("en-IN")}
          </span>
        </div>
      )}

    </div>

  </div>
</FormSection>

            {/* NOTES */}

            <FormSection
              title="Notes"
              icon="📝"
            >

              <textarea
                rows={6}
                value={
                  form.notes
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes:
                      e.target
                        .value,
                  })
                }
                placeholder="Enter customer requirements, follow-up details, meeting notes..."
                className="w-full px-4 py-3 border outline-none resize-none rounded-xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />

            </FormSection>

          </div>

        {/* FOOTER */}
<div
  className="
    flex-shrink-0
    flex flex-col
    gap-4
    w-full
    px-6
    py-4
    bg-white
    border-t border-slate-200
    shadow-[0_-4px_20px_rgba(15,23,42,0.08)]
    sm:flex-row
    sm:items-center
    sm:justify-between
  "
>
  {/* Footer Info */}
  <div className="items-center hidden gap-3 sm:flex">

    <div
      className="flex items-center justify-center border border-indigo-100 w-9 h-9 bg-indigo-50 rounded-xl"
    >
      <span className="text-sm">✨</span>
    </div>

    <div>
      <p className="text-xs font-semibold text-slate-700">
        ReadyTech CRM
      </p>

      <p className="text-[11px] text-slate-400">
        Enterprise Lead Management
      </p>
    </div>

  </div>

  {/* Actions */}
  <div className="flex items-center justify-end w-full gap-3 sm:w-auto">

    {/* Cancel */}
    <button
      type="button"
      onClick={() => setDrawerOpen(false)}
      className="
        flex items-center justify-center
        h-11
        px-6
        text-sm
        font-semibold
        text-slate-600
        bg-white
        border border-slate-200
        rounded-xl
        transition-all duration-200
        hover:bg-slate-50
        hover:border-slate-300
        active:scale-[0.98]
      "
    >
      Cancel
    </button>

    {/* Submit */}
    <button
      type="submit"
      className="
        relative
        flex items-center justify-center
        h-11
        px-7
        overflow-hidden
        text-sm
        font-semibold
        text-white
        rounded-xl
        shadow-md
        bg-gradient-to-r
        from-indigo-600
        via-indigo-600
        to-violet-600
        transition-all duration-200
        hover:shadow-lg
        hover:from-indigo-700
        hover:to-violet-700
        active:scale-[0.98]
      "
    >
      <span className="absolute inset-0 transition-opacity opacity-0 bg-white/10" />

      <span className="relative">
        {form._id ? "Update Lead" : "Create Lead"}
      </span>
    </button>

  </div>
</div>

        </form>

      </Drawer>

      {/* =====================================================
          PROFILE DRAWER
      ===================================================== */}

      <Drawer
        open={
          profileOpen &&
          !!activeLead
        }
        title={
          activeLead?.name ||
          "Lead"
        }
        subtitle={
          activeLead?.company ||
          "Lead profile"
        }
        icon={User}
        onClose={() =>
          setProfileOpen(false)
        }
      >

        {activeLead && (
          <div className="flex flex-col h-full">

            <div className="flex-1 overflow-y-auto">

              {/* PROFILE HERO */}

              <div className="p-6 text-white bg-gradient-to-r from-slate-950 via-indigo-900 to-blue-900">

                <div className="flex items-start gap-5">

                  <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold rounded-full shadow-lg bg-white/10">

                    {activeLead.name
                      ?.charAt(0)
                      ?.toUpperCase()}

                  </div>

                  <div className="flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <h2 className="text-2xl font-bold">
                        {
                          activeLead.name
                        }
                      </h2>

                      <span
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          STATUS_STYLES[
                            activeLead.status
                          ] ||
                          "bg-white/10"
                        }`}
                      >
                        {
                          activeLead.status
                        }
                      </span>

                    </div>

                    <p className="mt-2 text-sm text-slate-300">

                      {activeLead.company ||
                        "Lead Customer"}

                    </p>

                    <div className="flex flex-wrap gap-2 mt-4">

                      <span className="px-3 py-1 text-xs rounded-full bg-white/10">
                        Lead ID:
                        {" RTS-"}
                        {activeLead._id?.slice(
                          -6
                        )}
                      </span>

                      <span className="px-3 py-1 text-xs rounded-full bg-indigo-500/20">
                        Source:{" "}
                        {activeLead.source ||
                          "Website"}
                      </span>

                      <span className="px-3 py-1 text-xs text-yellow-300 rounded-full bg-yellow-500/20">
                        Priority:{" "}
                        {activeLead.priority ||
                          "Medium"}
                      </span>

                    </div>

                  </div>

                </div>

              </div>

              {/* QUICK STATS */}

              <div className="grid grid-cols-3 gap-4 p-6">

                <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">

                  <p className="text-xs text-slate-500">
                    Priority
                  </p>

                  <h3 className="mt-2 text-lg font-bold text-indigo-600">
                    {activeLead.priority ||
                      "Medium"}
                  </h3>

                </div>

                <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">

                  <p className="text-xs text-slate-500">
                    Deal Value
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-emerald-600">

                    ₹
                    {Number(
                      activeLead.value ||
                        0
                    ).toLocaleString(
                      "en-IN"
                    )}

                  </h3>

                </div>

                <div className="p-4 text-center bg-white border shadow-sm rounded-2xl">

                  <p className="text-xs text-slate-500">
                    Status
                  </p>

                  <h3 className="mt-2 text-sm font-semibold">
                    {
                      activeLead.status
                    }
                  </h3>

                </div>

              </div>

              {/* CONTACT */}

              <ProfileSection title="Contact Information">

                <div className="grid gap-4 md:grid-cols-2">

                  <Detail
                    icon={Mail}
                    label="Email"
                    value={
                      activeLead.email
                    }
                  />

                  <Detail
                    icon={Phone}
                    label="Phone"
                    value={
                      activeLead.phone
                    }
                  />

                  <Detail
                    icon={Building2}
                    label="Company"
                    value={
                      activeLead.company
                    }
                  />

                  <Detail
                    icon={Flag}
                    label="Source"
                    value={
                      activeLead.source
                    }
                  />

                </div>

              </ProfileSection>

              {/* SALES */}

              <ProfileSection
                title="Sales Information"
              >

                <div className="grid gap-4 md:grid-cols-2">

                  <Detail
                    icon={Target}
                    label="Lead Status"
                    value={
                      activeLead.status
                    }
                  />

                  <Detail
                    icon={Flag}
                    label="Priority"
                    value={
                      activeLead.priority ||
                      "Medium"
                    }
                  />

                  <Detail
                    icon={Briefcase}
                    label="Department"
                    value={
                      activeLead.department ||
                      "Sales"
                    }
                  />

                  <Detail
                    icon={
                      IndianRupee
                    }
                    label="Deal Value"
                    value={`₹${Number(
                      activeLead.value ||
                        0
                    ).toLocaleString(
                      "en-IN"
                    )}`}
                  />

                </div>

              </ProfileSection>

              {/* CONVERSION */}

              <ProfileSection
                title="Lead Conversion"
              >

                <div className="grid gap-4 md:grid-cols-2">

                  <Detail
                    icon={
                      CheckCircle
                    }
                    label="Converted"
                    value={
                      activeLead.isConverted
                        ? "Yes"
                        : "No"
                    }
                  />

                  <Detail
                    icon={
                      CalendarClock
                    }
                    label="Converted At"
                    value={
                      activeLead.convertedAt
                        ? new Date(
                            activeLead.convertedAt
                          ).toLocaleString()
                        : "Not Converted"
                    }
                  />

                </div>

              </ProfileSection>

              {/* CREATED */}

              <ProfileSection
                title="Record Information"
              >

                <Detail
                  icon={
                    CalendarClock
                  }
                  label="Created"
                  value={
                    activeLead.createdAt
                      ? new Date(
                          activeLead.createdAt
                        ).toLocaleString()
                      : "-"
                  }
                />

                <div className="mt-4">

                  <Detail
                    icon={
                      CalendarClock
                    }
                    label="Last Updated"
                    value={
                      activeLead.updatedAt
                        ? new Date(
                            activeLead.updatedAt
                          ).toLocaleString()
                        : "-"
                    }
                  />

                </div>

              </ProfileSection>

              {/* NOTES */}

              <ProfileSection title="Notes">

                <p className="leading-7 text-slate-600">

                  {activeLead.notes ||
                    "No notes have been added for this lead yet."}

                </p>

              </ProfileSection>

            </div>

            {/* PROFILE FOOTER */}

<div className="p-5 border-t bg-slate-50">

  <div className="flex flex-wrap gap-3">

    {/* EDIT */}
    <button
      onClick={() => {
        setForm({
          ...EMPTY_FORM,
          ...activeLead,
          value: activeLead.value ?? "",
        });

        setProfileOpen(false);
        setDrawerOpen(true);
      }}
      className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium border rounded-xl hover:bg-white"
    >
      <Pencil size={16} />
      Edit Lead
    </button>

    {/* CALL */}
    <button
      onClick={() =>
        activeLead.phone &&
        (window.location.href = `tel:${activeLead.phone}`)
      }
      disabled={!activeLead.phone}
      className="flex items-center justify-center flex-1 gap-2 px-4 py-3 border rounded-xl hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Phone size={16} />
      Call
    </button>

    {/* EMAIL */}
    <button
      onClick={() =>
        activeLead.email &&
        (window.location.href = `mailto:${activeLead.email}`)
      }
      disabled={!activeLead.email}
      className="flex items-center justify-center flex-1 gap-2 px-4 py-3 border rounded-xl hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Mail size={16} />
      Email
    </button>

    {/* CONVERT TO OPPORTUNITY */}
    {!activeLead.isConverted ? (
  <button
    onClick={() => convertLead(activeLead)}
    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white transition rounded-xl bg-emerald-600 hover:bg-emerald-700"
  >
    <Target size={16} />
    Convert to Opportunity
  </button>
) : (
  <button
    disabled
    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold cursor-not-allowed text-emerald-700 rounded-xl bg-emerald-100"
  >
    <CheckCircle size={16} />
    Converted
  </button>
)}

    {/* AI */}
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

      {/* AI */}

      {aiLead && (
        <LeadAIAssistant
          lead={aiLead}
          onClose={() =>
            setAiLead(null)
          }
        />
      )}

    </div>
  );
}

function Drawer({
  open,
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
      
      {/* Overlay */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close drawer"
      />

      {/* Drawer */}
      <div className="relative z-10 flex flex-col w-full h-full bg-white shadow-2xl sm:max-w-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 px-6 py-5 border-b border-slate-200">
          
          <div className="flex items-center gap-3">
            
            <div className="flex items-center justify-center w-10 h-10 text-indigo-600 bg-indigo-50 rounded-xl">
              {Icon && <Icon size={20} />}
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {title}
              </h2>

              {subtitle && (
                <p className="mt-0.5 text-sm text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid w-10 h-10 transition rounded-xl place-items-center text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>

        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {children}
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   HERO STAT
========================================================= */

function HeroStat({
  label,
  value,
}) {
  return (
    <div>

      <p className="text-xs tracking-wide uppercase text-slate-400">
        {label}
      </p>

      <h3 className="mt-1 text-2xl font-bold">
        {value}
      </h3>

    </div>
  );
}

/* =========================================================
   KPI
========================================================= */

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
    indigo:
      "from-indigo-500 to-indigo-700",

    blue:
      "from-sky-500 to-blue-700",

    emerald:
      "from-emerald-500 to-green-700",

    violet:
      "from-violet-500 to-purple-700",

    red:
      "from-red-500 to-rose-700",
  };

  return (
    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-xl">

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

/* =========================================================
   ICON BUTTON
========================================================= */

function IconButton({
  children,
  onClick,
  title,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      {children}
    </button>
  );
}



/* =========================================================
   FORM SECTION
========================================================= */

/* =========================================================
   FORM SECTION
========================================================= */

function FormSection({
  title,
  icon,
  children,
}) {
  return (
    <section className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200">
      
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
        
        <div className="flex items-center justify-center w-10 h-10 text-lg border border-indigo-100 bg-indigo-50 rounded-xl">
          {icon}
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">
            {title}
          </h3>

          <p className="mt-0.5 text-xs text-slate-400">
            Enter and manage lead information
          </p>
        </div>

      </div>

      {/* Fields */}
      <div>
        {children}
      </div>

    </section>
  );
}

/* =========================================================
   FIELD
========================================================= */

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  required = false,
  hint,
  children,
}) {
  return (
    <div className="min-w-0">

      <div className="flex items-center justify-between mb-2">

        <label className="text-sm font-semibold text-slate-700">
          {label}

          {required && (
            <span className="ml-1 text-red-500">
              *
            </span>
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

/* =========================================================
   PROFILE SECTION
========================================================= */

function ProfileSection({
  title,
  children,
}) {
  return (
    <div className="p-6 mx-6 mt-6 bg-white border shadow-sm rounded-2xl">

      <h3 className="mb-5 text-lg font-semibold text-slate-900">
        {title}
      </h3>

      {children}

    </div>
  );
}

/* =========================================================
   DETAIL
========================================================= */

function Detail({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="p-2 rounded-xl bg-slate-100">

        <Icon
          size={16}
          className="text-slate-500"
        />

      </div>

      <div className="min-w-0">

        <p className="text-xs text-slate-400">
          {label}
        </p>

        <p className="mt-1 text-sm font-medium break-words text-slate-700">
          {value || "—"}
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   INFO BOX
========================================================= */

function InfoBox({
  title,
  items,
}) {
  return (
    <div className="p-5 border rounded-2xl border-slate-200 bg-slate-50">

      <h3 className="font-semibold text-slate-900">
        {title}
      </h3>

      <ul className="mt-3 space-y-3 text-sm text-slate-600">

        {items.map(
          (item) => (
            <li
              key={item}
              className="flex items-center gap-2"
            >

              <CheckCircle
                size={16}
                className="text-emerald-500"
              />

              {item}

            </li>
          )
        )}

      </ul>

    </div>
  );
}

/* =========================================================
   OVERVIEW ITEM
========================================================= */

function OverviewItem({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="p-2 rounded-xl bg-white/10">

        <Icon size={18} />

      </div>

      <div>

        <h4 className="font-semibold">
          {title}
        </h4>

        <p className="mt-1 text-sm text-slate-300">
          {description}
        </p>

      </div>

    </div>
  );
}