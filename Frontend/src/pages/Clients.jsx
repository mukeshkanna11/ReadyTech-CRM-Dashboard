import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  User,
  FileText,
  Activity,
  X,
} from "lucide-react";

/* =========================================================
   ENTERPRISE CRM – CLIENTS MODULE (ZOHO-STYLE)
   Features:
   - Client list with search
   - Create / Edit / Delete
   - Client profile drawer
   - Notes & activity timeline (basic)
   - Responsive + production-ready
========================================================= */

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeClient, setActiveClient] = useState(null);

  const emptyForm = {
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "Active",
    source: "Website",
    address: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  /* ================= Fetch ================= */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/clients");
      setClients(data);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /* ================= Create / Update ================= */
  const saveClient = async (e) => {
    e.preventDefault();
    try {
      if (form._id) {
        await API.put(`/clients/${form._id}`, form);
        toast.success("Client updated");
      } else {
        await API.post("/clients", form);
        toast.success("Client created");
      }
      setDrawerOpen(false);
      setForm(emptyForm);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  /* ================= Delete ================= */
  const removeClient = async (id) => {
    if (!confirm("Delete this client permanently?")) return;
    try {
      await API.delete(`/clients/${id}`);
      toast.success("Client removed");
      fetchClients();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= Search ================= */
  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      `${c.name} ${c.company} ${c.email}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [clients, search]);

  return (
    <div className="space-y-6">
      {/* ================= Header ================= */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500">
            Manage customers, communications & activities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchClients}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl bg-slate-900"
          >
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      {/* ================= Search ================= */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company or email"
          className="w-full py-2 pl-10 pr-3 text-sm border rounded-xl"
        />
      </div>

      {/* ================= Table ================= */}
      <div className="overflow-x-auto bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && filteredClients.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                  No clients found
                </td>
              </tr>
            )}
            {filteredClients.map((c) => (
              <tr key={c._id} className="border-t hover:bg-slate-50">
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => {
                    setActiveClient(c);
                    setProfileOpen(true);
                  }}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td className="px-4 py-3">{c.company || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-1 text-xs ${c.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">{c.source}</td>
                <td className="px-4 py-3 text-xs">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="flex gap-2 px-4 py-3">
                  <button
                    onClick={() => {
                      setForm(c);
                      setDrawerOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => removeClient(c._id)}>
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= Create / Edit Drawer ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form onSubmit={saveClient} className="w-full max-w-md p-6 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{form._id ? "Edit Client" : "New Client"}</h2>
              <X onClick={() => setDrawerOpen(false)} className="cursor-pointer" />
            </div>

            {Object.keys(emptyForm).map((key) => (
              key !== "notes" ? (
                <input
                  key={key}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              ) : (
                <textarea
                  key={key}
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              )
            ))}

            <button className="w-full py-2 text-white rounded bg-slate-900">
              Save Client
            </button>
          </form>
        </div>
      )}

      {/* ================= Client Profile ================= */}
      {profileOpen && activeClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-lg p-6 space-y-4 bg-white">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">{activeClient.name}</h2>
              <X onClick={() => setProfileOpen(false)} className="cursor-pointer" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><User size={14}/> {activeClient.email}</div>
              <div>{activeClient.phone}</div>
              <div>{activeClient.company}</div>
              <div>{activeClient.status}</div>
            </div>

            <div className="pt-3 border-t">
              <h3 className="flex items-center gap-2 mb-2 font-medium"><FileText size={16}/> Notes</h3>
              <p className="text-sm text-slate-600">{activeClient.notes || "No notes"}</p>
            </div>

            <div className="pt-3 border-t">
              <h3 className="flex items-center gap-2 mb-2 font-medium"><Activity size={16}/> Activity</h3>
              <p className="text-xs text-slate-500">Activity timeline integration ready</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
