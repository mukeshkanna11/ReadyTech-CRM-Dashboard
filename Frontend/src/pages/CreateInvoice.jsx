import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import { toast } from "react-hot-toast";

export default function CreateInvoice() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: `INV-${Date.now()}`,
    customer: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    items: [{ product: "", name: "", quantity: 1, price: 0 }],
    tax: 0,
    discount: 0,
    notes: "",
  });

  /* ================= FETCH ================= */

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  const safeArray = (res) => {
    if (Array.isArray(res.data)) return res.data;
    return res.data?.data || [];
  };

  const fetchCustomers = async () => {
    try {
      const res = await API.get("/clients");
      setCustomers(safeArray(res));
    } catch {
      setCustomers([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get("/products");
      setProducts(safeArray(res));
    } catch {
      setProducts([]);
    }
  };

  /* ================= ITEM HANDLERS ================= */

  const handleItemChange = (index, field, value) => {
    const updated = [...invoiceData.items];
    updated[index][field] = value;

    if (field === "product") {
      const selected = products.find((p) => p._id === value);
      if (selected) {
        updated[index].price = selected.price;
        updated[index].name = selected.name;
      }
    }

    setInvoiceData({ ...invoiceData, items: updated });
  };

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { product: "", name: "", quantity: 1, price: 0 }],
    });
  };

  const removeItem = (index) => {
    const updated = invoiceData.items.filter((_, i) => i !== index);
    setInvoiceData({ ...invoiceData, items: updated });
  };

  /* ================= CALCULATIONS ================= */

  const subtotal = useMemo(() => {
    return invoiceData.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
  }, [invoiceData.items]);

  const taxAmount = useMemo(() => {
    return (subtotal * invoiceData.tax) / 100;
  }, [subtotal, invoiceData.tax]);

  const grandTotal = useMemo(() => {
    return subtotal + taxAmount - invoiceData.discount;
  }, [subtotal, taxAmount, invoiceData.discount]);

  /* ================= CREATE ================= */

  const createInvoice = async () => {
    if (!invoiceData.customer) {
      return toast.error("Please select a customer");
    }

    try {
      setLoading(true);

      await API.post("/invoices", {
        ...invoiceData,
        subtotal,
        taxAmount,
        totalAmount: grandTotal,
      });

      toast.success("Invoice Created Successfully");

      setInvoiceData({
        invoiceNumber: `INV-${Date.now()}`,
        customer: "",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        items: [{ product: "", name: "", quantity: 1, price: 0 }],
        tax: 0,
        discount: 0,
        notes: "",
      });

    } catch (err) {
      toast.error("Invoice creation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-100 to-slate-200">

      <div className="grid grid-cols-3 gap-6 mx-auto max-w-7xl">

        {/* ================= LEFT SECTION ================= */}
        <div className="col-span-2 p-6 space-y-6 bg-white shadow-lg rounded-2xl">

          {/* HEADER */}
          <div className="flex justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-800">
                New Invoice
              </h2>
              <p className="text-sm text-slate-500">
                Create invoice quickly & professionally
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Invoice #</p>
              <p className="font-medium">{invoiceData.invoiceNumber}</p>
            </div>
          </div>

          {/* CUSTOMER & DATES */}
          <div className="grid grid-cols-3 gap-4">
            <select
              value={invoiceData.customer}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, customer: e.target.value })
              }
              className="p-2 text-sm border rounded-lg"
            >
              <option value="">Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={invoiceData.issueDate}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, issueDate: e.target.value })
              }
              className="p-2 text-sm border rounded-lg"
            />

            <input
              type="date"
              value={invoiceData.dueDate}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, dueDate: e.target.value })
              }
              className="p-2 text-sm border rounded-lg"
            />
          </div>

          {/* ITEMS */}
          <div className="space-y-3">
            {invoiceData.items.map((item, index) => (
              <div
                key={index}
                className="grid items-center grid-cols-5 gap-3 p-3 border rounded-lg bg-slate-50"
              >
                <select
                  value={item.product}
                  onChange={(e) =>
                    handleItemChange(index, "product", e.target.value)
                  }
                  className="p-2 text-sm border rounded-md"
                >
                  <option value="">Product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={item.quantity}
                  min="1"
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                  className="p-2 text-sm text-center border rounded-md"
                />

                <input
                  value={item.price}
                  readOnly
                  className="p-2 text-sm text-center bg-white border rounded-md"
                />

                <div className="text-sm font-medium text-center">
                  ₹ {item.quantity * item.price}
                </div>

                <button
                  onClick={() => removeItem(index)}
                  className="text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addItem}
            className="px-4 py-2 text-sm text-white rounded-lg bg-slate-800"
          >
            + Add Item
          </button>

          {/* NOTES */}
          <textarea
            placeholder="Additional Notes..."
            value={invoiceData.notes}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, notes: e.target.value })
            }
            className="w-full p-3 text-sm border rounded-lg"
          />

          <button
            onClick={createInvoice}
            disabled={loading}
            className="w-full py-3 text-sm font-medium text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-700"
          >
            {loading ? "Creating..." : "Create Invoice"}
          </button>

        </div>

        {/* ================= RIGHT SUMMARY PANEL ================= */}
        <div className="p-6 space-y-6 bg-white shadow-lg rounded-2xl h-fit">

          <h3 className="text-lg font-semibold text-slate-700">
            Invoice Summary
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹ {subtotal}</span>
            </div>

            <div className="flex justify-between">
              <span>Tax ({invoiceData.tax}%)</span>
              <span>₹ {taxAmount}</span>
            </div>

            <div className="flex justify-between">
              <span>Discount</span>
              <span>₹ {invoiceData.discount}</span>
            </div>

            <div className="flex justify-between pt-3 text-base font-semibold border-t">
              <span>Total</span>
              <span>₹ {grandTotal}</span>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="number"
              placeholder="Tax %"
              value={invoiceData.tax}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, tax: Number(e.target.value) })
              }
              className="w-full p-2 text-sm border rounded-lg"
            />

            <input
              type="number"
              placeholder="Discount"
              value={invoiceData.discount}
              onChange={(e) =>
                setInvoiceData({
                  ...invoiceData,
                  discount: Number(e.target.value),
                })
              }
              className="w-full p-2 text-sm border rounded-lg"
            />
          </div>

        </div>

      </div>
    </div>
  );
}
