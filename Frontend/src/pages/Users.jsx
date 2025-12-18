import React, { useEffect, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import { Plus, Edit, Trash2, X, Search } from "lucide-react";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
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

  const fetchUsers = async () => {
    try {
      const { data } = await API.get("/admin/users");
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", email: "", role: "Staff", status: "Active", department: "", phone: "" });
    setDrawer(true);
  };

  const openEdit = (u) => {
    setEditingId(u._id);
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status || "Active",
      department: u.department || "",
      phone: u.phone || "",
    });
    setDrawer(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.put(`/admin/users/${editingId}`, form);
        toast.success("User updated");
      } else {
        await API.post("/admin/users", form);
        toast.success("User created");
      }
      setDrawer(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  const removeUser = async (id) => {
    if (!confirm("Are you sure?") ) return;
    try {
      await API.delete(`/admin/users/${id}`);
      toast.success("User removed");
      fetchUsers();
    } catch {
      toast.error("Delete failed");
    }
  };

  const filtered = users.filter(u =>
    [u.name, u.email, u.role].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded">
          <Plus size={18}/> Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute w-4 h-4 text-gray-400 left-3 top-3" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full p-2 pl-10 border rounded"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Department</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u._id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3 text-center">
                  <span className="px-2 py-1 text-xs bg-blue-100 rounded">{u.role}</span>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded ${u.status === "Inactive" ? "bg-red-100" : "bg-green-100"}`}>{u.status || "Active"}</span>
                </td>
                <td className="p-3 text-center">{u.department || "-"}</td>
                <td className="p-3 text-center text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEdit(u)} className="p-1 text-blue-600"><Edit size={16}/></button>
                    <button onClick={() => removeUser(u._id)} className="p-1 text-red-600"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-md p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{editingId ? "Edit User" : "Add User"}</h2>
              <button onClick={() => setDrawer(false)}><X/></button>
            </div>
            <form onSubmit={saveUser} className="space-y-3">
              <input required placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full p-2 border rounded"/>
              <input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full p-2 border rounded"/>
              <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full p-2 border rounded"/>
              <input placeholder="Department" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} className="w-full p-2 border rounded"/>
              <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full p-2 border rounded">
                <option>Admin</option>
                <option>Manager</option>
                <option>Staff</option>
              </select>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full p-2 border rounded">
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <button className="w-full py-2 text-white bg-blue-600 rounded">Save User</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
