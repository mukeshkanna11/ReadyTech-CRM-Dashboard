import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Download,
  Home,
  Inbox,
  IndianRupee,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit3,
  X,
  CalendarDays,
  UserRound,
  Phone,
  Mail,
  Building2,
  Clock,
  Check,
  CircleAlert,
  TrendingUp,
} from "lucide-react";

/* =========================================================
   BACKEND STAGES
========================================================= */

const STAGES = [
  "Prospecting",
  "Qualification",
  "Needs Analysis",
  "Value Proposition",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const FOLLOW_UP_TYPES = [
  "Call",
  "Meeting",
  "Email",
  "WhatsApp",
  "Other",
];

const FOLLOW_UP_STATUSES = [
  "Pending",
  "Completed",
  "Cancelled",
];

/* =========================================================
   INITIAL FORM
========================================================= */

const initialOpportunityForm = {
  title: "",
  lead: "",
  value: "",
  probability: 0,
  expectedCloseDate: "",
  stage: "Prospecting",
  assignedTo: "",
  notes: "",
};

const initialFollowUpForm = {
  type: "Call",
  date: "",
  note: "",
};

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (value = 0) => {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitial = (name = "") => {
  return name?.charAt(0)?.toUpperCase() || "U";
};

/* =========================================================
   COMPONENT
========================================================= */

export default function OpportunitiesTab() {
  /* =======================================================
     DATA STATES
  ======================================================= */

  const [opportunities, setOpportunities] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    prospecting: 0,
    proposal: 0,
    won: 0,
    lost: 0,
    revenue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* =======================================================
     FILTER STATES
  ======================================================= */

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  /* =======================================================
     MODAL STATES
  ======================================================= */

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  /* =======================================================
     SELECTED OPPORTUNITY
  ======================================================= */


const [leads, setLeads] = useState([]);
const [leadsLoading, setLeadsLoading] = useState(false);
const [ownersLoading, setOwnersLoading] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] =
    useState(null);

  /* =======================================================
     FORM STATES
  ======================================================= */

  const [opportunityForm, setOpportunityForm] = useState(
    initialOpportunityForm
  );

  const [followUpForm, setFollowUpForm] =
    useState(initialFollowUpForm);

  /* =======================================================
     SUBMIT STATES
  ======================================================= */

  const [submitting, setSubmitting] = useState(false);

  /* =======================================================
     FOLLOW-UP STATES
  ======================================================= */

  const [followUps, setFollowUps] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);

  /* =======================================================
     FETCH OPPORTUNITIES
  ======================================================= */

  const fetchOpportunities = async () => {
    try {
      const res = await API.get("/opportunities");

      if (res.data?.success) {
        setOpportunities(res.data.data || []);
      } else {
        setOpportunities([]);
      }
    } catch (error) {
      console.error("Fetch opportunities error:", error);

      toast.error(
        error?.response?.data?.message ||
          "Failed to fetch opportunities"
      );
    }
  };

  /* =======================================================
     FETCH STATS
  ======================================================= */

  const fetchStats = async () => {
    try {
      const res = await API.get(
        "/opportunities/dashboard/stats"
      );

      if (res.data?.success) {
        setStats(
          res.data.stats || {
            total: 0,
            prospecting: 0,
            proposal: 0,
            won: 0,
            lost: 0,
            revenue: 0,
          }
        );
      }
    } catch (error) {
      console.error("Fetch stats error:", error);
    }
  };

 /* =======================================================
   INITIAL LOAD
======================================================= */

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);

      await Promise.all([
        fetchOpportunities(),
        fetchStats(),
        fetchLeads(),
      ]);
    } catch (error) {
      console.error("Initial load error:", error);
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, []);

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh = async () => {
    try {
      setRefreshing(true);

      await Promise.all([
        fetchOpportunities(),
        fetchStats(),
      ]);

      toast.success("Opportunities refreshed");
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  /* =======================================================
     OWNERS FROM BACKEND
  ======================================================= */

  const owners = useMemo(() => {
    const map = new Map();

    opportunities.forEach((opportunity) => {
      if (opportunity.assignedTo?._id) {
        map.set(
          opportunity.assignedTo._id,
          opportunity.assignedTo.name
        );
      }
    });

    return Array.from(map.entries());
  }, [opportunities]);

  /* =======================================================
     FILTERED OPPORTUNITIES
  ======================================================= */

  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((opportunity) => {
        const searchText = search.toLowerCase();

        return (
          opportunity.title
            ?.toLowerCase()
            .includes(searchText) ||
          opportunity.lead?.name
            ?.toLowerCase()
            .includes(searchText) ||
          opportunity.lead?.company
            ?.toLowerCase()
            .includes(searchText) ||
          opportunity.assignedTo?.name
            ?.toLowerCase()
            .includes(searchText)
        );
      })
      .filter((opportunity) => {
        if (stageFilter === "All") return true;

        return opportunity.stage === stageFilter;
      })
      .filter((opportunity) => {
        if (ownerFilter === "All") return true;

        return opportunity.assignedTo?._id === ownerFilter;
      })
      .filter((opportunity) => {
        if (!dateFilter) return true;

        if (!opportunity.expectedCloseDate) return false;

        const opportunityDate = new Date(
          opportunity.expectedCloseDate
        )
          .toISOString()
          .split("T")[0];

        return opportunityDate === dateFilter;
      });
  }, [
    opportunities,
    search,
    stageFilter,
    ownerFilter,
    dateFilter,
  ]);

  /* =======================================================
     PIPELINE VALUE
  ======================================================= */

  const pipelineValue = useMemo(() => {
    return filteredOpportunities.reduce(
      (sum, opportunity) =>
        sum + Number(opportunity.value || 0),
      0
    );
  }, [filteredOpportunities]);

  /* =======================================================
     WIN RATE
  ======================================================= */

  const winRate = stats.total
    ? Math.round((stats.won / stats.total) * 100)
    : 0;

  /* =======================================================
     CREATE OPPORTUNITY
  ======================================================= */

  const handleCreateOpportunity = async (e) => {
    e.preventDefault();

    if (!opportunityForm.title.trim()) {
      toast.error("Opportunity title is required");
      return;
    }

    if (!opportunityForm.lead) {
      toast.error("Lead is required");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        title: opportunityForm.title.trim(),
        lead: opportunityForm.lead,
        value: Number(opportunityForm.value || 0),
        probability: Number(
          opportunityForm.probability || 0
        ),
        expectedCloseDate:
          opportunityForm.expectedCloseDate || undefined,
        stage: opportunityForm.stage,
        assignedTo:
          opportunityForm.assignedTo || undefined,
        notes: opportunityForm.notes.trim(),
      };

      const res = await API.post(
        "/opportunities",
        payload
      );

      if (res.data?.success) {
        toast.success(
          "Opportunity created successfully"
        );

        setShowCreateModal(false);

        setOpportunityForm(
          initialOpportunityForm
        );

        await Promise.all([
          fetchOpportunities(),
          fetchStats(),
        ]);
      }
    } catch (error) {
      console.error(
        "Create opportunity error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to create opportunity"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     OPEN EDIT MODAL
  ======================================================= */

  const openEditModal = (opportunity) => {
    setSelectedOpportunity(opportunity);

    setOpportunityForm({
      title: opportunity.title || "",
      lead: opportunity.lead?._id || "",
      value: opportunity.value ?? "",
      probability: opportunity.probability ?? 0,
      expectedCloseDate: opportunity.expectedCloseDate
        ? new Date(
            opportunity.expectedCloseDate
          )
            .toISOString()
            .split("T")[0]
        : "",
      stage:
        opportunity.stage || "Prospecting",
      assignedTo:
        opportunity.assignedTo?._id || "",
      notes: opportunity.notes || "",
    });

    setShowDetailsModal(false);
    setShowEditModal(true);
  };


 const fetchLeads = async () => {
  try {
    setLeadsLoading(true);

    const res = await API.get("/leads");

    console.log("LEADS API RESPONSE:", res.data);

    setLeads(
      res.data.data ||
      res.data.leads ||
      []
    );
  } catch (error) {
    console.error("Fetch leads error:", error);
    toast.error("Failed to fetch leads");
    setLeads([]);
  } finally {
    setLeadsLoading(false);
  }
};

  /* =======================================================
     UPDATE OPPORTUNITY
  ======================================================= */

  const handleUpdateOpportunity = async (e) => {
    e.preventDefault();

    if (!selectedOpportunity?._id) return;

    try {
      setSubmitting(true);

      const payload = {
        title: opportunityForm.title.trim(),
        lead: opportunityForm.lead,
        value: Number(opportunityForm.value || 0),
        probability: Number(
          opportunityForm.probability || 0
        ),
        expectedCloseDate:
          opportunityForm.expectedCloseDate || undefined,
        stage: opportunityForm.stage,
        assignedTo:
          opportunityForm.assignedTo || undefined,
        notes: opportunityForm.notes.trim(),
      };

      const res = await API.put(
        `/opportunities/${selectedOpportunity._id}`,
        payload
      );

      if (res.data?.success) {
        toast.success(
          "Opportunity updated successfully"
        );

        setShowEditModal(false);

        setSelectedOpportunity(null);

        setOpportunityForm(
          initialOpportunityForm
        );

        await Promise.all([
          fetchOpportunities(),
          fetchStats(),
        ]);
      }
    } catch (error) {
      console.error(
        "Update opportunity error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to update opportunity"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     DELETE OPPORTUNITY
  ======================================================= */

  const handleDeleteOpportunity = async (
    opportunity
  ) => {
    if (!opportunity?._id) return;

    const confirmed = window.confirm(
      `Delete "${opportunity.title}"?`
    );

    if (!confirmed) return;

    try {
      const res = await API.delete(
        `/opportunities/${opportunity._id}`
      );

      if (res.data?.success) {
        toast.success(
          "Opportunity deleted successfully"
        );

        setShowDetailsModal(false);

        setSelectedOpportunity(null);

        await Promise.all([
          fetchOpportunities(),
          fetchStats(),
        ]);
      }
    } catch (error) {
      console.error(
        "Delete opportunity error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to delete opportunity"
      );
    }
  };

  /* =======================================================
     GET FOLLOW-UPS
  ======================================================= */

  const fetchFollowUps = async (opportunityId) => {
    if (!opportunityId) return;

    try {
      setLoadingFollowUps(true);

      const res = await API.get(
        `/opportunities/${opportunityId}/followups`
      );

      if (res.data?.success) {
        setFollowUps(res.data.data || []);
      }
    } catch (error) {
      console.error(
        "Fetch follow-ups error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to fetch follow-ups"
      );
    } finally {
      setLoadingFollowUps(false);
    }
  };

  /* =======================================================
     OPEN DETAILS
  ======================================================= */

  const openDetails = async (opportunity) => {
    setSelectedOpportunity(opportunity);

    setShowDetailsModal(true);

    await fetchFollowUps(opportunity._id);
  };

  /* =======================================================
     OPEN FOLLOW-UP MODAL
  ======================================================= */

  const openFollowUpModal = () => {
    setFollowUpForm({
      type: "Call",
      date: "",
      note: "",
    });

    setShowFollowUpModal(true);
  };

  /* =======================================================
     ADD FOLLOW-UP
  ======================================================= */

  const handleAddFollowUp = async (e) => {
    e.preventDefault();

    if (!selectedOpportunity?._id) return;

    if (!followUpForm.date) {
      toast.error("Follow-up date is required");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        type: followUpForm.type,
        date: new Date(
          followUpForm.date
        ).toISOString(),
        note: followUpForm.note.trim(),
      };

      const res = await API.post(
        `/opportunities/${selectedOpportunity._id}/followups`,
        payload
      );

      if (res.data?.success) {
        toast.success(
          "Follow-up added successfully"
        );

        setShowFollowUpModal(false);

        setFollowUpForm(
          initialFollowUpForm
        );

        await fetchFollowUps(
          selectedOpportunity._id
        );

        await fetchOpportunities();

        const updatedOpportunity =
          res.data.data;

        setSelectedOpportunity(
          updatedOpportunity
        );
      }
    } catch (error) {
      console.error(
        "Add follow-up error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to add follow-up"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* =======================================================
     UPDATE FOLLOW-UP
  ======================================================= */

  const handleUpdateFollowUp = async (
    followUp,
    status
  ) => {
    if (
      !selectedOpportunity?._id ||
      !followUp?._id
    ) {
      return;
    }

    try {
      const res = await API.put(
        `/opportunities/${selectedOpportunity._id}/followups/${followUp._id}`,
        {
          status,
        }
      );

      if (res.data?.success) {
        toast.success(
          "Follow-up updated successfully"
        );

        await fetchFollowUps(
          selectedOpportunity._id
        );

        await fetchOpportunities();
      }
    } catch (error) {
      console.error(
        "Update follow-up error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to update follow-up"
      );
    }
  };

  /* =======================================================
     DELETE FOLLOW-UP
  ======================================================= */

  const handleDeleteFollowUp = async (
    followUp
  ) => {
    if (
      !selectedOpportunity?._id ||
      !followUp?._id
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this follow-up?"
    );

    if (!confirmed) return;

    try {
      const res = await API.delete(
        `/opportunities/${selectedOpportunity._id}/followups/${followUp._id}`
      );

      if (res.data?.success) {
        toast.success(
          "Follow-up deleted successfully"
        );

        await fetchFollowUps(
          selectedOpportunity._id
        );

        await fetchOpportunities();
      }
    } catch (error) {
      console.error(
        "Delete follow-up error:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to delete follow-up"
      );
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300">
          <RefreshCw
            size={20}
            className="animate-spin"
          />
          Loading opportunities...
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="space-y-6">

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="relative p-8 overflow-hidden text-white border shadow-2xl rounded-3xl border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />

        <div className="absolute rounded-full -right-16 -top-16 h-72 w-72 bg-blue-500/20 blur-3xl" />

        <div className="absolute rounded-full -bottom-16 -left-16 h-72 w-72 bg-purple-500/20 blur-3xl" />

        <div className="relative">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            {/* LEFT */}

            <div>

              <div className="flex items-center gap-2 text-sm text-blue-200">

                <Home size={15} />

                Dashboard

                <ChevronRight size={15} />

                CRM

                <ChevronRight size={15} />

                <span className="font-medium text-white">
                  Opportunities
                </span>

              </div>

              <div className="flex items-center gap-4 mt-4">

                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur">

                  <BriefcaseBusiness size={30} />

                </div>

                <div>

                  <h1 className="text-4xl font-bold">
                    Opportunity Pipeline
                  </h1>

                  <p className="max-w-2xl mt-2 text-blue-100">
                    Track deals, monitor pipeline
                    progress, forecast revenue and
                    manage customer opportunities.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap items-center gap-6 mt-6 text-sm">

                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300">

                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

                  Pipeline Active

                </div>

                <div>
                  Total Opportunities

                  <span className="ml-2 font-semibold text-white">
                    {stats.total}
                  </span>
                </div>

                <div>
                  Pipeline Value

                  <span className="ml-2 font-semibold text-emerald-300">
                    {formatCurrency(pipelineValue)}
                  </span>
                </div>

              </div>

            </div>

            {/* BUTTONS */}

            <div className="flex flex-wrap gap-3">

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-5 py-3 font-semibold text-indigo-700 transition bg-white shadow-lg rounded-xl hover:scale-105 disabled:opacity-60"
              >

                <RefreshCw
                  size={18}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh

              </button>

              <button
                type="button"
                className="flex items-center gap-2 px-5 py-3 border rounded-xl border-white/20 bg-white/10 hover:bg-white/20"
                onClick={() =>
                  toast("Export can be connected to CSV/PDF API")
                }
              >

                <Download size={18} />

                Export

              </button>

              <button
                onClick={() =>
                  setShowCreateModal(true)
                }
                className="flex items-center gap-2 px-5 py-3 font-semibold transition rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105"
              >

                <Plus size={18} />

                New Opportunity

              </button>

            </div>

          </div>

          {/* FILTERS */}

          <div className="p-5 mt-8 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

            <div className="grid gap-4 lg:grid-cols-5">

              {/* SEARCH */}

              <div className="relative lg:col-span-2">

                <Search
                  size={18}
                  className="absolute -translate-y-1/2 left-4 top-1/2 text-white/70"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search opportunity, lead, company..."
                  className="w-full py-3 pl-12 pr-4 text-white border rounded-xl border-white/20 bg-white/10 placeholder:text-white/60 focus:border-cyan-400 focus:outline-none"
                />

              </div>

              {/* STAGE */}

              <select
                value={stageFilter}
                onChange={(e) =>
                  setStageFilter(e.target.value)
                }
                className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10 focus:outline-none"
              >

                <option
                  value="All"
                  className="text-black"
                >
                  All Stages
                </option>

                {STAGES.map((stage) => (
                  <option
                    key={stage}
                    value={stage}
                    className="text-black"
                  >
                    {stage}
                  </option>
                ))}

              </select>

              {/* OWNER */}

              <select
                value={ownerFilter}
                onChange={(e) =>
                  setOwnerFilter(e.target.value)
                }
                className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10 focus:outline-none"
              >

                <option
                  value="All"
                  className="text-black"
                >
                  All Owners
                </option>

                {owners.map(([id, name]) => (
                  <option
                    key={id}
                    value={id}
                    className="text-black"
                  >
                    {name}
                  </option>
                ))}

              </select>

              {/* DATE */}

              <input
                type="date"
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value)
                }
                className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10"
              />

            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          PIPELINE BOARD
      =================================================== */}

      <div className="grid gap-6 xl:grid-cols-4">

        {STAGES.map((stage) => {

          const stageData =
            filteredOpportunities.filter(
              (opportunity) =>
                opportunity.stage === stage
            );

          const totalValue = stageData.reduce(
            (sum, opportunity) =>
              sum +
              Number(opportunity.value || 0),
            0
          );

          return (
            <div
              key={stage}
              className="overflow-hidden transition-all duration-300 bg-white border shadow-lg border-slate-200 rounded-3xl hover:-translate-y-1 hover:shadow-2xl"
            >

              {/* HEADER */}

              <div className="p-5 text-white border-b bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15">

                      <BriefcaseBusiness size={20} />

                    </div>

                    <div>

                      <h3 className="font-semibold">
                        {stage}
                      </h3>

                      <p className="text-xs text-blue-200">
                        {stageData.length} Deals
                      </p>

                    </div>

                  </div>

                  <span className="px-3 py-1 text-xs rounded-full bg-white/15">
                    {formatCurrency(totalValue)}
                  </span>

                </div>

              </div>

              {/* CARDS */}

              <div className="max-h-[650px] space-y-4 overflow-y-auto p-4">

                {stageData.map((opportunity) => {

                  const probability =
                    Number(
                      opportunity.probability ?? 0
                    );

                  return (
                    <div
                      key={opportunity._id}
                      className="p-4 transition border rounded-2xl border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-white hover:shadow-lg"
                    >

                      {/* TITLE */}

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h4 className="font-semibold text-slate-800">
                            {opportunity.title}
                          </h4>

                          <p className="mt-1 text-xs text-slate-500">
                            {opportunity.lead?.name ||
                              "No Lead"}
                          </p>

                          <p className="text-xs text-slate-400">
                            {opportunity.lead?.company ||
                              "No Company"}
                          </p>

                        </div>

                        <span className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full">
                          {probability}%
                        </span>

                      </div>

                      {/* VALUE */}

                      <div className="flex items-center justify-between mt-4">

                        <div>

                          <p className="text-xs text-slate-500">
                            Deal Value
                          </p>

                          <p className="font-bold text-emerald-600">
                            {formatCurrency(
                              opportunity.value
                            )}
                          </p>

                        </div>

                        <div className="text-right">

                          <p className="text-xs text-slate-500">
                            Expected Close
                          </p>

                          <p className="text-sm font-semibold text-slate-700">
                            {formatDate(
                              opportunity.expectedCloseDate
                            )}
                          </p>

                        </div>

                      </div>

                      {/* PROGRESS */}

                      <div className="mt-4">

                        <div className="flex justify-between mb-2 text-xs text-slate-500">

                          <span>
                            Probability
                          </span>

                          <span>
                            {probability}%
                          </span>

                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                            style={{
                              width: `${probability}%`,
                            }}
                          />

                        </div>

                      </div>

                      {/* FOLLOW-UP */}

                      {opportunity.followUps?.length >
                        0 && (
                        <div className="px-3 py-2 mt-4 border border-orange-200 rounded-xl bg-orange-50">

                          <div className="flex items-center gap-2 text-xs font-semibold text-orange-700">

                            <Clock size={14} />

                            Next Follow-up

                          </div>

                          <p className="mt-1 text-sm font-medium text-orange-800">

                            {
                              opportunity
                                .followUps[0]
                                .type
                            }

                          </p>

                          <p className="text-xs text-orange-600">

                            {formatDateTime(
                              opportunity
                                .followUps[0]
                                .date
                            )}

                          </p>

                        </div>
                      )}

                      {/* FOOTER */}

                      <div className="flex items-center justify-between pt-4 mt-5 border-t">

                        <div className="flex items-center gap-3">

                          <div className="flex items-center justify-center text-sm font-bold text-white rounded-full h-9 w-9 bg-gradient-to-r from-indigo-600 to-blue-600">

                            {getInitial(
                              opportunity
                                .assignedTo?.name
                            )}

                          </div>

                          <div>

                            <p className="text-sm font-medium">

                              {opportunity
                                .assignedTo
                                ?.name ||
                                "Unassigned"}

                            </p>

                            <p className="text-xs text-slate-500">

                              Assigned Employee

                            </p>

                          </div>

                        </div>

                        <button
                          onClick={() =>
                            openDetails(
                              opportunity
                            )
                          }
                          className="p-2 text-indigo-600 rounded-xl bg-indigo-50 hover:bg-indigo-100"
                          title="View Details"
                        >

                          <ArrowRight size={18} />

                        </button>

                      </div>

                    </div>
                  );
                })}

                {stageData.length === 0 && (
                  <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300">

                    <Inbox
                      className="mx-auto mb-3 text-slate-300"
                      size={36}
                    />

                    <p className="text-sm text-slate-500">
                      No Opportunities
                    </p>

                  </div>
                )}

              </div>

            </div>
          );
        })}

      </div>

      {/* ===================================================
          KPI
      =================================================== */}

      <div className="grid gap-6 mt-8 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-blue-100">
                Total Opportunities
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.total}
              </h2>

              <p className="mt-3 text-sm text-blue-100">
                From backend
              </p>

            </div>

            <div className="p-3 rounded-2xl bg-white/20">
              <BriefcaseBusiness size={26} />
            </div>

          </div>

        </div>

        {/* PIPELINE */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-green-100">
                Pipeline Value
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {formatCurrency(
                  pipelineValue
                )}
              </h2>

              <p className="mt-3 text-sm text-green-100">
                Current filtered pipeline
              </p>

            </div>

            <div className="p-3 rounded-2xl bg-white/20">
              <IndianRupee size={26} />
            </div>

          </div>

        </div>

        {/* WON */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-violet-100">
                Closed Won
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {stats.won}
              </h2>

              <p className="mt-3 text-sm text-violet-100">
                Successfully converted
              </p>

            </div>

            <div className="p-3 rounded-2xl bg-white/20">
              <CheckCircle2 size={26} />
            </div>

          </div>

        </div>

        {/* WIN RATE */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 hover:-translate-y-1 hover:shadow-2xl">

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-orange-100">
                Win Rate
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {winRate}%
              </h2>

              <p className="mt-3 text-sm text-orange-100">
                Closed Won / Total
              </p>

            </div>

            <div className="p-3 rounded-2xl bg-white/20">
              <TrendingUp size={26} />
            </div>

          </div>

        </div>

      </div>

      {/* ===================================================
          CREATE MODAL
      =================================================== */}

      {showCreateModal && (
       <OpportunityFormModal 
  title="Create New Opportunity" 
  form={opportunityForm} 
  setForm={setOpportunityForm} 
  onSubmit={handleCreateOpportunity} 
  onClose={() => 
    setShowCreateModal(false) 
  } 
  submitting={submitting} 
  leads={leads}
  leadsLoading={leadsLoading}
  owners={owners} 
/>
      )}

      {/* ===================================================
          EDIT MODAL
      =================================================== */}

      {showEditModal && (
        <OpportunityFormModal 
  title="Edit Opportunity" 
  form={opportunityForm} 
  setForm={setOpportunityForm} 
  onSubmit={handleUpdateOpportunity} 
  onClose={() => 
    setShowEditModal(false) 
  } 
  submitting={submitting} 
  leads={leads}
  leadsLoading={leadsLoading}
  owners={owners} 
  isEdit 
/>
      )}

      {/* ===================================================
          DETAILS MODAL
      =================================================== */}

      {showDetailsModal &&
        selectedOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

            <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white shadow-2xl rounded-3xl">

              {/* HEADER */}

              <div className="sticky top-0 z-10 flex items-center justify-between p-6 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

                <div>

                  <p className="text-sm text-blue-200">
                    Opportunity Details
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedOpportunity.title}
                  </h2>

                </div>

                <button
                  onClick={() =>
                    setShowDetailsModal(false)
                  }
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  <X size={22} />
                </button>

              </div>

              <div className="p-6 space-y-6">

                {/* BASIC INFO */}

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

                  <DetailBox
                    icon={<UserRound size={18} />}
                    label="Lead"
                    value={
                      selectedOpportunity
                        .lead?.name ||
                      "No Lead"
                    }
                  />

                  <DetailBox
                    icon={<Building2 size={18} />}
                    label="Company"
                    value={
                      selectedOpportunity
                        .lead?.company ||
                      "No Company"
                    }
                  />

                  <DetailBox
                    icon={<IndianRupee size={18} />}
                    label="Deal Value"
                    value={formatCurrency(
                      selectedOpportunity.value
                    )}
                  />

                  <DetailBox
                    icon={<TrendingUp size={18} />}
                    label="Probability"
                    value={`${selectedOpportunity.probability ?? 0}%`}
                  />

                  <DetailBox
                    icon={<BriefcaseBusiness size={18} />}
                    label="Stage"
                    value={
                      selectedOpportunity.stage
                    }
                  />

                  <DetailBox
                    icon={<UserRound size={18} />}
                    label="Assigned To"
                    value={
                      selectedOpportunity
                        .assignedTo?.name ||
                      "Unassigned"
                    }
                  />

                  <DetailBox
                    icon={<CalendarDays size={18} />}
                    label="Expected Close"
                    value={formatDate(
                      selectedOpportunity.expectedCloseDate
                    )}
                  />

                  <DetailBox
                    icon={<CalendarDays size={18} />}
                    label="Created"
                    value={formatDate(
                      selectedOpportunity.createdAt
                    )}
                  />

                </div>

                {/* CONTACT */}

                {selectedOpportunity.lead && (
                  <div className="p-5 border rounded-2xl border-slate-200 bg-slate-50">

                    <h3 className="mb-4 font-semibold text-slate-800">
                      Lead Contact
                    </h3>

                    <div className="grid gap-4 md:grid-cols-3">

                      <div className="flex items-center gap-3">

                        <div className="p-2 text-indigo-600 bg-indigo-100 rounded-xl">
                          <Mail size={18} />
                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Email
                          </p>

                          <p className="text-sm font-medium text-slate-700">
                            {selectedOpportunity
                              .lead?.email ||
                              "-"}
                          </p>

                        </div>

                      </div>

                      <div className="flex items-center gap-3">

                        <div className="p-2 text-emerald-600 bg-emerald-100 rounded-xl">
                          <Phone size={18} />
                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Phone
                          </p>

                          <p className="text-sm font-medium text-slate-700">
                            {selectedOpportunity
                              .lead?.phone ||
                              "-"}
                          </p>

                        </div>

                      </div>

                      <div className="flex items-center gap-3">

                        <div className="p-2 text-orange-600 bg-orange-100 rounded-xl">
                          <Building2 size={18} />
                        </div>

                        <div>

                          <p className="text-xs text-slate-500">
                            Source
                          </p>

                          <p className="text-sm font-medium text-slate-700">
                            {selectedOpportunity
                              .lead?.source ||
                              "-"}
                          </p>

                        </div>

                      </div>

                    </div>

                  </div>
                )}

                {/* NOTES */}

                <div className="p-5 border rounded-2xl border-slate-200">

                  <h3 className="font-semibold text-slate-800">
                    Notes
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedOpportunity.notes ||
                      "No notes available."}
                  </p>

                </div>

                {/* FOLLOW UPS */}

                <div className="p-5 border rounded-2xl border-slate-200">

                  <div className="flex items-center justify-between">

                    <div>

                      <h3 className="font-semibold text-slate-800">
                        Follow-ups
                      </h3>

                      <p className="text-xs text-slate-500">
                        Manage calls, meetings,
                        emails and other activities.
                      </p>

                    </div>

                    <button
                      onClick={openFollowUpModal}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
                    >

                      <Plus size={16} />

                      Add Follow-up

                    </button>

                  </div>

                  <div className="mt-5 space-y-3">

                    {loadingFollowUps ? (
                      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">

                        <RefreshCw
                          size={16}
                          className="animate-spin"
                        />

                        Loading follow-ups...

                      </div>
                    ) : followUps.length === 0 ? (
                      <div className="py-8 text-center border border-dashed rounded-2xl border-slate-300">

                        <CalendarDays
                          size={32}
                          className="mx-auto mb-2 text-slate-300"
                        />

                        <p className="text-sm text-slate-500">
                          No follow-ups yet
                        </p>

                      </div>
                    ) : (
                      followUps.map(
                        (followUp) => (
                          <div
                            key={
                              followUp._id
                            }
                            className="flex flex-col gap-4 p-4 border rounded-2xl border-slate-200 md:flex-row md:items-center md:justify-between"
                          >

                            <div className="flex gap-3">

                              <div className="flex items-center justify-center w-10 h-10 text-indigo-600 bg-indigo-100 rounded-xl">

                                {followUp.type ===
                                "Call" ? (
                                  <Phone
                                    size={18}
                                  />
                                ) : (
                                  <CalendarDays
                                    size={18}
                                  />
                                )}

                              </div>

                              <div>

                                <div className="flex items-center gap-2">

                                  <p className="font-semibold text-slate-800">
                                    {
                                      followUp.type
                                    }
                                  </p>

                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      followUp.status ===
                                      "Completed"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : followUp.status ===
                                          "Cancelled"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-orange-100 text-orange-700"
                                    }`}
                                  >
                                    {
                                      followUp.status
                                    }
                                  </span>

                                </div>

                                <p className="mt-1 text-sm text-slate-600">
                                  {
                                    followUp.note ||
                                    "No note"
                                  }
                                </p>

                                <p className="flex items-center gap-1 mt-1 text-xs text-slate-500">

                                  <Clock
                                    size={13}
                                  />

                                  {formatDateTime(
                                    followUp.date
                                  )}

                                </p>

                                {followUp
                                  .createdBy
                                  ?.name && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    Created by{" "}
                                    {
                                      followUp
                                        .createdBy
                                        .name
                                    }
                                  </p>
                                )}

                              </div>

                            </div>

                            <div className="flex items-center gap-2">

                              {followUp.status !==
                                "Completed" && (
                                <button
                                  onClick={() =>
                                    handleUpdateFollowUp(
                                      followUp,
                                      "Completed"
                                    )
                                  }
                                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-xl hover:bg-emerald-200"
                                >

                                  <Check
                                    size={14}
                                  />

                                  Complete

                                </button>
                              )}

                              {followUp.status ===
                                "Pending" && (
                                <button
                                  onClick={() =>
                                    handleUpdateFollowUp(
                                      followUp,
                                      "Cancelled"
                                    )
                                  }
                                  className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-100 rounded-xl hover:bg-red-200"
                                >
                                  Cancel
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  handleDeleteFollowUp(
                                    followUp
                                  )
                                }
                                className="p-2 text-red-600 rounded-xl bg-red-50 hover:bg-red-100"
                                title="Delete Follow-up"
                              >
                                <Trash2
                                  size={16}
                                />
                              </button>

                            </div>

                          </div>
                        )
                      )
                    )}

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="flex flex-wrap justify-end gap-3 pt-2 border-t">

                  <button
                    onClick={() =>
                      openEditModal(
                        selectedOpportunity
                      )
                    }
                    className="flex items-center gap-2 px-5 py-3 font-semibold text-indigo-700 bg-indigo-100 rounded-xl hover:bg-indigo-200"
                  >

                    <Edit3 size={17} />

                    Edit

                  </button>

                  <button
                    onClick={() =>
                      handleDeleteOpportunity(
                        selectedOpportunity
                      )
                    }
                    className="flex items-center gap-2 px-5 py-3 font-semibold text-red-700 bg-red-100 rounded-xl hover:bg-red-200"
                  >

                    <Trash2 size={17} />

                    Delete

                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      {/* ===================================================
          FOLLOW-UP MODAL
      =================================================== */}

      {showFollowUpModal &&
        selectedOpportunity && (
          <FollowUpModal
            form={followUpForm}
            setForm={setFollowUpForm}
            onSubmit={handleAddFollowUp}
            onClose={() =>
              setShowFollowUpModal(false)
            }
            submitting={submitting}
          />
        )}

    </div>
  );
}

/* =========================================================
   OPPORTUNITY FORM MODAL
========================================================= */

function OpportunityFormModal({
  form,
  setForm,
  onClose,
  onSubmit,
  leads = [],
  leadsLoading = false,
  owners = [],
  ownersLoading = false,
  submitting = false,
  isEdit = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white shadow-2xl rounded-3xl">

        {/* HEADER */}

        <div className="sticky top-0 z-10 flex items-center justify-between p-6 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

          <div>

            <p className="text-sm text-blue-200">
              CRM Opportunity
            </p>

            <h2 className="text-2xl font-bold">
              value={form.title}
            </h2>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
          >
            <X size={22} />
          </button>

        </div>

        {/* FORM */}

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-5"
        >

          {/* TITLE */}

          <div>

            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Opportunity Title *
            </label>

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              placeholder="Enter opportunity title"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />

          </div>

          {/* LEAD */}

<div>
  <label className="block mb-2 text-sm font-semibold text-slate-700">
    Lead *
  </label>

  <select
    value={form.lead}
    onChange={(e) =>
      setForm({
        ...form,
        lead: e.target.value,
      })
    }
    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
    required
  >
    <option value="">Select Lead</option>

    {(leads || []).map((lead)  => (
      <option key={lead._id} value={lead._id}>
        {lead.name}
        {lead.company ? ` — ${lead.company}` : ""}
      </option>
    ))}
  </select>

  <p className="mt-1 text-xs text-slate-500">
    Select the lead associated with this opportunity.
  </p>
</div>

          {/* VALUE + PROBABILITY */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>

              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Deal Value
              </label>

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
                placeholder="125000"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

            </div>

            <div>

              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Probability %
              </label>

              <input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) =>
                  setForm({
                    ...form,
                    probability:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

            </div>

          </div>

          {/* STAGE + OWNER */}

          <div className="grid gap-5 md:grid-cols-2">

            <div>

              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Stage
              </label>

              <select
                value={form.stage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stage: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >

                {STAGES.map((stage) => (
                  <option
                    key={stage}
                    value={stage}
                  >
                    {stage}
                  </option>
                ))}

              </select>

            </div>

            <div>

              <label className="block mb-2 text-sm font-semibold text-slate-700">
                Assigned To
              </label>

              <select
                value={form.assignedTo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assignedTo:
                      e.target.value,
                  })
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >

                <option value="">
                  Unassigned
                </option>

                {owners.map(([id, name]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {name}
                  </option>
                ))}

              </select>

            </div>

          </div>

          {/* DATE */}

          <div>

            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Expected Close Date
            </label>

            <input
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  expectedCloseDate:
                    e.target.value,
                })
              }
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

          </div>

          {/* NOTES */}

          <div>

            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Notes
            </label>

            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) =>
                setForm({
                  ...form,
                  notes: e.target.value,
                })
              }
              placeholder="Customer requirements, deal notes..."
              className="w-full px-4 py-3 border resize-none border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

          </div>

          {/* ACTIONS */}

          <div className="flex justify-end gap-3 pt-4 border-t">

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
            >

              {submitting && (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              )}

              {isEdit
                ? "Update Opportunity"
                : "Create Opportunity"}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}



/* =========================================================
   FOLLOW-UP MODAL
========================================================= */

function OpportunityFollowUpModal({
  form,
  setForm,
  onClose,
  onSubmit,
  submitting = false,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

      <div className="w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-3xl">

        {/* HEADER */}
        <div className="flex items-center justify-between p-6 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

          <div>
            <p className="text-sm text-blue-200">
              Opportunity Activity
            </p>

            <h2 className="text-xl font-bold">
              Add Follow-up
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
          >
            <X size={20} />
          </button>

        </div>

        {/* FORM */}
        <form
          onSubmit={onSubmit}
          className="p-6 space-y-5"
        >

          {/* TYPE */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Follow-up Type
            </label>

            <select
              value={form.type || "Call"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value,
                }))
              }
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FOLLOW_UP_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* DATE */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Follow-up Date & Time *
            </label>

            <input
              type="datetime-local"
              value={form.date || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  date: e.target.value,
                }))
              }
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* NOTE */}
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Note
            </label>

            <textarea
              rows={4}
              value={form.note || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  note: e.target.value,
                }))
              }
              placeholder="Enter follow-up note..."
              className="w-full px-4 py-3 border resize-none border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-3 font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
            >

              {submitting && (
                <RefreshCw
                  size={17}
                  className="animate-spin"
                />
              )}

              {submitting ? "Adding..." : "Add Follow-up"}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

/* =========================================================
   DETAIL BOX
========================================================= */

function DetailBox({
  icon,
  label,
  value,
}) {
  return (
    <div className="p-4 border rounded-2xl border-slate-200 bg-slate-50">

      <div className="flex items-center gap-2 text-indigo-600">

        {icon}

        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>

      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800">
        {value || "-"}
      </p>

    </div>
  );
}