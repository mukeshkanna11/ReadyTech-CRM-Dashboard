import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { SlidersHorizontal, Plus, Minus, Save, RefreshCcw } from "lucide-react";
import API from "../../services/api";

const asList = (d, keys) => {
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
  return Array.isArray(d) ? d : [];
};

export default function StockAdjustment() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  const [product, setProduct] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [direction, setDirection] = useState("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const loadRefs = async () => {
    try {
      const [p, w, s] = await Promise.all([
        API.get("/products"),
        API.get("/warehouses"),
        API.get("/inventory/summary"),
      ]);
      setProducts(asList(p.data, ["data"]));
      setWarehouses(asList(w.data, ["warehouses", "data"]));
      setSummary(asList(s.data, ["data"]));
    } catch {
      toast.error("Failed to load products / warehouses");
    }
  };

  useEffect(() => {
    loadRefs();
  }, []);

  const available = useMemo(() => {
    if (!product || !warehouse) return null;
    const row = summary.find(
      (s) => s.product?._id === product && s.warehouse?._id === warehouse
    );
    return row ? row.available ?? 0 : 0;
  }, [product, warehouse, summary]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!product || !warehouse) return toast.error("Select product and warehouse");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    if (!reason.trim()) return toast.error("A reason is required");

    const delta = direction === "increase" ? qty : -qty;
    if (delta < 0 && available !== null && qty > available)
      return toast.error(`Cannot decrease more than available (${available})`);

    try {
      setLoading(true);
      await API.post("/inventory/adjust", { product, warehouse, delta, reason: reason.trim() });
      toast.success("Stock adjusted successfully");
      setQuantity("");
      setReason("");
      loadRefs();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Adjustment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-900 p-8 text-white shadow-2xl">
        <div className="absolute rounded-full -top-20 -right-20 h-72 w-72 bg-indigo-500/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid text-white shadow-lg h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 place-items-center">
            <SlidersHorizontal size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-medium border rounded-full border-white/10 bg-white/10 backdrop-blur">
              ERP Inventory Module
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Adjustment</h1>
            <p className="mt-2 text-slate-300">
              Correct stock levels with a fully audited, transaction-safe adjustment.
            </p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="max-w-2xl p-6 space-y-5 bg-white border shadow-sm rounded-3xl border-slate-200">
        <Field label="Product">
          <select className={INPUT} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Select product…</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>{p.name} {p.sku ? `(${p.sku})` : ""}</option>
            ))}
          </select>
        </Field>

        <Field label="Warehouse">
          <select className={INPUT} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            <option value="">Select warehouse…</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>
        </Field>

        {available !== null && (
          <div className="px-4 py-2 text-sm font-medium text-indigo-700 rounded-xl bg-indigo-50">
            Current available: {available} units
          </div>
        )}

        <Field label="Adjustment">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDirection("increase")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                direction === "increase"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Plus size={16} /> Increase
            </button>
            <button
              type="button"
              onClick={() => setDirection("decrease")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                direction === "decrease"
                  ? "border-red-600 bg-red-600 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Minus size={16} /> Decrease
            </button>
          </div>
        </Field>

        <Field label="Quantity">
          <input type="number" min="1" className={INPUT} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 10" />
        </Field>

        <Field label="Reason">
          <textarea rows={3} className={`${INPUT} resize-none`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged goods, cycle count correction…" />
        </Field>

        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={16} /> {loading ? "Saving…" : "Apply Adjustment"}
          </button>
          <button onClick={loadRefs} className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
