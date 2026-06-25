import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  status: "new",
  source: "Website",
  department: "Salesforce",
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

    {/* HERO SECTION */}
    <div className="relative p-8 overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700">
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Lead Management
          </h1>

          <p className="mt-2 text-blue-100">
            Manage, track and convert leads into opportunities.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 font-medium text-blue-700 transition bg-white shadow-lg rounded-xl hover:scale-105"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

        </div>
      </div>
    </div>

    {/* KPI SECTION */}
<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-blue-100">
      Total Leads
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.total}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-green-100">
      New Leads
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.newLeads}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-orange-100">
      Contacted
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.contacted}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-purple-600 to-fuchsia-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-purple-100">
      Qualified
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.qualified}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-green-100">
      Converted
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.converted}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-red-500 to-rose-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-red-100">
      Lost
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.lost}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-cyan-500 to-sky-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-cyan-100">
      Active Leads
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.activeLeads}
    </h2>
  </div>

  <div className="p-6 text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-pink-500 to-violet-700 hover:-translate-y-1 hover:shadow-2xl">
    <p className="text-sm text-pink-100">
      Conversion Rate
    </p>
    <h2 className="mt-3 text-4xl font-bold">
      {kpis.conversionRate}%
    </h2>
  </div>

</div>

    {/* FILTER BAR */}
    <div className="p-5 bg-white border shadow-xl rounded-3xl dark:bg-slate-800">

      <div className="flex flex-col gap-4 lg:flex-row">

        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-3.5 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search leads..."
            className="w-full py-3 pl-12 pr-4 border rounded-2xl focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:bg-slate-700 dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
          className="px-4 py-3 border rounded-2xl dark:bg-slate-700 dark:text-white"
        >
          <option value="All">All</option>
<option value="new">New</option>
<option value="contacted">Contacted</option>
<option value="qualified">Qualified</option>
<option value="converted">Converted</option>
<option value="lost">Lost</option>
        </select>

      </div>
    </div>

    {/* TABLE */}
    <div className="overflow-hidden bg-white border shadow-2xl rounded-3xl dark:bg-slate-800">

      <div className="overflow-x-auto">
        <table className="min-w-full">

          <thead className="text-white bg-gradient-to-r from-blue-600 to-indigo-700">
            <tr>
              <th className="px-5 py-4 text-left">Name</th>
              <th className="px-5 py-4 text-left">Email</th>
              <th className="px-5 py-4 text-left">Phone</th>
              <th className="px-5 py-4 text-left">Status</th>
              <th className="px-5 py-4 text-left">Source</th>
              <th className="px-5 py-4 text-left">Department</th>
              <th className="px-5 py-4 text-left">Notes</th>
              <th className="px-5 py-4 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>

            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="py-10 text-center"
                >
                  Loading Leads...
                </td>
              </tr>
            )}

            {!loading &&
              paginatedLeads.map((l) => (
                <tr
                  key={l._id}
                  className="transition border-b hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <td className="px-5 py-4 font-medium">
                    {l.name}
                  </td>

                  <td className="px-5 py-4">
                    {l.email}
                  </td>

                  <td className="px-5 py-4">
                    {l.phone}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        STATUS_COLORS[l.status]
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    {l.source}
                  </td>

                  <td className="px-5 py-4">
                    {l.department}
                  </td>

                  <td className="max-w-[220px] truncate px-5 py-4 text-slate-500">
                    {l.notes}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-center gap-2">

                      <button
  type="button"
  onClick={() => {
    setForm({
      _id: l._id,
      name: l.name || "",
      email: l.email || "",
      phone: l.phone || "",
      status: l.status || "new",
      source: l.source || "Website",
      department: l.department || "Salesforce",
      notes: l.notes || "",
    });

    setDrawerOpen(true);
  }}
  className="p-2 text-blue-600 bg-blue-100 rounded-xl hover:bg-blue-200"
>
  <Pencil size={16} />
</button>

                      <button
                        onClick={() =>
                          deleteLead(l._id)
                        }
                        className="p-2 text-red-600 bg-red-100 rounded-xl hover:bg-red-200"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
  disabled={l.status === "converted"}
  onClick={() =>
    setConvertModal({
      open: true,
      lead: l,
    })
  }
  className={`px-3 py-2 text-xs font-medium text-white rounded-xl ${
    l.status === "converted"
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-green-600 hover:bg-green-700"
  }`}
>
  {l.status === "converted"
    ? "Converted"
    : "Convert"}
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
        className="p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {form._id ? "Edit Lead" : "Create Lead"}
          </h2>

          <button
            type="button"
            onClick={() => {
  setDrawerOpen(false);
  setForm(EMPTY_FORM);

  if (setOpenLeadForm) {
    setOpenLeadForm(false);
  }
}}
          >
            <X size={22} />
          </button>
        </div>

        <input
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
          placeholder="Lead Name"
          className="w-full p-3 border rounded-xl"
          required
        />

        <input
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
          placeholder="Email"
          className="w-full p-3 border rounded-xl"
        />

        <input
          value={form.phone}
          onChange={(e) =>
            setForm({
              ...form,
              phone: e.target.value,
            })
          }
          placeholder="Phone"
          className="w-full p-3 border rounded-xl"
        />

        <select
  value={form.status}
  onChange={(e) =>
    setForm({
      ...form,
      status: e.target.value,
    })
  }
  className="w-full p-3 border rounded-xl"
>
  <option value="new">New</option>
  <option value="contacted">Contacted</option>
  <option value="qualified">Qualified</option>
  <option value="converted">Converted</option>
  <option value="lost">Lost</option>
</select>

        <input
          value={form.source}
          onChange={(e) =>
            setForm({
              ...form,
              source: e.target.value,
            })
          }
          placeholder="Source"
          className="w-full p-3 border rounded-xl"
        />

        <input
          value={form.department}
          onChange={(e) =>
            setForm({
              ...form,
              department: e.target.value,
            })
          }
          placeholder="Department"
          className="w-full p-3 border rounded-xl"
        />

        <textarea
          value={form.notes}
          onChange={(e) =>
            setForm({
              ...form,
              notes: e.target.value,
            })
          }
          placeholder="Notes"
          rows={4}
          className="w-full p-3 border rounded-xl"
        />

        <button
          type="submit"
          className="w-full py-3 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
        >
          {form._id
            ? "Update Lead"
            : "Create Lead"}
        </button>
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