import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function CreateInvoice() {
  /* =========================
      STATES
  ========================== */

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const defaultInvoice = {
    customer: "",
    invoiceDate: today,
    dueDate: today,
    notes: "Thanks for your business.",
    terms: "",
    discountPercent: 0,
    tdsPercent: 0,
    tcsPercent: 0,
    items: [{ product: "", quantity: 1, rate: 0 }],
  };

  const [invoice, setInvoice] = useState(defaultInvoice);

  /* =========================
      TDS OPTIONS
  ========================== */

  const TDS_OPTIONS = [
    { label: "Professional Fees", percent: 10 },
    { label: "Commission", percent: 2 },
    { label: "Dividend", percent: 10 },
    { label: "Technical Fees", percent: 2 },
  ];

  /* =========================
      FETCH DATA
  ========================== */

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clientRes = await API.get("/clients");
        const productRes = await API.get("/products");

        const clientData =
          clientRes.data?.data ||
          clientRes.data?.clients ||
          clientRes.data ||
          [];

        const productData =
          productRes.data?.data ||
          productRes.data?.products ||
          productRes.data ||
          [];

        setClients(Array.isArray(clientData) ? clientData : []);
        setProducts(Array.isArray(productData) ? productData : []);
      } catch (error) {
        toast.error("Failed to load data");
      }
    };

    fetchData();
  }, []);

  /* =========================
      ITEM FUNCTIONS
  ========================== */

  const updateItem = (index, field, value) => {
    const updated = [...invoice.items];
    updated[index][field] = value;

    if (field === "product") {
      const selected = products.find((p) => p._id === value);
      if (selected) {
        updated[index].rate = selected.price || 0;
      }
    }

    setInvoice({ ...invoice, items: updated });
  };

  const addItem = () => {
    setInvoice({
      ...invoice,
      items: [...invoice.items, { product: "", quantity: 1, rate: 0 }],
    });
  };

  const removeItem = (index) => {
    setInvoice({
      ...invoice,
      items: invoice.items.filter((_, i) => i !== index),
    });
  };

  /* =========================
      CALCULATIONS
  ========================== */

  const calculations = useMemo(() => {
    let subtotal = 0;

    invoice.items.forEach((item) => {
      subtotal +=
        (Number(item.quantity) || 0) *
        (Number(item.rate) || 0);
    });

    const discount =
      (subtotal * Number(invoice.discountPercent || 0)) / 100;

    const afterDiscount = subtotal - discount;

    const tds =
      (afterDiscount * Number(invoice.tdsPercent || 0)) / 100;

    const tcs =
      (afterDiscount * Number(invoice.tcsPercent || 0)) / 100;

    const total = afterDiscount - tds + tcs;

    return {
      subtotal,
      discount,
      tds,
      tcs,
      total,
    };
  }, [invoice]);

  /* =========================
      SUBMIT
  ========================== */

  const handleSubmit = async () => {
    if (!invoice.customer) {
      return toast.error("Select customer");
    }

    try {
      setLoading(true);

      await API.post("/invoices", {
        ...invoice,
        ...calculations,
      });

      toast.success("Invoice Created Successfully 🚀");
      setInvoice(defaultInvoice);
    } catch (error) {
      toast.error("Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
      UI
  ========================== */

  return (
    <div className="min-h-screen p-10 bg-gray-100">
      <div className="grid grid-cols-3 gap-8 mx-auto max-w-7xl">

        {/* LEFT SECTION */}
        <div className="col-span-2 p-8 bg-white shadow-xl rounded-2xl">

          <h1 className="mb-6 text-3xl font-bold">
            New Invoice
          </h1>

          {/* HEADER */}
          <div className="grid grid-cols-2 gap-6 mb-8">

            <div>
              <label className="text-sm font-semibold">
                Customer
              </label>
              <select
                value={invoice.customer}
                onChange={(e) =>
                  setInvoice({ ...invoice, customer: e.target.value })
                }
                className="w-full p-3 mt-2 border rounded-lg"
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
              <label className="text-sm font-semibold">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoice.invoiceDate}
                onChange={(e) =>
                  setInvoice({
                    ...invoice,
                    invoiceDate: e.target.value,
                  })
                }
                className="w-full p-3 mt-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">
                Due Date
              </label>
              <input
                type="date"
                value={invoice.dueDate}
                onChange={(e) =>
                  setInvoice({
                    ...invoice,
                    dueDate: e.target.value,
                  })
                }
                className="w-full p-3 mt-2 border rounded-lg"
              />
            </div>
          </div>

          {/* ITEMS */}
          <table className="w-full overflow-hidden border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-left">Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className="border-t">

                  <td className="p-3">
                    <select
                      value={item.product}
                      onChange={(e) =>
                        updateItem(index, "product", e.target.value)
                      }
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                      className="w-20 p-2 border rounded"
                    />
                  </td>

                  <td>₹ {item.rate}</td>

                  <td>
                    ₹ {(item.quantity * item.rate).toFixed(2)}
                  </td>

                  <td>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-500"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addItem}
            className="px-4 py-2 mt-4 bg-gray-200 rounded-lg"
          >
            + Add Item
          </button>

          {/* NOTES */}
          <div className="mt-8">
            <label className="text-sm font-semibold">
              Notes
            </label>
            <textarea
              value={invoice.notes}
              onChange={(e) =>
                setInvoice({ ...invoice, notes: e.target.value })
              }
              className="w-full p-3 mt-2 border rounded-lg"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 mt-8 text-lg text-white bg-blue-600 rounded-xl"
          >
            {loading ? "Creating..." : "Save Invoice"}
          </button>
        </div>

        {/* RIGHT SUMMARY CARD */}
        <div className="p-8 space-y-4 bg-white shadow-xl rounded-2xl">

          <h2 className="text-xl font-bold">
            Invoice Summary
          </h2>

          <p>Subtotal: ₹ {calculations.subtotal.toFixed(2)}</p>

          <div>
            <label>Discount %</label>
            <input
              type="number"
              value={invoice.discountPercent}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  discountPercent: e.target.value,
                })
              }
              className="w-full p-2 mt-1 border rounded"
            />
            <p>- ₹ {calculations.discount.toFixed(2)}</p>
          </div>

          <div>
            <label>TDS</label>
            <select
              onChange={(e) => {
                const selected =
                  TDS_OPTIONS[e.target.value];
                setInvoice({
                  ...invoice,
                  tdsPercent: selected?.percent || 0,
                });
              }}
              className="w-full p-2 mt-1 border rounded"
            >
              <option>Select TDS</option>
              {TDS_OPTIONS.map((t, i) => (
                <option key={i} value={i}>
                  {t.label} [{t.percent}%]
                </option>
              ))}
            </select>
            <p>- ₹ {calculations.tds.toFixed(2)}</p>
          </div>

          <div>
            <label>TCS %</label>
            <input
              type="number"
              value={invoice.tcsPercent}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  tcsPercent: e.target.value,
                })
              }
              className="w-full p-2 mt-1 border rounded"
            />
            <p>+ ₹ {calculations.tcs.toFixed(2)}</p>
          </div>

          <hr />

          <h2 className="text-2xl font-bold">
            Total: ₹ {calculations.total.toFixed(2)}
          </h2>

        </div>
      </div>
    </div>
  );
}
