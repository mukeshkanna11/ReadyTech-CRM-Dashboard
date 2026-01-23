import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2, Search, RefreshCcw } from "lucide-react";
import API from "../../services/api";
import toast from "react-hot-toast";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  /* ================= FETCH PRODUCTS (SAFE) ================= */
  const fetchProducts = async () => {
    try {
      setLoading(true);

      const res = await API.get("/products");

      // ✅ NORMALIZE RESPONSE
      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      setProducts(list);
    } catch (err) {
      console.error("Fetch products error:", err);

      if (err.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else {
        toast.error("Failed to fetch products");
      }

      setProducts([]);
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
      await API.post("/products", { name: name.trim() });
      toast.success("Product added");
      setName("");
      fetchProducts();
    } catch (err) {
      console.error("Add product error:", err);
      toast.error(err.response?.data?.message || "Failed to add product");
    }
  };

  /* ================= DELETE PRODUCT ================= */
  const deleteProduct = async (id) => {
    if (!window.confirm("Delete this product?")) return;

    try {
      await API.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      console.error("Delete product error:", err);
      toast.error("Failed to delete product");
    }
  };

  /* ================= SEARCH ================= */
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  /* ================= KPI ================= */
  const totalProducts = products.length;

  const lastAdded =
    products.length > 0 && products[products.length - 1]?.createdAt
      ? new Date(products[products.length - 1].createdAt).toLocaleDateString()
      : "-";

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">
            Manage inventory products
          </p>
        </div>

        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Total Products"
          value={totalProducts}
          icon={Package}
          color="indigo"
        />
        <StatCard
          title="Last Added"
          value={lastAdded}
          icon={Plus}
          color="emerald"
        />
      </div>

      {/* ADD + SEARCH */}
      <div className="flex flex-wrap gap-3 p-4 bg-white border rounded-xl">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="flex-1 px-4 py-2 border rounded-lg"
        />

        <button
          onClick={addProduct}
          className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg"
        >
          <Plus size={16} />
          Add
        </button>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full py-2 pr-3 border rounded-lg pl-9"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl">
        {loading ? (
          <LoadingState />
        ) : filteredProducts.length === 0 ? (
          <EmptyState text="No products found" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>Name</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p._id} className="border-t">
                  <Td>{p.name}</Td>
                  <Td>
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString()
                      : "-"}
                  </Td>
                  <Td>
                    <button
                      onClick={() => deleteProduct(p._id)}
                      className="text-red-500"
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

/* ================= SHARED COMPONENTS ================= */

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };

  return (
    <div className="flex gap-4 p-4 bg-white border rounded-xl">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

const Th = ({ children }) => (
  <th className="p-3 text-left text-slate-600">{children}</th>
);

const Td = ({ children }) => <td className="p-3">{children}</td>;

const LoadingState = () => (
  <div className="p-6 text-center text-slate-500">Loading...</div>
);

const EmptyState = ({ text }) => (
  <div className="p-6 text-center text-slate-500">{text}</div>
);
