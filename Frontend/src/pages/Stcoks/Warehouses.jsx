import { useEffect, useMemo, useState } from "react";
import { Warehouse, Plus, Trash2, Edit, Search, RefreshCcw } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await API.get("/warehouses");
      setWarehouses(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const addWarehouse = async () => {
    if (!name.trim()) return toast.error("Enter warehouse name");
    try {
      await API.post("/inventory/warehouses", { name: name.trim() });
      toast.success("Warehouse added");
      setName("");
      fetchWarehouses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add warehouse");
    }
  };

  const deleteWarehouse = async (id) => {
    if (!confirm("Are you sure to delete this warehouse?")) return;
    try {
      await API.delete(`/inventory/warehouses/${id}`);
      toast.success("Warehouse deleted");
      fetchWarehouses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete warehouse");
    }
  };

  const filtered = useMemo(() => {
    return warehouses.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()));
  }, [warehouses, search]);

  const totalWarehouses = warehouses.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Warehouses</h1>
          <p className="text-sm text-slate-500">Manage your stock locations</p>
        </div>
        <button onClick={fetchWarehouses} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Warehouses" value={totalWarehouses} icon={Warehouse} color="indigo" />
      </div>

      <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-xl dark:bg-slate-900 dark:border-slate-800">
        <input type="text" placeholder="Warehouse name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-4 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700" />
        <button onClick={addWarehouse} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Add Warehouse
        </button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input type="text" placeholder="Search warehouses..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full py-2 pr-3 text-sm border rounded-lg pl-9 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
        </div>
      </div>

      <div className="bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
        {loading ? <LoadingState text="Loading warehouses..." /> : filtered.length === 0 ? <EmptyState text="No warehouses found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <Th>Name</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w._id} className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                    <Td>{w.name}</Td>
                    <Td className="text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button title="Edit" className="p-1 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-slate-700"><Edit size={16} /></button>
                        <button onClick={() => deleteWarehouse(w._id)} title="Delete" className="p-1 text-red-500 rounded hover:bg-red-50 dark:hover:bg-slate-700"><Trash2 size={16} /></button>
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

/* ================= COMPONENTS ================= */
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

function Th({ children }) {
  return <th className="p-3 font-semibold text-left text-slate-600 dark:text-slate-300">{children}</th>;
}
function Td({ children, className = "" }) { return <td className={`p-3 ${className}`}>{children}</td>; }
function LoadingState({ text }) { return <div className="p-6 text-center text-slate-500">{text}</div>; }
function EmptyState({ text }) { return <div className="p-6 text-center text-slate-500">{text}</div>; }
