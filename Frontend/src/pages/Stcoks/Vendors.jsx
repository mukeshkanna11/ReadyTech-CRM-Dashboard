import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Plus,
  Trash2,
  Edit,
  Search,
  RefreshCcw,
  Package,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [search, setSearch] = useState("");

  /* ================= FETCH ================= */
  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await API.get("/vendors");
      setVendors(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  /* ================= ADD ================= */
  const addVendor = async () => {
    if (!name.trim()) return toast.error("Vendor name required");
    try {
      await API.post("/inventory/vendors", {
        name: name.trim(),
        contact: contact.trim(),
      });
      toast.success("Vendor added");
      setName("");
      setContact("");
      fetchVendors();
    } catch {
      toast.error("Failed to add vendor");
    }
  };

  /* ================= DELETE ================= */
  const deleteVendor = async (id) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      await API.delete(`/inventory/vendors/${id}`);
      toast.success("Vendor removed");
      fetchVendors();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= DATA ================= */
  const filtered = useMemo(
    () =>
      vendors.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase())
      ),
    [vendors, search]
  );

  const total = vendors.length;
  const active = vendors.filter((v) => v.contact).length;
  const incomplete = total - active;

  /* ================= UI ================= */
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
            Vendors
          </h1>
          <p className="text-xs text-slate-500">
            Suppliers & procurement partners
          </p>
        </div>
        <button
          onClick={fetchVendors}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {/* STATS – COMPACT */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat
          label="Total"
          value={total}
          icon={Truck}
          color="indigo"
        />
        <MiniStat
          label="Active"
          value={active}
          icon={CheckCircle}
          color="emerald"
        />
        <MiniStat
          label="Incomplete"
          value={incomplete}
          icon={AlertCircle}
          color="amber"
        />
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
        <input
          className="px-3 py-1.5 text-xs border rounded-md dark:bg-slate-800 dark:border-slate-700"
          placeholder="Vendor name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="px-3 py-1.5 text-xs border rounded-md dark:bg-slate-800 dark:border-slate-700"
          placeholder="Contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <button
          onClick={addVendor}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-md"
        >
          <Plus size={14} /> Add
        </button>

        <div className="relative w-56 ml-auto">
          <Search
            size={14}
            className="absolute left-2.5 top-2 text-slate-400"
          />
          <input
            className="w-full py-1.5 pl-8 pr-2 text-xs border rounded-md dark:bg-slate-800 dark:border-slate-700"
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <Empty />
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <Th>Vendor</Th>
                <Th>Status</Th>
                <Th>Products</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const active = Boolean(v.contact);
                return (
                  <tr
                    key={v._id}
                    className="border-t dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Td>
                      <div className="font-medium">{v.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {v.contact || "No contact"}
                      </div>
                    </Td>

                    <Td>
                      {active ? (
                        <Badge color="emerald" text="Active" />
                      ) : (
                        <Badge color="amber" text="Incomplete" />
                      )}
                    </Td>

                    <Td>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Package size={12} />
                        {v.productsCount || 0}
                      </div>
                    </Td>

                    <Td className="text-slate-500">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </Td>

                    <Td>
                      <div className="flex justify-end gap-1">
                        <IconBtn icon={Edit} />
                        <IconBtn
                          icon={Trash2}
                          danger
                          onClick={() => deleteVendor(v._id)}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ================= UI COMPONENTS ================= */

function MiniStat({ label, value, icon: Icon, color }) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-100",
    emerald: "text-emerald-600 bg-emerald-100",
    amber: "text-amber-600 bg-amber-100",
  };
  return (
    <div className="flex items-center gap-2 p-2 bg-white border rounded-lg dark:bg-slate-900 dark:border-slate-800">
      <div className={`p-1.5 rounded ${colors[color]}`}>
        <Icon size={14} />
      </div>
      <div>
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Badge({ text, color }) {
  const map = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded-full ${map[color]}`}>
      {text}
    </span>
  );
}

function IconBtn({ icon: Icon, danger, ...props }) {
  return (
    <button
      {...props}
      className={`p-1 rounded ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 font-semibold text-left text-slate-600 dark:text-slate-300">
      {children}
    </th>
  );
}
function Td({ children }) {
  return <td className="px-3 py-2">{children}</td>;
}
function Loader() {
  return (
    <div className="p-6 text-sm text-center text-slate-500">
      Loading vendors...
    </div>
  );
}
function Empty() {
  return (
    <div className="p-6 text-sm text-center text-slate-400">
      No vendors found
    </div>
  );
}
