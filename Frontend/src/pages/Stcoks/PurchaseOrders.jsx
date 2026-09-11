import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  RefreshCcw,
  Search,
  CheckCircle,
  Clock,
  IndianRupee,
  Package,
  ShoppingCart,
  Plus,
  Download,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

const EMPTY_ITEM = { product: "", qty: 1, cost: 0 };

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ===== SELECTION SOURCES (existing APIs) ===== */
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);

  /* ===== CREATE / EDIT FORM ===== */
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor: "",
    items: [{ ...EMPTY_ITEM }],
  });

  /* ===== VIEW ===== */
  const [viewPO, setViewPO] = useState(null);

  /* ================= FETCH ================= */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await API.get("/purchase");
      setOrders(res.data || []);
    } catch (err) {
      console.error("Failed to fetch purchase orders", err);
      toast.error("Failed to fetch purchase orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await API.get("/vendors");
      setVendors(res.data || []);
    } catch {
      /* interceptor already surfaced the error */
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(res.data?.data || res.data || []);
    } catch {
      /* interceptor already surfaced the error */
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchVendors();
    fetchProducts();
  }, []);

  /* ================= FORM HELPERS ================= */
  const openCreate = () => {
    setEditingId(null);
    setForm({ vendor: "", items: [{ ...EMPTY_ITEM }] });
    setDrawerOpen(true);
  };

  const openEdit = (po) => {
    setEditingId(po._id);
    setForm({
      vendor: po.vendor?._id || po.vendor || "",
      items: (po.items || []).map((i) => ({
        product: i.product?._id || i.product || "",
        qty: i.qty ?? 1,
        cost: i.cost ?? 0,
      })),
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    setForm({ vendor: "", items: [{ ...EMPTY_ITEM }] });
  };

  const setItem = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? { ...item, [key]: key === "product" ? value : Number(value) }
          : item
      ),
    }));
  };

  const addItemRow = () =>
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));

  const removeItemRow = (index) =>
    setForm((prev) => ({
      ...prev,
      items:
        prev.items.length > 1
          ? prev.items.filter((_, i) => i !== index)
          : prev.items,
    }));

  /* When a product is picked, default its cost from the product price */
  const onProductChange = (index, productId) => {
    const picked = products.find((p) => p._id === productId);

    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index
          ? {
              ...item,
              product: productId,
              cost:
                Number(item.cost) > 0
                  ? item.cost
                  : Number(picked?.purchasePrice ?? picked?.price ?? 0),
            }
          : item
      ),
    }));
  };

  const formTotal = form.items.reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.cost) || 0),
    0
  );

  /* ================= CREATE / UPDATE ================= */
  const savePO = async (e) => {
    e?.preventDefault();

    if (!form.vendor) return toast.error("Vendor is required");

    const items = form.items.filter((i) => i.product);

    if (!items.length) return toast.error("Add at least one product");

    if (items.some((i) => Number(i.qty) <= 0))
      return toast.error("Quantity must be greater than 0");

    const payload = {
      vendor: form.vendor,
      items: items.map((i) => ({
        product: i.product,
        qty: Number(i.qty),
        cost: Number(i.cost) || 0,
      })),
    };

    try {
      setSaving(true);

      if (editingId) {
        await API.put(`/purchase/${editingId}`, payload);
        toast.success("Purchase order updated");
      } else {
        await API.post("/purchase", payload);
        toast.success("Purchase order created");
      }

      closeDrawer();
      fetchOrders();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          (editingId ? "Failed to update PO" : "Failed to create PO")
      );
    } finally {
      setSaving(false);
    }
  };

  /* ================= VIEW ================= */
  const openView = async (id) => {
    try {
      const res = await API.get(`/purchase/${id}`);
      setViewPO(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load PO");
    }
  };

  /* ================= DELETE ================= */
  const deletePO = async (id) => {
    if (!confirm("Delete this purchase order?")) return;

    try {
      await API.delete(`/purchase/${id}`);
      toast.success("Purchase order deleted");
      fetchOrders();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  /* ================= DERIVED DATA ================= */
  const filtered = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.poNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.vendor?.name || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [orders, search]);

  const totalPO = orders.length;
  const draftPO = orders.filter((o) => o.status === "DRAFT").length;
  const confirmedPO = orders.filter((o) => o.status !== "DRAFT").length;

  const totalSpend = orders.reduce((sum, po) => {
    return (
      sum +
      (po.items || []).reduce(
        (s, i) => s + (i.qty || 0) * (i.cost || 0),
        0
      )
    );
  }, 0);

  /* ================= DASHBOARD STATS ================= */

  const activeVendors = new Set(
    orders.map((o) => o.vendor?.name).filter(Boolean)
  ).size;

  const totalPurchaseValue = orders.reduce((sum, po) => {
    const orderTotal =
      po.items?.reduce(
        (total, item) =>
          total + (item.qty || 0) * (item.cost || 0),
        0
      ) || 0;

    return sum + orderTotal;
  }, 0);

  const pendingOrders = orders.filter(
    (o) =>
      o.status === "PENDING" ||
      o.status === "DRAFT"
  ).length;

  const completedOrders = orders.filter(
    (o) =>
      o.status === "RECEIVED" ||
      o.status === "COMPLETED"
  ).length;

  const averageOrderValue =
    totalPO > 0
      ? Math.round(totalPurchaseValue / totalPO)
      : 0;

  /* ================= UI ================= */
  return (
    <div className="space-y-4">
      {/* ===================== ENTERPRISE HEADER ===================== */}

      <div className="relative p-8 overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

        {/* Background Effects */}
        <div className="absolute rounded-full -top-16 -right-16 h-72 w-72 bg-indigo-500/20 blur-3xl" />
        <div className="absolute rounded-full -bottom-20 -left-20 h-72 w-72 bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

          {/* Left */}
          <div>

            <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-xs font-semibold tracking-wider text-blue-100 uppercase border rounded-full border-white/20 bg-white/10">

              <ShoppingCart size={14} />

              Procurement Management

            </div>

            <h1 className="text-4xl font-bold tracking-tight">
              Purchase Orders
            </h1>

            <p className="max-w-3xl mt-3 text-base leading-7 text-slate-300">
              Streamline procurement workflows, manage vendor purchases,
              monitor stock inflow, approve purchase requests, and track
              order lifecycle with enterprise-grade visibility.
            </p>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-5 mt-6">

              <div>
                <p className="text-3xl font-bold">
                  {totalPO}
                </p>
                <p className="text-sm text-slate-300">
                  Purchase Orders
                </p>
              </div>

              <div className="w-px h-10 bg-white/20" />

              <div>
                <p className="text-3xl font-bold text-emerald-400">
                  {activeVendors}
                </p>
                <p className="text-sm text-slate-300">
                  Active Vendors
                </p>
              </div>

              <div className="w-px h-10 bg-white/20" />

              <div>
                <p className="text-3xl font-bold text-cyan-400">
                  ₹{totalPurchaseValue.toLocaleString()}
                </p>
                <p className="text-sm text-slate-300">
                  Total Procurement
                </p>
              </div>

            </div>

          </div>

          {/* Right */}
          <div className="flex flex-wrap items-center justify-end gap-4">

            {/* Refresh */}
            <button
              onClick={fetchOrders}
              className="flex h-14 min-w-[180px] items-center justify-center gap-2 rounded-2xl bg-white px-6 font-semibold text-slate-900 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <RefreshCcw
                size={18}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            {/* Create PO */}
            <button
              onClick={openCreate}
              className="flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 px-6 font-semibold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <Plus size={18} />
              Create Purchase Order
            </button>

            {/* Export */}
            <button
              className="flex h-14 min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 font-semibold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/20 hover:shadow-2xl"
            >
              <Download size={18} />
              Export
            </button>

          </div>

        </div>

      </div>

      {/* ===================== ENTERPRISE KPI CARDS ===================== */}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">

        {/* Total Purchase Orders */}
        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-blue-100">
                Total Purchase Orders
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {totalPO}
              </h2>

              <p className="mt-3 text-sm text-blue-100">
                All procurement orders
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <FileText size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-4/5 h-full bg-white rounded-full" />
          </div>

        </div>

        {/* Draft Orders */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-amber-500 to-orange-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-amber-100">
                Draft Orders
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {draftPO}
              </h2>

              <p className="mt-3 text-sm text-amber-100">
                Awaiting approval
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <Clock size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-2/5 h-full bg-white rounded-full" />
          </div>

        </div>

        {/* Confirmed Orders */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-green-100">
                Confirmed Orders
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                {confirmedPO}
              </h2>

              <p className="mt-3 text-sm text-green-100">
                Successfully approved
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <CheckCircle size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="w-3/4 h-full bg-white rounded-full" />
          </div>

        </div>

        {/* Total Spend */}

        <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-700 hover:-translate-y-1 hover:shadow-2xl">

          <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-white/10 blur-3xl" />

          <div className="relative flex items-start justify-between">

            <div>

              <p className="text-sm text-purple-100">
                Total Spend
              </p>

              <h2 className="mt-3 text-4xl font-bold">
                ₹{totalSpend.toLocaleString()}
              </h2>

              <p className="mt-3 text-sm text-purple-100">
                Procurement investment
              </p>

            </div>

            <div className="p-4 rounded-2xl bg-white/15">
              <IndianRupee size={30} />
            </div>

          </div>

          <div className="h-2 mt-5 rounded-full bg-white/20">
            <div className="h-full w-[90%] rounded-full bg-white" />
          </div>

        </div>

      </div>

      {/* ===================== ENTERPRISE ACTION BAR ===================== */}

      <div className="p-6 bg-white border shadow-xl rounded-3xl border-slate-200 dark:border-slate-700 dark:bg-slate-900">

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          {/* Left */}

          <div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Purchase Order Management
            </h3>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Search, filter and manage procurement orders across vendors.
            </p>

          </div>

          {/* Right */}

          <div className="flex flex-wrap gap-3">

            {/* Search */}

            <div className="relative w-full md:w-80">

              <Search
                size={18}
                className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO Number, Vendor..."
                className="w-full py-3 pl-12 pr-4 text-sm border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

            </div>

            {/* Status */}

            <select className="px-4 py-3 text-sm border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white">

              <option>All Status</option>
              <option>Draft</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Received</option>
              <option>Cancelled</option>

            </select>

            {/* Vendor */}

            <select className="px-4 py-3 text-sm border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white">

              <option>All Vendors</option>

              {[...new Set(orders.map(o => o.vendor?.name).filter(Boolean))].map(v => (
                <option key={v}>{v}</option>
              ))}

            </select>

            {/* Refresh */}

            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-2xl hover:bg-indigo-700"
            >
              <RefreshCcw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            {/* Export */}

            <button className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition border rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800">

              <Download size={17} />

              Export

            </button>

            {/* Add PO */}

            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-xl"
            >

              <Plus size={18} />

              New Purchase Order

            </button>

          </div>

        </div>

        {/* Bottom Summary */}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-5 mt-6 border-t border-slate-200 dark:border-slate-700">

          <div className="flex flex-wrap gap-6 text-sm">

            <span className="font-medium text-slate-600 dark:text-slate-300">
              Total Orders:
              <span className="ml-2 font-bold text-indigo-600">
                {filtered.length}
              </span>
            </span>

            <span className="font-medium text-slate-600 dark:text-slate-300">
              Procurement Value:
              <span className="ml-2 font-bold text-emerald-600">
                ₹{totalSpend.toLocaleString()}
              </span>
            </span>

          </div>

          <div className="px-4 py-2 text-sm font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">

            Procurement System Online

          </div>

        </div>

      </div>

      {/* ================= ENTERPRISE PURCHASE TABLE ================= */}

      <div className="overflow-hidden bg-white border shadow-2xl rounded-3xl border-slate-200 dark:border-slate-700 dark:bg-slate-900">

        {loading ? (
          <Loader />
        ) : filtered.length === 0 ? (
          <Empty onCreate={openCreate} />
        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full">

              {/* Header */}

              <thead className="sticky top-0 z-20 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

                <tr>

                  <th className="px-5 py-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                    />
                  </th>

                  <th className="px-5 py-4 text-left">
                    Purchase Order
                  </th>

                  <th className="px-5 py-4 text-left">
                    Vendor
                  </th>

                  <th className="px-5 py-4 text-left">
                    Items
                  </th>

                  <th className="px-5 py-4 text-left">
                    Quantity
                  </th>

                  <th className="px-5 py-4 text-left">
                    Amount
                  </th>

                  <th className="px-5 py-4 text-left">
                    Status
                  </th>

                  <th className="px-5 py-4 text-left">
                    Created
                  </th>

                  <th className="px-5 py-4 text-center">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filtered.map((po) => {

                  const qty = (po.items || []).reduce(
                    (sum, item) => sum + (item.qty || 0),
                    0
                  );

                  const amount = (po.items || []).reduce(
                    (sum, item) =>
                      sum + (item.qty || 0) * (item.cost || 0),
                    0
                  );

                  return (

                    <tr
                      key={po._id}
                      className="transition border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                    >

                      {/* Checkbox */}

                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded"
                        />
                      </td>

                      {/* PO */}

                      <td className="px-5 py-4">

                        <div>

                          <p className="font-semibold text-slate-800 dark:text-white">
                            {po.poNumber}
                          </p>

                          <p className="text-xs text-slate-500">
                            Procurement Order
                          </p>

                        </div>

                      </td>

                      {/* Vendor */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-3">

                          <div className="flex items-center justify-center w-10 h-10 font-bold text-white rounded-full bg-gradient-to-r from-indigo-600 to-blue-600">

                            {po.vendor?.name?.charAt(0)}

                          </div>

                          <div>

                            <p className="font-semibold text-slate-800 dark:text-white">
                              {po.vendor?.name}
                            </p>

                            <p className="text-xs text-slate-500">
                              Approved Vendor
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* Items */}

                      <td className="px-5 py-4">

                        <div className="flex items-center gap-2">

                          <Package
                            size={16}
                            className="text-indigo-500"
                          />

                          {(po.items || []).length}

                        </div>

                      </td>

                      {/* Qty */}

                      <td className="px-5 py-4 font-medium">
                        {qty}
                      </td>

                      {/* Amount */}

                      <td className="px-5 py-4">

                        <span className="font-bold text-emerald-600">
                          ₹{amount.toLocaleString()}
                        </span>

                      </td>

                      {/* Status */}

                      <td className="px-5 py-4">

                        {po.status === "DRAFT" ? (

                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">

                            Draft

                          </span>

                        ) : (

                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">

                            Confirmed

                          </span>

                        )}

                      </td>

                      {/* Date */}

                      <td className="px-5 py-4 text-slate-500">

                        {new Date(
                          po.createdAt
                        ).toLocaleDateString()}

                      </td>

                      {/* Actions */}

                      <td className="px-5 py-4">

                        <div className="flex justify-center gap-2">

                          <button
                            onClick={() => openView(po._id)}
                            className="p-2 text-blue-600 transition bg-blue-100 rounded-xl hover:bg-blue-200"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => openEdit(po)}
                            className="p-2 transition rounded-xl bg-amber-100 text-amber-600 hover:bg-amber-200"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => deletePO(po._id)}
                            className="p-2 text-red-600 transition bg-red-100 rounded-xl hover:bg-red-200"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {/* ================= CREATE / EDIT DRAWER ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
          <form
            onSubmit={savePO}
            className="flex h-full w-full max-w-2xl flex-col bg-white dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">
              <div>
                <h3 className="text-lg font-bold">
                  {editingId ? "Edit Purchase Order" : "Create Purchase Order"}
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  Select vendor and products, then save.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                className="px-3 py-1.5 text-sm rounded-xl bg-white/10 hover:bg-white/20"
              >
                Close
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">

              {/* Vendor */}
              <div>
                <label className="block mb-1 text-xs font-semibold text-slate-500">
                  Vendor
                </label>

                <select
                  value={form.vendor}
                  onChange={(e) =>
                    setForm({ ...form, vendor: e.target.value })
                  }
                  className="w-full px-3 py-3 text-sm border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500">
                    Items
                  </label>

                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-xl hover:bg-indigo-200"
                  >
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {form.items.map((item, index) => {
                    const lineTotal =
                      (Number(item.qty) || 0) * (Number(item.cost) || 0);

                    return (
                      <div
                        key={index}
                        className="p-4 border rounded-2xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="grid gap-3 sm:grid-cols-12">

                          {/* Product */}
                          <div className="sm:col-span-5">
                            <label className="block mb-1 text-[11px] text-slate-500">
                              Product
                            </label>

                            <select
                              value={item.product}
                              onChange={(e) =>
                                onProductChange(index, e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Qty */}
                          <div className="sm:col-span-2">
                            <label className="block mb-1 text-[11px] text-slate-500">
                              Qty
                            </label>

                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) =>
                                setItem(index, "qty", e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Cost */}
                          <div className="sm:col-span-3">
                            <label className="block mb-1 text-[11px] text-slate-500">
                              Unit Cost
                            </label>

                            <input
                              type="number"
                              min="0"
                              value={item.cost}
                              onChange={(e) =>
                                setItem(index, "cost", e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm bg-white border rounded-xl border-slate-200 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Line total + remove */}
                          <div className="flex items-end justify-between gap-2 sm:col-span-2">
                            <div>
                              <label className="block mb-1 text-[11px] text-slate-500">
                                Amount
                              </label>

                              <p className="py-2 text-sm font-bold text-emerald-600">
                                ₹{lineTotal.toLocaleString()}
                              </p>
                            </div>

                            {form.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItemRow(index)}
                                className="p-2 mb-1 text-red-600 bg-red-100 rounded-xl hover:bg-red-200"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-t border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs text-slate-500">Order Total</p>
                <p className="text-xl font-bold text-emerald-600">
                  ₹{formTotal.toLocaleString()}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeDrawer}
                  disabled={saving}
                  className="px-5 py-3 text-sm font-semibold border rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 text-sm font-semibold text-white rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:shadow-xl disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Purchase Order"
                    : "Create Purchase Order"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= VIEW MODAL ================= */}
      {viewPO && (
        <div className="fixed inset-0 z-50 grid p-4 bg-slate-900/50 place-items-center">
          <div className="w-full max-w-xl overflow-hidden bg-white shadow-2xl rounded-3xl dark:bg-slate-900">

            <div className="flex items-center justify-between px-6 py-5 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">
              <div>
                <h3 className="text-lg font-bold">{viewPO.poNumber}</h3>
                <p className="mt-1 text-xs text-slate-300">
                  {viewPO.vendor?.name || "—"}
                </p>
              </div>

              <button
                onClick={() => setViewPO(null)}
                className="px-3 py-1.5 text-sm rounded-xl bg-white/10 hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="py-2 text-left">Product</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Cost</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {(viewPO.items || []).map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2">
                        {item.product?.name || "—"}
                      </td>
                      <td className="py-2 text-right">{item.qty}</td>
                      <td className="py-2 text-right">
                        ₹{(item.cost || 0).toLocaleString()}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        ₹{((item.qty || 0) * (item.cost || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                  {viewPO.status}
                </span>

                <div className="text-right">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-xl font-bold text-emerald-600">
                    ₹
                    {(viewPO.items || [])
                      .reduce(
                        (s, i) => s + (i.qty || 0) * (i.cost || 0),
                        0
                      )
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

/* ================= UI COMPONENTS ================= */

function MiniStat({
  label,
  value,
  icon: Icon,
  color = "slate",
  trend,
}) {
  const styles = {
    slate: {
      icon: "from-slate-600 to-slate-800",
      ring: "ring-slate-200",
      text: "text-slate-700",
      badge: "bg-slate-100 text-slate-700",
    },
    indigo: {
      icon: "from-indigo-600 to-blue-700",
      ring: "ring-indigo-200",
      text: "text-indigo-700",
      badge: "bg-indigo-100 text-indigo-700",
    },
    emerald: {
      icon: "from-emerald-500 to-green-700",
      ring: "ring-emerald-200",
      text: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-700",
    },
    amber: {
      icon: "from-amber-500 to-orange-600",
      ring: "ring-amber-200",
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-700",
    },
    rose: {
      icon: "from-rose-500 to-red-700",
      ring: "ring-rose-200",
      text: "text-rose-700",
      badge: "bg-rose-100 text-rose-700",
    },
  };

  const s = styles[color] || styles.slate;

  return (
    <div className="relative p-5 overflow-hidden transition-all duration-300 bg-white border shadow-lg group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900">

      {/* Background Glow */}
      <div className="absolute rounded-full -right-10 -top-10 h-28 w-28 bg-slate-200/20 blur-3xl" />

      <div className="relative flex items-center justify-between">

        <div>

          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {label}
          </p>

          <h2 className={`mt-2 text-3xl font-bold ${s.text}`}>
            {value}
          </h2>

          {trend && (
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}
            >
              {trend}
            </span>
          )}

        </div>

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.icon} text-white shadow-xl ring-8 ${s.ring} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon size={28} />
        </div>

      </div>

      {/* Bottom Progress */}
      <div className="h-2 mt-5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${s.icon}`}
          style={{ width: "80%" }}
        />
      </div>

    </div>
  );
}

/* ===========================
   ENTERPRISE STATUS BADGE
=========================== */

function Badge({ text, color = "slate" }) {
  const styles = {
    emerald:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",

    amber:
      "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",

    red:
      "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",

    blue:
      "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",

    violet:
      "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",

    slate:
      "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${styles[color]}`}
    >
      <span className="w-2 h-2 mr-2 bg-current rounded-full opacity-70" />
      {text}
    </span>
  );
}

/* ===========================
   TABLE HEADER
=========================== */

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-200 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

/* ===========================
   TABLE CELL
=========================== */

function Td({ children, className = "" }) {
  return (
    <td
      className={`px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 ${className}`}
    >
      {children}
    </td>
  );
}

/* ===========================
   LOADER
=========================== */

function Loader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">

      <div className="w-12 h-12 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />

      <div>

        <h3 className="text-lg font-semibold text-slate-700 dark:text-white">
          Loading Purchase Orders
        </h3>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fetching procurement records...
        </p>

      </div>

    </div>
  );
}

/* ===========================
   EMPTY STATE
=========================== */

function Empty({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">

      <div className="flex items-center justify-center w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800">

        <Package
          size={42}
          className="text-slate-400"
        />

      </div>

      <h3 className="mt-6 text-xl font-bold text-slate-800 dark:text-white">
        No Purchase Orders Found
      </h3>

      <p className="max-w-md mt-2 text-sm text-center text-slate-500 dark:text-slate-400">
        There are currently no purchase orders available.
        Create a new procurement order to begin managing vendor purchases.
      </p>

      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-6 py-3 mt-8 font-semibold text-white transition shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105"
      >
        <Plus size={18} />
        Create Purchase Order
      </button>

    </div>
  );
}