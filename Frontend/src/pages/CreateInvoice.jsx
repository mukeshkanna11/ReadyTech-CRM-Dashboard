import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function CreateInvoice() {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [invoice, setInvoice] = useState({
    customer: "",
    invoiceDate: today,
    dueDate: today,
    notes: "Thanks for your business.",
    discountPercent: 0,
    tdsType: "",
    tdsPercent: 0,
    tcsPercent: 0,
    items: [{ product: "", description: "", quantity: 1, rate: 0, taxPercent: 0 }],
  });

  /* ===========================
     TDS OPTIONS
  ============================ */
  const TDS_OPTIONS = [
    { label: "Commission or Brokerage", percent: 2 },
    { label: "Professional Fees", percent: 10 },
    { label: "Dividend", percent: 10 },
    { label: "Rent on land/furniture", percent: 10 },
    { label: "Technical Fees", percent: 2 },
  ];

  /* ===========================
     FETCH CLIENTS & PRODUCTS
  ============================ */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientRes, productRes] = await Promise.all([
          API.get("/clients"),
          API.get("/products"),
        ]);

        // Ensure correct data path
        const clientData = clientRes.data?.data || clientRes.data || [];
        const productData = productRes.data?.data || productRes.data || [];

        setClients(clientData);
        setProducts(productData);
      } catch (err) {
        console.error("Fetch error:", err);
        toast.error("Failed to load clients or products");
      }
    };
    fetchData();
  }, []);

  /* ===========================
     ITEM FUNCTIONS
  ============================ */
  const updateItem = (index, field, value) => {
    const updated = [...invoice.items];
    updated[index][field] = value;

    if (field === "product") {
      const selected = products.find((p) => p._id === value);
      if (selected) {
        updated[index].description = selected.name;
        updated[index].rate = selected.price || 0;
      }
    }
    setInvoice({ ...invoice, items: updated });
  };

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { product: "", description: "", quantity: 1, rate: 0, taxPercent: 0 }],
    });
  };

  const removeItem = (index) => {
    const updated = invoice.items.filter((_, i) => i !== index);
    setInvoice({ ...invoice, items: updated });
  };

  /* ===========================
     CALCULATIONS
  ============================ */
  const calculations = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    invoice.items.forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const taxPercent = Number(item.taxPercent || 0);

      subtotal += quantity * rate;
      taxTotal += (quantity * rate * taxPercent) / 100;
    });

    const discountAmount = (subtotal * Number(invoice.discountPercent || 0)) / 100;
    const afterDiscount = subtotal - discountAmount;

    const tdsAmount = (afterDiscount * Number(invoice.tdsPercent || 0)) / 100;
    const tcsAmount = (afterDiscount * Number(invoice.tcsPercent || 0)) / 100;

    const total = afterDiscount - tdsAmount + tcsAmount + taxTotal;

    return { subtotal, discountAmount, tdsAmount, tcsAmount, taxTotal, total };
  }, [invoice]);

  /* ===========================
     HANDLE SUBMIT
  ============================ */
  const handleSubmit = async () => {
    if (!invoice.customer) return toast.error("Please select a customer");

    try {
      setLoading(true);

      const payload = {
        customer: invoice.customer,
        items: invoice.items.map((i) => ({
          product: i.product,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.rate,
          taxPercent: i.taxPercent,
        })),
        discountPercent: invoice.discountPercent,
        tdsType: invoice.tdsType,
        tdsPercent: invoice.tdsPercent,
        tcsPercent: invoice.tcsPercent,
        notes: invoice.notes,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        subtotal: calculations.subtotal,
        taxTotal: calculations.taxTotal,
        discountAmount: calculations.discountAmount,
        grandTotal: calculations.total,
        currency: "INR",
      };

      await API.post("/invoices", payload);

      toast.success("Invoice Created Successfully 🚀");

      // Reset
      setInvoice({
        customer: "",
        invoiceDate: today,
        dueDate: today,
        notes: "Thanks for your business.",
        discountPercent: 0,
        tdsType: "",
        tdsPercent: 0,
        tcsPercent: 0,
        items: [{ product: "", description: "", quantity: 1, rate: 0, taxPercent: 0 }],
      });
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Invoice creation failed");
    } finally {
      setLoading(false);
    }
  };

  /* ===========================
     RENDER
  ============================ */
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl p-8 mx-auto bg-white shadow-xl rounded-2xl">
        <h1 className="mb-8 text-3xl font-bold">Create New Invoice</h1>

        {/* HEADER */}
        <div className="grid grid-cols-3 gap-6 mb-10">
          <div>
            <label className="text-sm font-medium">Customer</label>
            <select
              className="w-full p-3 mt-2 border rounded-lg"
              value={invoice.customer}
              onChange={(e) => setInvoice({ ...invoice, customer: e.target.value })}
            >
              <option value="">Select Customer</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Invoice Date</label>
            <input
              type="date"
              className="w-full p-3 mt-2 border rounded-lg"
              value={invoice.invoiceDate}
              onChange={(e) => setInvoice({ ...invoice, invoiceDate: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Due Date</label>
            <input
              type="date"
              className="w-full p-3 mt-2 border rounded-lg"
              value={invoice.dueDate}
              onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
            />
          </div>
        </div>

        {/* ITEMS */}
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm border rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Tax %</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">
                    <select
                      className="w-full p-2 border rounded"
                      value={item.product}
                      onChange={(e) => updateItem(index, "product", e.target.value)}
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs">{item.description}</p>
                  </td>

                  <td>
                    <input
                      type="number"
                      className="w-20 p-2 border rounded"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </td>

                  <td>₹ {item.rate}</td>

                  <td>
                    <input
                      type="number"
                      className="w-16 p-1 border rounded"
                      value={item.taxPercent}
                      onChange={(e) => updateItem(index, "taxPercent", e.target.value)}
                    />
                  </td>

                  <td>
                    ₹{" "}
                    {(
                      item.quantity * item.rate +
                      (item.quantity * item.rate * item.taxPercent) / 100
                    ).toFixed(2)}
                  </td>

                  <td>
                    <button onClick={() => removeItem(index)} className="text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addItem} className="px-4 py-2 mt-2 bg-gray-200 rounded-lg">
          + Add Item
        </button>

        {/* SUMMARY */}
        <div className="flex justify-end mt-8">
          <div className="space-y-2 text-right w-96">
            <p>Subtotal: ₹ {calculations.subtotal.toFixed(2)}</p>
            <p>Discount ({invoice.discountPercent}%): - ₹ {calculations.discountAmount.toFixed(2)}</p>
            <p>TDS ({invoice.tdsPercent}%): - ₹ {calculations.tdsAmount.toFixed(2)}</p>
            <p>TCS ({invoice.tcsPercent}%): + ₹ {calculations.tcsAmount.toFixed(2)}</p>
            <p>Tax: ₹ {calculations.taxTotal.toFixed(2)}</p>
            <h2 className="text-xl font-bold">Grand Total: ₹ {calculations.total.toFixed(2)}</h2>
          </div>
        </div>

        {/* TDS SELECTION */}
        <div className="w-64 mt-4">
          <label className="text-sm font-medium">Select TDS</label>
          <select
            className="w-full p-2 mt-1 border rounded"
            onChange={(e) => {
              const selected = TDS_OPTIONS[e.target.value];
              setInvoice({
                ...invoice,
                tdsType: selected?.label || "",
                tdsPercent: selected?.percent || 0,
              });
            }}
          >
            <option value="">None</option>
            {TDS_OPTIONS.map((t, i) => (
              <option key={i} value={i}>
                {t.label} [{t.percent}%]
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 mt-8 text-lg text-white bg-blue-600 rounded-xl"
        >
          {loading ? "Creating..." : "Save Invoice"}
        </button>
      </div>
    </div>
  );
}
