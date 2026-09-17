import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Clock3,
  ClipboardList,
  Flag,
  IndianRupee,
  Download,
  Upload,
  AlertTriangle,
  BarChart3,
  Megaphone,
  Zap,
  PhoneCall,
  PhoneOff,
} from "lucide-react";

import LeadAIAssistant from "../components/LeadAIAssistant";

const PAGE_SIZE = 8;

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  name: "",
  designation: "",
  email: "",
  phone: "",

  company: "",
  industry: "",
  website: "",
  companySize: "",

  requirement: "",
  message: "",

  status: "New",
  source: "Website",
  priority: "Medium",

  assignedTo: "",

  value: "",
  expectedValue: "",

  followUpDate: "",
  lastContactedAt: "",
  nextFollowUpAt: "",

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

const [activities, setActivities] = useState([]);
const [activitiesLoading, setActivitiesLoading] = useState(false);

const [users, setUsers] = useState([]);
const [usersLoading, setUsersLoading] = useState(false);

/* =========================================================
   TWILIO BROWSER CALL (outbound only)
   The Device is created lazily on the first Call click and
   destroyed when the panel closes — never on page load.
========================================================= */

const [callLead, setCallLead] = useState(null);
// idle | connecting | ringing | connected | completed | failed
const [callState, setCallState] = useState("idle");
const [callError, setCallError] = useState("");
const [callSeconds, setCallSeconds] = useState(0);

const deviceRef = useRef(null);
const callRef = useRef(null);
// Guards a second Device while the first one is still being created
const callStartingRef = useRef(false);
// device.connect() rejects with `undefined` when the signaling stream closes,
// so the real TwilioError only ever arrives on the Device "error" event.
const lastDeviceErrorRef = useRef(null);

/* Pull code / message / causes / twilioError out of a Twilio error */
const describeCallError = (err) => {
  const twilioError = err?.twilioError || err;
  const original = twilioError?.originalError;

  const code = twilioError?.code ?? original?.code;
  const message =
    original?.message ||
    twilioError?.description ||
    twilioError?.message ||
    err?.message;

  if (!code && !message) return "";
  return code ? `(${code}) ${message || "Signaling error"}` : message;
};

const logCallError = (label, err) => {
  const twilioError = err?.twilioError || err;
  console.error(label, {
    code: twilioError?.code,
    message: twilioError?.message,
    causes: twilioError?.causes,
    twilioError: err?.twilioError,
    originalError: twilioError?.originalError,
    raw: err,
  });
};

/* Tick the duration only while connected */
useEffect(() => {
  if (callState !== "connected") return;

  const id = setInterval(
    () => setCallSeconds((s) => s + 1),
    1000
  );

  return () => clearInterval(id);
}, [callState]);

const formatDuration = (total) => {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const teardownCall = () => {
  try {
    callRef.current?.disconnect?.();
  } catch {
    /* already gone */
  }
  callRef.current = null;

  try {
    deviceRef.current?.destroy?.();
  } catch {
    /* already gone */
  }
  deviceRef.current = null;
};

const startCall = async (lead) => {
  // Requirement 4: guard a missing number, never start a call.
  if (!lead?.phone) {
    toast.error("This lead has no phone number");
    return;
  }

  if (
    callStartingRef.current ||
    callState === "connecting" ||
    callState === "ringing" ||
    callState === "connected"
  ) {
    toast.error("A call is already in progress");
    return;
  }

  callStartingRef.current = true;
  lastDeviceErrorRef.current = null;

  setCallLead(lead);
  setCallError("");
  setCallSeconds(0);
  setCallState("connecting");

  try {
    // Reuses the shared axios instance -> Authorization header
    const { data } = await API.get("/voip/token");
    const token = data?.data?.token;

    if (!token) throw new Error("No Twilio token returned");

    // Loaded on demand so the SDK never runs on page load
    const { Device } = await import("@twilio/voice-sdk");

    teardownCall();

    const device = new Device(token, {
      codecPreferences: ["opus", "pcmu"],
      disableAudioContextSounds: true,
      // Without this the SDK collapses every signaling error it receives
      // (31001-31107, 31202/31203/31207, 31404/31480/31486, 31603) into the
      // generic "ConnectionError (53000)" with no code, message or causes.
      enableImprovedSignalingErrorPrecision: true,
    });

    deviceRef.current = device;

    device.on("error", (err) => {
      lastDeviceErrorRef.current = err;
      logCallError("Twilio device error:", err);
      setCallError(describeCallError(err) || "Device error");
      setCallState("failed");
    });

    const call = await device.connect({
      // Requirement 8: lead mapping travels with the call
      params: {
        To: String(lead.phone),
        leadId: String(lead._id),
      },
    });

    callRef.current = call;

    call.on("ringing", () => setCallState("ringing"));
    call.on("accept", () => setCallState("connected"));

    call.on("disconnect", () => {
      setCallState("completed");
      callRef.current = null;
      // Requirement 10: refresh this lead's timeline via the existing helper
      setTimeout(() => fetchActivities(lead._id), 1500);
    });

    call.on("cancel", () => setCallState("completed"));

    call.on("error", (err) => {
      logCallError("Twilio call error:", err);
      setCallError(describeCallError(err) || "Call error");
      setCallState("failed");
    });

    // connect() resolves after accept() has already been kicked off, so a very
    // fast call can emit "accept" before the handlers above are attached.
    const status = call.status?.();
    if (status === "open") setCallState("connected");
    else if (status === "ringing") setCallState("ringing");
  } catch (err) {
    // A closed signaling stream rejects with `undefined`; the Device "error"
    // event carries the actual TwilioError.
    const realErr = err || lastDeviceErrorRef.current;

    logCallError("Failed to start call:", realErr);
    setCallError(
      err?.response?.data?.message ||
        describeCallError(realErr) ||
        describeCallError(lastDeviceErrorRef.current) ||
        "Unable to start call"
    );
    setCallState("failed");
    teardownCall();
  } finally {
    callStartingRef.current = false;
  }
};

const endCall = () => {
  try {
    callRef.current?.disconnect?.();
  } catch {
    /* ignore */
  }
  setCallState("completed");
};

const closeCallPanel = () => {
  const leadId = callLead?._id;

  teardownCall();
  setCallLead(null);
  setCallState("idle");
  setCallSeconds(0);
  setCallError("");

  if (leadId) fetchActivities(leadId);
};

/* Clean up if the page unmounts mid-call */
useEffect(() => teardownCall, []);


/* =========================================================
   FETCH LEADS
========================================================= */

const fetchLeads = async () => {
  try {
    setLoading(true);
    setError("");

    const res = await API.get("/leads?limit=1000");

    console.log("LEADS API RESPONSE:", res.data);

    const data = Array.isArray(res.data)
      ? res.data
      : res.data?.data || [];

    console.log("FIRST LEAD:", data[0]);
    console.log("ASSIGNED TO:", data[0]?.assignedTo);

    setLeads(data);
  } catch (err) {
    console.error("FETCH LEADS ERROR:", err);
    setLeads([]);
  } finally {
    setLoading(false);
  }
};


/* =========================================================
   FETCH USERS
========================================================= */

const fetchUsers = async () => {
  try {
    setUsersLoading(true);

    const res = await API.get("/admin/users");

    console.log("USERS RESPONSE:", res.data);

    const data =
      res.data?.users ||
      res.data?.data ||
      (Array.isArray(res.data) ? res.data : []);

    setUsers(data);

  } catch (err) {
    console.error("FETCH USERS ERROR:", err);
    console.error("STATUS:", err?.response?.status);
    console.error("ERROR DATA:", err?.response?.data);

    toast.error(
      err?.response?.data?.message ||
      "Failed to load users"
    );

    setUsers([]);

  } finally {
    setUsersLoading(false);
  }
};


/* =========================================================
   INITIAL LOAD
========================================================= */

useEffect(() => {
  fetchLeads();
  fetchUsers();
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
console.log("FORM ASSIGNED TO:", form.assignedTo);
   const payload = {
  name: form.name?.trim() || "",
  designation: form.designation?.trim() || "",
  email: form.email?.trim() || "",
  phone: form.phone?.trim() || "",
  company: form.company?.trim() || "",
  industry: form.industry?.trim() || "",
  website: form.website?.trim() || "",
  companySize: form.companySize || "",
  requirement: form.requirement?.trim() || "",
  message: form.message?.trim() || "",

  status: form.status || "New",
  source: form.source || "Website",
  priority: form.priority || "Medium",
  assignedTo: form.assignedTo || "",

  value: Number(form.value || 0),
  expectedValue: Number(form.expectedValue || 0),

  followUpDate: form.followUpDate || null,
  lastContactedAt: form.lastContactedAt || null,
  nextFollowUpAt: form.nextFollowUpAt || null,

  department: form.department || "Sales",
  notes: form.notes?.trim() || "",
};
console.log("PAYLOAD ASSIGNED TO:", payload.assignedTo);
    console.log("LEAD PAYLOAD:", payload);

    let response;

    // =========================
    // UPDATE LEAD
    // =========================
    if (form._id) {
      response = await API.put(
        `/leads/${form._id}`,
        payload
      );

      console.log(
        "UPDATE LEAD RESPONSE:",
        response.data
      );

      toast.success(
        response?.data?.message ||
        "Lead updated successfully"
      );

    // =========================
    // CREATE LEAD
    // =========================
    } else {
      response = await API.post(
        "/leads",
        payload
      );

      console.log(
        "CREATE LEAD RESPONSE:",
        response.data
      );

      toast.success(
        response?.data?.message ||
        "Lead created successfully"
      );
    }

    // =========================
    // SUCCESS
    // =========================

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

    setLeads((prev) =>
  prev.map((item) =>
    item._id === lead._id
      ? {
          ...item,
          isConverted: true,
          convertedAt: new Date().toISOString(),
        }
      : item
  )
);

setActiveLead((prev) =>
  prev
    ? {
        ...prev,
        isConverted: true,
        convertedAt: new Date().toISOString(),
      }
    : prev
);

setProfileOpen(true);

    await fetchLeads();
  } catch (err) {
    console.error("CONVERT LEAD ERROR:", err);

    toast.error(
      err?.response?.data?.message ||
        "Failed to convert lead"
    );
  }
};
  

const fetchActivities = async (leadId) => {
  if (!leadId) return;

  try {
    setActivitiesLoading(true);

   const response = await fetch(
  `${import.meta.env.VITE_API_URL}/activities?lead=${leadId}`
);

    const result = await response.json();

    if (result.success) {
      setActivities(result.data || []);
    } else {
      setActivities([]);
    }
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    setActivities([]);
  } finally {
    setActivitiesLoading(false);
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
<th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase lg:table-cell">
  Assigned To
</th>

<th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase xl:table-cell">
  Follow-up
</th>

<th className="hidden px-6 py-3.5 text-xs font-semibold tracking-wider text-left uppercase xl:table-cell">
  Expected Value
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
  setActivities([]);
  setActiveLead(lead);
  setProfileOpen(true);
  fetchActivities(lead._id);
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

                        {/* ASSIGNED TO */}
<td className="hidden px-6 py-4 lg:table-cell">
  <div className="flex items-center gap-2">

    {(() => {
      const assignedUser = users.find(
        (user) =>
          String(user._id) === String(lead.assignedTo)
      );

      const userName =
        assignedUser?.name || "Unassigned";

      const userEmail =
        assignedUser?.email || "";

      return (
        <>
          <div className="flex items-center justify-center w-8 h-8 text-xs font-semibold text-indigo-600 rounded-full bg-indigo-50">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-semibold truncate text-slate-700">
              {userName}
            </div>

            {userEmail && (
              <div className="text-[11px] truncate text-slate-400">
                {userEmail}
              </div>
            )}
          </div>
        </>
      );
    })()}

  </div>
</td> 
{/* FOLLOW-UP */}
<td className="hidden px-6 py-4 xl:table-cell">

  <div className="space-y-1.5">

    {lead.followUpDate ? (
      <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
        <CalendarClock size={13} />

        <span>
          Follow-up:{" "}
          {new Date(
            lead.followUpDate
          ).toLocaleDateString("en-IN")}
        </span>
      </div>
    ) : (
      <div className="text-xs text-slate-400">
        No follow-up date
      </div>
    )}

    {lead.nextFollowUpAt && (
      <div className="text-[11px] text-slate-500">
        Next:{" "}
        {new Date(
          lead.nextFollowUpAt
        ).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </div>
    )}

    {lead.lastContactedAt && (
      <div className="text-[11px] text-slate-400">
        Last contacted:{" "}
        {new Date(
          lead.lastContactedAt
        ).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </div>
    )}

  </div>

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

{/* EXPECTED VALUE */}
<td className="hidden px-6 py-4 xl:table-cell">

  <span className="font-semibold text-indigo-600">
    ₹
    {Number(
      lead.expectedValue || 0
    ).toLocaleString("en-IN")}
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
                                startCall(
                                  lead
                                )
                              }
                              title={
                                lead.phone
                                  ? `Call ${lead.phone}`
                                  : "No phone number"
                              }
                              className={
                                lead.phone
                                  ? "text-emerald-600 hover:bg-emerald-50"
                                  : "text-slate-300 cursor-not-allowed"
                              }
                            >
                              <PhoneCall
                                size={
                                  16
                                }
                              />
                            </IconButton>

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

{/* =====================================================
    COMPANY & REQUIREMENT DETAILS
===================================================== */}

<FormSection
  title="Company & Requirement"
  icon="🏢"
>
  <div className="space-y-6">

    <div className="flex items-start gap-3 p-4 border border-blue-100 bg-gradient-to-r from-blue-50/70 via-white to-white rounded-2xl">
      <div className="flex items-center justify-center w-10 h-10 text-lg bg-white border border-blue-100 shadow-sm rounded-xl">
        🏢
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Business Information
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">
          Add company details and understand the customer's requirement.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

      {/* Designation */}
      <Field label="Designation">
        <input
          value={form.designation || ""}
          onChange={(e) =>
            setForm({
              ...form,
              designation: e.target.value,
            })
          }
          placeholder="Managing Director"
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />
      </Field>

      {/* Industry */}
      <Field label="Industry">
        <input
          value={form.industry || ""}
          onChange={(e) =>
            setForm({
              ...form,
              industry: e.target.value,
            })
          }
          placeholder="IT Services"
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />
      </Field>

      {/* Website */}
      <Field label="Website">
        <input
          type="url"
          value={form.website || ""}
          onChange={(e) =>
            setForm({
              ...form,
              website: e.target.value,
            })
          }
          placeholder="https://example.com"
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />
      </Field>

      {/* Company Size */}
      <Field label="Company Size">
        <select
          value={form.companySize || ""}
          onChange={(e) =>
            setForm({
              ...form,
              companySize: e.target.value,
            })
          }
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none appearance-none cursor-pointer text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        >
          <option value="">Select company size</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201-500">201-500</option>
          <option value="501-1000">501-1000</option>
          <option value="1001+">1001+</option>
        </select>
      </Field>

      {/* Requirement */}
      <div className="md:col-span-2">
        <Field label="Requirement">
          <input
            value={form.requirement || ""}
            onChange={(e) =>
              setForm({
                ...form,
                requirement: e.target.value,
              })
            }
            placeholder="CRM Software"
            className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </Field>
      </div>

      {/* Message */}
      <div className="md:col-span-2">
        <Field label="Customer Message">
          <textarea
            rows={4}
            value={form.message || ""}
            onChange={(e) =>
              setForm({
                ...form,
                message: e.target.value,
              })
            }
            placeholder="We need a CRM for our company..."
            className="w-full px-4 py-3 text-sm font-medium bg-white border outline-none resize-none text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
        </Field>
      </div>

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
{/* =====================================================
    SALES & FOLLOW-UP
===================================================== */}

<FormSection
  title="Sales & Follow-up"
  icon="💰"
>
  <div className="space-y-6">

    <div className="flex items-start gap-3 p-4 border bg-gradient-to-r from-emerald-50/70 via-white to-white border-emerald-100 rounded-2xl">
      <div className="flex items-center justify-center w-10 h-10 text-lg bg-white border shadow-sm rounded-xl border-emerald-100">
        💰
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Deal & Follow-up Details
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">
          Track opportunity value and upcoming customer follow-ups.
        </p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

      {/* DEAL VALUE */}
      <Field label="Deal Value">

        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 border rounded-lg bg-slate-50 border-slate-200">
              <IndianRupee
                size={16}
                className="text-slate-500"
              />
            </div>
          </div>

          <input
            type="number"
            min="0"
            value={form.value ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                value: e.target.value,
              })
            }
            placeholder="50000"
            className="w-full h-12 pr-16 text-sm font-semibold bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />

          <div className="absolute -translate-y-1/2 right-3 top-1/2">
            <span className="px-2 py-1 text-[10px] font-bold tracking-wide rounded-md text-slate-500 bg-slate-100">
              INR
            </span>
          </div>

        </div>

      </Field>

      {/* EXPECTED VALUE */}
      <Field label="Expected Value">

        <div className="relative group">

          <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
            <div className="flex items-center justify-center w-8 h-8 border rounded-lg bg-slate-50 border-slate-200">
              <IndianRupee
                size={16}
                className="text-slate-500"
              />
            </div>
          </div>

          <input
            type="number"
            min="0"
            value={form.expectedValue ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                expectedValue: e.target.value,
              })
            }
            placeholder="75000"
            className="w-full h-12 pr-16 text-sm font-semibold bg-white border outline-none pl-14 text-slate-900 placeholder:text-slate-400 border-slate-200 rounded-xl hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />

          <div className="absolute -translate-y-1/2 right-3 top-1/2">
            <span className="px-2 py-1 text-[10px] font-bold tracking-wide rounded-md text-slate-500 bg-slate-100">
              INR
            </span>
          </div>

        </div>

      </Field>

      {/* FOLLOW UP DATE */}
      <Field label="Follow-up Date">

        <input
          type="date"
          value={
            form.followUpDate
              ? String(form.followUpDate).slice(0, 10)
              : ""
          }
          onChange={(e) =>
            setForm({
              ...form,
              followUpDate: e.target.value,
            })
          }
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none cursor-pointer text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />

      </Field>

      {/* LAST CONTACTED */}
      <Field label="Last Contacted">

        <input
          type="datetime-local"
          value={
            form.lastContactedAt
              ? String(form.lastContactedAt).slice(0, 16)
              : ""
          }
          onChange={(e) =>
            setForm({
              ...form,
              lastContactedAt: e.target.value,
            })
          }
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none cursor-pointer text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />

      </Field>

      {/* NEXT FOLLOW UP */}
      <Field label="Next Follow-up">

        <input
          type="datetime-local"
          value={
            form.nextFollowUpAt
              ? String(form.nextFollowUpAt).slice(0, 16)
              : ""
          }
          onChange={(e) =>
            setForm({
              ...form,
              nextFollowUpAt: e.target.value,
            })
          }
          className="w-full h-12 px-4 text-sm font-medium bg-white border outline-none cursor-pointer text-slate-800 border-slate-200 rounded-xl hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />

      </Field>

      {/* ASSIGNED TO */}
     <Field label="Assigned To">

  <div className="relative group">

    <div className="absolute z-10 -translate-y-1/2 left-3 top-1/2">
      <div className="flex items-center justify-center w-8 h-8 border rounded-lg bg-slate-50 border-slate-200">
        👤
      </div>
    </div>

    <select
  value={form.assignedTo || ""}
  onChange={(e) => {
    console.log("SELECTED USER ID:", e.target.value);

    setForm({
      ...form,
      assignedTo: e.target.value,
    });
  }}
  disabled={usersLoading}
  className="w-full h-12 pr-10 text-sm font-medium bg-white border outline-none appearance-none cursor-pointer pl-14 border-slate-200 rounded-xl text-slate-800 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
>

      <option value="">
        {usersLoading
          ? "Loading users..."
          : "Select team member"}
      </option>

      {users.map((user) => (
        <option
          key={user._id}
          value={user._id}
        >
          {user.name}
          {user.email
            ? ` — ${user.email}`
            : ""}
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

{/* =====================================================
    ACTIVITY TIMELINE
===================================================== */}

<ProfileSection title="Activity Timeline">

  <div className="space-y-6">

    {activitiesLoading ? (

      /* LOADING */

      <div className="space-y-5">

        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-4 animate-pulse"
          >

            <div className="w-10 h-10 rounded-full bg-slate-100 shrink-0" />

            <div className="flex-1 space-y-2">

              <div className="w-1/3 h-3 rounded bg-slate-100" />

              <div className="w-2/3 h-3 rounded bg-slate-100" />

              <div className="w-1/4 h-2 rounded bg-slate-100" />

            </div>

          </div>
        ))}

      </div>

    ) : activities.length === 0 ? (

      /* EMPTY */

      <div className="flex flex-col items-center justify-center py-10 text-center">

        <div className="flex items-center justify-center w-12 h-12 text-indigo-500 rounded-2xl bg-indigo-50">

          <Clock3 size={22} />

        </div>

        <h4 className="mt-3 text-sm font-semibold text-slate-800">
          No activities yet
        </h4>

        <p className="max-w-xs mt-1 text-xs text-slate-500">
          Calls, emails, follow-ups and other lead activities
          will appear here.
        </p>

      </div>

    ) : (

      /* TIMELINE */

      <div className="relative">

        {/* Vertical Line */}

        <div className="absolute w-px top-2 bottom-2 left-5 bg-slate-200" />

        <div className="space-y-6">

          {activities.map((activity) => {

            const type =
              String(activity.type || "")
                .toLowerCase();

            let ActivityIcon = ClipboardList;
            let iconStyle =
              "bg-indigo-50 text-indigo-600";

            if (type === "call") {

              ActivityIcon = Phone;
              iconStyle =
                "bg-emerald-50 text-emerald-600";

            } else if (type === "email") {

              ActivityIcon = Mail;
              iconStyle =
                "bg-blue-50 text-blue-600";

            } else if (
              type === "follow-up" ||
              type === "followup"
            ) {

              ActivityIcon = CalendarClock;
              iconStyle =
                "bg-violet-50 text-violet-600";

            } else if (type === "meeting") {

              ActivityIcon = Users;
              iconStyle =
                "bg-orange-50 text-orange-600";

            } else if (type === "task") {

              ActivityIcon = CheckCircle;
              iconStyle =
                "bg-amber-50 text-amber-600";

            }

            return (

              <div
                key={activity._id}
                className="relative flex items-start gap-4"
              >

                {/* ICON */}

                <div
                  className={`relative z-10 flex items-center justify-center w-10 h-10 border border-white rounded-full shadow-sm shrink-0 ${iconStyle}`}
                >

                  <ActivityIcon size={17} />

                </div>

                {/* CONTENT */}

                <div className="flex-1 min-w-0">

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <h4 className="text-sm font-semibold text-slate-900">

                        {activity.type ||
                          "Activity"}

                      </h4>

                      {activity.notes && (

                        <p className="mt-1 text-sm leading-6 text-slate-600">

                          {activity.notes}

                        </p>

                      )}

                    </div>

                    {/* STATUS */}

                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        activity.done
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >

                      {activity.done
                        ? "Completed"
                        : "Pending"}

                    </span>

                  </div>

                  {/* META */}

                  <div className="flex flex-wrap mt-3 text-xs gap-x-4 gap-y-2 text-slate-400">

                    {/* CREATED */}

                    <span className="flex items-center gap-1.5">

                      <Clock3 size={13} />

                      {activity.createdAt
                        ? new Date(
                            activity.createdAt
                          ).toLocaleString(
                            "en-IN",
                            {
                              dateStyle:
                                "medium",
                              timeStyle:
                                "short",
                            }
                          )
                        : "—"}

                    </span>

                    {/* PRIORITY */}

                    {activity.priority && (

                      <span className="flex items-center gap-1.5">

                        <Flag size={13} />

                        {activity.priority}

                      </span>

                    )}

                    {/* CREATED BY */}

                    {activity.createdBy?.name && (

                      <span className="flex items-center gap-1.5">

                        <User size={13} />

                        {activity.createdBy.name}

                      </span>

                    )}

                  </div>

                  {/* DUE DATE */}

                  {activity.dueDate && (

                    <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">

                      <CalendarClock size={13} />

                      Due:{" "}

                      {new Date(
                        activity.dueDate
                      ).toLocaleString(
                        "en-IN",
                        {
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      )}

                    </div>

                  )}

                  {/* OUTCOME */}

                  {activity.outcome && (

                    <div className="p-3 mt-3 text-xs border rounded-xl bg-slate-50 border-slate-200">

                      <span className="font-semibold text-slate-700">
                        Outcome:
                      </span>{" "}

                      <span className="text-slate-600">
                        {activity.outcome}
                      </span>

                    </div>

                  )}

                </div>

              </div>

            );

          })}

        </div>

      </div>

    )}

  </div>

</ProfileSection>

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
      value={activeLead.email || "—"}
    />

    <Detail
      icon={Phone}
      label="Phone"
      value={activeLead.phone || "—"}
    />

    <Detail
      icon={Building2}
      label="Company"
      value={activeLead.company || "—"}
    />

    <Detail
      icon={User}
      label="Designation"
      value={activeLead.designation || "—"}
    />

    <Detail
      icon={Building2}
      label="Industry"
      value={activeLead.industry || "—"}
    />

    <Detail
      icon={Users}
      label="Company Size"
      value={activeLead.companySize || "—"}
    />

    <Detail
      icon={Flag}
      label="Source"
      value={activeLead.source || "—"}
    />

    <Detail
      icon={Briefcase}
      label="Department"
      value={activeLead.department || "—"}
    />

  </div>

  {activeLead.website && (
    <div className="mt-4">
      <Detail
        icon={Globe}
        label="Website"
        value={activeLead.website}
      />
    </div>
  )}

</ProfileSection>

              {/* SALES */}

              <ProfileSection title="Sales Information">

  <div className="grid gap-4 md:grid-cols-2">

    <Detail
      icon={Target}
      label="Lead Status"
      value={activeLead.status || "—"}
    />

    <Detail
      icon={Flag}
      label="Priority"
      value={activeLead.priority || "Medium"}
    />

    <Detail
      icon={IndianRupee}
      label="Deal Value"
      value={`₹${Number(
        activeLead.value || 0
      ).toLocaleString("en-IN")}`}
    />

    <Detail
      icon={IndianRupee}
      label="Expected Value"
      value={`₹${Number(
        activeLead.expectedValue || 0
      ).toLocaleString("en-IN")}`}
    />

    <Detail
      icon={CalendarClock}
      label="Follow-up Date"
      value={
        activeLead.followUpDate
          ? new Date(
              activeLead.followUpDate
            ).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Not Scheduled"
      }
    />

    <Detail
      icon={CalendarClock}
      label="Next Follow-up"
      value={
        activeLead.nextFollowUpAt
          ? new Date(
              activeLead.nextFollowUpAt
            ).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Not Scheduled"
      }
    />

    <Detail
      icon={Phone}
      label="Last Contacted"
      value={
        activeLead.lastContactedAt
          ? new Date(
              activeLead.lastContactedAt
            ).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "Not Contacted"
      }
    />

    <Detail
      icon={User}
      label="Lead Owner"
      value={
        activeLead.owner?.name ||
        "Unassigned"
      }
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
                  {activeLead.convertedOpportunity && (
  <Detail
    icon={Target}
    label="Opportunity"
    value={
      typeof activeLead.convertedOpportunity === "object"
        ? activeLead.convertedOpportunity.name ||
          activeLead.convertedOpportunity._id ||
          "Converted Opportunity"
        : activeLead.convertedOpportunity
    }
  />
)}

                </div>

              </ProfileSection>

              {/* CREATED */}

              <ProfileSection
                title="Record Information"
              >
<Detail
  icon={User}
  label="Lead Owner"
  value={
    activeLead.owner?.name ||
    "Unassigned"
  }
/>
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

{/* REQUIREMENT & MESSAGE */}

<ProfileSection title="Requirement & Message">

  <div className="space-y-4">

    <div className="p-4 border border-indigo-100 rounded-2xl bg-indigo-50/50">

      <div className="flex items-center gap-2 mb-2">

        <Target
          size={16}
          className="text-indigo-600"
        />

        <span className="text-xs font-semibold text-indigo-700">
          Customer Requirement
        </span>

      </div>

      <p className="text-sm leading-6 text-slate-700">
        {activeLead.requirement ||
          "No requirement provided."}
      </p>

    </div>

    <div className="p-4 border rounded-2xl bg-slate-50 border-slate-200">

      <div className="flex items-center gap-2 mb-2">

        <MessageSquare
          size={16}
          className="text-slate-600"
        />

        <span className="text-xs font-semibold text-slate-700">
          Customer Message
        </span>

      </div>

      <p className="text-sm leading-6 text-slate-600">
        {activeLead.message ||
          "No message provided."}
      </p>

    </div>

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

      {/* CALL */}

      {callLead && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4">

          <div className="w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-3xl">

            <div className="p-6 text-center">

              <div className="grid w-16 h-16 mx-auto mb-4 place-items-center rounded-2xl bg-emerald-50">
                <PhoneCall size={26} className="text-emerald-600" />
              </div>

              <h3 className="text-lg font-semibold text-slate-800">
                {callLead.name || "Unknown Lead"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {callLead.phone || "—"}
              </p>

              <p className="mt-4 text-xs font-semibold tracking-wide uppercase text-slate-400">
                {callState === "connecting" && "Calling…"}
                {callState === "ringing" && "Ringing…"}
                {callState === "connected" && "Connected"}
                {callState === "completed" && "Completed"}
                {callState === "failed" && "Failed"}
              </p>

              {callState === "connected" && (
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-800">
                  {formatDuration(callSeconds)}
                </p>
              )}

              {callState === "completed" && callSeconds > 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  Duration {formatDuration(callSeconds)}
                </p>
              )}

              {callError && (
                <p className="mt-3 text-xs text-red-500">
                  {callError}
                </p>
              )}

            </div>

            <div className="flex gap-3 px-6 pb-6">

              {["connecting", "ringing", "connected"].includes(callState) ? (
                <button
                  type="button"
                  onClick={endCall}
                  className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium text-white bg-red-500 rounded-xl hover:bg-red-600"
                >
                  <PhoneOff size={16} />
                  End Call
                </button>
              ) : (
                <button
                  type="button"
                  onClick={closeCallPanel}
                  className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium border rounded-xl hover:bg-slate-50"
                >
                  Close
                </button>
              )}

            </div>

          </div>

        </div>
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