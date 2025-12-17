import React, { useEffect, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: "", price: "" });

  const fetch = async () => {
    try {
      const { data } = await API.get("/products");
      setProducts(data);
    } catch (err) {
      toast.error("Failed to load products");
    }
  };

  useEffect(() => { fetch(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await API.post("/products", { ...form, price: Number(form.price) });
      toast.success("Product created");
      setForm({ name: "", price: "" });
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Create failed");
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Products</h2>

      <form onSubmit={create} className="grid grid-cols-1 gap-2 mb-4 md:grid-cols-3">
        <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Name" className="p-2 border rounded"/>
        <input value={form.price} onChange={(e)=>setForm({...form, price:e.target.value})} placeholder="Price" className="p-2 border rounded"/>
        <button className="px-4 py-2 text-white bg-green-600 rounded">Create</button>
      </form>

      <div className="space-y-2">
        {products.map(p => (
          <div key={p._id} className="flex items-center justify-between p-3 bg-white rounded shadow">
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-slate-500">₹{p.price}</div>
            </div>
            <div className="text-sm text-slate-400">{p.sku || "-"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
