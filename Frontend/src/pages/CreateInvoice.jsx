import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function CreateInvoice() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  /* ================= INITIAL STATE ================= */
  const getInitialInvoice = () => ({
    customer: "",
    invoiceType: "Subscription",
    orderNumber: "",
    purchaseDate: today,
    issueDate: today,
    dueDate: today,
    currency: "INR",

    discountType: "Percentage",
    discountValue: 0,

    paymentMode: "UPI",

    taxType: "INTRA",
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,

    notes: "Thank you for your business.",
    termsAndConditions: "Payment due within 15 days.",

    subscriptionStart: "",
    subscriptionEnd: "",

    items: [
      {
        description: "",
        hsnCode: "",
        planType: "Annual",
        users: 1,
        quantity: 1,
        unitPrice: 0,
        taxPercent: 0,
      },
    ],
  });

  const [invoice, setInvoice] = useState(getInitialInvoice());

  /* ================= FETCH CLIENTS ================= */
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await API.get("/clients");
        setClients(res.data?.data || res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load clients");
      }
    };
    fetchClients();
  }, []);

  /* ================= ITEM UPDATE ================= */
  const updateItem = (index, field, value) => {
    const items = [...invoice.items];

    items[index] = {
      ...items[index],
      [field]: ["quantity", "users", "unitPrice", "taxPercent"].includes(field)
        ? Number(value)
        : value,
    };

    setInvoice((prev) => ({ ...prev, items }));
  };

  const addItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: "",
          hsnCode: "",
          planType: "One-Time",
          users: 1,
          quantity: 1,
          unitPrice: 0,
          taxPercent: 0,
        },
      ],
    }));
  };

  const removeItem = (index) => {
    if (invoice.items.length === 1) {
      return toast.error("At least one item is required");
    }

    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  /* ================= CALCULATIONS ================= */
  const calculations = useMemo(() => {
  const subtotal = (invoice.items || []).reduce((sum, item) => {
    return (
      sum +
      Number(item.quantity || 0) * Number(item.unitPrice || 0)
    );
  }, 0);

  const discountAmount =
    invoice.discountType === "Percentage"
      ? (subtotal * Number(invoice.discountValue || 0)) / 100
      : Number(invoice.discountValue || 0);

  const safeDiscount = Math.min(discountAmount, subtotal);

  const taxableAmount = Math.max(subtotal - safeDiscount, 0);

  let totalTax = 0;

  const cgstRate = Number(invoice.cgstRate || 0);
  const sgstRate = Number(invoice.sgstRate || 0);
  const igstRate = Number(invoice.igstRate || 0);

  if (invoice.taxType === "INTRA") {
    const cgst = (taxableAmount * cgstRate) / 100;
    const sgst = (taxableAmount * sgstRate) / 100;
    totalTax = cgst + sgst;
  } else {
    totalTax = (taxableAmount * igstRate) / 100;
  }

  const grandTotal = taxableAmount + totalTax;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(safeDiscount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}, [invoice]);

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
  try {
    if (!invoice.customer) {
      return toast.error("Please select a customer");
    }

    setLoading(true);

    const payload = {
      customer: invoice.customer,
      invoiceType: invoice.invoiceType,
      orderNumber: invoice.orderNumber,
      purchaseDate: invoice.purchaseDate,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,

      /* DISCOUNT */
      discountType: invoice.discountType,
      discountValue: Number(invoice.discountValue || 0),

      /* TAX */
      taxType: invoice.taxType,
      cgstRate: Number(invoice.cgstRate || 0),
      sgstRate: Number(invoice.sgstRate || 0),
      igstRate: Number(invoice.igstRate || 0),

      paymentMode: invoice.paymentMode,

      notes: invoice.notes,
      termsAndConditions: invoice.termsAndConditions,

      subscriptionStart: invoice.subscriptionStart || null,
      subscriptionEnd: invoice.subscriptionEnd || null,

      /* ITEMS */
      items: (invoice.items || []).map((item) => ({
        description: item.description || "",
        hsnCode: item.hsnCode || "",
        planType: item.planType || "One-Time",
        users: Number(item.users || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        taxPercent: Number(item.taxPercent || 0),
      })),
    };

    const res = await API.post("/invoices", payload);

    toast.success(
      `Invoice ${res.data.data.invoiceNumber} created successfully`
    );

    setInvoice(getInitialInvoice());
  } catch (err) {
    console.error(err);
    toast.error(
      err?.response?.data?.message || "Invoice creation failed"
    );
  } finally {
    setLoading(false);
  }
};

return (
  <div className="min-h-screen p-6 bg-slate-100">
    <div className="mx-auto overflow-hidden bg-white shadow-2xl max-w-7xl rounded-3xl">

      {/* HEADER */}
      <div className="p-8 text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-800">
        <h1 className="text-3xl font-bold">Create Invoice</h1>
        <p className="mt-2 text-sm opacity-80">
          GST compliant professional invoice generator
        </p>
      </div>

      <div className="p-8">

        {/* CUSTOMER + BASIC INFO */}
        <div className="grid gap-6 mb-8 md:grid-cols-3">

          <div>
            <label className="text-sm font-semibold">Customer</label>
            <select
              value={invoice.customer}
              onChange={(e) =>
                setInvoice({ ...invoice, customer: e.target.value })
              }
              className="w-full p-3 mt-2 border rounded-xl"
            >
              <option value="">Select Customer</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold">Invoice Type</label>
            <select
              value={invoice.invoiceType}
              onChange={(e) =>
                setInvoice({ ...invoice, invoiceType: e.target.value })
              }
              className="w-full p-3 mt-2 border rounded-xl"
            >
              <option>Subscription</option>
              <option>Service</option>
              <option>Product</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold">Order Number</label>
            <input
              value={invoice.orderNumber}
              onChange={(e) =>
                setInvoice({ ...invoice, orderNumber: e.target.value })
              }
              className="w-full p-3 mt-2 border rounded-xl"
              placeholder="ORD-1001"
            />
          </div>
        </div>

        {/* DATES */}
        <div className="grid gap-6 mb-8 md:grid-cols-4">

          <input type="date" value={invoice.purchaseDate}
            onChange={(e) => setInvoice({ ...invoice, purchaseDate: e.target.value })}
            className="p-3 border rounded-xl"
          />

          <input type="date" value={invoice.issueDate}
            onChange={(e) => setInvoice({ ...invoice, issueDate: e.target.value })}
            className="p-3 border rounded-xl"
          />

          <input type="date" value={invoice.dueDate}
            onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
            className="p-3 border rounded-xl"
          />

          <select
            value={invoice.paymentMode}
            onChange={(e) =>
              setInvoice({ ...invoice, paymentMode: e.target.value })
            }
            className="p-3 border rounded-xl"
          >
            <option>UPI</option>
            <option>Cash</option>
            <option>Card</option>
            <option>Bank Transfer</option>
          </select>
        </div>

        {/* ITEMS */}
        <div className="mb-8">

          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold">Items</h2>

            <button
              onClick={addItem}
              className="px-4 py-2 text-white bg-blue-600 rounded-xl"
            >
              + Add Item
            </button>
          </div>

          <table className="w-full border rounded-xl">
            <thead className="bg-gray-100">
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-t">

                  <td>
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(i, "description", e.target.value)
                      }
                      className="w-full p-2"
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(i, "quantity", e.target.value)
                      }
                      className="w-20 p-2"
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(i, "unitPrice", e.target.value)
                      }
                      className="p-2 w-28"
                    />
                  </td>

                  <td>
                    ₹ {(item.quantity * item.unitPrice).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DISCOUNT + TAX SETTINGS */}
        <div className="grid gap-6 mb-8 md:grid-cols-3">

          <div>
            <label>Discount Type</label>
            <select
              value={invoice.discountType}
              onChange={(e) =>
                setInvoice({ ...invoice, discountType: e.target.value })
              }
              className="w-full p-3 border rounded-xl"
            >
              <option>Percentage</option>
              <option>Flat</option>
            </select>
          </div>

          <div>
            <label>Discount</label>
            <input
              type="number"
              value={invoice.discountValue}
              onChange={(e) =>
                setInvoice({ ...invoice, discountValue: e.target.value })
              }
              className="w-full p-3 border rounded-xl"
            />
          </div>

          <div>
            <label>Tax Type</label>
            <select
              value={invoice.taxType}
              onChange={(e) =>
                setInvoice({ ...invoice, taxType: e.target.value })
              }
              className="w-full p-3 border rounded-xl"
            >
              <option value="INTRA">INTRA (CGST + SGST)</option>
              <option value="INTER">INTER (IGST)</option>
            </select>
          </div>

        </div>

        {/* 💎 PREMIUM SUMMARY */}
        <div className="p-6 mb-8 border shadow-sm rounded-2xl bg-slate-50">

          <h2 className="mb-4 text-lg font-bold">Invoice Summary</h2>

          <div className="space-y-2 text-sm">

            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹ {calculations.subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Discount</span>
              <span>₹ {calculations.discountAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Taxable Amount</span>
              <span>₹ {calculations.taxableAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>CGST</span>
              <span>₹ {(calculations.totalTax / 2).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>SGST</span>
              <span>₹ {(calculations.totalTax / 2).toFixed(2)}</span>
            </div>

            <div className="flex justify-between pt-3 text-lg font-bold border-t">
              <span>Grand Total</span>
              <span>₹ {calculations.grandTotal.toFixed(2)}</span>
            </div>

          </div>
        </div>

        {/* NOTES */}
        <textarea
          value={invoice.notes}
          onChange={(e) =>
            setInvoice({ ...invoice, notes: e.target.value })
          }
          className="w-full p-4 border rounded-xl"
          placeholder="Notes"
        />

        {/* SAVE */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 mt-6 text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700"
        >
          {loading ? "Creating..." : "Create Invoice"}
        </button>

      </div>
    </div>
  </div>
);  };