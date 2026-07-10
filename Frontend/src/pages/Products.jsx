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
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            CRM Products
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Manage product catalog, pricing, and stock visibility across
            ReadyTech CRM & ERP modules.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchProducts}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border shadow-sm rounded-xl"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2 text-sm text-white shadow rounded-xl bg-slate-900"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* ================= KPI ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Total Products" value={totalProducts} icon={Package} />
        <Kpi title="Active Products" value={activeProducts} icon={Layers} />
        <Kpi
          title="Low Stock Alerts"
          value={lowStock.length}
          icon={AlertTriangle}
          danger
        />
        <Kpi
          title="Inventory Value"
          value={`₹${inventoryValue.toLocaleString()}`}
          icon={IndianRupee}
        />
      </div>

      {/* ================= CATEGORY INSIGHTS ================= */}
      <div className="p-6 bg-white border shadow-sm rounded-2xl">
        <h2 className="flex items-center gap-2 mb-4 font-semibold">
          <Boxes size={18} /> Category Distribution
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(categorySummary).length === 0 && (
            <p className="text-sm text-slate-500">
              No categories available yet.
            </p>
          )}

          {Object.entries(categorySummary).map(([cat, count]) => (
            <div
              key={cat}
              className="flex items-center justify-between p-4 border rounded-xl bg-slate-50"
            >
              <span className="text-sm font-medium">{cat}</span>
              <span className="text-sm text-slate-600">{count} items</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================= SEARCH ================= */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, SKU, category..."
          className="w-full py-2.5 pl-10 pr-3 text-sm bg-white border shadow-sm rounded-xl"
        />
      </div>

      {/* ================= TABLE ================= */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {!loading && filteredProducts.length === 0 && (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-500">
                  <Package className="mx-auto mb-2 opacity-40" />
                  No products found
                </td>
              </tr>
            )}

            {filteredProducts.map((p) => (
              <tr key={p._id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">{p.sku || "—"}</td>
                <td className="px-4 py-3">{p.category || "—"}</td>
                <td className="px-4 py-3">₹{p.price}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      p.stock <= 5
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      p.status === "Active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="flex gap-3 px-4 py-3">
                  <button
                    onClick={() => {
                      setForm(p);
                      setDrawerOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteProduct(p._id)}>
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= DRAWER ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur">
          <form
            onSubmit={saveProduct}
            className="w-full max-w-md p-6 space-y-3 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {form._id ? "Edit Product" : "Create Product"}
              </h2>
              <X onClick={() => setDrawerOpen(false)} />
            </div>

            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Product Name"
              className="w-full p-2 border rounded"
            />

            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="SKU"
              className="w-full p-2 border rounded"
            />

            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category"
              className="w-full p-2 border rounded"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: e.target.value })
                }
                placeholder="Price"
                className="p-2 border rounded"
              />
              <input
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: e.target.value })
                }
                placeholder="Stock Qty"
                className="p-2 border rounded"
              />
            </div>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value })
              }
              className="w-full p-2 border rounded"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Product description"
              className="w-full p-2 border rounded"
            />

            <button className="w-full py-2 text-white rounded bg-slate-900">
              Save Product
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ================= KPI CARD ================= */
function Kpi({ title, value, icon: Icon, danger }) {
  return (
    <div className="relative p-5 overflow-hidden bg-white border shadow-sm rounded-2xl">
      <div className="flex items-center gap-3">
        <Icon
          size={22}
          className={danger ? "text-red-600" : "text-slate-700"}
        />
        <div>
          <p className="text-xs text-slate-500">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
      <TrendingUp className="absolute opacity-5 -bottom-4 -right-4" size={64} />
    </div>
  );
}
