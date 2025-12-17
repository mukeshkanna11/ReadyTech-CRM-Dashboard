import React, { useEffect, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const fetch = async () => {
    try {
      const { data } = await API.get("/clients");
      setClients(data);
    } catch (err) {
      toast.error("Failed to load clients");
    }
  };

  useEffect(() => { fetch(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await API.post("/clients", form);
      toast.success("Client created");
      setForm({ name: "", email: "", phone: "" });
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Create failed");
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Clients</h2>

      <form onSubmit={create} className="grid grid-cols-1 gap-2 mb-4 md:grid-cols-4">
        <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Name" className="p-2 border rounded"/>
        <input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} placeholder="Email" className="p-2 border rounded"/>
        <input value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} placeholder="Phone" className="p-2 border rounded"/>
        <button className="px-4 py-2 text-white bg-green-600 rounded">Create</button>
      </form>

      <div className="space-y-2">
        {clients.map(c => (
          <div key={c._id} className="flex items-center justify-between p-3 bg-white rounded shadow">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-slate-500">{c.email} • {c.phone}</div>
            </div>
            <div className="text-sm text-slate-400">{new Date(c.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
