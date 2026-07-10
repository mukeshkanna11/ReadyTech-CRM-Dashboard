import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Package,
  X,
  AlertTriangle,
  Layers,
  IndianRupee,
  Info,
  CheckCircle,
  ArrowRight,
  Boxes,
  TrendingUp,
} from "lucide-react";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const emptyForm = {
    name: "",
    sku: "",
    category: "",
    price: "",
    tax: "",
    stock: "",
    status: "Active",
    description: "",
  };

  const [form, setForm] = useState(emptyForm);
  const fetchedOnce = useRef(false);

  /* ================= FETCH ================= */
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await API.get("/products");

      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      setProducts(
        list.map((p) => ({
          ...p,
          status: p.status || "Active",
        }))
      );
    } catch {
      toast.error("Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    fetchProducts();
  }, []);

  /* ================= SAVE ================= */
  const saveProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        tax: Number(form.tax) || 0,
      };

      form._id
        ? await API.put(`/products/${form._id}`, payload)
        : await API.post("/products", payload);

      toast.success(form._id ? "Product updated" : "Product created");
      setDrawerOpen(false);
      setForm(emptyForm);
      fetchProducts();
    } catch {
      toast.error("Save failed");
    }
  };

  /* ================= DELETE ================= */
  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      await API.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= FILTER ================= */
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [products, search]);

  /* ================= INSIGHTS ================= */
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.status === "Active").length;
  const lowStock = products.filter((p) => p.stock <= 5);
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  );

  const categorySummary = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (!p.category) return;
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [products]);

  return (
    <div className="p-6 space-y-10 bg-gradient-to-br from-slate-50 via-white to-slate-100">
     
      {/* ================= PREMIUM HERO HEADER ================= */}
<div className="relative p-8 overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900">

  <div className="absolute w-56 h-56 rounded-full -top-16 -right-16 bg-white/10 blur-3xl"></div>
  <div className="absolute w-56 h-56 rounded-full -bottom-16 -left-16 bg-indigo-500/20 blur-3xl"></div>

  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

    <div>
      <div className="flex items-center gap-2 mb-3 text-sm text-slate-300">
        <Package size={16} />
        <span>ERP</span>
        <ArrowRight size={14} />
        <span>Inventory</span>
        <ArrowRight size={14} />
        <span className="font-medium text-white">Products</span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight">
        Products & Inventory
      </h1>

      <p className="max-w-2xl mt-3 text-slate-300">
        Manage products, pricing, inventory levels and stock availability
        across your ERP platform with real-time visibility.
      </p>

      <div className="flex flex-wrap gap-3 mt-6">

        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-5 py-3 text-sm transition border rounded-xl border-white/20 bg-white/10 backdrop-blur hover:bg-white/20"
        >
          <RefreshCw size={18} />
          Refresh
        </button>

        <button
          onClick={() => {
            setForm(emptyForm);
            setDrawerOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition bg-white shadow-lg rounded-xl text-slate-900 hover:scale-105"
        >
          <Plus size={18} />
          Add Product
        </button>

      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">
        <p className="text-sm text-slate-300">
          Total Products
        </p>

        <h2 className="mt-2 text-3xl font-bold">
          {totalProducts}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">
        <p className="text-sm text-slate-300">
          Active
        </p>

        <h2 className="mt-2 text-3xl font-bold text-emerald-300">
          {activeProducts}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">
        <p className="text-sm text-slate-300">
          Low Stock
        </p>

        <h2 className="mt-2 text-3xl font-bold text-amber-300">
          {lowStock.length}
        </h2>
      </div>

      <div className="p-5 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">
        <p className="text-sm text-slate-300">
          Inventory Value
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          ₹{inventoryValue.toLocaleString()}
        </h2>
      </div>

    </div>

  </div>

</div>

      {/* ================= PREMIUM KPI ================= */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
  <Kpi
    title="Total Products"
    value={totalProducts}
    icon={Package}
    subtitle="All registered products"
    color="blue"
  />

  <Kpi
    title="Active Products"
    value={activeProducts}
    icon={Layers}
    subtitle="Currently available"
    color="green"
  />

  <Kpi
    title="Low Stock Alerts"
    value={lowStock.length}
    icon={AlertTriangle}
    subtitle="Needs attention"
    color="red"
  />

  <Kpi
    title="Inventory Value"
    value={`₹${inventoryValue.toLocaleString()}`}
    icon={IndianRupee}
    subtitle="Current inventory worth"
    color="purple"
  />
</div>
  

      {/* ================= INVENTORY INSIGHTS ================= */}
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

  <div className="p-6 text-white shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">

    <p className="text-sm opacity-80">Product Categories</p>

    <h2 className="mt-3 text-4xl font-bold">
      {Object.keys(categorySummary).length}
    </h2>

    <p className="mt-3 text-sm opacity-80">
      Active Categories
    </p>

  </div>

  <div className="p-6 text-white shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600">

    <p className="text-sm opacity-80">
      Inventory Health
    </p>

    <h2 className="mt-3 text-4xl font-bold">
      {activeProducts}
    </h2>

    <p className="mt-3 text-sm opacity-80">
      Active Products
    </p>

  </div>

  <div className="p-6 text-white shadow-xl rounded-3xl bg-gradient-to-br from-orange-500 to-red-500">

    <p className="text-sm opacity-80">
      Low Stock Alerts
    </p>

    <h2 className="mt-3 text-4xl font-bold">
      {lowStock.length}
    </h2>

    <p className="mt-3 text-sm opacity-80">
      Products Need Restocking
    </p>

  </div>

</div>

      {/* ================= PREMIUM SEARCH & ACTION BAR ================= */}
<div className="p-6 mb-8 bg-white border shadow-sm rounded-3xl border-slate-200">

  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

    {/* Search */}
    <div className="relative flex-1">

      <Search
        className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
        size={20}
      />

      <input
        type="text"
        placeholder="Search products by name, SKU or category..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-12 pr-4 text-sm transition border h-14 rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
      />

    </div>

    {/* Action Buttons */}
    <div className="flex flex-wrap gap-3">

      <button className="px-5 py-3 text-sm font-semibold transition bg-white border rounded-xl border-slate-200 hover:border-indigo-500 hover:text-indigo-600">
        Export
      </button>

      <button className="px-5 py-3 text-sm font-semibold transition bg-white border rounded-xl border-slate-200 hover:border-indigo-500 hover:text-indigo-600">
        Import
      </button>

      <button
        onClick={fetchProducts}
        className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white transition rounded-xl bg-slate-900 hover:bg-indigo-700"
      >
        <RefreshCw size={18} />
        Refresh
      </button>

    </div>

  </div>

</div>

      {/* ================= PREMIUM PRODUCTS TABLE ================= */}
<div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  {/* Header */}
  <div className="flex flex-col gap-4 p-6 text-white border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 md:flex-row md:items-center md:justify-between">

    <div>
      <h2 className="text-2xl font-bold">
        Product Inventory
      </h2>

      <p className="mt-1 text-sm text-slate-300">
        Monitor inventory, stock levels and product availability.
      </p>
    </div>

    <div className="px-5 py-3 text-center rounded-2xl bg-white/10 backdrop-blur">
      <p className="text-xs tracking-widest uppercase text-slate-300">
        Total Products
      </p>

      <h2 className="text-3xl font-bold">
        {filteredProducts.length}
      </h2>
    </div>

  </div>

  <div className="overflow-x-auto">

    <table className="min-w-full">

      <thead className="sticky top-0 bg-slate-100">

        <tr className="text-xs tracking-wider uppercase text-slate-600">

          <th className="px-6 py-4 text-left">
            Product
          </th>

          <th className="px-6 py-4 text-center">
            SKU
          </th>

          <th className="px-6 py-4 text-center">
            Category
          </th>

          <th className="px-6 py-4 text-center">
            Price
          </th>

          <th className="px-6 py-4 text-center">
            Stock
          </th>

          <th className="px-6 py-4 text-center">
            Status
          </th>

          <th className="px-6 py-4 text-center">
            Actions
          </th>

        </tr>

      </thead>

      <tbody>

        {!loading && filteredProducts.length === 0 && (

          <tr>

            <td colSpan="7" className="py-20">

              <div className="flex flex-col items-center">

                <Package
                  size={70}
                  className="mb-4 text-slate-300"
                />

                <h2 className="text-xl font-bold text-slate-700">
                  No Products Found
                </h2>

                <p className="mt-2 text-slate-500">
                  Add your first inventory item to get started.
                </p>

              </div>

            </td>

          </tr>

        )}

        {filteredProducts.map((p) => (

          <tr
            key={p._id}
            className="transition-all duration-300 border-b hover:bg-indigo-50"
          >

            {/* Product */}

            <td className="px-6 py-5">

              <div className="flex items-center gap-4">

                <div className="flex items-center justify-center text-white shadow-lg h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600">

                  <Package size={24} />

                </div>

                <div>

                  <h3 className="font-semibold text-slate-900">
                    {p.name}
                  </h3>

                  <p className="text-xs text-slate-500">
                    Inventory Product
                  </p>

                </div>

              </div>

            </td>

            {/* SKU */}

            <td className="px-6 py-5 text-center">

              <span className="px-3 py-2 font-medium rounded-xl bg-slate-100">
                {p.sku || "—"}
              </span>

            </td>

            {/* Category */}

            <td className="px-6 py-5 text-center">

              <span className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">

                {p.category || "General"}

              </span>

            </td>

            {/* Price */}

            <td className="px-6 py-5 text-center">

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  ₹{Number(p.price).toLocaleString()}
                </h2>

                <span className="text-xs text-slate-400">
                  Unit Price
                </span>

              </div>

            </td>

            {/* Stock */}

            <td className="px-6 py-5">

              <div>

                <div className="flex justify-between mb-2 text-xs">

                  <span className="font-semibold">
                    {p.stock}
                  </span>

                  <span className="text-slate-500">
                    Qty
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                  <div
                    className={`h-full rounded-full ${
                      p.stock <= 5
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        (p.stock / 100) * 100,
                        100
                      )}%`,
                    }}
                  />

                </div>

              </div>

            </td>

            {/* Status */}

            <td className="px-6 py-5 text-center">

              <span
                className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold ${
                  p.status === "Active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {p.status}
              </span>

            </td>

            {/* Actions */}

            <td className="px-6 py-5">

              <div className="flex justify-center gap-3">

                <button
                  onClick={() => {
                    setForm(p);
                    setDrawerOpen(true);
                  }}
                  className="p-3 text-blue-700 transition bg-blue-100 rounded-xl hover:scale-110 hover:bg-blue-200"
                >
                  <Pencil size={18} />
                </button>

                <button
                  onClick={() => deleteProduct(p._id)}
                  className="p-3 text-red-600 transition bg-red-100 rounded-xl hover:scale-110 hover:bg-red-200"
                >
                  <Trash2 size={18} />
                </button>

              </div>

            </td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

</div>

      {/* ================= PREMIUM PRODUCT DRAWER ================= */}
{drawerOpen && (
  <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">

    {/* Drawer */}
    <div className="flex flex-col w-full h-full max-w-xl bg-white shadow-2xl">

      {/* Header */}
      <div className="px-8 py-6 text-white bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold">
              {form._id ? "Edit Product" : "Create Product"}
            </h2>

            <p className="mt-1 text-sm text-slate-300">
              Manage your inventory product details.
            </p>

          </div>

          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 transition rounded-xl bg-white/10 hover:bg-white/20"
          >
            <X size={22} />
          </button>

        </div>

      </div>

      {/* Form */}
      <form
        onSubmit={saveProduct}
        className="flex-1 p-8 space-y-6 overflow-y-auto"
      >

        {/* General */}
        <div>

          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            General Information
          </h3>

          <div className="space-y-5">

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-600">
                Product Name
              </label>

              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="Enter Product Name"
                className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-600">
                SKU
              </label>

              <input
                value={form.sku}
                onChange={(e) =>
                  setForm({ ...form, sku: e.target.value })
                }
                placeholder="SKU Number"
                className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-600">
                Category
              </label>

              <input
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                placeholder="Category"
                className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

          </div>

        </div>

        {/* Pricing */}
        <div>

          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            Pricing & Inventory
          </h3>

          <div className="grid grid-cols-2 gap-5">

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-600">
                Price
              </label>

              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                placeholder="₹ 0"
                className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-600">
                Stock Quantity
              </label>

              <input
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value })
                }
                placeholder="0"
                className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

          </div>

        </div>

        {/* Status */}
        <div>

          <label className="block mb-2 text-sm font-medium text-slate-600">
            Product Status
          </label>

          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value })
            }
            className="w-full px-4 py-3 transition border rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

        </div>

        {/* Description */}
        <div>

          <label className="block mb-2 text-sm font-medium text-slate-600">
            Description
          </label>

          <textarea
            rows={5}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder="Write product description..."
            className="w-full px-4 py-3 transition border resize-none rounded-xl border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          />

        </div>

        {/* Footer Buttons */}
        <div className="flex gap-4 pt-4">

          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              setForm(emptyForm);
            }}
            className="flex-1 py-3 font-semibold transition border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02]"
          >
            {form._id ? "Update Product" : "Save Product"}
          </button>

        </div>

      </form>

    </div>

  </div>
)}

    </div>
  );
}


/* ================= KPI CARD ================= */
function Kpi({
  title,
  value,
  
  icon: Icon,
  subtitle,
  color = "blue",
}) {
  const styles = {
    blue: {
      bg: "from-blue-500 to-indigo-600",
      badge: "bg-blue-100 text-blue-700",
      progress: "bg-blue-500",
    },
    green: {
      bg: "from-emerald-500 to-green-600",
      badge: "bg-emerald-100 text-emerald-700",
      progress: "bg-emerald-500",
    },
    red: {
      bg: "from-red-500 to-rose-600",
      badge: "bg-red-100 text-red-700",
      progress: "bg-red-500",
    },
    purple: {
      bg: "from-purple-500 to-violet-600",
      badge: "bg-purple-100 text-purple-700",
      progress: "bg-purple-500",
    },
  };

  const s = styles[color];

  return (
    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-md group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl">

      {/* Background Effect */}
      <div className="absolute inset-0 transition duration-300 opacity-0 bg-gradient-to-br from-slate-50 via-white to-slate-100 group-hover:opacity-100"></div>

      <div className="relative flex items-start justify-between">

        <div className="flex-1">

          <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            {title}
          </p>

          <h2 className="mt-3 text-4xl font-bold text-slate-900">
            {value}
          </h2>

          <span
            className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${s.badge}`}
          >
            {subtitle}
          </span>

        </div>

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${s.bg} text-white shadow-lg transition duration-300 group-hover:scale-110`}
        >
          <Icon size={30} />
        </div>

      </div>

      <div className="mt-6">

        <div className="flex items-center justify-between mb-2 text-xs">

          <span className="text-slate-400">
            Inventory Status
          </span>

          <span className="font-semibold text-slate-700">
            Live
          </span>

        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">

          <div
            className={`h-full rounded-full ${s.progress}`}
            style={{ width: "90%" }}
          ></div>

        </div>

      </div>

    </div>
  );
}

