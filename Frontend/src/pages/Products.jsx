import React, { useEffect, useMemo, useState } from "react";
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

  /* ============================
     FETCH PRODUCTS (SAFE)
  ============================ */
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await API.get("/products");

      // ✅ ALWAYS normalize response
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      setProducts(list);
    } catch (err) {
      console.error("PRODUCT FETCH ERROR:", err);

      if (err.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else {
        toast.error("Failed to load products");
      }

      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  /* ============================
     SAVE PRODUCT
  ============================ */
  const saveProduct = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        tax: Number(form.tax),
        stock: Number(form.stock),
      };

      if (form._id) {
        await API.put(`/products/${form._id}`, payload);
        toast.success("Product updated");
      } else {
        await API.post("/products", payload);
        toast.success("Product created");
      }

      setDrawerOpen(false);
      setForm(emptyForm);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  /* ============================
     DELETE PRODUCT
  ============================ */
  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product?")) return;

    try {
      await API.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ============================
     FILTER
  ============================ */
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      `${p.name} ${p.sku} ${p.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [products, search]);

  /* ============================
     UI
  ============================ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-slate-500">
            Manage product catalog, pricing & inventory
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchProducts}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl bg-slate-900"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU or category"
          className="w-full py-2 pl-10 pr-3 text-sm border rounded-xl"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
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
            {loading && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && filteredProducts.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-slate-500">
                  No products found
                </td>
              </tr>
            )}

            {filteredProducts.map((p) => (
              <tr key={p._id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    <Package size={14} /> {p.name}
                  </div>
                  <div className="max-w-xs text-xs truncate text-slate-500">
                    {p.description}
                  </div>
                </td>
                <td className="px-4 py-3">{p.sku || "—"}</td>
                <td className="px-4 py-3">{p.category || "—"}</td>
                <td className="px-4 py-3">₹{p.price}</td>
                <td className="px-4 py-3">{p.stock ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded">
                    {p.status}
                  </span>
                </td>
                <td className="flex gap-2 px-4 py-3">
                  <button onClick={() => { setForm(p); setDrawerOpen(true); }}>
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

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form
            onSubmit={saveProduct}
            className="w-full max-w-md p-6 space-y-3 bg-white"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {form._id ? "Edit Product" : "New Product"}
              </h2>
              <X
                onClick={() => setDrawerOpen(false)}
                className="cursor-pointer"
              />
            </div>

            {Object.keys(emptyForm).map((key) =>
              key !== "description" ? (
                <input
                  key={key}
                  value={form[key]}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.value })
                  }
                  placeholder={key.toUpperCase()}
                  className="w-full p-2 border rounded"
                />
              ) : (
                <textarea
                  key={key}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Description"
                  className="w-full p-2 border rounded"
                />
              )
            )}

            <button className="w-full py-2 text-white rounded bg-slate-900">
              Save Product
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
