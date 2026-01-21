import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2, Edit, Search, RefreshCcw } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  /* ================= FETCH PRODUCTS ================= */
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await API.get("/products");
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  /* ================= ADD PRODUCT ================= */
  const addProduct = async () => {
    if (!name.trim()) return toast.error("Enter product name");
    try {
      await API.post("/inventory/products", { name: name.trim() });
      toast.success("Product added successfully");
      setName("");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add product");
    }
  };

  /* ================= DELETE PRODUCT ================= */
  const deleteProduct = async (id) => {
    if (!confirm("Are you sure to delete this product?")) return;
    try {
      await API.delete(`/inventory/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product");
    }
  };

  /* ================= SEARCH FILTER ================= */
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  /* ================= KPI ================= */
  const totalProducts = products.length;
  const lastAdded = products.length
    ? new Date(products[products.length - 1].createdAt).toLocaleDateString()
    : "-";

  /* ======================================================
     UI
  ====================================================== */
  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Products
          </h1>
          <p className="text-sm text-slate-500">
            Manage all products in your inventory system
          </p>
        </div>

        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Products" value={totalProducts} icon={Package} color="indigo" />
        <StatCard title="Last Added" value={lastAdded} icon={Plus} color="emerald" />
      </div>

      {/* ================= ADD + SEARCH ================= */}
      <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-xl dark:bg-slate-900 dark:border-slate-800">
        <input
          type="text"
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-4 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700"
        />
        <button
          onClick={addProduct}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add Product
        </button>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-2 pr-3 text-sm border rounded-lg pl-9 focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700"
          />
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <div className="bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
        {loading ? (
          <LoadingState />
        ) : filteredProducts.length === 0 ? (
          <EmptyState text="No products found." />
        ) : (
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
                {filteredProducts.map((p) => (
                  <tr key={p._id} className="border-t hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                    <Td>{p.name}</Td>
                    <Td className="text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          title="Edit"
                          className="p-1 text-blue-500 rounded hover:bg-blue-50 dark:hover:bg-slate-700"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => deleteProduct(p._id)}
                          className="p-1 text-red-500 rounded hover:bg-red-50 dark:hover:bg-slate-700"
                        >
                          <Trash2 size={16} />
                        </button>
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
  const colors = {
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white border shadow rounded-xl dark:bg-slate-900 dark:border-slate-800">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="p-3 font-semibold text-left text-slate-600 dark:text-slate-300">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}

function LoadingState() {
  return <div className="p-6 text-center text-slate-500">Loading products...</div>;
}

function EmptyState({ text }) {
  return <div className="p-6 text-center text-slate-500">{text}</div>;
}
