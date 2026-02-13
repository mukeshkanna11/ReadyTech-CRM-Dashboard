import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  User,
  Calendar,
  FileText,
  Percent,
  IndianRupee,
} from "lucide-react";
import API from "../services/api";
import { toast } from "react-hot-toast";

export default function CreateInvoice() {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([
    { product: "", name: "", quantity: 1, price: 0, total: 0 },
  ]);

  const [tax, setTax] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState("");

  const [subtotal, setSubtotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  /* =========================================
     FETCH CLIENTS & PRODUCTS
  ========================================= */
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const clientsRes = await API.get("/clients");
      const productRes = await API.get("/products");

      setClients(clientsRes.data);
      setProducts(productRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    }
  };

  /* =========================================
     HANDLE PRODUCT CHANGE
  ========================================= */
  const handleProductChange = (index, productId) => {
    const selectedProduct = products.find((p) => p._id === productId);

    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      product: productId,
      name: selectedProduct?.name || "",
      price: selectedProduct?.price || 0,
      total: selectedProduct?.price * updatedItems[index].quantity || 0,
    };

    setItems(updatedItems);
  };

  /* =========================================
     HANDLE QUANTITY CHANGE
  ========================================= */
  const handleQuantityChange = (index, qty) => {
    const updatedItems = [...items];
    updatedItems[index].quantity = qty;
    updatedItems[index].total = qty * updatedItems[index].price;
    setItems(updatedItems);
  };

  /* =========================================
     CALCULATE TOTALS
  ========================================= */
  useEffect(() => {
    let sub = items.reduce((acc, item) => acc + item.total, 0);
    setSubtotal(sub);

    const total =
      sub + (sub * tax) / 100 - (discount ? Number(discount) : 0);

    setGrandTotal(total);
  }, [items, tax, discount]);

  /* =========================================
     ADD ITEM ROW
  ========================================= */
  const addItem = () => {
    setItems([
      ...items,
      { product: "", name: "", quantity: 1, price: 0, total: 0 },
    ]);
  };

  /* =========================================
     REMOVE ITEM ROW
  ========================================= */
  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  /* =========================================
     SUBMIT INVOICE
  ========================================= */
  const handleSubmit = async () => {
    try {
      await API.post("/invoices", {
        customer,
        items,
        tax,
        discount,
        dueDate,
      });

      toast.success("Invoice Created Successfully 🎉");
    } catch (error) {
      toast.error("Invoice Creation Failed");
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-6xl p-10 mx-auto bg-white shadow-2xl rounded-3xl">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <FileText size={28} /> Create Invoice
          </h1>
        </div>

        {/* CLIENT + DATE */}
        <div className="grid gap-6 mb-8 md:grid-cols-2">

          <div>
            <label className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <User size={16} /> Select Client
            </label>
            <select
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-400"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Choose Client</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <Calendar size={16} /> Due Date
            </label>
            <input
              type="date"
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-400"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="p-6 shadow-inner bg-slate-50 rounded-2xl">

          {items.map((item, index) => (
            <div
              key={index}
              className="grid items-center gap-4 mb-4 md:grid-cols-5"
            >
              <select
                className="p-2 border rounded-xl"
                value={item.product}
                onChange={(e) =>
                  handleProductChange(index, e.target.value)
                }
              >
                <option value="">Select Product</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>
                    {product.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Qty"
                className="p-2 border rounded-xl"
                value={item.quantity}
                onChange={(e) =>
                  handleQuantityChange(index, e.target.value)
                }
              />

              <input
                type="number"
                value={item.price}
                disabled
                className="p-2 bg-gray-100 border rounded-xl"
              />

              <input
                type="number"
                value={item.total}
                disabled
                className="p-2 bg-gray-100 border rounded-xl"
              />

              <button
                onClick={() => removeItem(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 />
              </button>
            </div>
          ))}

          <button
            onClick={addItem}
            className="flex items-center gap-2 mt-4 font-semibold text-indigo-600"
          >
            <Plus size={18} /> Add Item
          </button>
        </div>

        {/* CALCULATIONS */}
        <div className="grid gap-6 mt-8 md:grid-cols-2">

          <div>
            <label className="flex items-center gap-2 font-semibold">
              <Percent size={16} /> GST %
            </label>
            <input
              type="number"
              value={tax}
              onChange={(e) => setTax(e.target.value)}
              className="w-full p-2 mt-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-semibold">Discount (₹)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full p-2 mt-2 border rounded-xl"
            />
          </div>
        </div>

        {/* TOTAL SUMMARY */}
        <div className="p-6 mt-10 text-white shadow-xl bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl">
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>₹ {subtotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between mb-2">
            <span>GST ({tax}%)</span>
            <span>₹ {(subtotal * tax / 100).toFixed(2)}</span>
          </div>

          <div className="flex justify-between mb-2">
            <span>Discount</span>
            <span>- ₹ {discount}</span>
          </div>

          <hr className="my-3 border-white/40" />

          <div className="flex justify-between text-xl font-bold">
            <span>Total Amount</span>
            <span>₹ {grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* SUBMIT */}
        <div className="mt-8 text-right">
          <button
            onClick={handleSubmit}
            className="px-8 py-3 font-semibold text-white bg-indigo-600 shadow-lg hover:bg-indigo-700 rounded-2xl"
          >
            Create Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
