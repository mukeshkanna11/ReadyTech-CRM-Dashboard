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

  /* ================= FETCH LEADS ================= */
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

  /* ================= SAVE LEAD ================= */
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
      setPage(1);
      fetchLeads();
    } catch {
      toast.error("Save failed");
    }
  };

  /* ================= DELETE LEAD ================= */
  const deleteLead = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    try {
      await API.delete(`/leads/${id}`);
      toast.success("Lead deleted");
      setPage(1);
      fetchLeads();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= FILTER + SEARCH ================= */
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

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-slate-500">
            Capture, track and convert leads
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchLeads}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl"
          >
            <RefreshCw size={16} /> Refresh
          </button>

          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl bg-slate-900"
          >
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* SEARCH + FILTER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads"
            className="w-full py-2 pl-10 pr-3 text-sm border rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-xl"
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
      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && paginatedLeads.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-slate-500">
                  No leads found
                </td>
              </tr>
            )}

            {paginatedLeads.map((l) => (
              <tr key={l._id} className="border-t hover:bg-slate-50">
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => {
                    setActiveLead(l);
                    setProfileOpen(true);
                  }}
                >
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.email}</div>
                </td>

                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail size={14} /> {l.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} /> {l.phone}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded-lg bg-slate-100">
                    {l.status}
                  </span>
                </td>

                <td className="px-4 py-3">{l.source}</td>

                <td className="flex gap-2 px-4 py-3">
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

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* CREATE / EDIT DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form
            onSubmit={saveLead}
            className="w-full max-w-md p-6 space-y-3 bg-white"
          >
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">
                {form._id ? "Edit Lead" : "New Lead"}
              </h2>
              <X
                onClick={() => setDrawerOpen(false)}
                className="cursor-pointer"
              />
            </div>

            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
              className="w-full p-2 border rounded"
            />

            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="w-full p-2 border rounded"
            />

            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="w-full p-2 border rounded"
            />

            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full p-2 border rounded"
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
              className="w-full p-2 border rounded"
            />

            <button className="w-full py-2 text-white rounded bg-slate-900">
              Save Lead
            </button>
          </form>
        </div>
      )}

      {/* PROFILE DRAWER */}
      {profileOpen && activeLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-lg p-6 space-y-4 bg-white">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">{activeLead.name}</h2>
              <X
                onClick={() => setProfileOpen(false)}
                className="cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User size={14} /> {activeLead.email}
              </div>
              <div>{activeLead.phone}</div>
              <div>Status: {activeLead.status}</div>
              <div>Source: {activeLead.source}</div>
            </div>

            <div className="pt-3 border-t">
              <h3 className="flex items-center gap-2 font-medium">
                <Activity size={16} /> Activity
              </h3>
              <p className="text-xs text-slate-500">
                Timeline & follow-ups coming soon
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
