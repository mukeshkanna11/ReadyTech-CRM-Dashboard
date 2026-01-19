import React, { useEffect, useMemo, useState } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import { Search, Plus, RefreshCw, Pencil, Trash2, Mail, Phone, X } from "lucide-react";

const PAGE_SIZE = 8;

export default function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "New",
    source: "Website",
    department: "Salesforce",
    notes: "",
  });
  const [page, setPage] = useState(1);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/salesforce/leads");
      setLeads(data?.data || []);
    } catch {
      toast.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

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
      setForm({
        name: "",
        email: "",
        phone: "",
        status: "New",
        source: "Website",
        department: "Salesforce",
        notes: "",
      });
      fetchLeads();
    } catch {
      toast.error("Save failed");
    }
  };

  const deleteLead = async (id) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await API.delete(`/salesforce/leads/${id}`);
      toast.success("Lead deleted");
      fetchLeads();
    } catch {
      toast.error("Delete failed");
    }
  };

  // FILTER + PAGINATION
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

  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-xl font-semibold">Leads</h2>
          <p className="text-sm text-gray-500">Manage Salesforce leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLeads} className="btn">
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="btn-primary"
          >
            <Plus size={16} /> Add Lead
          </button>
        </div>
      </div>

      {/* Search + Status */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            className="w-full p-2 pl-10 border rounded"
            placeholder="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded"
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

      {/* Table */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((l) => (
              <tr key={l._id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2">{l.email}</td>
                <td className="px-4 py-2">{l.phone}</td>
                <td className="px-4 py-2">{l.status}</td>
                <td className="flex gap-2 px-4 py-2">
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
            {paginatedLeads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No leads found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="px-3 py-1">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form
            onSubmit={saveLead}
            className="w-full max-w-md p-4 space-y-2 bg-white rounded-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{form._id ? "Edit Lead" : "New Lead"}</h3>
              <X onClick={() => setDrawerOpen(false)} className="cursor-pointer" />
            </div>
            {["name","email","phone","status","source","department","notes"].map((key) => (
              key === "notes" ? (
                <textarea
                  key={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={key}
                  className="w-full p-2 border rounded"
                />
              ) : (
                <input
                  key={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={key}
                  className="w-full p-2 border rounded"
                />
              )
            ))}
            <button className="w-full py-2 text-white bg-blue-700 rounded">Save Lead</button>
          </form>
        </div>
      )}
    </div>
  );
}
