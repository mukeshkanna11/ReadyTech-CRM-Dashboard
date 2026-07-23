import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
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
  Building2,
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
    stockQuantity: "",
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
      {/* ================= ENTERPRISE CRM PRODUCTS HEADER ================= */}
<div className="space-y-6">

  {/* Main Header */}
  <div className="relative p-6 overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

    {/* Background Effects */}
    <div className="absolute rounded-full -right-24 -top-24 h-72 w-72 bg-indigo-500/10 blur-3xl" />
    <div className="absolute bottom-0 rounded-full -left-24 h-52 w-52 bg-blue-500/10 blur-3xl" />


    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">


      {/* Left Content */}
      <div className="space-y-4">

        <div className="flex items-center gap-3">

          <div className="flex items-center justify-center w-12 h-12 shadow-lg rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 shadow-indigo-500/20">
            <Package size={24} className="text-white" />
          </div>


          <div>

            <div className="flex items-center gap-2">

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                CRM Products
              </h1>


              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-600">
                Active
              </span>

            </div>


            <div className="flex items-center gap-2 mt-1">

              <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500" />

              <p className="text-xs font-medium text-slate-500">
                ReadyTech CRM & ERP Product Management Module
              </p>

            </div>

          </div>

        </div>



        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">

          Manage complete product lifecycle including product catalog,
          pricing, inventory visibility, and business operations across
          ReadyTech Solutions CRM & ERP ecosystem.

        </p>



        {/* Product Module Highlights */}
        <div className="flex flex-wrap gap-3 pt-2">

          {[
            "Product Catalog",
            "Inventory Control",
            "Pricing Management",
            "CRM Integration",
            "ERP Workflow",
          ].map((item) => (

            <div
              key={item}
              className="px-4 py-2 text-xs font-semibold border rounded-xl border-slate-200 bg-slate-50 text-slate-700"
            >
              {item}
            </div>

          ))}

        </div>


      </div>




      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">


        <button
          onClick={fetchProducts}
          className="
            group
            flex
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-5
            py-2.5
            text-sm
            font-medium
            text-slate-700
            shadow-sm
            transition-all
            hover:border-indigo-300
            hover:bg-indigo-50
            hover:text-indigo-700
          "
        >

          <RefreshCw
            size={16}
            className="transition-transform duration-500 group-hover:rotate-180"
          />

          Refresh Products

        </button>



        <button
          onClick={() => {
            setForm(emptyForm);
            setDrawerOpen(true);
          }}
          className="
            flex
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-gradient-to-r
            from-slate-900
            via-indigo-900
            to-blue-900
            px-6
            py-2.5
            text-sm
            font-semibold
            text-white
            shadow-lg
            shadow-indigo-500/20
            transition-all
            hover:-translate-y-0.5
            hover:shadow-xl
          "
        >

          <Plus size={17} />

          Add New Product

        </button>


      </div>


    </div>

  </div>




  {/* About ReadyTech CRM Section */}
  <div className="p-6 border border-indigo-100 shadow-sm rounded-3xl bg-gradient-to-r from-indigo-50 via-white to-blue-50">


    <div className="flex flex-col gap-4 md:flex-row">


      <div className="flex items-center justify-center w-12 h-12 bg-indigo-600 shadow-lg shrink-0 rounded-2xl">
        <Building2 size={23} className="text-white" />
      </div>



      <div className="space-y-2">


        <h3 className="text-lg font-bold text-slate-900">
          About ReadyTech Solutions CRM Platform
        </h3>



        <p className="text-sm leading-relaxed text-slate-600">

          ReadyTech Solutions delivers modern CRM and ERP solutions designed
          to simplify business operations, customer management, inventory
          tracking, and enterprise workflows through a unified digital platform.

        </p>



        <p className="text-sm leading-relaxed text-slate-600">

          The Products module enables organizations to maintain accurate
          product information, monitor stock availability, manage pricing,
          and improve operational efficiency with real-time business insights.

        </p>



        <div className="flex flex-wrap gap-2 pt-2">

          {[
            "Enterprise CRM",
            "ERP Solutions",
            "Smart Inventory",
            "Business Automation",
            "Scalable Architecture",
          ].map((item) => (

            <span
              key={item}
              className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-white border border-indigo-100 rounded-full shadow-sm "
            >
              {item}
            </span>

          ))}

        </div>


      </div>


    </div>


  </div>


</div>



      
      {/* ================= ENTERPRISE KPI CARDS ================= */}
<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

  <Kpi
    title="Total Products"
    value={totalProducts}
    icon={Package}
    subtitle="Product catalog"
    trend="+12% this month"
    gradient="from-indigo-500 to-blue-600"
  />


  <Kpi
    title="Active Products"
    value={activeProducts}
    icon={Layers}
    subtitle="Currently available"
    trend="Healthy stock"
    gradient="from-emerald-500 to-teal-600"
  />


  <Kpi
    title="Low Stock Alerts"
    value={lowStock.length}
    icon={AlertTriangle}
    subtitle="Requires attention"
    trend="Action needed"
    danger
    gradient="from-rose-500 to-red-600"
  />


  <Kpi
    title="Inventory Value"
    value={`₹${inventoryValue.toLocaleString()}`}
    icon={IndianRupee}
    subtitle="Total asset value"
    trend="Live valuation"
    gradient="from-violet-500 to-purple-600"
  />

</div>

     {/* ================= ENTERPRISE CATEGORY INSIGHTS ================= */}
<div className="relative p-6 overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

  {/* Background Glow */}
  <div className="absolute rounded-full -right-20 -top-20 h-52 w-52 bg-indigo-500/5 blur-3xl" />

  <div className="relative">

    {/* Header */}
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

      <div>

        <div className="flex items-center gap-3">

          <div className="flex items-center justify-center shadow-lg h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600">
            <Boxes size={20} className="text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Product Category Insights
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Analyze product distribution across business categories and
              monitor inventory allocation throughout the ReadyTech CRM &
              ERP ecosystem.
            </p>

          </div>

        </div>

      </div>

      <div className="px-4 py-2 border rounded-xl border-slate-200 bg-slate-50">

        <p className="text-xs text-slate-500">
          Total Categories
        </p>

        <p className="text-xl font-bold text-slate-900">
          {Object.keys(categorySummary).length}
        </p>

      </div>

    </div>



    {/* Categories */}
    <div className="grid gap-4 mt-6 sm:grid-cols-2 xl:grid-cols-4">

      {Object.keys(categorySummary).length === 0 && (

        <div className="py-10 text-center border border-dashed col-span-full rounded-2xl border-slate-300 bg-slate-50">

          <Boxes
            size={42}
            className="mx-auto mb-3 text-slate-300"
          />

          <h3 className="font-semibold text-slate-700">
            No Categories Found
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Product categories will appear here after products are added.
          </p>

        </div>

      )}


      {Object.entries(categorySummary).map(([cat, count]) => {

        const percentage =
          totalProducts > 0
            ? Math.round((count / totalProducts) * 100)
            : 0;

        return (

          <div
            key={cat}
            className="p-5 transition-all duration-300 border group rounded-2xl border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:-translate-y-1 hover:shadow-lg"
          >

            <div className="flex items-center justify-between">

              <div>

                <span className="inline-flex px-3 py-1 text-xs font-semibold text-indigo-700 rounded-full bg-indigo-50">
                  {cat}
                </span>

                <h3 className="mt-4 text-2xl font-bold text-slate-900">
                  {count}
                </h3>

                <p className="text-sm text-slate-500">
                  Products Available
                </p>

              </div>


              <div className="flex items-center justify-center w-12 h-12 shadow-md rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600">

                <Boxes
                  size={20}
                  className="text-white"
                />

              </div>

            </div>



            {/* Progress */}
            <div className="mt-5">

              <div className="flex items-center justify-between mb-2 text-xs text-slate-500">

                <span>Category Share</span>

                <span>{percentage}%</span>

              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                <div
                  className="h-full transition-all duration-700 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600"
                  style={{
                    width: `${percentage}%`,
                  }}
                />

              </div>

            </div>

          </div>

        );

      })}

    </div>

  </div>

</div>

      {/* ================= ENTERPRISE SEARCH ================= */}
<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

  {/* Search Box */}
  <div className="relative w-full max-w-xl">

    <Search
      size={18}
      className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400"
    />

    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search by Product Name, SKU, Category, Brand..."
      className="w-full py-3 pl-12 pr-12 text-sm transition-all duration-300 bg-white border shadow-sm outline-none rounded-2xl border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
    />

    {/* Clear Search */}
    {search && (
      <button
        onClick={() => setSearch("")}
        className="
          absolute
          right-3
          top-1/2
          -translate-y-1/2
          rounded-lg
          p-1.5
          text-slate-400
          transition
          hover:bg-slate-100
          hover:text-slate-700
        "
      >
        <X size={16} />
      </button>
    )}

  </div>

  {/* Search Info */}
  <div className="flex flex-wrap items-center gap-3">

    <div className="px-4 py-2 bg-white border shadow-sm rounded-xl border-slate-200">
      <p className="text-xs text-slate-500">
        Total Products
      </p>

      <p className="text-lg font-bold text-slate-900">
        {filteredProducts.length}
      </p>
    </div>

    <div className="px-4 py-2 border rounded-xl border-emerald-100 bg-emerald-50">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500" />
        <span className="text-xs font-semibold text-emerald-700">
          Live Search Enabled
        </span>
      </div>
    </div>

  </div>

</div>

      {/* ================= ENTERPRISE PRODUCTS TABLE ================= */}
<div className="overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

  {/* Table Header */}
  <div className="flex flex-col gap-4 p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white md:flex-row md:items-center md:justify-between">

    <div>

      <h2 className="text-xl font-bold text-slate-900">
        Product Inventory
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        View, manage, and update product inventory across the ReadyTech CRM &
        ERP platform.
      </p>

    </div>

    <div className="flex items-center gap-3">

      <div className="px-4 py-2 bg-white border rounded-xl border-slate-200">

        <p className="text-xs text-slate-500">
          Total Records
        </p>

        <p className="text-lg font-bold text-slate-900">
          {filteredProducts.length}
        </p>

      </div>

    </div>

  </div>

  {/* Responsive Table */}
  <div className="overflow-x-auto">

    <table className="min-w-full">

      <thead className="sticky top-0 bg-slate-100">

        <tr className="text-xs font-semibold tracking-wider uppercase text-slate-600">

          <th className="px-6 py-4 text-left">
            Product
          </th>

          <th className="px-6 py-4 text-left">
            SKU
          </th>

          <th className="px-6 py-4 text-left">
            Category
          </th>

          <th className="px-6 py-4 text-right">
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

            <td
              colSpan={7}
              className="py-16 text-center"
            >

              <Package
                size={50}
                className="mx-auto mb-3 text-slate-300"
              />

              <h3 className="text-lg font-semibold text-slate-700">
                No Products Found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Add your first product to begin managing inventory.
              </p>

            </td>

          </tr>

        )}

        {filteredProducts.map((p) => (

          <tr
            key={p._id}
            className="transition border-t hover:bg-indigo-50/40"
          >

            {/* Product */}
            <td className="px-6 py-4">

              <div className="flex items-center gap-3">

                <div className="flex items-center justify-center font-semibold text-white shadow h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600">

                  {p.name?.charAt(0).toUpperCase()}

                </div>

                <div>

                  <p className="font-semibold text-slate-900">
                    {p.name}
                  </p>

                  <p className="text-xs text-slate-500">
                    ReadyTech Product
                  </p>

                </div>

              </div>

            </td>

            {/* SKU */}
            <td className="px-6 py-4 font-medium text-slate-600">
              {p.sku || "—"}
            </td>

            {/* Category */}
            <td className="px-6 py-4">

              <span className="px-3 py-1 text-xs font-semibold text-indigo-700 rounded-full bg-indigo-50">

                {p.category || "General"}

              </span>

            </td>

            {/* Price */}
            <td className="px-6 py-4 font-semibold text-right text-slate-900">
              ₹{Number(p.price).toLocaleString()}
            </td>

            {/* Stock */}
<td className="px-6 py-4 text-center">
  <span
    className={`rounded-full px-3 py-1 text-xs font-semibold ${
      p.stockQuantity <= 5
        ? "bg-red-100 text-red-700"
        : "bg-emerald-100 text-emerald-700"
    }`}
  >
    {p.stockQuantity} Units
  </span>
</td>

            {/* Status */}
            <td className="px-6 py-4 text-center">

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  p.status === "Active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {p.status}
              </span>

            </td>

            {/* Actions */}
            <td className="px-6 py-4">

              <div className="flex justify-center gap-2">

                <button
                  onClick={() => {
                    setForm(p);
                    setDrawerOpen(true);
                  }}
                  className="p-2 transition bg-white border rounded-xl border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <Pencil size={16} />
                </button>

                <button
                  onClick={() => deleteProduct(p._id)}
                  className="p-2 text-red-600 transition border border-red-200 rounded-xl bg-red-50 hover:bg-red-100"
                >
                  <Trash2 size={16} />
                </button>

              </div>

            </td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

</div>

      {/* ================= ENTERPRISE PRODUCT DRAWER ================= */}
{drawerOpen && (
  <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">

    <div className="flex flex-col w-full h-full max-w-2xl bg-white shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 text-white border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

        <div>

          <h2 className="text-xl font-bold">
            {form._id ? "Edit Product" : "Create New Product"}
          </h2>

          <p className="mt-1 text-sm text-slate-300">
            ReadyTech CRM & ERP Product Management
          </p>

        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="p-2 transition rounded-xl hover:bg-white/10"
        >
          <X size={22} />
        </button>

      </div>

      {/* Form */}
      <form
        onSubmit={saveProduct}
        className="flex-1 p-6 space-y-6 overflow-y-auto"
      >

        {/* Product Information */}
        <div>

          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            Product Information
          </h3>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                Product Name *
              </label>

              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Apple iPhone 16"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                SKU
              </label>

              <input
                value={form.sku}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sku: e.target.value,
                  })
                }
                className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="RTS-10001"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                Category
              </label>

              <input
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
                className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Electronics"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }
                className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>

          </div>

        </div>

        {/* Pricing */}
        <div>

          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            Pricing & Inventory
          </h3>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                Selling Price (₹)
              </label>

              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: e.target.value,
                  })
                }
                className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700">
                Stock Quantity
              </label>

              <input
  type="number"
  value={form.stockQuantity}
  onChange={(e) =>
    setForm({
      ...form,
      stockQuantity: e.target.value,
    })
  }
  className="w-full px-4 py-3 text-sm border outline-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
/>
            </div>

          </div>

        </div>

        {/* Description */}
        <div>

          <label className="block mb-2 text-sm font-medium text-slate-700">
            Product Description
          </label>

          <textarea
            rows={5}
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            placeholder="Enter product description..."
            className="w-full px-4 py-3 text-sm border outline-none resize-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 pt-5 bg-white border-t border-slate-200">

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="px-6 py-3 font-medium transition border rounded-xl border-slate-300 hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 px-8 py-3 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            {form._id ? "Update Product" : "Create Product"}
          </button>

        </div>

            </form>

    </div>

  </div>

)}
    </div>
  );
}

const Kpi = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  gradient,
  danger
}) => {

  return (
    <div
      className="relative p-5 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:shadow-xl"
    >

      {/* Glow */}
      <div
        className={`
          absolute
          -right-10
          -top-10
          h-32
          w-32
          rounded-full
          bg-gradient-to-br
          ${gradient}
          opacity-10
          blur-2xl
        `}
      />


      <div className="relative flex items-start justify-between">


        {/* Text */}
        <div>

          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>


          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </h2>


          <p className="mt-2 text-xs text-slate-500">
            {subtitle}
          </p>


          <div
            className={`
              mt-3
              inline-flex
              rounded-full
              px-3
              py-1
              text-xs
              font-semibold
              ${
                danger
                  ? "bg-red-50 text-red-600"
                  : "bg-emerald-50 text-emerald-600"
              }
            `}
          >
            {trend}
          </div>

        </div>



        {/* Icon */}
        <div
          className={`
            flex
            h-12
            w-12
            items-center
            justify-center
            rounded-2xl
            bg-gradient-to-br
            ${gradient}
            shadow-lg
            transition-transform
            duration-300
            group-hover:scale-110
          `}
        >
          <Icon size={23} className="text-white" />
        </div>


      </div>


    </div>
  );
};
