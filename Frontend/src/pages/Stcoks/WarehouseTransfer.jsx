import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { ArrowLeftRight, Save, RefreshCcw, MoveRight } from "lucide-react";
import API from "../../services/api";

const asList = (d, keys) => {
  for (const k of keys) if (Array.isArray(d?.[k])) return d[k];
  return Array.isArray(d) ? d : [];
};

export default function WarehouseTransfer() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  const [product, setProduct] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
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
    if (!product || !fromWarehouse) return null;
    const row = summary.find(
      (s) => s.product?._id === product && s.warehouse?._id === fromWarehouse
    );
    return row ? row.available ?? 0 : 0;
  }, [product, fromWarehouse, summary]);

  const submit = async () => {
    const qty = Number(quantity);
    if (!product || !fromWarehouse || !toWarehouse) return toast.error("Select product and both warehouses");
    if (fromWarehouse === toWarehouse) return toast.error("Source and destination must differ");
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Enter a valid quantity");
    if (available !== null && qty > available) return toast.error(`Cannot transfer more than available (${available})`);

    try {
      setLoading(true);
      await API.post("/inventory/transfer", {
        product,
        fromWarehouse,
        toWarehouse,
        quantity: qty,
        reason: reason.trim(),
      });
      toast.success("Stock transferred successfully");
      setQuantity("");
      setReason("");
      loadRefs();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Transfer failed");
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
            <ArrowLeftRight size={26} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 text-xs font-medium border rounded-full border-white/10 bg-white/10 backdrop-blur">
              ERP Inventory Module
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouse Transfer</h1>
            <p className="mt-2 text-slate-300">
              Move stock between warehouses atomically — both legs commit together.
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

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="From Warehouse">
            <select className={INPUT} value={fromWarehouse} onChange={(e) => setFromWarehouse(e.target.value)}>
              <option value="">Source…</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>{w.name}</option>
              ))}
            </select>
          </Field>

          <div className="justify-center hidden pb-3 sm:flex text-slate-400">
            <MoveRight size={20} />
          </div>

          <Field label="To Warehouse">
            <select className={INPUT} value={toWarehouse} onChange={(e) => setToWarehouse(e.target.value)}>
              <option value="">Destination…</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id} disabled={w._id === fromWarehouse}>{w.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {available !== null && (
          <div className="px-4 py-2 text-sm font-medium text-indigo-700 rounded-xl bg-indigo-50">
            Available in source: {available} units
          </div>
        )}

        <Field label="Quantity">
          <input type="number" min="1" className={INPUT} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 10" />
        </Field>

        <Field label="Reason / Note (optional)">
          <textarea rows={3} className={`${INPUT} resize-none`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Rebalancing stock for regional demand…" />
        </Field>

        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center justify-center flex-1 gap-2 py-3 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={16} /> {loading ? "Transferring…" : "Transfer Stock"}
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
