import { useEffect, useState } from "react";
import API from "../services/api";

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", status: "" });
  const [editingId, setEditingId] = useState(null);

  // Fetch all leads
  const fetchLeads = async () => {
    try {
      const res = await API.get("/leads");
      setLeads(res.data);
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await API.put(`/leads/${editingId}`, form);
      } else {
        await API.post("/leads", form);
      }
      setForm({ name: "", email: "", phone: "", status: "" });
      setEditingId(null);
      fetchLeads();
    } catch (err) {
      console.error("Error saving lead:", err);
    }
  };

  const handleEdit = (lead) => {
    setEditingId(lead._id);
    setForm({ name: lead.name, email: lead.email, phone: lead.phone, status: lead.status });
  };

  const handleDelete = async (id) => {
    try { await API.delete(`/leads/${id}`); fetchLeads(); } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold">Leads Management</h1>

      <form onSubmit={handleSubmit} className="p-4 mb-6 bg-gray-100 rounded shadow">
        <h2 className="mb-4 text-xl font-semibold">{editingId ? "Update Lead" : "Add New Lead"}</h2>
        <div className="grid grid-cols-2 gap-4">
          <input name="name" value={form.name} onChange={handleChange} placeholder="Lead Name" className="p-2 border rounded" required/>
          <input name="email" value={form.email} onChange={handleChange} placeholder="Lead Email" className="p-2 border rounded" required/>
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone Number" className="p-2 border rounded" required/>
          <input name="status" value={form.status} onChange={handleChange} placeholder="Status (New, Follow-up, Closed)" className="p-2 border rounded" required/>
        </div>
        <button className="px-4 py-2 mt-4 text-white bg-blue-600 rounded">{editingId ? "Update Lead" : "Create Lead"}</button>
      </form>

      <div className="p-4 bg-white rounded shadow">
        <h2 className="mb-4 text-xl font-semibold">All Leads</h2>
        <table className="w-full border table-auto">
          <thead>
            <tr className="text-center bg-gray-200">
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Phone</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead._id} className="text-center">
                <td className="p-2 border">{lead.name}</td>
                <td className="p-2 border">{lead.email}</td>
                <td className="p-2 border">{lead.phone}</td>
                <td className="p-2 border">{lead.status}</td>
                <td className="p-2 border">
                  <button onClick={() => handleEdit(lead)} className="px-3 py-1 mr-2 text-white bg-yellow-500 rounded">Edit</button>
                  <button onClick={() => handleDelete(lead._id)} className="px-3 py-1 text-white bg-red-600 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="py-4 text-center text-gray-500">No leads found.</p>}
      </div>
    </div>
  );
};

export default Leads;
