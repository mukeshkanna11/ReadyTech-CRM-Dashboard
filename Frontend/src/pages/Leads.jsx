import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  status: "New",
  source: "Website",
  notes: "",
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [activeLead, setActiveLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [page, setPage] = useState(1);

  /* ================= FETCH ================= */
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await API.get("/leads");
      setLeads(res.data?.data || []);
    } catch {
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

  /* ================= FILTER ================= */
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l) =>
        `${l.name} ${l.email} ${l.phone}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
      .filter((l) =>
        statusFilter === "All" ? true : l.status === statusFilter
      );
  }, [leads, search, statusFilter]);

  /* ================= PAGINATION ================= */
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE) || 1;
  const paginatedLeads = filteredLeads.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  /* ================= KPI ================= */
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "New").length;
  const qualifiedLeads = leads.filter((l) => l.status === "Qualified").length;

  /* ================= UI ================= */
  return (
    <div className="p-6 space-y-8 bg-gradient-to-b from-slate-100 to-slate-50">

      {/* HERO HEADER */}
      <div className="relative p-8 overflow-hidden text-white rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800">
        <Sparkles className="absolute right-6 top-6 opacity-20" size={120} />
        <h1 className="text-3xl font-bold">Lead Management</h1>
        <p className="max-w-2xl mt-2 text-slate-300">
          Centralize, nurture, and convert potential customers into revenue
          using <b>ReadyTech CRM</b>. Track every interaction from first contact
          to deal closure.
        </p>

        <div className="flex gap-3 mt-6">
          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-xl"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white text-slate-900 rounded-xl"
          >
            <Plus size={16} /> Add New Lead
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Kpi title="Total Leads" value={totalLeads} icon={Users} accent="blue" />
        <Kpi title="New Leads" value={newLeads} icon={TrendingUp} accent="amber" />
        <Kpi
          title="Qualified Leads"
          value={qualifiedLeads}
          icon={CheckCircle}
          accent="green"
        />
      </div>

      {/* SEARCH & FILTER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, email, phone..."
            className="w-full py-3 pr-4 text-sm bg-white border shadow-sm pl-11 rounded-2xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 text-sm bg-white border rounded-2xl"
          >
            <option>All</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Qualified</option>
            <option>Closed</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-3xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-6 py-4 text-left">Lead</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && paginatedLeads.length === 0 && (
              <tr>
                <td colSpan="5" className="py-12 text-center">
                  <p className="text-slate-500">
                    No leads yet. Start by adding your first potential customer.
                  </p>
                </td>
              </tr>
            )}

            {paginatedLeads.map((l) => (
              <tr key={l._id} className="border-t hover:bg-slate-50">
                <td
                  className="px-6 py-4 cursor-pointer"
                  onClick={() => {
                    setActiveLead(l);
                    setProfileOpen(true);
                  }}
                >
                  <div className="font-medium text-slate-900">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.email}</div>
                </td>

                <td className="px-6 py-4 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail size={14} /> {l.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} /> {l.phone}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span className="px-3 py-1 text-xs rounded-full bg-slate-100">
                    {l.status}
                  </span>
                </td>

                <td className="px-6 py-4">{l.source}</td>

                <td className="flex gap-3 px-6 py-4">
                  <button
                    onClick={() => {
                      setForm(l);
                      setDrawerOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteLead(l._id)}>
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* READYTECH CRM EXPLANATION */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white border rounded-3xl">
          <h3 className="mb-2 text-lg font-semibold">
            What are Leads in ReadyTech CRM?
          </h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Leads are individuals or organizations that show interest in your
            services. ReadyTech CRM helps your sales team capture leads from
            websites, calls, emails, and campaigns, track engagement, and
            convert them into real business opportunities.
          </p>
        </div>

        <div className="p-6 text-white bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl">
          <h3 className="flex items-center gap-2 mb-2 text-lg font-semibold">
            How ReadyTech Helps <ArrowRight size={16} />
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Centralized lead database</li>
            <li>• Status-based sales pipeline</li>
            <li>• Faster follow-ups & better conversions</li>
            <li>• Clear visibility for sales managers</li>
          </ul>
        </div>
      </div>

      {/* DRAWERS */}
      {drawerOpen && (
        <Drawer title={form._id ? "Edit Lead" : "New Lead"} onClose={() => setDrawerOpen(false)} onSubmit={saveLead}>
          <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full p-3 border rounded-xl"
          >
            <option>New</option>
            <option>Contacted</option>
            <option>Qualified</option>
            <option>Closed</option>
          </select>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            className="w-full p-3 border rounded-xl"
          />
          <button className="w-full py-3 text-white bg-slate-900 rounded-xl">
            Save Lead
          </button>
        </Drawer>
      )}

      {profileOpen && activeLead && (
        <Drawer title={activeLead.name} onClose={() => setProfileOpen(false)}>
          <p className="text-sm text-slate-600">Status: {activeLead.status}</p>
          <p className="text-sm text-slate-600">Source: {activeLead.source}</p>
          <div className="mt-3 text-xs text-slate-500">
            Activity timeline coming soon
          </div>
        </Drawer>
      )}
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Kpi({ title, value, icon: Icon, accent }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
  };
  return (
    <div className="flex items-center gap-4 p-5 bg-white border shadow-sm rounded-3xl">
      <div className={`p-3 rounded-2xl ${colors[accent]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Drawer({ title, children, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md p-6 space-y-3 bg-white"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <X onClick={onClose} className="cursor-pointer" />
        </div>
        {children}
      </form>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-3 border rounded-xl"
      />
    </div>
  );
}
