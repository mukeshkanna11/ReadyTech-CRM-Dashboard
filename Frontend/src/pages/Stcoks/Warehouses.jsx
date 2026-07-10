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

  const INITIAL_FORM = {
    name: "",
    code: "",
    location: "",
    manager: "",
    status: "Active",

    description: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",

    capacity: 0,
    currentStock: 0,

    isPrimary: false,
  };

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  /* ================= FETCH ================= */

  const fetchWarehouses = async () => {
    try {
      setLoading(true);

      const { data } = await API.get("/warehouses");

      const list = Array.isArray(data?.warehouses)
        ? data.warehouses
        : Array.isArray(data)
        ? data
        : [];

      setWarehouses(list);
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message ||
          "Failed to fetch warehouses"
      );

      setWarehouses([]);
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
      const payload = {
        ...form,
        capacity: Number(form.capacity) || 0,
        currentStock: Number(form.currentStock) || 0,
      };

      const { data } = await API.post(
        "/warehouses",
        payload
      );

      if (data.success) {
        toast.success(data.message);

        setForm(INITIAL_FORM);

        fetchWarehouses();
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message ||
          "Warehouse creation failed"
      );
    }
  };

  /* ================= UPDATE ================= */

  const updateWarehouse = async () => {
    if (!editingId) return;

    if (!form.name.trim())
      return toast.error("Warehouse name is required");

    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity) || 0,
        currentStock: Number(form.currentStock) || 0,
      };

      const { data } = await API.put(
        `/warehouses/${editingId}`,
        payload
      );

      if (data.success) {
        toast.success(data.message);

        setEditingId(null);

        setForm(INITIAL_FORM);

        fetchWarehouses();
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message ||
          "Failed to update warehouse"
      );
    }
  };

  /* ================= DELETE ================= */

  const deleteWarehouse = async (id) => {
    if (!window.confirm("Delete this warehouse?"))
      return;

    try {
      const { data } = await API.delete(
        `/warehouses/${id}`
      );

      if (data.success) {
        toast.success(data.message);

        if (editingId === id) {
          setEditingId(null);
          setForm(INITIAL_FORM);
        }

        fetchWarehouses();
      }
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message ||
          "Failed to delete warehouse"
      );
    }
  };

  /* ================= EDIT ================= */

  const handleEdit = (warehouse) => {
    setEditingId(warehouse._id);

    setForm({
      ...INITIAL_FORM,
      ...warehouse,
      capacity: Number(warehouse.capacity || 0),
      currentStock: Number(
        warehouse.currentStock || 0
      ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* ================= CANCEL ================= */

  const cancelEdit = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  /* ================= FILTER ================= */

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return warehouses.filter((w) => {
      return (
        w.name?.toLowerCase().includes(q) ||
        w.code?.toLowerCase().includes(q) ||
        w.location?.toLowerCase().includes(q) ||
        w.manager?.toLowerCase().includes(q) ||
        w.city?.toLowerCase().includes(q) ||
        w.state?.toLowerCase().includes(q)
      );
    });
  }, [warehouses, search]);

  /* ================= KPI ================= */

  const totalWarehouses = warehouses.length;

  const activeWarehouses = warehouses.filter(
    (w) => w.status === "Active"
  ).length;

  const inactiveWarehouses = warehouses.filter(
    (w) => w.status === "Inactive"
  ).length;

  const totalCapacity = warehouses.reduce(
    (sum, w) => sum + Number(w.capacity || 0),
    0
  );

  const totalCurrentStock = warehouses.reduce(
    (sum, w) => sum + Number(w.currentStock || 0),
    0
  );

  const primaryWarehouses = warehouses.filter(
    (w) => w.isPrimary
  ).length;

  const lastAdded =
    warehouses.length > 0
      ? new Date(
          [...warehouses].sort(
            (a, b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          )[0].createdAt
        ).toLocaleDateString()
      : "-";

  // RETURN STARTS HERE
  /* ================= UI ================= */
  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
     {/* ================= PREMIUM MODULE OVERVIEW ================= */}
<div className="relative overflow-hidden border shadow-xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-3xl">

  {/* Background Glow */}
  <div className="absolute rounded-full w-72 h-72 -top-24 -right-24 bg-indigo-500/20 blur-3xl" />
  <div className="absolute w-64 h-64 rounded-full -bottom-24 -left-24 bg-cyan-500/10 blur-3xl" />

  <div className="relative p-8">

    {/* Header */}
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

      <div className="flex items-start gap-5">

        <div className="flex items-center justify-center w-16 h-16 shadow-lg rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
          <Warehouse size={32} className="text-white" />
        </div>


        <div>

          <div className="inline-flex items-center px-3 py-1 mb-3 text-xs font-semibold text-indigo-200 border rounded-full bg-white/10 border-white/10">
            ERP INVENTORY MODULE
          </div>


          <h2 className="text-2xl font-bold text-white">
            Warehouse Management System
          </h2>


          <p className="max-w-3xl mt-2 text-sm leading-6 text-slate-300">
            Manage multiple storage locations with real-time inventory
            visibility, stock movements, product allocation and warehouse
            level analytics across your complete business ecosystem.
          </p>

        </div>

      </div>


      {/* Status Badge */}
      <div className="px-5 py-4 border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl">

        <p className="text-xs text-slate-300">
          Module Status
        </p>

        <div className="flex items-center gap-2 mt-2">

          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />

          <span className="font-semibold text-white">
            Active
          </span>

        </div>

      </div>

    </div>


    {/* Feature Cards */}
    <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-4">


      <div className="p-5 transition border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl hover:bg-white/20">

        <h3 className="font-semibold text-white">
          Multi Location
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          Track inventory across multiple warehouses and branches.
        </p>

      </div>



      <div className="p-5 transition border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl hover:bg-white/20">

        <h3 className="font-semibold text-white">
          Stock Visibility
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          View warehouse-wise stock availability instantly.
        </p>

      </div>



      <div className="p-5 transition border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl hover:bg-white/20">

        <h3 className="font-semibold text-white">
          Product Integration
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          Connected with products, sales and purchase workflows.
        </p>

      </div>



      <div className="p-5 transition border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl hover:bg-white/20">

        <h3 className="font-semibold text-white">
          Stock Transfers
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          Ready for future warehouse transfer operations.
        </p>

      </div>


    </div>


  </div>

</div>

      {/* ================= PREMIUM HEADER ================= */}
<div className="relative p-8 overflow-hidden shadow-2xl rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">

  {/* Background Glow */}
  <div className="absolute w-64 h-64 rounded-full -top-20 -right-20 bg-indigo-500/20 blur-3xl" />
  <div className="absolute w-56 h-56 rounded-full -bottom-20 -left-20 bg-cyan-500/10 blur-3xl" />


  <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">


    {/* Left Content */}
    <div>

      <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-semibold text-indigo-200 border rounded-full bg-white/10 border-white/10">
        <Warehouse size={14} />
        INVENTORY CONTROL CENTER
      </div>


      <h1 className="text-4xl font-bold tracking-tight text-white">
        Warehouse Management
      </h1>


      <p className="max-w-xl mt-3 text-sm leading-6 text-slate-300">
        Manage storage locations, monitor stock distribution and control
        inventory movement across your business operations.
      </p>


      {/* Quick Stats */}
      <div className="flex flex-wrap gap-3 mt-6">


        <div className="px-4 py-2 border rounded-xl bg-white/10 border-white/10 backdrop-blur-xl">

          <p className="text-xs text-slate-300">
            Module
          </p>

          <p className="font-semibold text-white">
            Warehouses
          </p>

        </div>


        <div className="px-4 py-2 border rounded-xl bg-white/10 border-white/10 backdrop-blur-xl">

          <p className="text-xs text-slate-300">
            Tracking
          </p>

          <p className="font-semibold text-emerald-300">
            Real-Time
          </p>

        </div>


      </div>


    </div>



    {/* Action */}
    <button
      onClick={fetchWarehouses}
      className="relative flex items-center justify-center gap-2 px-6 py-3 font-semibold transition bg-white shadow-xl rounded-xl text-slate-900 hover:scale-105"
    >

      <RefreshCcw
        size={18}
      />

      Refresh Data

    </button>


  </div>


</div>

      {/* ================= PREMIUM KPI DASHBOARD ================= */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">

  {/* Total Warehouses */}
  <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl">

    <div className="absolute w-32 h-32 transition bg-indigo-100 rounded-full -top-10 -right-10 group-hover:scale-125" />

    <div className="relative flex items-start justify-between">

      <div>
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Total Warehouses
        </p>

        <h2 className="mt-3 text-4xl font-bold text-slate-900">
          {totalWarehouses}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Registered storage locations
        </p>
      </div>


      <div className="flex items-center justify-center text-white shadow-lg w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
        <Warehouse size={28}/>
      </div>

    </div>


    <div className="h-1 mt-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />

  </div>



  {/* Active Warehouses */}
  <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl">

    <div className="absolute w-32 h-32 transition rounded-full -top-10 -right-10 bg-emerald-100 group-hover:scale-125" />


    <div className="relative flex items-start justify-between">

      <div>

        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Active Warehouses
        </p>

        <h2 className="mt-3 text-4xl font-bold text-slate-900">
          {activeWarehouses}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Currently operational locations
        </p>

      </div>


      <div className="flex items-center justify-center text-white shadow-lg w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600">

        <CheckCircle size={28}/>

      </div>

    </div>


    <div className="h-1 mt-6 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />

  </div>




  {/* Last Added */}
  <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl">

    <div className="absolute w-32 h-32 transition rounded-full -top-10 -right-10 bg-cyan-100 group-hover:scale-125" />


    <div className="relative flex items-start justify-between">

      <div>

        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Latest Warehouse
        </p>

        <h2 className="max-w-[180px] mt-3 text-2xl font-bold truncate text-slate-900">
          {lastAdded}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Recently created location
        </p>

      </div>


      <div className="flex items-center justify-center text-white shadow-lg w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600">

        <MapPin size={28}/>

      </div>

    </div>


    <div className="h-1 mt-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />

  </div>


</div>
     {/* ================= PREMIUM ADD + SEARCH PANEL ================= */}
<div className="relative p-6 overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  {/* Header */}
  <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">

    <div>
      <h3 className="text-xl font-bold text-slate-900">
        Create Warehouse
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Add new storage locations and manage warehouse information.
      </p>
    </div>


    <div className="px-4 py-2 text-xs font-semibold text-indigo-700 rounded-full bg-indigo-50">
      Warehouse Setup
    </div>

  </div>



 {/* ================= PREMIUM WAREHOUSE FORM ================= */}
<div className="relative p-8 overflow-hidden border shadow-2xl bg-gradient-to-br from-white via-slate-50 to-indigo-50 rounded-3xl border-slate-200">

  <div className="absolute w-64 h-64 rounded-full -top-20 -right-20 bg-indigo-500/10 blur-3xl" />
  <div className="absolute w-64 h-64 rounded-full -bottom-20 -left-20 bg-violet-500/10 blur-3xl" />

  <div className="relative">

    <div className="flex items-center justify-between mb-8">

      <div>
        <h3 className="text-2xl font-bold text-slate-900">
          {editingId ? "Update Warehouse" : "Create Warehouse"}
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Configure warehouse information, storage capacity and operational details.
        </p>
      </div>

      <div className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
        ERP Warehouse Setup
      </div>

    </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">

      {/* Warehouse Name */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Warehouse Name *
        </label>

        <input
          value={form.name}
          onChange={(e)=>setForm({...form,name:e.target.value})}
          placeholder="Main Warehouse"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Code */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Warehouse Code
        </label>

        <input
          value={form.code}
          onChange={(e)=>setForm({...form,code:e.target.value})}
          placeholder="WH-001"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Location */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Location
        </label>

        <input
          value={form.location}
          onChange={(e)=>setForm({...form,location:e.target.value})}
          placeholder="Coimbatore"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Manager */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Manager
        </label>

        <input
          value={form.manager}
          onChange={(e)=>setForm({...form,manager:e.target.value})}
          placeholder="Manager Name"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Capacity */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Capacity
        </label>

        <input
          type="number"
          value={form.capacity}
          onChange={(e)=>setForm({...form,capacity:e.target.value})}
          placeholder="10000"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Current Stock */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Current Stock
        </label>

        <input
          type="number"
          value={form.currentStock}
          onChange={(e)=>setForm({...form,currentStock:e.target.value})}
          placeholder="3500"
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block mb-2 text-xs font-bold uppercase text-slate-600">
          Status
        </label>

        <select
          value={form.status}
          onChange={(e)=>setForm({...form,status:e.target.value})}
          className="w-full px-4 py-3 transition bg-white border rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        >
          <option>Active</option>
          <option>Inactive</option>
          <option>Maintenance</option>
        </select>
      </div>

      {/* Primary */}
      <div className="flex items-center pt-8">

        <label className="flex items-center gap-3 font-medium cursor-pointer text-slate-700">

          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e)=>
              setForm({...form,isPrimary:e.target.checked})
            }
            className="w-5 h-5 accent-indigo-600"
          />

          Primary Warehouse

        </label>

      </div>

    </div>

    <div className="flex flex-wrap gap-4 mt-8">

      <button
        onClick={editingId ? updateWarehouse : addWarehouse}
        className="flex items-center gap-2 px-8 py-3 font-semibold text-white transition-all shadow-xl rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:scale-105"
      >
        {editingId ? (
          <>
            <Edit size={18}/>
            Update Warehouse
          </>
        ) : (
          <>
            <Plus size={18}/>
            Create Warehouse
          </>
        )}
      </button>

      {editingId && (
        <button
          onClick={()=>{
            setEditingId(null);
            setForm(INITIAL_FORM);
          }}
          className="px-8 py-3 font-semibold transition bg-white border shadow rounded-xl border-slate-300 hover:bg-slate-100"
        >
          Cancel
        </button>
      )}

    </div>

  </div>

</div>




  {/* Search */}
  <div className="relative mt-6">


    <Search
      size={18}
      className="absolute text-slate-400 left-4 top-3.5"
    />


    <input
      placeholder="Search warehouse name, location or code..."
      value={search}
      onChange={(e)=>setSearch(e.target.value)}
      className="w-full py-3 pl-12 pr-4 transition border outline-none rounded-2xl border-slate-200 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
    />


  </div>


</div>

      {/* ================= PREMIUM WAREHOUSE TABLE ================= */}

<div className="overflow-hidden bg-white border shadow-2xl rounded-3xl border-slate-200">


  {/* HEADER */}

  <div className="relative px-6 py-6 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">


    <div className="absolute rounded-full w-72 h-72 bg-indigo-500/20 blur-3xl -top-32 -right-20"/>


    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">


      <div>


        <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-indigo-200 rounded-full bg-white/10">

          <Warehouse size={14}/>

          Inventory Locations

        </div>



        <h2 className="mt-3 text-2xl font-bold text-white ">
          Warehouse Directory
        </h2>



        <p className="mt-1 text-sm text-slate-300">
          Manage storage locations, managers and operational status.
        </p>


      </div>



      <div className="px-5 py-3 border rounded-2xl bg-white/10 border-white/10 backdrop-blur">


        <p className="text-xs text-slate-300">
          Total Locations
        </p>


        <p className="mt-1 text-3xl font-bold text-white ">
          {filtered.length}
        </p>


      </div>


    </div>


  </div>





  {/* ================= TABLE CONTENT ================= */}

{loading ? (
  <LoadingState text="Loading warehouses..." />
) : filtered.length === 0 ? (
  <EmptyState text="No warehouses found" />
) : (
  <div className="overflow-x-auto">

    <table className="min-w-full">

      {/* ================= HEADER ================= */}

      <thead className="sticky top-0 z-10 bg-slate-100">

        <tr className="text-xs font-semibold tracking-wider uppercase text-slate-600">

          <Th>Warehouse</Th>
          <Th>Code</Th>
          <Th>Location</Th>
          <Th>Manager</Th>
          <Th>Stock</Th>
          <Th>Status</Th>
          <Th>Created</Th>
          <Th className="text-right">Actions</Th>

        </tr>

      </thead>

      {/* ================= BODY ================= */}

      <tbody>

        {filtered.map((w, index) => {

          const stock = Number(w.currentStock || 0);
          const capacity = Number(w.capacity || 0);

          const percentage =
            capacity > 0
              ? Math.min((stock / capacity) * 100, 100)
              : 0;

          return (

            <tr
              key={w._id}
              className={`group border-b transition-all duration-300 hover:bg-indigo-50/40 ${
                index % 2 === 0
                  ? "bg-white"
                  : "bg-slate-50/40"
              }`}
            >

              {/* Warehouse */}

              <Td>

                <div className="flex items-center gap-4">

                  <div className="flex items-center justify-center w-12 h-12 text-lg font-bold text-white shadow-lg rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600">

                    {w.name?.charAt(0)?.toUpperCase()}

                  </div>

                  <div>

                    <div className="flex items-center gap-2">

                      <p className="font-bold text-slate-900">
                        {w.name}
                      </p>

                      {w.isPrimary && (

                        <span className="px-2 py-1 text-[10px] rounded-full font-bold bg-yellow-100 text-yellow-700">

                          PRIMARY

                        </span>

                      )}

                    </div>

                    <p className="mt-1 text-xs text-slate-400">

                      Warehouse Facility

                    </p>

                  </div>

                </div>

              </Td>

              {/* Code */}

              <Td>

                <span className="inline-flex px-3 py-1 font-semibold text-indigo-700 rounded-xl bg-indigo-50">

                  {w.code || `WH-${w._id.slice(-4).toUpperCase()}`}

                </span>

              </Td>

              {/* Location */}

              <Td>

                <div>

                  <div className="flex items-center gap-2">

                    <MapPin
                      size={15}
                      className="text-indigo-500"
                    />

                    <span className="font-medium">

                      {w.location || "-"}

                    </span>

                  </div>

                  <p className="mt-1 text-xs text-slate-400">

                    {[w.city, w.state, w.country]
                      .filter(Boolean)
                      .join(", ")}

                  </p>

                </div>

              </Td>

              {/* Manager */}

              <Td>

                <div className="flex items-center gap-3">

                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100">

                    <User
                      size={16}
                      className="text-slate-500"
                    />

                  </div>

                  <div>

                    <p className="font-semibold">

                      {w.manager || "Not Assigned"}

                    </p>

                    <p className="text-xs text-slate-400">

                      Warehouse Manager

                    </p>

                  </div>

                </div>

              </Td>

              {/* Stock */}

              {/* Stock */}

<Td>
  <div className="w-52">

    <div className="flex items-center justify-between text-sm font-semibold">
      <span>{stock.toLocaleString()} Units</span>
      <span>{capacity.toLocaleString()} Max</span>
    </div>

    <div className="h-2 mt-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          percentage >= 90
            ? "bg-red-500"
            : percentage >= 70
            ? "bg-yellow-500"
            : "bg-emerald-500"
        }`}
        style={{
          width: `${percentage}%`,
        }}
      />
    </div>

    <div className="flex justify-between mt-2 text-xs">
      <span className="font-semibold text-slate-600">
        {percentage.toFixed(1)}% Used
      </span>

      <span className="text-slate-500">
        {Math.max(capacity - stock, 0).toLocaleString()} Free
      </span>
    </div>

  </div>
</Td>

              {/* Status */}

              <Td>
  <span
    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
      w.status === "Inactive"
        ? "bg-red-100 text-red-700"
        : w.status === "Maintenance"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-emerald-100 text-emerald-700"
    }`}
  >
    <span
      className={`w-2.5 h-2.5 rounded-full ${
        w.status === "Inactive"
          ? "bg-red-500"
          : w.status === "Maintenance"
          ? "bg-yellow-500"
          : "bg-emerald-500"
      }`}
    />

    {w.status}
  </span>
</Td>

              {/* Created */}

              <Td>

                <div>

                  <p className="font-medium">

                    {new Date(
                      w.createdAt
                    ).toLocaleDateString()}

                  </p>

                  <p className="text-xs text-slate-400">

                    Created

                  </p>

                </div>

              </Td>

              {/* Actions */}

              <Td className="text-right">

                <div className="flex justify-end gap-2 transition opacity-70 group-hover:opacity-100">

                 <button
  onClick={() => {
    setEditingId(w._id);
    setForm({ ...w });
  }}
  className="p-2 text-indigo-600 transition rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white"
  title="Edit Warehouse"
>
  <Edit size={17} />
</button>



                  <button
                    onClick={() => deleteWarehouse(w._id)}
                    className="p-2 text-red-600 transition-all rounded-xl hover:bg-red-100 hover:scale-110"
                    title="Delete Warehouse"
                  >

                    <Trash2 size={17} />

                  </button>

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

/* ================= PREMIUM SMALL COMPONENTS ================= */

function Feature({ text }) {
  return (
    <div className="flex items-center gap-3 p-4 transition border rounded-2xl bg-white/10 border-white/10 backdrop-blur-xl hover:bg-white/20">

      <div className="flex items-center justify-center rounded-full w-7 h-7 bg-indigo-500/20">
        <div className="w-2 h-2 bg-indigo-400 rounded-full" />
      </div>

      <p className="text-sm font-medium text-slate-200">
        {text}
      </p>

    </div>
  );
}



function Kpi({ title, value, icon: Icon }) {

  return (

    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-xl">


      {/* Glow */}
      <div className="absolute w-24 h-24 transition bg-indigo-100 rounded-full -top-10 -right-10 group-hover:scale-125" />


      <div className="relative flex items-center justify-between">


        <div>

          <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            {title}
          </p>


          <p className="mt-3 text-3xl font-bold text-slate-900">
            {value}
          </p>


        </div>



        <div className="flex items-center justify-center text-white shadow-lg w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">

          <Icon size={26}/>

        </div>


      </div>


    </div>

  );

}



const Th = ({ children, className = "" }) => (

  <th
    className={`px-5 py-4 text-xs font-semibold tracking-wider text-left uppercase text-slate-500 ${className}`}
  >

    {children}

  </th>

);



const Td = ({ children, className = "" }) => (

  <td
    className={`px-5 py-4 text-sm text-slate-700 ${className}`}
  >

    {children}

  </td>

);



const LoadingState = ({ text }) => (

  <div className="flex flex-col items-center justify-center gap-3 p-10 text-slate-500">

    <div className="w-8 h-8 border-4 border-indigo-200 rounded-full border-t-indigo-600 animate-spin" />

    <p className="text-sm font-medium">
      {text}
    </p>

  </div>

);



const EmptyState = ({ text }) => (

  <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">

    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100">

      <Warehouse size={30} className="text-slate-400" />

    </div>


    <p className="font-medium text-slate-600">
      {text}
    </p>


    <p className="text-sm text-slate-400">
      Create a warehouse or adjust your search filters.
    </p>

  </div>

);