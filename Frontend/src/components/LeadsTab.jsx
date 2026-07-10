import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Home,
  ChevronRight,
   Users,
   Loader2,
   Eye,
   Phone,
   Mail,
   Download,
   TrendingUp,
   RotateCcw,
   Filter,
  
  X,
} from "lucide-react";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  status: "new",
  priority: "Medium",
  source: "Website",
  department: "",
  owner: "",
  value: "",
  expectedCloseDate: "",
  leadScore: 50,
  address: "",
  notes: "",
};
const STATUS_COLORS = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

export default function LeadsTab({
  openLeadForm,
  setOpenLeadForm,
  onLeadCreated,
}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(1);
  const [convertModal, setConvertModal] = useState({ open: false, lead: null });
  const [convertValue, setConvertValue] = useState("");
  const [convertLoading, setConvertLoading] = useState(false);

  /* ================= FETCH ================= */
const fetchLeads = async () => {
  try {
    setLoading(true);

    const res = await API.get("/leads");

    console.log("LEADS API:", res.data);

    const data =
      res?.data?.data ||
      res?.data?.leads ||
      [];

    setLeads(
      Array.isArray(data)
        ? data
        : []
    );
  } catch (error) {
    console.error(
      "FETCH ERROR",
      error.response?.data || error
    );

    toast.error("Failed To Fetch Leads");
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchLeads();
}, []);

useEffect(() => {
  if (openLeadForm) {
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }
}, [openLeadForm]);


// ================= SAVE =================
  const saveLead = async (e) => {
  e.preventDefault();

  try {
    setLoading(true);

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      status: form.status,
      source: form.source,
      department: form.department,
      notes: form.notes,
    };

    let res;

    if (form._id) {
      res = await API.put(
        `/leads/${form._id}`,
        payload
      );

      console.log("UPDATE:", res.data);
      toast.success("Lead Updated");
    } else {
      res = await API.post(
        "/leads",
        payload
      );

      console.log("CREATE:", res.data);
      toast.success("Lead Created");
    }

    setDrawerOpen(false);
    setForm(EMPTY_FORM);

    if (setOpenLeadForm) {
      setOpenLeadForm(false);
    }

    await fetchLeads();

    if (onLeadCreated) {
      onLeadCreated();
    }
  } catch (error) {
    console.error("SAVE ERROR", error);

    toast.error(
      error?.response?.data?.message ||
      "Save Failed"
    );
  } finally {
    setLoading(false);
  }
};
  /* ================= DELETE ================= */
  const deleteLead = async (id) => {
  const confirmDelete =
    window.confirm(
      "Are you sure you want to delete this lead?"
    );

  if (!confirmDelete) return;

  try {
    setLoading(true);

    await API.delete(
      `/leads/${id}`
    );

    toast.success(
      "Lead Deleted Successfully"
    );

    await fetchLeads();
  } catch (error) {
    console.error(error);

    toast.error(
      error?.response?.data?.message ||
      "Delete Failed"
    );
  } finally {
    setLoading(false);
  }
};

  /* ================= CONVERT LEAD ================= */
  const convertLead = async () => {
  if (!convertValue || Number(convertValue) <= 0) {
    return toast.error("Enter valid opportunity value");
  }

  try {
    setConvertLoading(true);

    const res = await API.post(
      `/leads/${convertModal.lead._id}/convert`,
      {
        title: `${convertModal.lead.name} Opportunity`,
        value: Number(convertValue),
      }
    );

    toast.success(
      res.data?.message || "Lead Converted Successfully"
    );

    setConvertModal({
      open: false,
      lead: null,
    });

    setConvertValue("");

    await fetchLeads();
  } catch (error) {
    console.error(error);

    toast.error(
      error?.response?.data?.message ||
      "Convert Failed"
    );
  } finally {
    setConvertLoading(false);
  }
};

  /* ================= FILTER + PAGINATION ================= */
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l) =>
        `${l.name || ""} ${l.email || ""} ${l.phone || ""}`.toLowerCase().includes(search.toLowerCase())
      )
      .filter((l) =>
        statusFilter === "All" ? true : l.status === statusFilter
      );
  }, [leads, search, statusFilter]);

  useEffect(() => setPage(1), [search, statusFilter]);

  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

 
  /* ================= KPI SUMMARY ================= */
/* ================= KPI SUMMARY ================= */
const kpis = useMemo(() => {
  const normalizedLeads = leads.map((lead) => ({
    ...lead,
    status: (lead.status || "").toLowerCase(),
  }));

  const total = normalizedLeads.length;

  const newLeads = normalizedLeads.filter(
    (l) => l.status === "new"
  ).length;

  const contacted = normalizedLeads.filter(
    (l) => l.status === "contacted"
  ).length;

  const qualified = normalizedLeads.filter(
    (l) => l.status === "qualified"
  ).length;

  const converted = normalizedLeads.filter(
    (l) => l.status === "converted"
  ).length;

  const lost = normalizedLeads.filter(
    (l) => l.status === "lost"
  ).length;

  const activeLeads =
    newLeads + contacted + qualified;

  const conversionRate =
    total > 0
      ? Number(
          (converted / total) * 100
        ).toFixed(1)
      : "0.0";

  const lossRate =
    total > 0
      ? Number(
          (lost / total) * 100
        ).toFixed(1)
      : "0.0";

  return {
    total,
    newLeads,
    contacted,
    qualified,
    converted,
    lost,
    activeLeads,
    conversionRate,
    lossRate,
  };
}, [leads]);



  return (
  <div className="space-y-8">

    {/* ===================== HERO SECTION ===================== */}
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 text-white shadow-[0_20px_60px_rgba(15,23,42,0.35)]">

  {/* Background Effects */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_35%)]" />
  <div className="absolute rounded-full -top-20 -right-20 h-72 w-72 bg-indigo-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-24 -left-20 h-72 w-72 bg-cyan-500/20 blur-3xl" />

  <div className="relative p-8 lg:p-10">

    {/* Top */}
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

      {/* Left */}
      <div>

        <div className="flex items-center gap-2 mb-3 text-sm text-blue-200">
          <Home size={15} />
          Dashboard
          <ChevronRight size={14} />
          CRM
          <ChevronRight size={14} />
          <span className="font-medium text-white">
            Lead Management
          </span>
        </div>

        <div className="flex items-center gap-3">

          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur">
            <Users size={28} />
          </div>

          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Lead Management
            </h1>

            <p className="max-w-2xl mt-2 text-blue-100">
              Centralize your sales pipeline, monitor lead performance,
              assign ownership, and convert prospects into customers with
              real-time analytics.
            </p>
          </div>

        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-5 mt-6 text-sm">

          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-500/20 text-emerald-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            CRM Online
          </div>

          <div className="text-blue-100">
            Last Sync :
            <span className="ml-2 font-semibold text-white">
              2 mins ago
            </span>
          </div>

          <div className="text-blue-100">
            Updated Today :
            <span className="ml-2 font-semibold text-white">
              132 Leads
            </span>
          </div>

        </div>

      </div>

      {/* Right Buttons */}
      <div className="flex flex-wrap gap-3">

        <button
          onClick={fetchLeads}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 font-semibold text-indigo-700 transition-all bg-white shadow-lg rounded-xl hover:scale-105"
        >
          <RefreshCw
            size={18}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>

        <button className="flex items-center gap-2 px-5 py-3 font-semibold transition border rounded-xl bg-white/10 border-white/20 hover:bg-white/20">
          <Download size={18} />
          Export
        </button>

        <button className="flex items-center gap-2 px-5 py-3 font-semibold transition rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105">
          <Plus size={18} />
          New Lead
        </button>

      </div>

    </div>

    {/* KPI Cards */}
    <div className="grid grid-cols-2 gap-5 mt-10 md:grid-cols-4">

      <div className="p-5 border bg-white/10 backdrop-blur-xl rounded-2xl border-white/10">
        <div className="text-sm text-blue-200">
          Total Leads
        </div>

        <div className="mt-2 text-3xl font-bold">
          1,248
        </div>

        <div className="mt-1 text-xs text-emerald-300">
          ↑ 12% this month
        </div>
      </div>

      <div className="p-5 border bg-white/10 backdrop-blur-xl rounded-2xl border-white/10">
        <div className="text-sm text-blue-200">
          Qualified
        </div>

        <div className="mt-2 text-3xl font-bold">
          486
        </div>

        <div className="mt-1 text-xs text-green-300">
          Conversion 38%
        </div>
      </div>

      <div className="p-5 border bg-white/10 backdrop-blur-xl rounded-2xl border-white/10">
        <div className="text-sm text-blue-200">
          Follow Ups
        </div>

        <div className="mt-2 text-3xl font-bold">
          93
        </div>

        <div className="mt-1 text-xs text-yellow-300">
          Due Today
        </div>
      </div>

      <div className="p-5 border bg-white/10 backdrop-blur-xl rounded-2xl border-white/10">
        <div className="text-sm text-blue-200">
          Revenue Potential
        </div>

        <div className="mt-2 text-3xl font-bold">
          ₹18.5L
        </div>

        <div className="mt-1 text-xs text-cyan-300">
          Forecast
        </div>
      </div>

    </div>

  </div>
</div>

    <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:-translate-y-2 hover:shadow-2xl">

  {/* Background Glow */}
  <div className="absolute w-32 h-32 rounded-full -top-8 -right-8 bg-white/10 blur-3xl" />

  <div className="relative">

    {/* Header */}
    <div className="flex items-center justify-between">

      <div>
        <p className="text-sm text-blue-100">
          Total Leads
        </p>

        <h2 className="mt-2 text-4xl font-bold">
          {kpis.total}
        </h2>
      </div>

      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur">
        <Users size={28} />
      </div>

    </div>

    {/* Trend */}
    <div className="flex items-center justify-between mt-6">

      <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
        <TrendingUp size={16} />
        +12.4%
      </div>

      <span className="text-xs text-blue-100">
        vs last month
      </span>

    </div>

    {/* Progress */}
    <div className="mt-4">

      <div className="flex justify-between mb-2 text-xs text-blue-100">
        <span>Target</span>
        <span>78%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full bg-white rounded-full"
          style={{ width: "78%" }}
        />
      </div>

    </div>

    {/* Footer */}
    <div className="pt-4 mt-5 border-t border-white/20">
      <div className="flex items-center justify-between text-xs">

        <span className="text-blue-100">
          Updated 2 mins ago
        </span>

        <span className="font-semibold">
          Live Data
        </span>

      </div>
    </div>

  </div>

</div>

   {/* ================= FILTER BAR ================= */}

<div className="p-6 bg-white border shadow-lg border-slate-200 rounded-3xl">

  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

    {/* Left */}
    <div className="flex flex-wrap flex-1 gap-4">

      {/* Search */}
      <div className="relative flex-1 min-w-[260px]">

        <Search
          size={18}
          className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Name, Email, Phone..."
          className="w-full py-3 pl-12 pr-4 transition border outline-none rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />

      </div>

      {/* Status */}
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-4 py-3 bg-white border rounded-2xl border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
      >
        <option>All Status</option>
        <option>New</option>
        <option>Contacted</option>
        <option>Qualified</option>
        <option>Converted</option>
        <option>Lost</option>
      </select>

      {/* Source */}
      <select className="px-4 py-3 bg-white border rounded-2xl border-slate-200">
        <option>Lead Source</option>
        <option>Website</option>
        <option>Facebook</option>
        <option>LinkedIn</option>
        <option>Referral</option>
      </select>

      {/* Date */}
      <input
        type="date"
        className="px-4 py-3 border rounded-2xl border-slate-200"
      />

    </div>

    {/* Right */}
    <div className="flex flex-wrap items-center gap-3">

      <span className="px-4 py-2 text-sm font-medium text-indigo-700 rounded-full bg-indigo-50">
        {filteredLeads.length} Results
      </span>

      <button
        className="flex items-center gap-2 px-4 py-3 border rounded-2xl border-slate-200 hover:bg-slate-50"
      >
        <RotateCcw size={17} />
        Reset
      </button>

      <button
        className="flex items-center gap-2 px-5 py-3 font-medium text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700"
      >
        <Filter size={17} />
        Apply Filters
      </button>

    </div>

  </div>

</div>

    {/* TABLE */}
    <div className="overflow-hidden bg-white border shadow-2xl rounded-3xl dark:bg-slate-800">

      <div className="overflow-x-auto">
        <table className="min-w-full">

          <thead className="sticky top-0 z-10 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

<tr>
  <th className="px-5 py-4">
    <input type="checkbox" />
  </th>

  <th className="px-5 py-4 text-left">Lead</th>

  <th className="px-5 py-4 text-left">Company</th>

  <th className="px-5 py-4 text-left">Contact</th>

  <th className="px-5 py-4 text-left">Owner</th>

  <th className="px-5 py-4 text-left">Priority</th>

  <th className="px-5 py-4 text-left">Status</th>

  <th className="px-5 py-4 text-left">Source</th>

  <th className="px-5 py-4 text-left">Value</th>

  <th className="px-5 py-4 text-left">Last Activity</th>

  <th className="px-5 py-4 text-left">Created</th>

  <th className="px-5 py-4 text-center">Actions</th>
</tr>

</thead>

          <tbody>

          {loading && (
  <tr>
    <td colSpan={12} className="py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2
          size={32}
          className="text-indigo-600 animate-spin"
        />
        <span className="text-slate-500">
          Loading Leads...
        </span>
      </div>
    </td>
  </tr>
)}

           {!loading &&
  paginatedLeads.map((l) => (
    <tr
      key={l._id}
      className="transition-all duration-200 border-b border-slate-100 hover:bg-slate-50"
    >
      {/* Checkbox */}
      <td className="px-5 py-4">
        <input type="checkbox" />
      </td>

      {/* Lead */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center font-bold text-white rounded-full h-11 w-11 bg-gradient-to-r from-blue-600 to-indigo-600">
            {l.name?.charAt(0)?.toUpperCase()}
          </div>

          <div>
            <h4 className="font-semibold">{l.name}</h4>
            <p className="text-xs text-slate-500">{l.email}</p>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="px-5 py-4">
        {l.company || "-"}
      </td>

      {/* Contact */}
      <td className="px-5 py-4">
        <div className="space-y-1">
          <div>{l.phone}</div>
          <div className="text-xs text-slate-500">
            {l.email}
          </div>
        </div>
      </td>

      {/* Owner */}
      <td className="px-5 py-4">
        {l.owner || "Admin"}
      </td>

      {/* Priority */}
      <td className="px-5 py-4">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            l.priority === "High"
              ? "bg-red-100 text-red-700"
              : l.priority === "Medium"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {l.priority || "Low"}
        </span>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            STATUS_COLORS[l.status]
          }`}
        >
          {l.status}
        </span>
      </td>

      {/* Source */}
      <td className="px-5 py-4">
        {l.source}
      </td>

      {/* Value */}
      <td className="px-5 py-4 font-semibold text-emerald-600">
        ₹ {l.value?.toLocaleString() || "0"}
      </td>

      {/* Last Activity */}
      <td className="px-5 py-4 text-sm text-slate-500">
        {l.lastActivity || "Today"}
      </td>

      {/* Created */}
      <td className="px-5 py-4 text-sm text-slate-500">
        {new Date(l.createdAt).toLocaleDateString()}
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex justify-center gap-2">

          <button
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200"
          >
            <Eye size={16} />
          </button>

          <button
            className="p-2 text-blue-600 bg-blue-100 rounded-xl hover:bg-blue-200"
          >
            <Pencil size={16} />
          </button>

          <button
            className="p-2 text-green-600 bg-green-100 rounded-xl hover:bg-green-200"
          >
            <Phone size={16} />
          </button>

          <button
            className="p-2 text-purple-600 bg-purple-100 rounded-xl hover:bg-purple-200"
          >
            <Mail size={16} />
          </button>

          <button
            className="p-2 text-red-600 bg-red-100 rounded-xl hover:bg-red-200"
          >
            <Trash2 size={16} />
          </button>

        </div>
      </td>
    </tr>
))}

          </tbody>
        </table>
      </div>
    </div>

    {/* PAGINATION */}
    {totalPages > 1 && (
      <div className="flex justify-end gap-3">
        <button
          disabled={page === 1}
          onClick={() =>
            setPage((p) => p - 1)
          }
          className="px-4 py-2 border rounded-xl disabled:opacity-50"
        >
          Previous
        </button>

        <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700">
          Page {page} of {totalPages}
        </div>

        <button
          disabled={page === totalPages}
          onClick={() =>
            setPage((p) => p + 1)
          }
          className="px-4 py-2 border rounded-xl disabled:opacity-50"
        >
          Next
        </button>
      </div>
    )}

{drawerOpen && (
  <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">

    <div className="w-full h-full max-w-lg overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">

      <form
  onSubmit={saveLead}
  className="flex flex-col h-full"
>
  {/* Header */}
  <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white border-b">
    <div>
      <h2 className="text-2xl font-bold text-slate-800">
        {form._id ? "Edit Lead" : "Create New Lead"}
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Manage lead information and sales pipeline.
      </p>
    </div>

    <button
      type="button"
      onClick={() => {
        setDrawerOpen(false);
        setForm(EMPTY_FORM);

        if (setOpenLeadForm) {
          setOpenLeadForm(false);
        }
      }}
      className="p-2 transition rounded-xl hover:bg-slate-100"
    >
      <X size={22} />
    </button>
  </div>

  {/* Body */}
  <div className="flex-1 p-6 space-y-8 overflow-y-auto">

    {/* Lead Information */}
    <div>
      <h3 className="pb-2 mb-5 text-lg font-semibold border-b text-slate-800">
        Lead Information
      </h3>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        <input
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          placeholder="Lead Name *"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          required
        />

        <input
          value={form.company || ""}
          onChange={(e) =>
            setForm({ ...form, company: e.target.value })
          }
          placeholder="Company"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        <input
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          placeholder="Email"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        <input
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
          placeholder="Phone"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        <input
          value={form.website || ""}
          onChange={(e) =>
            setForm({ ...form, website: e.target.value })
          }
          placeholder="Website"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        <input
          value={form.department}
          onChange={(e) =>
            setForm({ ...form, department: e.target.value })
          }
          placeholder="Department"
          className="w-full p-3 transition border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

      </div>
    </div>

    {/* Sales Information */}
    <div>
      <h3 className="pb-2 mb-5 text-lg font-semibold border-b text-slate-800">
        Sales Information
      </h3>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        <select
          value={form.status}
          onChange={(e) =>
            setForm({ ...form, status: e.target.value })
          }
          className="w-full p-3 border rounded-xl"
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>

        <select
          value={form.priority || "Medium"}
          onChange={(e) =>
            setForm({ ...form, priority: e.target.value })
          }
          className="w-full p-3 border rounded-xl"
        >
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <input
          value={form.source}
          onChange={(e) =>
            setForm({ ...form, source: e.target.value })
          }
          placeholder="Lead Source"
          className="w-full p-3 border rounded-xl"
        />

        <input
          value={form.owner || ""}
          onChange={(e) =>
            setForm({ ...form, owner: e.target.value })
          }
          placeholder="Assigned Owner"
          className="w-full p-3 border rounded-xl"
        />

      </div>
    </div>

    {/* Opportunity */}
    <div>
      <h3 className="pb-2 mb-5 text-lg font-semibold border-b text-slate-800">
        Opportunity
      </h3>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        <input
          type="number"
          value={form.value || ""}
          onChange={(e) =>
            setForm({ ...form, value: e.target.value })
          }
          placeholder="Expected Deal Value"
          className="w-full p-3 border rounded-xl"
        />

        <input
          type="date"
          value={form.expectedCloseDate || ""}
          onChange={(e) =>
            setForm({
              ...form,
              expectedCloseDate: e.target.value,
            })
          }
          className="w-full p-3 border rounded-xl"
        />

      </div>

      <div className="mt-5">

        <label className="block mb-2 text-sm font-medium text-slate-600">
          Lead Score ({form.leadScore || 50})
        </label>

        <input
          type="range"
          min="0"
          max="100"
          value={form.leadScore || 50}
          onChange={(e) =>
            setForm({
              ...form,
              leadScore: e.target.value,
            })
          }
          className="w-full"
        />

      </div>
    </div>

    {/* Additional Information */}
    <div>
      <h3 className="pb-2 mb-5 text-lg font-semibold border-b text-slate-800">
        Additional Information
      </h3>

      <textarea
        rows={3}
        value={form.address || ""}
        onChange={(e) =>
          setForm({ ...form, address: e.target.value })
        }
        placeholder="Address"
        className="w-full p-3 border rounded-xl"
      />

      <textarea
        rows={5}
        value={form.notes}
        onChange={(e) =>
          setForm({ ...form, notes: e.target.value })
        }
        placeholder="Notes"
        className="w-full p-3 mt-5 border rounded-xl"
      />

    </div>

  </div>

  {/* Footer */}
  <div className="sticky bottom-0 flex justify-end gap-3 p-6 bg-white border-t">

    <button
      type="button"
      onClick={() => {
        setDrawerOpen(false);
        setForm(EMPTY_FORM);
      }}
      className="px-6 py-3 font-medium transition border rounded-xl hover:bg-slate-100"
    >
      Cancel
    </button>

    <button
      type="submit"
      className="px-8 py-3 font-semibold text-white transition rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-xl"
    >
      {form._id ? "Update Lead" : "Create Lead"}
    </button>

  </div>
</form>
    </div>
  </div>
)}

{convertModal.open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">

    <div className="w-full max-w-md p-6 bg-white shadow-2xl rounded-3xl dark:bg-slate-900">

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">
          Convert Lead
        </h2>

        <button
          onClick={() =>
            setConvertModal({
              open: false,
              lead: null,
            })
          }
        >
          <X size={20} />
        </button>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500">
          Lead Name
        </p>

        <p className="font-semibold">
          {convertModal.lead?.name}
        </p>
      </div>

      <input
        type="number"
        placeholder="Opportunity Value"
        value={convertValue}
        onChange={(e) =>
          setConvertValue(e.target.value)
        }
        className="w-full p-3 mb-4 border rounded-xl"
      />

      <button
        onClick={convertLead}
        disabled={convertLoading}
        className="w-full py-3 font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700"
      >
        {convertLoading
          ? "Converting..."
          : "Convert To Opportunity"}
      </button>
    </div>
  </div>
)}

  </div>
);  
}