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
  UserCheckIcon,
  ShieldCheckIcon,
  Mail,
  Lock,
  UserCheck,     // Active Users metric
  UserCog,       // User management
  Activity,      // Live status
  CalendarDays,  // Created date
  CheckCircle,   // Status
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
<div className="relative p-8 overflow-hidden shadow-2xl rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900">
  {/* Background Glow */}
  <div className="absolute rounded-full -top-24 -right-24 w-80 h-80 bg-blue-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-24 -left-24 w-80 h-80 bg-indigo-500/20 blur-3xl" />

  <div className="relative flex items-center justify-between">
    <div className="flex items-center gap-5">

      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 border shadow-lg rounded-2xl bg-white/10 backdrop-blur-xl border-white/20">
        <UsersIcon 
          size={32} 
          className="text-white"
        />
      </div>

      {/* Content */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            User & Access Management
          </h1>

          <span className="px-3 py-1 text-xs font-semibold text-blue-200 border rounded-full bg-blue-500/20 border-blue-400/30">
            ReadyTech Solutions
          </span>
        </div>

        <p className="mt-2 text-sm text-slate-300">
          Centralized user administration platform to manage roles,
          permissions, authentication and enterprise security controls.
        </p>

        <p className="mt-2 text-xs text-indigo-200">
          Designed & Developed for ReadyTech Solutions Growth Suite ERP
          ecosystem with secure access governance and scalable user management.
        </p>

        {/* Status */}
        <div className="flex flex-wrap gap-2 mt-4">

          <span className="px-3 py-1 text-xs font-medium text-green-300 border rounded-full bg-green-400/10 border-green-400/20">
            ● System Secure
          </span>

          <span className="px-3 py-1 text-xs font-medium text-purple-300 border rounded-full bg-purple-400/10 border-purple-400/20">
            Role Based Access
          </span>

          <span className="px-3 py-1 text-xs font-medium text-blue-300 border rounded-full bg-blue-400/10 border-blue-400/20">
            Enterprise Ready
          </span>

        </div>
      </div>
    </div>


    {/* Right Information Card */}
    <div className="hidden md:block">
      <div className="px-6 py-5 border rounded-2xl bg-white/10 backdrop-blur-xl border-white/20">

        <p className="text-xs text-slate-300">
          Organization
        </p>

        <p className="mt-1 text-lg font-semibold text-white">
          ReadyTech Solutions
        </p>

        <div className="h-px my-3 bg-white/20" />

        <p className="text-xs text-slate-300">
          Module Status
        </p>

        <p className="mt-1 text-sm font-medium text-green-300">
          Active & Protected
        </p>

      </div>
    </div>

  </div>
</div>

      {/* METRICS */}
<div className="grid gap-6 md:grid-cols-3">

  <PremiumMetric
    title="Total Users"
    value={metrics.total}
    icon={<UsersIcon size={26} />}
    description="Registered users across ReadyTech Solutions"
    badge="All Users"
  />

  <PremiumMetric
    title="Active Users"
    value={metrics.active}
    icon={<UserCheckIcon size={26} />}
    description="Currently active & verified accounts"
    badge="Live"
  />

  <PremiumMetric
    title="Administrators"
    value={metrics.admins}
    icon={<ShieldCheckIcon size={26} />}
    description="Users with elevated permissions"
    badge="Secure"
  />

</div>

      {/* TOOLBAR */}
<div className="relative flex flex-col gap-4 p-5 overflow-hidden bg-white border shadow-xl md:flex-row md:items-center md:justify-between rounded-3xl border-slate-200">

  {/* Background Accent */}
  <div className="absolute w-40 h-40 rounded-full -right-20 -top-20 bg-indigo-500/10 blur-3xl" />

  {/* Search Section */}
  <div className="relative z-10 flex items-center gap-4">

    <div className="relative w-full md:w-96">

      <Search
        className="absolute text-slate-400 left-4 top-3.5"
        size={18}
      />

      <input
        className="w-full py-3 pr-4 text-sm transition-all duration-300 border outline-none pl-11 rounded-2xl bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        placeholder="Search users by name, email or role..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

    </div>


    {/* Search Status */}
    <div className="hidden px-4 py-2 text-xs font-medium text-indigo-600 border border-indigo-100 md:flex rounded-xl bg-indigo-50">
      User Directory
    </div>

  </div>


  {/* Action Section */}
  <div className="relative z-10 flex items-center gap-3">

    <button
      className="hidden px-4 py-3 text-sm font-medium transition-all border md:flex rounded-2xl text-slate-600 border-slate-200 hover:bg-slate-50"
    >
      Export
    </button>


    <button
      onClick={openAdd}
      className="
        flex items-center gap-2
        px-5 py-3
        text-sm font-semibold
        text-white
        transition-all duration-300
        shadow-lg
        rounded-2xl
        bg-gradient-to-r
        from-blue-600
        via-indigo-600
        to-purple-600
        hover:shadow-indigo-500/30
        hover:scale-[1.02]
      "
    >
      <Plus size={18} />
      Add New User
    </button>

  </div>

</div>

      {/* TABLE */}
<div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  <div className="overflow-x-auto">
    <table className="w-full text-sm">

      {/* HEADER */}
      <thead className="border-b bg-slate-50 border-slate-200">
        <tr>
          <th className="p-5 font-semibold text-left text-slate-600">
            User
          </th>

          <th className="p-5 font-semibold text-center text-slate-600">
            Role
          </th>

          <th className="p-5 font-semibold text-center text-slate-600">
            Status
          </th>

          <th className="p-5 font-semibold text-center text-slate-600">
            Created Date
          </th>

          <th className="p-5 font-semibold text-center text-slate-600">
            Actions
          </th>
        </tr>
      </thead>


      {/* BODY */}
      <tbody>

        {filtered.map((u) => (

          <tr
            key={u._id}
            className="transition-all duration-200 border-b group hover:bg-indigo-50/40 border-slate-100"
          >

            {/* USER */}
            <td className="p-5">

              <div className="flex items-center gap-4">

                {/* Avatar */}
                <div className="flex items-center justify-center font-bold text-indigo-600 bg-indigo-100 w-11 h-11 rounded-2xl">
                  {u.name?.charAt(0).toUpperCase()}
                </div>


                <div>
                  <p className="font-semibold text-slate-800">
                    {u.name}
                  </p>

                  <p className="text-xs text-slate-500">
                    {u.email}
                  </p>
                </div>

              </div>

            </td>



            {/* ROLE */}
            <td className="p-5 text-center">

              <span
                className={`
                  px-3 py-1.5
                  text-xs
                  font-semibold
                  rounded-full

                  ${
                    u.role === "admin"
                      ? "bg-purple-100 text-purple-700"
                      : u.role === "manager"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-700"
                  }
                `}
              >
                {u.role}
              </span>

            </td>



            {/* STATUS */}
            <td className="p-5 text-center">

              <span
                className={`
                  inline-flex
                  items-center
                  gap-2
                  px-3 py-1.5
                  text-xs
                  font-semibold
                  rounded-full

                  ${
                    u.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }
                `}
              >

                <span
                  className={`
                    w-2 h-2 rounded-full

                    ${
                      u.isActive
                        ? "bg-green-500"
                        : "bg-red-500"
                    }
                  `}
                />

                {u.isActive ? "Active" : "Inactive"}

              </span>

            </td>



            {/* DATE */}
            <td className="p-5 text-xs text-center text-slate-500">
              {formatDate(u.createdAt)}
            </td>



            {/* ACTIONS */}
            <td className="p-5">

              <div className="flex justify-center gap-2">

                <button
                  onClick={() => openEdit(u)}
                  className="p-2 text-blue-600 transition rounded-xl bg-blue-50 hover:bg-blue-100"
                >
                  <Edit size={16}/>
                </button>


                <button
                  onClick={() => removeUser(u._id)}
                  className="p-2 text-red-600 transition rounded-xl bg-red-50 hover:bg-red-100"
                >
                  <Trash2 size={16}/>
                </button>

              </div>

            </td>


          </tr>

        ))}

      </tbody>

    </table>
  </div>

</div>

      {/* DRAWER */}
<AnimatePresence>
  {drawer && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
    >

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25 }}
        className="relative w-full h-full max-w-md p-6 overflow-y-auto bg-white shadow-2xl "
      >

        {/* HEADER */}
        <div className="flex items-start justify-between pb-5 mb-6 border-b">

          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {editingId ? "Update User" : "Create New User"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage user access, roles and security permissions
            </p>
          </div>


          <button
            type="button"
            onClick={() => setDrawer(false)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>

        </div>



        <form onSubmit={saveUser} className="space-y-5">


          {/* PERSONAL DETAILS */}
          <div>

            <label className="text-xs font-semibold text-slate-500">
              FULL NAME
            </label>

            <input
              required
              placeholder="Enter full name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full p-3 mt-2 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />

          </div>



          <div>

            <label className="text-xs font-semibold text-slate-500">
              EMAIL ADDRESS
            </label>

            <input
              required
              type="email"
              placeholder="user@company.com"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="w-full p-3 mt-2 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />

          </div>




          <div>

            <label className="text-xs font-semibold text-slate-500">
              PASSWORD
            </label>

            <input
              type="password"
              placeholder={
                editingId
                  ? "Leave blank to keep existing password"
                  : "Create secure password"
              }
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              className="w-full p-3 mt-2 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
            />

          </div>




          {/* ACCESS CONTROL */}
          <div className="p-4 border rounded-2xl bg-slate-50">

            <p className="mb-3 text-sm font-semibold text-slate-700">
              Access Control
            </p>


            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value })
              }
              className="w-full p-3 mb-3 text-sm bg-white border outline-none rounded-xl"
            >
              <option value="admin">
                Admin
              </option>

              <option value="employee">
                Employee
              </option>

              <option value="client">
                Client
              </option>

            </select>



            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value })
              }
              className="w-full p-3 text-sm bg-white border outline-none rounded-xl"
            >

              <option>
                Active
              </option>

              <option>
                Inactive
              </option>

            </select>

          </div>




          {/* SECURITY NOTE */}
          <div className="p-4 text-xs text-indigo-700 border border-indigo-100 rounded-2xl bg-indigo-50">

            🔐 User credentials are securely managed under
            ReadyTech Solutions enterprise access policy.

          </div>




          {/* ACTION */}
          <button
            className="w-full py-3 font-semibold text-white transition-all shadow-lg rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-indigo-500/30"
          >
            {editingId ? "Update User" : "Create User"}
          </button>


        </form>


      </motion.div>

    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
}

function PremiumMetric({ 
  title, 
  value, 
  icon, 
  description, 
  badge 
}) {
  return (
    <div
      className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl group rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 hover:-translate-y-1 hover:shadow-2xl"
    >

      {/* Background Glow */}
      <div
        className="absolute w-40 h-40 transition rounded-full -right-16 -top-16 bg-white/10 blur-3xl group-hover:bg-white/20"
      />


      <div className="relative">

        {/* Top Section */}
        <div className="flex items-center justify-between">

          {/* Icon */}
          <div
            className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl"
          >
            {icon}
          </div>


          {/* Badge */}
          {badge && (
            <span
              className="px-3 py-1 text-xs font-semibold rounded-full bg-white/20 backdrop-blur-md"
            >
              {badge}
            </span>
          )}

        </div>



        {/* Content */}
        <div className="mt-6">

          <p className="text-sm font-medium text-indigo-100">
            {title}
          </p>


          <h2
            className="mt-2 text-4xl font-bold tracking-tight "
          >
            {value}
          </h2>


          {description && (
            <p className="mt-2 text-xs text-indigo-100">
              {description}
            </p>
          )}

        </div>



        {/* Footer Status */}
        <div
          className="flex items-center gap-2 mt-5 text-xs font-medium text-white/90"
        >

          <span
            className="w-2 h-2 bg-green-300 rounded-full animate-pulse"
          />

          Live Data Updated

        </div>


      </div>

    </div>
  );
}