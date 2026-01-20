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
  status: "New",
  source: "Website",
  department: "Salesforce",
  notes: "",
};

const STATUS_COLORS = {
  New: "bg-blue-100 text-blue-800",
  Contacted: "bg-yellow-100 text-yellow-800",
  Qualified: "bg-purple-100 text-purple-800",
  Closed: "bg-green-100 text-green-800",
};

export default function LeadsTab() {
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
      const res = await API.get("/salesforce/leads");
      setLeads(res?.data?.data || []);
    } catch {
      toast.error("Failed to fetch leads");
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
        await API.put(`/salesforce/leads/${form._id}`, form);
        toast.success("Lead updated");
      } else {
        await API.post("/salesforce/leads", form);
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
      await API.delete(`/salesforce/leads/${id}`);
      toast.success("Lead deleted");
      fetchLeads();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= CONVERT LEAD ================= */
  const convertLead = async () => {
    if (!convertValue) return toast.error("Enter opportunity value");
    try {
      setConvertLoading(true);
      await API.post(`/salesforce/leads/${convertModal.lead._id}/convert`, {
        title: `${convertModal.lead.source || "Lead"} Deal`,
        value: Number(convertValue),
      });
      toast.success("Lead converted successfully");
      setConvertModal({ open: false, lead: null });
      setConvertValue("");
      fetchLeads();
    } catch {
      toast.error("Conversion failed");
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
  const kpis = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter((l) => l.status === "New").length;
    const contacted = leads.filter((l) => l.status === "Contacted").length;
    const qualified = leads.filter((l) => l.status === "Qualified").length;
    return { total, newLeads, contacted, qualified };
  }, [leads]);

  return (
    <div className="space-y-6">

      {/* HEADER + KPI */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Salesforce Leads</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300">Manage your leads efficiently</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={fetchLeads} className="flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-700" disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setDrawerOpen(true); }} className="flex items-center gap-1 px-3 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="p-3 bg-white shadow dark:bg-slate-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-300">Total Leads</p>
          <p className="text-xl font-bold text-gray-800 dark:text-white">{kpis.total}</p>
        </div>
        <div className="p-3 bg-white shadow dark:bg-slate-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-300">New</p>
          <p className="text-xl font-bold text-blue-600">{kpis.newLeads}</p>
        </div>
        <div className="p-3 bg-white shadow dark:bg-slate-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-300">Contacted</p>
          <p className="text-xl font-bold text-yellow-600">{kpis.contacted}</p>
        </div>
        <div className="p-3 bg-white shadow dark:bg-slate-800 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-300">Qualified</p>
          <p className="text-xl font-bold text-purple-600">{kpis.qualified}</p>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full p-2 pl-10 border rounded dark:bg-slate-800 dark:border-gray-700 dark:text-white"
            placeholder="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded dark:bg-slate-800 dark:border-gray-700 dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>New</option>
          <option>Contacted</option>
          <option>Qualified</option>
          <option>Closed</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Notes</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((l) => (
              <tr key={l._id} className="border-t hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2">{l.email}</td>
                <td className="px-4 py-2">{l.phone}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[l.status] || "bg-gray-100 text-gray-800"}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2">{l.source}</td>
                <td className="px-4 py-2">{l.department}</td>
                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-300">{l.notes?.substring(0, 30)}{l.notes?.length > 30 ? "..." : ""}</td>
                <td className="flex gap-2 px-4 py-2">
                  <button onClick={() => { setForm(l); setDrawerOpen(true); }}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteLead(l._id)}>
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                  <button
                    onClick={() => setConvertModal({ open: true, lead: l })}
                    className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                  >
                    Convert
                  </button>
                </td>
              </tr>
            ))}
            {!loading && paginatedLeads.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No leads found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1">Page {page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}

      {/* DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form onSubmit={saveLead} className="w-full max-w-md p-4 space-y-3 bg-white dark:bg-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form._id ? "Edit Lead" : "New Lead"}</h3>
              <X onClick={() => setDrawerOpen(false)} className="cursor-pointer" />
            </div>
            {["name","email","phone","status","source","department"].map((key)=>(
              <input key={key} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} placeholder={key} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600 dark:text-white"/>
            ))}
            <textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="Notes" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600 dark:text-white"/>
            <button className="w-full py-2 text-white bg-blue-700 rounded hover:bg-blue-800">Save Lead</button>
          </form>
        </div>
      )}

      {/* CONVERT MODAL */}
      {convertModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md p-6 space-y-4 bg-white rounded-xl dark:bg-slate-800">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Convert Lead</h2>
              <X onClick={()=>setConvertModal({open:false,lead:null})} className="cursor-pointer" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Lead: <strong>{convertModal.lead.name}</strong>
            </p>
            <input type="number" placeholder="Opportunity Value" value={convertValue} onChange={(e)=>setConvertValue(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600 dark:text-white"/>
            <button onClick={convertLead} disabled={convertLoading} className="w-full py-2 text-white bg-green-600 rounded hover:bg-green-700">
              {convertLoading ? "Converting..." : "Convert to Opportunity"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
