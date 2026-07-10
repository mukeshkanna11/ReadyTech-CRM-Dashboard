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
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    password: "",
    role: "employee",
    status: "Active",
    department: "",
    phone: "",
  });

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      const res = await API.get("/admin/users");
      setUsers(res.data || []);
    } catch (err) {
      console.error("FETCH USERS ERROR:", err);
      toast.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  /* ================= METRICS ================= */
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive !== false).length;
    const admins = users.filter(
      (u) => String(u.role).toLowerCase() === "admin"
    ).length;
    return { total, active, admins };
  }, [users]);

  /* ================= ACTIONS ================= */
  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: "employee",
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
      password: "",
      role: u.role || "employee",
      status: u.isActive ? "Active" : "Inactive",
      department: u.department || "",
      phone: u.phone || "",
    });
    setDrawer(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();

    try {
      if (!editingId && !form.password) {
        toast.error("Password is required");
        return;
      }

      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        status: form.status,
        department: form.department,
        phone: form.phone,
      };

      if (form.password) {
        payload.password = form.password;
      }

      if (editingId) {
        await API.put(`/admin/users/${editingId}`, payload);
        toast.success("User updated");
      } else {
        await API.post("/admin/users", payload);
        toast.success("User created");
      }

      setDrawer(false);
      fetchUsers();
    } catch (err) {
      console.error("SAVE ERROR:", err.response?.data);
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Remove this user?")) return;
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
    const textMatch = [u.name, u.email, u.role]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    const roleMatch =
      roleFilter === "All" ||
      String(u.role).toLowerCase() === roleFilter.toLowerCase();

    const statusMatch =
      statusFilter === "All" ||
      (u.isActive ? "Active" : "Inactive") === statusFilter;

    return textMatch && roleMatch && statusMatch;
  });

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-IN");
  };

  return (
    <div className="min-h-screen p-8 space-y-10 bg-gradient-to-br from-slate-50 via-white to-slate-100">

      {/* HEADER */}
      <div className="p-8 text-white shadow-xl rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600">
        <div className="flex items-center gap-4">
          <UsersIcon size={28} />
          <div>
            <h1 className="text-3xl font-bold">User & Access Management</h1>
            <p className="text-sm text-indigo-100">
              Manage roles, permissions & security
            </p>
          </div>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid gap-6 md:grid-cols-3">
        <PremiumMetric title="Total Users" value={metrics.total} />
        <PremiumMetric title="Active Users" value={metrics.active} />
        <PremiumMetric title="Administrators" value={metrics.admins} />
      </div>

      {/* TOOLBAR */}
      <div className="flex items-center justify-between p-4 bg-white shadow rounded-2xl">
        <div className="relative w-80">
          <Search className="absolute left-3 top-3 text-slate-400" size={16} />
          <input
            className="w-full p-2 border pl-9 rounded-xl"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden bg-white shadow-xl rounded-3xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-4 text-left">User</th>
              <th className="p-4 text-center">Role</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Created</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u._id} className="border-t">
                <td className="p-4">
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="p-4 text-center">{u.role}</td>
                <td className="p-4 text-center">
                  {u.isActive ? "Active" : "Inactive"}
                </td>
                <td className="p-4 text-xs text-center text-slate-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => openEdit(u)}>
                    <Edit size={16} />
                  </button>
                  <button onClick={() => removeUser(u._id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DRAWER */}
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 flex justify-end bg-black/40">
            <motion.div className="w-full max-w-md p-6 bg-white shadow-xl">
              <form onSubmit={saveUser} className="space-y-4">
                <input
                  required
                  placeholder="Full Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full p-3 border rounded-xl"
                />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full p-3 border rounded-xl"
                />
                <input
                  type="password"
                  placeholder={
                    editingId
                      ? "Leave blank to keep same password"
                      : "Password"
                  }
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full p-3 border rounded-xl"
                />
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  className="w-full p-3 border rounded-xl"
                >
                  <option value="admin">Admin</option>
                  <option value="employee">Employee</option>
                  <option value="client">Client</option>
                </select>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                  className="w-full p-3 border rounded-xl"
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>

                <button className="w-full py-3 text-white rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
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

function PremiumMetric({ title, value }) {
  return (
    <div className="p-6 text-white shadow-xl rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600">
      <div className="text-sm opacity-80">{title}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
