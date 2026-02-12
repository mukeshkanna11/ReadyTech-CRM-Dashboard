import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Filter,
  Users as UsersIcon,
  ShieldCheck,
  Briefcase,
  Phone,
  Mail,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * PREMIUM Zoho-inspired Users Management
 * ✔ Same logic
 * ✔ Same API
 * ✔ Enterprise SaaS Design
 */

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [drawer, setDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Staff",
    status: "Active",
    department: "",
    phone: "",
  });

  /* ================= FETCH ================= */
 const fetchUsers = async () => {
  try {
    const data = await API.get("/admin/users"); // no need for data.data now
    setUsers(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("FETCH USERS ERROR:", err);
  }
};


  useEffect(() => {
    fetchUsers();
  }, []);

  /* ================= METRICS ================= */
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter(
      (u) => (u.status || "Active") === "Active"
    ).length;
    const admins = users.filter(
      (u) => String(u.role || "").toLowerCase() === "admin"
    ).length;
    return { total, active, admins };
  }, [users]);

  /* ================= ACTIONS ================= */
  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      role: "Staff",
      status: "Active",
      department: "",
      phone: "",
    });
    setDrawer(true);
  };

  const openEdit = (u) => {
    setEditingId(u._id);
    setForm({
      name: u.name || "",
      email: u.email || "",
      role: u.role || "Staff",
      status: u.status || "Active",
      department: u.department || "",
      phone: u.phone || "",
    });
    setDrawer(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      editingId
        ? await API.put(`/admin/users/${editingId}`, form)
        : await API.post("/admin/users", form);

      toast.success(editingId ? "User updated" : "User created");
      setDrawer(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  const removeUser = async (id) => {
    if (!confirm("Remove this user?")) return;
    try {
      await API.delete(`/admin/users/${id}`);
      toast.success("User removed");
      fetchUsers();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= FILTER ================= */
  const filtered = users.filter((u) => {
    const textMatch = [u.name, u.email, u.role, u.department]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const roleMatch = roleFilter === "All" || (u.role || "Staff") === roleFilter;
    const statusMatch =
      statusFilter === "All" || (u.status || "Active") === statusFilter;

    return textMatch && roleMatch && statusMatch;
  });

  /* ================= DATE ================= */
  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <div className="min-h-screen p-8 space-y-10 bg-gradient-to-br from-slate-50 via-white to-slate-100">

      {/* ================= HERO HEADER ================= */}
      <div className="relative overflow-hidden border shadow-xl rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700">
        <div className="p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur">
              <UsersIcon size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">User & Access Management</h1>
              <p className="mt-1 text-sm text-indigo-100">
                Control roles, permissions & security across CRM & ERP
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= METRICS ================= */}
      <div className="grid gap-6 md:grid-cols-3">
        <PremiumMetric
          title="Total Users"
          value={metrics.total}
          gradient="from-blue-500 to-indigo-600"
          icon={<UsersIcon />}
        />
        <PremiumMetric
          title="Active Users"
          value={metrics.active}
          gradient="from-emerald-500 to-teal-600"
          icon={<ShieldCheck />}
        />
        <PremiumMetric
          title="Administrators"
          value={metrics.admins}
          gradient="from-purple-500 to-fuchsia-600"
          icon={<Briefcase />}
        />
      </div>

      {/* ================= TOOLBAR ================= */}
      <div className="sticky z-20 p-4 border shadow top-4 bg-white/80 backdrop-blur rounded-2xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute w-4 h-4 text-slate-400 left-4 top-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name, email or role"
              className="w-full py-3 pr-4 text-sm border rounded-xl pl-11"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm border rounded-xl"
            >
              <option value="All">All Roles</option>
              <option>Admin</option>
              <option>Manager</option>
              <option>Staff</option>
              <option>Support</option>
              <option>Finance</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border rounded-xl"
            >
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
            >
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-hidden bg-white border shadow-xl rounded-3xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-500">
            <tr>
              <th className="p-4 text-left">User</th>
              <th className="p-4 text-center">Role</th>
              <th className="p-4 text-center">Department</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Created</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u._id}
                className="transition border-t hover:bg-indigo-50/40"
              >
                <td className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center font-bold text-indigo-600 bg-indigo-100 rounded-full w-11 h-11">
                      {u.name?.[0] || "U"}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {u.name || "Unnamed"}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail size={12} /> {u.email}
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone size={12} /> {u.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 font-medium text-center">
                  {u.role || "Staff"}
                </td>
                <td className="p-4 text-center">{u.department || "—"}</td>
                <td className="p-4 text-center">
                  <span
                    className={`px-3 py-1 text-xs rounded-full font-medium ${
                      (u.status || "Active") === "Inactive"
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {u.status || "Active"}
                  </span>
                </td>
                <td className="p-4 text-xs text-center text-slate-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 text-blue-600 rounded-lg hover:bg-blue-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => removeUser(u._id)}
                      className="p-2 text-red-600 rounded-lg hover:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ================= DRAWER ================= */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/40"
          >
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              className="w-full max-w-md p-6 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {editingId ? "Edit User" : "Add User"}
                </h2>
                <button onClick={() => setDrawer(false)}>
                  <X />
                </button>
              </div>

              <form onSubmit={saveUser} className="space-y-4">
                <input required placeholder="Full Name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-3 border rounded-xl" />

                <input required type="email" placeholder="Email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-3 border rounded-xl" />

                <input placeholder="Phone" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full p-3 border rounded-xl" />

                <input placeholder="Department" value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full p-3 border rounded-xl" />

                <select value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full p-3 border rounded-xl">
                  <option>Admin</option>
                  <option>Manager</option>
                  <option>Staff</option>
                  <option>Support</option>
                  <option>Finance</option>
                </select>

                <select value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full p-3 border rounded-xl">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>

                <button className="w-full py-3 font-medium text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                  Save User
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= PREMIUM METRIC ================= */
function PremiumMetric({ title, value, icon, gradient }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`relative p-6 text-white rounded-3xl shadow-xl bg-gradient-to-br ${gradient}`}
    >
      <div className="absolute top-4 right-4 opacity-30">{icon}</div>
      <div className="text-sm tracking-wide uppercase opacity-90">{title}</div>
      <div className="mt-2 text-4xl font-bold">{value}</div>
    </motion.div>
  );
}
