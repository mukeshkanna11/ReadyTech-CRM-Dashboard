import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Trash2, Edit, Search, RefreshCcw } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [search, setSearch] = useState("");

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await API.get("/vendors");
      setVendors(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const addVendor = async () => {
    if (!name.trim()) return toast.error("Enter vendor name");
    try {
      await API.post("/inventory/vendors", { name: name.trim(), contact: contact.trim() });
      toast.success("Vendor added");
      setName(""); setContact("");
      fetchVendors();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add vendor");
    }
  };

  const deleteVendor = async (id) => {
    if (!confirm("Are you sure to delete this vendor?")) return;
    try { await API.delete(`/inventory/vendors/${id}`); toast.success("Vendor deleted"); fetchVendors(); } 
    catch (err) { console.error(err); toast.error("Failed to delete vendor"); }
  };

  const filtered = useMemo(() => vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase())), [vendors, search]);

  const totalVendors = vendors.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Vendors</h1>
          <p className="text-sm text-slate-500">Manage all your suppliers</p>
        </div>
        <button onClick={fetchVendors} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Vendors" value={totalVendors} icon={Truck} color="emerald" />
      </div>

      <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-xl dark:bg-slate-900 dark:border-slate-800">
        <input type="text" placeholder="Vendor name" value={name} onChange={e => setName(e.target.value)} className="flex-1 px-4 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
        <input type="text" placeholder="Contact" value={contact} onChange={e => setContact(e.target.value)} className="flex-1 px-4 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
        <button onClick={addVendor} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"><Plus size={16}/> Add Vendor</button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input type="text" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="w-full py-2 pr-3 text-sm border rounded-lg pl-9 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700"/>
        </div>
      </div>

      <div className="bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
        {loading ? <LoadingState text="Loading vendors..." /> : filtered.length === 0 ? <EmptyState text="No vendors found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr><Th>Name</Th><Th>Contact</Th><Th>Created</Th><Th>Actions</Th></tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v._id} className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                    <Td>{v.name}</Td>
                    <Td>{v.contact}</Td>
                    <Td className="text-slate-500">{new Date(v.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button title="Edit" className="p-1 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-slate-700"><Edit size={16} /></button>
                        <button title="Delete" onClick={() => deleteVendor(v._id)} className="p-1 text-red-500 rounded hover:bg-red-50 dark:hover:bg-slate-700"><Trash2 size={16} /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== REUSABLE COMPONENTS ================= */
function StatCard({ title, value, icon: Icon, color }) {
  const colors = { indigo: "bg-indigo-100 text-indigo-600", emerald: "bg-emerald-100 text-emerald-600", red: "bg-red-100 text-red-600" };
  return (
    <div className="flex items-center gap-4 p-4 bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
      <div className={`p-3 rounded-xl ${colors[color]}`}><Icon size={22} /></div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
function Th({ children }) { return <th className="p-3 font-semibold text-left text-slate-600 dark:text-slate-300">{children}</th>; }
function Td({ children, className = "" }) { return <td className={`p-3 ${className}`}>{children}</td>; }
function LoadingState({ text }) { return <div className="p-6 text-center text-slate-500">{text}</div>; }
function EmptyState({ text }) { return <div className="p-6 text-center text-slate-500">{text}</div>; }
