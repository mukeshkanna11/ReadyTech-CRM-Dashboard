import { useEffect, useMemo, useState } from "react";
import {
  Warehouse,
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCcw,
  MapPin,
  User,
  CheckCircle,
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    code: "",
    location: "",
    manager: "",
    status: "Active",
  });

  /* ================= FETCH ================= */
  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await API.get("/warehouses");
      setWarehouses(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to fetch warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  /* ================= ADD ================= */
  const addWarehouse = async () => {
    if (!form.name.trim())
      return toast.error("Warehouse name is required");

    try {
      await API.post("/inventory/warehouses", form);
      toast.success("Warehouse added");
      setForm({
        name: "",
        code: "",
        location: "",
        manager: "",
        status: "Active",
      });
      fetchWarehouses();
    } catch {
      toast.error("Failed to add warehouse");
    }
  };

  /* ================= DELETE ================= */
  const deleteWarehouse = async (id) => {
    if (!confirm("Delete this warehouse?")) return;
    try {
      await API.delete(`/inventory/warehouses/${id}`);
      toast.success("Warehouse deleted");
      fetchWarehouses();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= FILTER ================= */
  const filtered = useMemo(() => {
    return warehouses.filter((w) =>
      `${w.name} ${w.code} ${w.location}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [warehouses, search]);

  /* ================= KPI ================= */
  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter(
    (w) => w.status !== "Inactive"
  ).length;

  const lastAdded =
    warehouses.length > 0 && warehouses.at(-1)?.createdAt
      ? new Date(warehouses.at(-1).createdAt).toLocaleDateString()
      : "-";

  /* ================= UI ================= */
  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* ================= MODULE OVERVIEW ================= */}
      <div className="p-6 bg-white border shadow-sm rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-slate-100">
            <Warehouse size={26} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              Warehouses Module
            </h2>
            <p className="max-w-3xl mt-1 text-sm text-slate-600">
              Warehouses define physical or virtual locations where inventory
              is stored. Each warehouse can track stock levels, movements,
              and valuation across inventory, sales, and purchase modules.
            </p>
          </div>
        </div>

        <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Feature text="Multi-location inventory tracking" />
          <Feature text="Warehouse-wise stock visibility" />
          <Feature text="Linked with products & orders" />
          <Feature text="Supports future stock transfers" />
        </div>
      </div>

      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <p className="text-sm text-slate-600">
            Manage stock locations and inventory flow
          </p>
        </div>
        <button
          onClick={fetchWarehouses}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border shadow-sm rounded-xl"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="Total Warehouses" value={totalWarehouses} icon={Warehouse} />
        <Kpi title="Active Warehouses" value={activeWarehouses} icon={CheckCircle} />
        <Kpi title="Last Added" value={lastAdded} icon={MapPin} />
      </div>

      {/* ================= ADD + SEARCH ================= */}
      <div className="grid gap-4 p-5 bg-white border shadow-sm rounded-2xl lg:grid-cols-5">
        <input
          placeholder="Warehouse name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="p-2 border rounded-xl"
        />
        <input
          placeholder="Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="p-2 border rounded-xl"
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="p-2 border rounded-xl"
        />
        <input
          placeholder="Manager"
          value={form.manager}
          onChange={(e) => setForm({ ...form, manager: e.target.value })}
          className="p-2 border rounded-xl"
        />
        <button
          onClick={addWarehouse}
          className="flex items-center justify-center gap-2 px-4 py-2 text-white bg-slate-900 rounded-xl"
        >
          <Plus size={16} />
          Add
        </button>

        <div className="relative lg:col-span-5">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            placeholder="Search warehouse, location, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pr-3 border pl-9 rounded-xl"
          />
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl">
        {loading ? (
          <LoadingState text="Loading warehouses..." />
        ) : filtered.length === 0 ? (
          <EmptyState text="No warehouses found" />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Location</Th>
                <Th>Manager</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w._id} className="border-t hover:bg-slate-50">
                  <Td className="font-medium">{w.name}</Td>
                  <Td>{w.code || "-"}</Td>
                  <Td>{w.location || "-"}</Td>
                  <Td>{w.manager || "-"}</Td>
                  <Td>
                    <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">
                      {w.status || "Active"}
                    </span>
                  </Td>
                  <Td>
                    <button
                      onClick={() => deleteWarehouse(w._id)}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= SMALL COMPONENTS ================= */

function Feature({ text }) {
  return (
    <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50">
      <div className="w-2 h-2 rounded-full bg-slate-900" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function Kpi({ title, value, icon: Icon }) {
  return (
    <div className="relative p-5 bg-white border shadow-sm rounded-2xl">
      <div className="flex items-center gap-3">
        <Icon size={22} />
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

const Th = ({ children }) => (
  <th className="px-4 py-3 text-left text-slate-600">{children}</th>
);
const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 ${className}`}>{children}</td>
);
const LoadingState = ({ text }) => (
  <div className="p-8 text-center text-slate-500">{text}</div>
);
const EmptyState = ({ text }) => (
  <div className="p-8 text-center text-slate-500">{text}</div>
);
