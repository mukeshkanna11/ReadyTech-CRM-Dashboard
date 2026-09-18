import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Users as UsersIcon,
  ShieldCheck,
  Briefcase,
  Phone,
  UserCheckIcon,
  ShieldCheckIcon,
  Mail,
  UserCheck,     // Active Users metric
  UserCog,       // User management
  Activity,      // Live status
  CalendarDays,  // Created date
  CheckCircle,   // Status
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

/* =========================================================
   ENUMS — must stay in sync with Backend/models/User.js
========================================================= */
const DEPARTMENTS = [
  "Software Development",
  "UI/UX Design",
  "Digital Marketing",
  "Sales & Business Development",
  "BPO & Customer Support",
  "Human Resources",
  "Finance & Accounting",
  "Administration",
  "Quality Assurance",
  "Data & Analytics",
  "Project Management",
  "Operations",
  "Other",
];

/**
 * Grouped by department so the dropdown can be filtered to the selected one.
 * Every value below exists in the backend `designation` enum.
 */
const DESIGNATIONS_BY_DEPARTMENT = {
  "Software Development": [
    "Software Developer",
    "Full Stack Developer",
    "MERN Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "React Developer",
    "Node.js Developer",
    "Mobile App Developer",
    "Software Engineer",
    "Technical Lead",
    "Tech Lead",
  ],
  "UI/UX Design": [
    "UI/UX Designer",
    "UI Designer",
    "UX Designer",
    "Product Designer",
    "Graphic Designer",
  ],
  "Digital Marketing": [
    "Digital Marketing Executive",
    "Digital Marketing Manager",
    "SEO Executive",
    "SEO Specialist",
    "SEM Executive",
    "Social Media Executive",
    "Social Media Manager",
    "Content Marketing Executive",
    "Content Writer",
    "Marketing Executive",
  ],
  "Sales & Business Development": [
    "Sales Executive",
    "Sales Manager",
    "Business Development Executive",
    "Business Development Manager",
    "Relationship Manager",
    "Account Manager",
  ],
  "BPO & Customer Support": [
    "BPO Executive",
    "BPO Team Leader",
    "Customer Support Executive",
    "Customer Support Manager",
    "Telecaller",
    "Process Associate",
  ],
  "Human Resources": [
    "HR Executive",
    "HR Manager",
    "Recruiter",
    "Talent Acquisition Executive",
  ],
  "Finance & Accounting": ["Accountant", "Finance Executive", "Finance Manager"],
  "Quality Assurance": ["QA Tester", "QA Engineer", "QA Lead"],
  "Project Management": [
    "Project Manager",
    "Project Coordinator",
    "Scrum Master",
    "Team Lead",
  ],
  "Data & Analytics": ["Data Analyst", "Data Entry Operator"],
  Administration: ["Office Administrator", "Admin Executive"],
  Operations: ["Operations Executive", "Operations Manager"],
  Other: [],
};

/** Always selectable regardless of department. */
const COMMON_DESIGNATIONS = [
  "Intern",
  "Trainee",
  "Manager",
  "Senior Manager",
  "General Manager",
  "Director",
  "Other",
];

const designationsFor = (department) => [
  ...(DESIGNATIONS_BY_DEPARTMENT[department] || []),
  ...COMMON_DESIGNATIONS,
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [drawer, setDrawer] = useState(false);  
  const [editingId, setEditingId] = useState(null);

  /* ===== OPTIONAL PASSWORD CHANGE (inside the Update User form) ===== */
  const EMPTY_PWD = {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  };

  const [pwdForm, setPwdForm] = useState(EMPTY_PWD);

  // The existing change-password API is self-service only, so this
  // section is offered only while editing your own profile.
  const selfId = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      return String(stored?._id || stored?.id || "");
    } catch {
      return "";
    }
  }, []);

  const canChangeOwnPassword =
    Boolean(selfId) && String(editingId || "") === selfId;

  const [form, setForm] = useState({
  name: "",
  email: "",
  password: "",
  role: "client",
  department: "",
  designation: "",
  company: "",
  employeeId: "",
  joiningDate: "",
  status: "Active",
});

  /* ================= FETCH USERS ================= */
const fetchUsers = async () => {
  try {
    console.log("FETCH USERS START");

    const res = await API.get("/admin/users");

    console.log(
      "FETCH USERS RESPONSE:",
      res.data
    );

    let userList = [];

    if (Array.isArray(res.data)) {
      userList = res.data;
    } else if (Array.isArray(res.data?.users)) {
      userList = res.data.users;
    } else if (Array.isArray(res.data?.data)) {
      userList = res.data.data;
    } else if (
      Array.isArray(res.data?.data?.users)
    ) {
      userList = res.data.data.users;
    }

    console.log(
      "FRESH USERS FROM DATABASE:",
      userList
    );

    console.table(
      userList.map((u) => ({
        id: u._id || u.id,
        name: u.name,
        department: u.department,
        designation: u.designation,
        company: u.company,
      }))
    );

    setUsers(userList);

    return userList;

  } catch (err) {
    console.error(
      "FETCH USERS ERROR:",
      err.response?.data || err
    );

    toast.error(
      err.response?.data?.message ||
      "Failed to fetch users"
    );

    return [];
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
      designation: "",
      company: "",
      employeeId: "",
      joiningDate: "",
    });
    setPwdForm(EMPTY_PWD);
    setDrawer(true);
  };

const openEdit = (u) => {
  setEditingId(u._id || u.id);

  setForm({
    name: u.name || "",
    email: u.email || "",
    password: "",
    role: u.role || "employee",
    status: u.isActive === false ? "Inactive" : "Active",

    department: u.department || "",
    designation: u.designation || "",
    company: u.company || "",
    employeeId: u.employeeId || "",

    joiningDate: u.joiningDate
      ? new Date(u.joiningDate).toISOString().split("T")[0]
      : "",

  });

  setPwdForm(EMPTY_PWD);
  setDrawer(true);
};

const saveUser = async (e) => {
  e.preventDefault();

  try {
    // ================= VALIDATION =================

    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!editingId && !form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    if (!form.department) {
      toast.error("Department is required");
      return;
    }

    if (!form.designation) {
      toast.error("Designation is required");
      return;
    }

    // ============ OPTIONAL PASSWORD CHANGE ============
    // Same form, same "Update User" button. All three fields blank =>
    // details-only update, exactly as before.

    const oldPwd = pwdForm.currentPassword.trim();
    const newPwd = pwdForm.newPassword.trim();
    const confirmPwd = pwdForm.confirmPassword.trim();

    const wantsPasswordChange =
      canChangeOwnPassword && Boolean(oldPwd || newPwd || confirmPwd);

    if (wantsPasswordChange) {
      if (!oldPwd) {
        toast.error("Old password is required to change your password");
        return;
      }

      if (!newPwd) {
        toast.error("New password is required");
        return;
      }

      if (newPwd !== confirmPwd) {
        toast.error("New password and confirm password do not match");
        return;
      }

      if (newPwd.length < 6) {
        toast.error("New password must be at least 6 characters");
        return;
      }

      if (newPwd === oldPwd) {
        toast.error("New password must be different from the old password");
        return;
      }

      // Existing API verifies the old password and re-hashes with the
      // existing bcrypt hook. Runs before the detail update so a wrong
      // old password aborts without changing anything.
      try {
        await API.patch("/user/change-password", {
          currentPassword: oldPwd,
          newPassword: newPwd,
          confirmPassword: confirmPwd,
        });

        setPwdForm(EMPTY_PWD);
        toast.success("Password updated successfully");
      } catch (err) {
        toast.error(
          err?.response?.data?.message || "Failed to change password"
        );
        return;
      }
    }

    // ================= PAYLOAD =================

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,

      department: form.department.trim(),
      designation: form.designation.trim(),

      company: form.company.trim() || null,
      employeeId: form.employeeId.trim() || null,

      joiningDate: form.joiningDate || null,

      isActive: form.status === "Active",
    };

    // Password only when entered
    if (form.password.trim()) {
      payload.password = form.password.trim();
    }

    console.log("=================================");
    console.log(
      editingId
        ? "UPDATING USER"
        : "CREATING USER"
    );
    console.log("ID:", editingId);
    console.log("PAYLOAD:", payload);
    console.log("=================================");

    // =========================================================
    // UPDATE USER
    // =========================================================

    if (editingId) {
      const id = String(editingId);

      const res = await API.put(
        `/admin/users/${id}`,
        payload
      );

      console.log("UPDATE RESPONSE:", res.data);

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || "User update failed"
        );
      }

      console.log(
        "UPDATED USER FROM BACKEND:",
        res.data.user
      );

      // =======================================================
      // IMPORTANT
      // GET FRESH DATA FROM DATABASE
      // =======================================================

      await fetchUsers();

      toast.success("User updated successfully");
    }

    // =========================================================
    // CREATE USER
    // =========================================================

    else {
      const createPayload = {
        ...payload,
        password: form.password.trim(),
      };

      console.log(
        "CREATE PAYLOAD:",
        createPayload
      );

      const res = await API.post(
        "/admin/users",
        createPayload
      );

      console.log(
        "CREATE RESPONSE:",
        res.data
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || "User creation failed"
        );
      }

      // Fresh DB data
      await fetchUsers();

      toast.success("User created successfully");
    }

    // =========================================================
    // RESET
    // =========================================================

    setDrawer(false);
    setEditingId(null);
    setPwdForm(EMPTY_PWD);

    setForm({
      name: "",
      email: "",
      password: "",
      role: "employee",
      department: "",
      designation: "",
      company: "",
      employeeId: "",
      joiningDate: "",
      status: "Active",
    });

  } catch (err) {
    console.error(
      "SAVE USER ERROR:",
      err.response?.data || err
    );

    toast.error(
      err.response?.data?.message ||
      err.message ||
      "Failed to save user"
    );
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

console.table(
  users.map((u) => ({
    id: u._id || u.id,
    name: u.name,
    department: u.department,
    designation: u.designation,
    company: u.company,
  }))
);
  
  /* ================= FILTER ================= */
 const filtered = users.filter((u) => {
  const textMatch = [
    u.name,
    u.email,
    u.role,
    u.department,
    u.designation,
    u.company,
    u.employeeId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search.toLowerCase());

  const roleMatch =
    roleFilter === "All" ||
    String(u.role || "").toLowerCase() ===
      roleFilter.toLowerCase();

  const statusMatch =
    statusFilter === "All" ||
    (u.isActive ? "Active" : "Inactive") ===
      statusFilter;

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

      {/* ================= TABLE ================= */}
<div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  <div className="overflow-x-auto">

    <table className="w-full text-sm">

      {/* ================= TABLE HEADER ================= */}
      <thead className="border-b bg-slate-50 border-slate-200">
        <tr>

          <th className="p-5 font-semibold text-left text-slate-600">
            User
          </th>

          <th className="p-5 font-semibold text-center text-slate-600">
            Role
          </th>

          <th className="p-5 font-semibold text-left text-slate-600">
            Department
          </th>

          <th className="p-5 font-semibold text-left text-slate-600">
            Designation
          </th>

          <th className="p-5 font-semibold text-left text-slate-600">
            Company
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


      {/* ================= TABLE BODY ================= */}
      <tbody>

        {filtered.length > 0 ? (

          filtered.map((u) => {

            const userId = u._id || u.id;

            const isActive = u.isActive !== false;

            const role = String(
              u.role || "employee"
            ).toLowerCase();

            return (

              <tr
                key={userId}
                className="transition-all duration-200 border-b group hover:bg-indigo-50/40 border-slate-100"
              >

                {/* ================= USER ================= */}
                <td className="p-5">

                  <div className="flex items-center gap-4">

                    {/* Avatar */}
                    <div
                      className="flex items-center justify-center font-bold text-indigo-600 bg-indigo-100 w-11 h-11 rounded-2xl shrink-0"
                    >
                      {u.name
                        ?.charAt(0)
                        ?.toUpperCase() || "U"}
                    </div>


                    {/* Name + Email */}
                    <div className="min-w-0">

                      <p className="font-semibold truncate text-slate-800">
                        {u.name || "Unnamed User"}
                      </p>

                      <p className="text-xs truncate text-slate-500">
                        {u.email || "No email"}
                      </p>

                    </div>

                  </div>

                </td>


                {/* ================= ROLE ================= */}
                <td className="p-5 text-center">

                  <span
                    className={`
                      inline-flex
                      px-3 py-1.5
                      text-xs
                      font-semibold
                      rounded-full
                      capitalize

                      ${
                        role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : role === "manager"
                          ? "bg-blue-100 text-blue-700"
                          : role === "client"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }
                    `}
                  >
                    {role}
                  </span>

                </td>


                {/* ================= DEPARTMENT ================= */}
                <td className="p-5 text-sm text-slate-700">

                  {u.department ? (
                    u.department
                  ) : (
                    <span className="text-slate-400">
                      —
                    </span>
                  )}

                </td>


                {/* ================= DESIGNATION ================= */}
                <td className="p-5 text-sm text-slate-700">

                  {u.designation ? (
                    u.designation
                  ) : (
                    <span className="text-slate-400">
                      —
                    </span>
                  )}

                </td>


                {/* ================= COMPANY ================= */}
                <td className="p-5 text-sm text-slate-700">

                  {u.company ? (
                    u.company
                  ) : (
                    <span className="text-slate-400">
                      —
                    </span>
                  )}

                </td>


                {/* ================= STATUS ================= */}
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
                        isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }
                    `}
                  >

                    {/* Status Dot */}
                    <span
                      className={`
                        w-2 h-2
                        rounded-full

                        ${
                          isActive
                            ? "bg-green-500"
                            : "bg-red-500"
                        }
                      `}
                    />

                    {isActive
                      ? "Active"
                      : "Inactive"}

                  </span>

                </td>


                {/* ================= CREATED DATE ================= */}
                <td className="p-5 text-xs text-center text-slate-500">

                  {formatDate(u.createdAt)}

                </td>


                {/* ================= ACTIONS ================= */}
                <td className="p-5">

                  <div className="flex justify-center gap-2">

                    {/* EDIT */}
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      title="Edit User"
                      className="p-2 text-blue-600 transition-all rounded-xl bg-blue-50 hover:bg-blue-100 hover:scale-105"
                    >
                      <Edit size={16} />
                    </button>


                    {/* DELETE */}
                    <button
                      type="button"
                      onClick={() => removeUser(userId)}
                      title="Delete User"
                      className="p-2 text-red-600 transition-all rounded-xl bg-red-50 hover:bg-red-100 hover:scale-105"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </td>

              </tr>

            );

          })

        ) : (

          /* ================= EMPTY STATE ================= */
          <tr>

            <td
              colSpan="8"
              className="p-12 text-center"
            >

              <div className="flex flex-col items-center justify-center">

                <div
                  className="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-slate-100 text-slate-400"
                >
                  <UsersIcon size={28} />
                </div>

                <p className="text-sm font-semibold text-slate-700">
                  No users found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {search
                    ? `No users match "${search}"`
                    : "No users are available"}
                </p>

              </div>

            </td>

          </tr>

        )}

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




          {/* Set only while creating a user. Existing users change their
              password through the separate Change Password form, which
              verifies the old password on the backend. */}
          {!editingId && (
            <div>

              <label className="text-xs font-semibold text-slate-500">
                PASSWORD
              </label>

              <input
                type="password"
                placeholder="Create secure password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="w-full p-3 mt-2 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
              />

            </div>
          )}




          {/* EMPLOYMENT DETAILS */}
<div className="p-4 border rounded-2xl bg-slate-50">

  <p className="mb-3 text-sm font-semibold text-slate-700">
    Employment Details
  </p>

  {/* Department */}
  <select
    required
    value={form.department}
    onChange={(e) => {
      const department = e.target.value;

      setForm((prev) => ({
        ...prev,
        department,
        designation: "",
      }));
    }}
    className="w-full p-3 mb-3 text-sm bg-white border outline-none rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
  >
    <option value="">Select Department</option>

    {DEPARTMENTS.map((department) => (
      <option key={department} value={department}>
        {department}
      </option>
    ))}
  </select>

  {/* Designation */}
  <select
    required
    value={form.designation}
    disabled={!form.department}
    onChange={(e) => {
      setForm((prev) => ({
        ...prev,
        designation: e.target.value,
      }));
    }}
    className="w-full p-3 mb-3 text-sm bg-white border outline-none rounded-xl disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
  >
    <option value="">
      {form.department
        ? "Select Designation"
        : "Select a department first"}
    </option>

    {designationsFor(form.department).map((designation) => (
      <option key={designation} value={designation}>
        {designation}
      </option>
    ))}
  </select>

  {/* Company */}
  <input
    type="text"
    placeholder="Company"
    value={form.company}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        company: e.target.value,
      }))
    }
    className="w-full p-3 mb-3 text-sm bg-white border outline-none rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
  />

  {/* Employee ID + Joining Date */}
  <div className="grid grid-cols-2 gap-3">

    <input
      type="text"
      placeholder="Employee ID"
      value={form.employeeId}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          employeeId: e.target.value,
        }))
      }
      className="w-full p-3 text-sm bg-white border outline-none rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
    />

    <input
      type="date"
      title="Joining Date"
      value={form.joiningDate}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          joiningDate: e.target.value,
        }))
      }
      className="w-full p-3 text-sm bg-white border outline-none rounded-xl text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
    />

  </div>

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




          {/* CHANGE PASSWORD — optional, submitted by the same button */}
          {canChangeOwnPassword && (
            <div className="p-4 border rounded-2xl bg-slate-50">

              <p className="text-sm font-semibold text-slate-700">
                Change Password
              </p>

              <p className="mt-1 mb-3 text-xs text-slate-500">
                Leave blank to keep your current password.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { name: "currentPassword", label: "Old Password" },
                  { name: "newPassword", label: "New Password" },
                  { name: "confirmPassword", label: "Confirm New Password" },
                ].map((f) => (
                  <div key={f.name}>

                    <label className="text-xs font-semibold text-slate-500">
                      {f.label}
                    </label>

                    <input
                      type="password"
                      autoComplete="new-password"
                      value={pwdForm[f.name]}
                      onChange={(e) =>
                        setPwdForm({ ...pwdForm, [f.name]: e.target.value })
                      }
                      className="w-full p-3 mt-2 text-sm bg-white border outline-none rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                    />

                  </div>
                ))}
              </div>

            </div>
          )}




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