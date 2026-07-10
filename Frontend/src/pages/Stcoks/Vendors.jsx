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
  Phone,
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
      {/* ================= PREMIUM HEADER ================= */}
<div className="relative p-6 overflow-hidden border shadow-xl rounded-2xl border-slate-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 dark:border-slate-700">

  {/* Background Decorations */}
  <div className="absolute w-48 h-48 rounded-full -right-16 -top-16 bg-white/10 blur-3xl"></div>
  <div className="absolute w-40 h-40 rounded-full -bottom-20 left-20 bg-cyan-400/20 blur-3xl"></div>

  <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

    {/* Left */}
    <div className="flex items-center gap-4">

      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
        <Truck size={30} className="text-white" />
      </div>

      <div>

        <div className="flex items-center gap-3">

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Vendor Management
          </h1>

          <span className="px-3 py-1 text-xs font-semibold border rounded-full bg-emerald-400/20 text-emerald-100 border-emerald-300/30">
            Active
          </span>

        </div>

        <p className="max-w-xl mt-2 text-sm text-indigo-100">
          Manage suppliers, procurement partners, purchase history,
          vendor performance, and business relationships from one place.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">

          <div className="px-3 py-1 text-xs text-white rounded-full bg-white/10 backdrop-blur">
            {vendors.length} Vendors
          </div>

          <div className="px-3 py-1 text-xs text-white rounded-full bg-white/10 backdrop-blur">
            {active} Active
          </div>

          <div className="px-3 py-1 text-xs text-white rounded-full bg-white/10 backdrop-blur">
            {incomplete} Pending
          </div>

        </div>

      </div>

    </div>

    {/* Right Buttons */}
    <div className="flex flex-wrap items-center gap-3">

      <button
        onClick={fetchVendors}
        className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
      >
        <RefreshCcw size={16} />
        Refresh
      </button>

      <button
        className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:scale-105"
      >
        <Plus size={16} />
        Add Vendor
      </button>

    </div>

  </div>
</div>

      {/* ================= PREMIUM STATS ================= */}
<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

  <PremiumStat
    title="Total Vendors"
    value={total}
    subtitle="Registered suppliers"
    icon={Truck}
    color="from-indigo-500 to-violet-600"
    iconBg="bg-indigo-100 text-indigo-600"
    trend="+12%"
  />

  <PremiumStat
    title="Active Vendors"
    value={active}
    subtitle="Currently available"
    icon={CheckCircle}
    color="from-emerald-500 to-green-600"
    iconBg="bg-emerald-100 text-emerald-600"
    trend="+8%"
  />

  <PremiumStat
    title="Pending Setup"
    value={incomplete}
    subtitle="Incomplete profiles"
    icon={AlertCircle}
    color="from-amber-500 to-orange-500"
    iconBg="bg-amber-100 text-amber-600"
    trend="-2%"
  />

  <PremiumStat
    title="Products Supplied"
    value={vendors.reduce((sum, v) => sum + (v.productsCount || 0), 0)}
    subtitle="Across all vendors"
    icon={Package}
    color="from-cyan-500 to-sky-600"
    iconBg="bg-cyan-100 text-cyan-600"
    trend="+15%"
  />

</div>

      {/* ================= PREMIUM ACTION BAR ================= */}
<div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">

  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

    {/* Left */}
    <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* Vendor Name */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-slate-500">
          Vendor Name
        </label>

        <div className="relative">
          <Truck
            size={16}
            className="absolute left-3 top-3 text-slate-400"
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ABC Suppliers"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Contact */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-slate-500">
          Contact
        </label>

        <div className="relative">
          <Phone
            size={16}
            className="absolute left-3 top-3 text-slate-400"
          />

          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="+91 9876543210"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-slate-500">
          Category
        </label>

        <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800">
          <option>All Categories</option>
          <option>Electronics</option>
          <option>Furniture</option>
          <option>Hardware</option>
          <option>Food</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-slate-500">
          Status
        </label>

        <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800">
          <option>All Status</option>
          <option>Active</option>
          <option>Pending</option>
          <option>Blocked</option>
        </select>
      </div>

    </div>

    {/* Right */}
    <div className="flex flex-wrap items-center gap-3">

      {/* Search */}
      <div className="relative w-72">

        <Search
          size={16}
          className="absolute left-3 top-3 text-slate-400"
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors..."
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
        />

      </div>

      {/* Add Button */}
      <button
        onClick={addVendor}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-indigo-300"
      >
        <Plus size={18} />
        Add Vendor
      </button>

    </div>

  </div>

</div>

      {/* TABLE */}
      {/* ================= PREMIUM TABLE ================= */}
<div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">

  {loading ? (
    <Loader />
  ) : filtered.length === 0 ? (
    <Empty />
  ) : (
    <div className="overflow-x-auto">

      <table className="w-full text-sm">

        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>

            <Th>Vendor</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Products</Th>
            <Th>Created</Th>
            <Th>Performance</Th>
            <Th />

          </tr>
        </thead>


        <tbody>

          {filtered.map((v) => {

            const active = Boolean(v.contact);

            const initials = v.name
              ?.split(" ")
              .map((x) => x[0])
              .join("")
              .slice(0,2)
              .toUpperCase();


            return (

              <tr
                key={v._id}
                className="transition border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >


                {/* Vendor */}
                <Td>

                  <div className="flex items-center gap-3">

                    <div className="flex items-center justify-center w-10 h-10 text-sm font-bold text-white rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                      {initials}
                    </div>


                    <div>

                      <p className="font-semibold text-slate-800 dark:text-white">
                        {v.name}
                      </p>

                      <p className="text-xs text-slate-400">
                        {v.contact || "No contact"}
                      </p>

                    </div>

                  </div>

                </Td>



                {/* Category */}
                <Td>

                  <span className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full">
                    Supplier
                  </span>

                </Td>



                {/* Status */}
                <Td>

                  {active ? (

                    <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full w-fit bg-emerald-100 text-emerald-700">
                      <CheckCircle size={12}/>
                      Active
                    </span>

                  ) : (

                    <span className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full w-fit bg-amber-100 text-amber-700">
                      <AlertCircle size={12}/>
                      Pending
                    </span>

                  )}

                </Td>



                {/* Products */}
                <Td>

                  <div className="flex items-center gap-2 font-medium">

                    <div className="p-2 text-blue-600 bg-blue-100 rounded-lg">
                      <Package size={15}/>
                    </div>

                    {v.productsCount || 0}

                  </div>

                </Td>



                {/* Created */}
                <Td>

                  <span className="text-slate-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>

                </Td>



                {/* Performance */}
                <Td>

                  <div className="w-28">

                    <div className="flex justify-between mb-1 text-xs">

                      <span className="text-slate-500">
                        Delivery
                      </span>

                      <span className="font-semibold">
                        95%
                      </span>

                    </div>


                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width:"95%"
                        }}
                      />

                    </div>

                  </div>

                </Td>



                {/* Actions */}
                <Td>

                  <div className="flex justify-end gap-2">

                    <IconBtn
                      icon={Edit}
                    />


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

    </div>
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
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${map[color]}`}
    >
      {text}
    </span>
  );
}

function IconBtn({ icon: Icon, danger, ...props }) {
  return (
    <button
      {...props}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${
        danger
          ? "text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <Icon size={16} />
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
  return (
    <td className="px-5 py-4">
      {children}
    </td>
  );
}


function Loader() {
  return (
    <div className="p-6 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16">

      <div className="p-5 mb-5 bg-indigo-100 rounded-full dark:bg-indigo-900/30">
        <Truck className="w-10 h-10 text-indigo-600" />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
        No Vendors Found
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        Start by adding your first supplier or procurement partner.
      </p>

      <button
        onClick={addVendor}
        className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 text-white transition hover:bg-indigo-700"
      >
        + Add Vendor
      </button>

    </div>
  );
}
function PremiumStat({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  iconBg,
  trend,
}) {
  return (
    <div className="relative p-5 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">

      {/* Top Gradient */}
      <div
        className={`absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${color}`}
      />

      <div className="flex items-start justify-between">

        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>


        <div
          className={`rounded-2xl p-4 ${iconBg}`}
        >
          <Icon size={24} />
        </div>

      </div>


      <div className="flex items-center justify-between mt-5">

        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
          {trend}
        </span>

        <span className="text-xs text-slate-400">
          This Month
        </span>

      </div>

    </div>
  );
}