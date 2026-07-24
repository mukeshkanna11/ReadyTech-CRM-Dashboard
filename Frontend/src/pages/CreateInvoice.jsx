import { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
export default function CreateInvoice() {
  const today = new Date().toISOString().split("T")[0];

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
const navigate = useNavigate();
  /* ==================================================
      INITIAL INVOICE
  =================================================== */

  const createInvoiceState = () => ({
    customer: "",

    invoiceType: "Subscription",

    orderNumber: "",

    orderDate: today,
    
    purchaseDate: today,

    issueDate: today,

    dueDate: today,

    currency: "INR",

    taxType: "INTRA",

    cgstRate: 9,

    sgstRate: 9,

    igstRate: 18,

    discountType: "Percentage",

    discountValue: 0,

    paymentMode: "UPI",

    notes: "Thank you for your business.",

    termsAndConditions:
      "Payment due within 15 days.",

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

        taxPercent: 18,
      },
    ],
  });

  const [invoice, setInvoice] =
    useState(createInvoiceState());


    
  /* ==================================================
      LOAD CLIENTS
  =================================================== */

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await API.get("/clients");

      const data =
        res.data?.data || res.data || [];

      setClients(data);
    } catch (err) {
      console.error(err);

      toast.error("Unable to load customers");
    }
  };

  /* ==================================================
      UPDATE FIELD
  =================================================== */

  const updateField = (field, value) => {
    setInvoice((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /* ==================================================
      UPDATE ITEM
  =================================================== */

  const updateItem = (
    index,
    field,
    value
  ) => {
    const items = [...invoice.items];

    items[index] = {
      ...items[index],

      [field]:
        field === "quantity" ||
        field === "users" ||
        field === "unitPrice" ||
        field === "taxPercent"
          ? Number(value)
          : value,
    };

    setInvoice((prev) => ({
      ...prev,
      items,
    }));
  };


  
  /* ==================================================
      ADD ITEM
  =================================================== */

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

          taxPercent: 18,
        },
      ],
    }));
  };

  /* ==================================================
      REMOVE ITEM
  =================================================== */

  const removeItem = (index) => {
    if (invoice.items.length === 1) {
      toast.error(
        "Minimum one item required."
      );
      return;
    }

    setInvoice((prev) => ({
      ...prev,

      items: prev.items.filter(
        (_, i) => i !== index
      ),
    }));
  };

/* ==================================================
   CALCULATIONS
================================================== */

const calculations = useMemo(() => {
  const subtotal = (invoice.items || []).reduce((sum, item) => {
    return (
      sum +
      Number(item.quantity || 0) *
        Number(item.unitPrice || 0)
    );
  }, 0);

  /* ---------------- Discount ---------------- */

  const discountAmount =
    invoice.discountType === "Percentage"
      ? (subtotal * Number(invoice.discountValue || 0)) / 100
      : Number(invoice.discountValue || 0);

  const safeDiscount = Math.min(discountAmount, subtotal);

  /* ---------------- Taxable ---------------- */

  const taxableAmount = Math.max(
    subtotal - safeDiscount,
    0
  );

  /* ---------------- GST ---------------- */

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (invoice.taxType === "INTRA") {
    cgst =
      (taxableAmount *
        Number(invoice.cgstRate || 0)) /
      100;

    sgst =
      (taxableAmount *
        Number(invoice.sgstRate || 0)) /
      100;
  } else {
    igst =
      (taxableAmount *
        Number(invoice.igstRate || 0)) /
      100;
  }

  const totalTax = cgst + sgst + igst;

  /* ---------------- Grand Total ---------------- */

  const grandTotal = taxableAmount + totalTax;

  /* ---------------- Round Off ---------------- */

  const roundOff =
    Math.round(grandTotal) - grandTotal;

  const payable =
    grandTotal + roundOff;

  return {
    subtotal: Number(subtotal.toFixed(2)),

    discountAmount: Number(
      safeDiscount.toFixed(2)
    ),

    taxableAmount: Number(
      taxableAmount.toFixed(2)
    ),

    cgst: Number(cgst.toFixed(2)),

    sgst: Number(sgst.toFixed(2)),

    igst: Number(igst.toFixed(2)),

    totalTax: Number(totalTax.toFixed(2)),

    grandTotal: Number(
      grandTotal.toFixed(2)
    ),

    roundOff: Number(
      roundOff.toFixed(2)
    ),

    payable: Number(
      payable.toFixed(2)
    ),
  };
}, [invoice]);

/* ================= CREATE INVOICE ================= */

const handleSubmit = async () => {

  console.log("========== BUTTON CLICKED ==========");


  if (loading) {
    console.log("STOP : LOADING TRUE");
    return;
  }


  try {

    console.log("STEP 1 : START");

    setLoading(true);



    console.log(
      "STEP 2 : INVOICE STATE",
      invoice
    );



    console.log(
      "STEP 3 : CLIENT LIST",
      clients
    );



    // ================= CUSTOMER =================


    const client = clients.find(
      (c) =>
        String(c._id) === String(invoice.customer)
    );


    console.log(
      "STEP 4 : SELECTED CLIENT",
      client
    );



    if (!client) {

      toast.error(
        "Please select customer"
      );

      return;

    }




    // ================= ITEMS =================


    console.log(
      "STEP 5 : ITEMS",
      invoice.items
    );



    if (
      !invoice.items ||
      invoice.items.length === 0
    ) {

      toast.error(
        "Please add invoice items"
      );

      return;

    }




    for (
      let i = 0;
      i < invoice.items.length;
      i++
    ) {


      const item = invoice.items[i];


      console.log(
        "VALIDATING ITEM",
        item
      );



      if (
        !item.description ||
        !item.description.trim()
      ) {

        toast.error(
          `Item ${i+1} description required`
        );

        return;

      }



      if (
        !item.hsnCode
      ) {

        toast.error(
          `Item ${i+1} HSN required`
        );

        return;

      }



      if (
        Number(item.quantity) <= 0
      ) {

        toast.error(
          `Item ${i+1} quantity invalid`
        );

        return;

      }



    }





    // ================= PAYMENT =================


    console.log(
      "STEP 6 : PAYMENT",
      invoice.paymentMode
    );



    if(!invoice.paymentMode){

      toast.error(
        "Payment Mode Required"
      );

      return;

    }





    // ================= ADDRESS =================


    const billing = {
  addressLine1:
    client.billingAddress?.addressLine1 ||
    client.billingAddress?.address ||
    client.address ||
    "",

  addressLine2:
    client.billingAddress?.addressLine2 ||
    "",

  city:
    client.billingAddress?.city ||
    "",

  state:
    client.billingAddress?.state ||
    "",

  pincode:
    client.billingAddress?.pincode ||
    "",

  country:
    client.billingAddress?.country ||
    "India"
};



   const shipping = {
  addressLine1:
    client.shippingAddress?.addressLine1 ||
    client.shippingAddress?.address ||
    client.shippingAddress?.street ||
    "",

  addressLine2:
    client.shippingAddress?.addressLine2 ||
    "",

  city:
    client.shippingAddress?.city ||
    "",

  state:
    client.shippingAddress?.state ||
    "",

  pincode:
    client.shippingAddress?.pincode ||
    "",

  country:
    client.shippingAddress?.country ||
    "India"
};


    console.log(
      "STEP 7 : ADDRESS",
      {
        billing,
        shipping
      }
    );






    // ================= PAYLOAD =================


    const payload = {


      customer:
        client._id,



      invoiceType:
        invoice.invoiceType || "Subscription",



      orderNumber:
        invoice.orderNumber || "",

orderDate:
  invoice.orderDate || new Date(),

      purchaseDate:
        invoice.purchaseDate || new Date(),



      issueDate:
        invoice.issueDate || new Date(),



      dueDate:
        invoice.dueDate,



      currency:
        invoice.currency || "INR",



      paymentMode:
        invoice.paymentMode,



      discountType:
        invoice.discountType || "Flat",



      discountValue:
        Number(invoice.discountValue || 0),



      notes:
        invoice.notes || "",



      termsAndConditions:
        invoice.termsAndConditions || "",





      companyDetails:{


        companyName:
          "ReadyTech Solutions",


        website:
          "www.readytechsolutions.com",


        email:
          "quries.readytechsolutions@gmail.com",


        phone:
          "+91 7010797721",


        gstNumber:
          "29ABCDE1234F1Z5",


        panNumber:
          "ABCDE1234F",


        address:
          "149 Hope College",


        city:
          "Coimbatore",


        state:
          "Tamil Nadu",


        pincode:
          "641004",


        country:
          "India"

      },





     billingDetails: {

  companyName:
    client.companyName || "",


  contactPerson:
    client.contactPerson || "",


  email:
    client.email || "",


  phone:
    client.phone || "",


  addressLine1:
    billing.addressLine1 ||
    billing.address ||
    billing.street ||
    billing.location ||
    "",


  addressLine2:
    billing.addressLine2 ||
    "",


  city:
    billing.city ||
    billing.town ||
    "",


  state:
    billing.state ||
    "",


  pincode:
    billing.pincode ||
    billing.zipCode ||
    "",


  country:
    billing.country ||
    "India",


  gstNumber:
    client.gstNumber || "",


  panNumber:
    client.panNumber || ""

},




      shippingDetails:{


        companyName:
          client.companyName || "",


        contactPerson:
          client.contactPerson || "",


        phone:
          client.phone || "",



        addressLine1:
          shipping.addressLine1 ||
          billing.addressLine1 ||
          "",



        city:
          shipping.city ||
          billing.city ||
          "",



        state:
          shipping.state ||
          billing.state ||
          "",



        pincode:
          shipping.pincode ||
          billing.pincode ||
          "",



        country:
          "India"

      },

            taxType: invoice.taxType,

      cgstRate: Number(invoice.cgstRate || 9),

      sgstRate: Number(invoice.sgstRate || 9),

      igstRate: Number(invoice.igstRate || 18),

      subscriptionStart:
        invoice.invoiceType === "Subscription"
          ? invoice.subscriptionStart || null
          : null,

      subscriptionEnd:
        invoice.invoiceType === "Subscription"
          ? invoice.subscriptionEnd || null
          : null,

      items: invoice.items.map((item) => ({
        description: item.description,

        hsnCode: item.hsnCode || "",

        sacCode: item.sacCode || "",

        planType: item.planType || "One-Time",

        users: Number(item.users || 1),

        quantity: Number(item.quantity || 1),

        unitPrice: Number(item.unitPrice || 0),

        taxPercent: Number(item.taxPercent || 18),

        discountType:
          item.discountType || "Flat",

        discountValue:
          Number(item.discountValue || 0),
      }))
    };
  



console.log(
  "STEP 8 : FINAL PAYLOAD",
  payload
);

console.log(
  "STEP 9 : API CALL START"
);

const response = await API.post(
  "/invoices",
  payload
);

const createdInvoice = response.data.data;

console.log(
  "STEP 10 : SUCCESS",
  createdInvoice
);

console.log("Subtotal :", createdInvoice.subtotal);
console.log("Taxable :", createdInvoice.taxableAmount);
console.log("Discount :", createdInvoice.discountAmount);
console.log("CGST :", createdInvoice.cgstAmount);
console.log("SGST :", createdInvoice.sgstAmount);
console.log("IGST :", createdInvoice.igstAmount);
console.log("Total GST :", createdInvoice.totalTax);
console.log("Round Off :", createdInvoice.roundOff);
console.log("Grand Total :", createdInvoice.grandTotal);
console.log("Balance Due :", createdInvoice.balanceDue);

toast.success(
  "Invoice Created Successfully"
);

// Optional:
// navigate(`/invoices/${createdInvoice._id}`);

// Reset Form
setInvoice(createInvoiceState());

} catch (error) {

  console.error(
    "========== ERROR ==========",
    error
  );

  console.log(
    "SERVER ERROR",
    error.response?.data
  );

  toast.error(
    error.response?.data?.message ||
    "Invoice Creation Failed"
  );

} finally {

  console.log(
    "FINALLY EXECUTED"
  );

  setLoading(false);
}
};



    return (
      <div className="min-h-screen p-6 bg-slate-100">
  <div className="mx-auto overflow-hidden bg-white shadow-2xl max-w-7xl rounded-3xl">

    {/* ================= HEADER ================= */}

    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 rounded-t-3xl">

      <div className="absolute rounded-full -top-20 -right-20 w-72 h-72 bg-white/10 blur-3xl"></div>

      <div className="absolute rounded-full -bottom-20 -left-20 w-72 h-72 bg-cyan-500/10 blur-3xl"></div>

      <div className="relative flex flex-col justify-between gap-8 p-10 lg:flex-row">

        <div>

          <div className="inline-flex px-4 py-2 mb-5 text-xs font-bold tracking-widest uppercase rounded-full bg-white/10 text-cyan-300">

            ReadyTech ERP Finance

          </div>

          <h1 className="text-5xl font-black text-white">

            Create Tax Invoice

          </h1>

          <p className="max-w-2xl mt-4 leading-7 text-slate-300">

            Generate GST compliant professional invoices for
            Products, Services and SaaS Subscription billing with
            automatic calculations and enterprise financial records.

          </p>

        </div>

        <div className="grid grid-cols-2 gap-5">

          <div className="p-5 border bg-white/10 border-white/20 rounded-2xl backdrop-blur">

            <p className="text-xs uppercase text-slate-300">
              Status
            </p>

            <h2 className="mt-2 text-2xl font-bold text-amber-300">
              Draft
            </h2>

          </div>

          <div className="p-5 border bg-white/10 border-white/20 rounded-2xl backdrop-blur">

            <p className="text-xs uppercase text-slate-300">
              Currency
            </p>

            <h2 className="mt-2 text-2xl font-bold text-emerald-300">
              {invoice.currency}
            </h2>

          </div>

          <div className="p-5 border bg-white/10 border-white/20 rounded-2xl backdrop-blur">

            <p className="text-xs uppercase text-slate-300">
              Invoice Type
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              {invoice.invoiceType}
            </h2>

          </div>

          <div className="p-5 border bg-white/10 border-white/20 rounded-2xl backdrop-blur">

            <p className="text-xs uppercase text-slate-300">
              Due Date
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              {invoice.dueDate}
            </h2>

          </div>

        </div>

      </div>

    </div>

    <div className="p-8">

      {/* ================= SALES DOCUMENT ================= */}

      <div className="p-8 mb-8 bg-white border shadow-sm border-slate-200 rounded-3xl">

        <div className="flex items-center justify-between mb-8">

          <div>

            <h2 className="text-2xl font-bold text-slate-800">
              Sales Document Information
            </h2>

            <p className="mt-2 text-sm text-slate-500">

              Select customer and configure invoice details.

            </p>

          </div>

          <div className="px-4 py-2 font-semibold text-indigo-700 rounded-xl bg-indigo-50">

            Finance Module

          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          {/* Customer */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

              Customer

            </label>

            <select
              value={invoice.customer}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  customer: e.target.value,
                })
              }
              className="w-full px-4 py-3 border rounded-2xl"
            >
              <option value="">
                Select Customer
              </option>

              {clients.map((client) => (
                <option
                  key={client._id}
                  value={client._id}
                >
                  {client.companyName}
                </option>
              ))}

            </select>

          </div>

          {/* Invoice Type */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

              Invoice Type

            </label>

            <select
              value={invoice.invoiceType}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  invoiceType: e.target.value,
                })
              }
              className="w-full px-4 py-3 border rounded-2xl"
            >

              <option value="Subscription">
                SaaS Subscription
              </option>

              <option value="Service">
                Professional Service
              </option>

              <option value="Product">
                Product Sale
              </option>

            </select>

          </div>

          {/* Order Number */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

              Order Number

            </label>

            <input
              type="text"
              value={invoice.orderNumber}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  orderNumber: e.target.value,
                })
              }
              placeholder="ORD-0001"
              className="w-full px-4 py-3 border rounded-2xl"
            />

          </div>

{/* Order Date */}

<div>

  <label className="block mb-2 text-sm font-semibold">
    Order Date
  </label>

  <input
    type="date"
    value={invoice.orderDate}
    onChange={(e) =>
      setInvoice({
        ...invoice,
        orderDate: e.target.value,
      })
    }
    className="w-full px-4 py-3 border rounded-2xl"
  />

</div>

          {/* Issue Date */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

              Issue Date

            </label>

            <input
              type="date"
              value={invoice.issueDate}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  issueDate: e.target.value,
                })
              }
              className="w-full px-4 py-3 border rounded-2xl"
            />

          </div>

          {/* Due Date */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

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
              className="w-full px-4 py-3 border rounded-2xl"
            />

          </div>

          {/* Payment Mode */}

          <div>

            <label className="block mb-2 text-sm font-semibold">

              Payment Mode

            </label>

            <select
              value={invoice.paymentMode}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  paymentMode: e.target.value,
                })
              }
              className="w-full px-4 py-3 border rounded-2xl"
            >

              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Razorpay">Razorpay</option>
              <option value="Stripe">Stripe</option>

            </select>

          </div>

        </div>

      </div>
      {/* ================= SALES LINE ITEMS ================= */}

<div className="mb-8 overflow-hidden bg-white border shadow-sm rounded-3xl border-slate-200">

  {/* Header */}

  <div className="flex items-center justify-between p-6 border-b bg-slate-50">

    <div>

      <h2 className="text-2xl font-bold text-slate-800">
        Sales Line Items
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Add Products, Services or SaaS Subscription Plans
      </p>

    </div>

    <button
      type="button"
      onClick={addItem}
      className="px-5 py-3 font-semibold text-white transition bg-indigo-600 rounded-2xl hover:bg-indigo-700"
    >
      + Add Item
    </button>

  </div>

  <div className="overflow-x-auto">

    <table className="min-w-full">

      <thead className="bg-slate-100">

        <tr className="text-sm font-semibold text-slate-700">

          <th className="px-4 py-4 text-left">
            Description
          </th>

          <th className="px-4 py-4 text-left">
            Plan
          </th>

          <th className="px-4 py-4 text-left">
            HSN / SAC
          </th>

          <th className="px-4 py-4 text-center">
            Users
          </th>

          <th className="px-4 py-4 text-center">
            Qty
          </th>

          <th className="px-4 py-4 text-right">
            Unit Price
          </th>

          {/* <th className="px-4 py-4 text-center">
            GST %
          </th> */}

          {/* <th className="px-4 py-4 text-right">
            Tax
          </th> */}

          <th className="px-4 py-4 text-right">
            Total
          </th>

          <th className="px-4 py-4 text-center">
            Action
          </th>

        </tr>

      </thead>

      <tbody>

        {invoice.items.map((item, index) => {

          const qty = Number(item.quantity || 0);

          const users = Number(item.users || 1);

          const price = Number(item.unitPrice || 0);

          const gst = Number(item.taxPercent || 0);

          const taxable = qty * price;

          const tax = taxable * gst / 100;

          const total = taxable + tax;

          return (

            <tr
              key={index}
              className="transition border-t hover:bg-slate-50"
            >

              {/* Description */}

              <td className="p-3">

                <input
                  type="text"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Product / Service"
                  className="w-full px-3 py-2 border rounded-xl"
                />

              </td>

              {/* Plan */}

              <td className="p-3">

                <select
                  value={item.planType}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "planType",
                      e.target.value
                    )
                  }
                  className="px-3 py-2 border rounded-xl"
                >

                  <option value="Monthly">
                    Monthly
                  </option>

                  <option value="Annual">
                    Annual
                  </option>

                  <option value="One-Time">
                    One-Time
                  </option>

                  <option value="Add-on">
                    Add-on
                  </option>

                </select>

              </td>

              {/* HSN */}

              <td className="p-3">

                <input
                  type="text"
                  value={item.hsnCode}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "hsnCode",
                      e.target.value
                    )
                  }
                  placeholder="998314"
                  className="w-32 px-3 py-2 border rounded-xl"
                />

              </td>

              {/* Users */}

              <td className="p-3 text-center">

                <input
                  type="number"
                  min="1"
                  value={item.users}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "users",
                      e.target.value
                    )
                  }
                  className="w-20 px-3 py-2 text-center border rounded-xl"
                />

              </td>
                            {/* Quantity */}

              <td className="p-3 text-center">

                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "quantity",
                      e.target.value
                    )
                  }
                  className="w-20 px-3 py-2 text-center border rounded-xl"
                />

              </td>

              {/* Unit Price */}

              <td className="p-3">

                <input
                  type="number"
                  min="0"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "unitPrice",
                      e.target.value
                    )
                  }
                  className="w-32 px-3 py-2 text-right border rounded-xl"
                />

              </td>

              {/* GST */}

              {/* <td className="p-3 text-center">

                <input
                  type="number"
                  min="0"
                  value={item.taxPercent}
                  onChange={(e) =>
                    updateItem(
                      index,
                      "taxPercent",
                      e.target.value
                    )
                  }
                  className="w-20 px-3 py-2 text-center border rounded-xl"
                />

              </td> */}

              {/* Tax */}

              {/* <td className="p-3 font-medium text-right text-slate-700">

                ₹{" "}
                {tax.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}

              </td> */}

              {/* Total */}

              <td className="p-3 font-bold text-right text-indigo-700">

                ₹{" "}
                {total.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}

              </td>

              {/* Delete */}

              <td className="p-3 text-center">

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="px-4 py-2 text-red-600 transition rounded-xl hover:bg-red-50"
                >
                  Delete
                </button>

              </td>

            </tr>

          );

        })}

      </tbody>

    </table>

  </div>

</div>
{/* ================= DISCOUNT & GST CONFIGURATION ================= */}

<div className="p-8 mb-8 bg-white border shadow-sm rounded-3xl border-slate-200">

  <div className="flex items-center justify-between mb-8">

    <div>

      <h2 className="text-2xl font-bold text-slate-800">
        Discount & Tax Configuration
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Configure discounts, GST type and currency.
      </p>

    </div>

    <div className="px-4 py-2 text-sm font-semibold text-indigo-700 rounded-xl bg-indigo-50">
      GST Enabled
    </div>

  </div>

  <div className="grid gap-6 lg:grid-cols-4">

    {/* Discount Type */}

    <div>

      <label className="block mb-2 text-sm font-semibold">
        Discount Type
      </label>

      <select
        value={invoice.discountType}
        onChange={(e) =>
          setInvoice({
            ...invoice,
            discountType: e.target.value,
          })
        }
        className="w-full px-4 py-3 border rounded-2xl"
      >
        <option value="Percentage">
          Percentage (%)
        </option>

        <option value="Flat">
          Flat Amount (₹)
        </option>

      </select>

    </div>

    {/* Discount Value */}

    <div>

      <label className="block mb-2 text-sm font-semibold">
        Discount Value
      </label>

      <input
        type="number"
        value={invoice.discountValue}
        onChange={(e) =>
          setInvoice({
            ...invoice,
            discountValue: Number(e.target.value),
          })
        }
        className="w-full px-4 py-3 border rounded-2xl"
      />

    </div>

    {/* GST Type */}

    <div>

      <label className="block mb-2 text-sm font-semibold">
        GST Type
      </label>

      <select
        value={invoice.taxType}
        onChange={(e) =>
          setInvoice({
            ...invoice,
            taxType: e.target.value,
          })
        }
        className="w-full px-4 py-3 border rounded-2xl"
      >

        <option value="INTRA">
          INTRA STATE
        </option>

        <option value="INTER">
          INTER STATE
        </option>

      </select>

    </div>

    {/* Currency */}

    <div>

      <label className="block mb-2 text-sm font-semibold">
        Currency
      </label>

      <select
        value={invoice.currency}
        onChange={(e) =>
          setInvoice({
            ...invoice,
            currency: e.target.value,
          })
        }
        className="w-full px-4 py-3 border rounded-2xl"
      >

        <option value="INR">
          INR ₹
        </option>

        <option value="USD">
          USD $
        </option>

        <option value="EUR">
          EUR €
        </option>

      </select>

    </div>

  </div>

  {/* GST Rates */}

  <div className="grid gap-6 mt-8 lg:grid-cols-3">

    {invoice.taxType === "INTRA" ? (

      <>

        <div>

          <label className="block mb-2 text-sm font-semibold">
            CGST %
          </label>

          <input
            type="number"
            value={invoice.cgstRate}
            onChange={(e) =>
              setInvoice({
                ...invoice,
                cgstRate: Number(e.target.value),
              })
            }
            className="w-full px-4 py-3 border rounded-2xl"
          />

        </div>

        <div>

          <label className="block mb-2 text-sm font-semibold">
            SGST %
          </label>

          <input
            type="number"
            value={invoice.sgstRate}
            onChange={(e) =>
              setInvoice({
                ...invoice,
                sgstRate: Number(e.target.value),
              })
            }
            className="w-full px-4 py-3 border rounded-2xl"
          />

        </div>

        <div className="flex items-end">

          <div className="w-full p-5 text-center border rounded-2xl bg-emerald-50 border-emerald-200">

            <div className="text-xs text-slate-500">
              Total GST
            </div>

            <div className="mt-2 text-3xl font-bold text-emerald-700">

              {Number(invoice.cgstRate || 0) +
                Number(invoice.sgstRate || 0)}
              %

            </div>

          </div>

        </div>

      </>

    ) : (

      <>

        <div>

          <label className="block mb-2 text-sm font-semibold">
            IGST %
          </label>

          <input
            type="number"
            value={invoice.igstRate}
            onChange={(e) =>
              setInvoice({
                ...invoice,
                igstRate: Number(e.target.value),
              })
            }
            className="w-full px-4 py-3 border rounded-2xl"
          />

        </div>

        <div className="flex items-end">

          <div className="w-full p-5 text-center border border-blue-200 rounded-2xl bg-blue-50">

            <div className="text-xs text-slate-500">
              IGST
            </div>

            <div className="mt-2 text-3xl font-bold text-blue-700">
              {invoice.igstRate}%
            </div>

          </div>

        </div>

      </>

    )}

  </div>

</div>
{/* ================= INVOICE SUMMARY ================= */}

<div className="mb-10">

  <div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

    {/* Header */}

    <div className="px-8 py-5 bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-2xl font-bold text-white">
            Invoice Summary
          </h2>

          <p className="mt-1 text-sm text-indigo-100">
            Live calculation based on line items
          </p>

        </div>

        <div className="px-4 py-2 text-sm font-semibold text-white rounded-full bg-white/20">

          {invoice.taxType}

        </div>

      </div>

    </div>

    {/* Body */}

    <div className="grid gap-8 p-8 lg:grid-cols-2">

      {/* LEFT */}

      <div className="space-y-5">

        <div className="flex justify-between">

          <span className="text-slate-600">
            Subtotal
          </span>

          <span className="font-semibold">

            ₹ {calculations.subtotal.toLocaleString("en-IN",{
              minimumFractionDigits:2
            })}

          </span>

        </div>

        <div className="flex justify-between">

          <span className="text-slate-600">
            Discount
          </span>

          <span className="font-semibold text-red-600">

            - ₹ {calculations.discountAmount.toLocaleString("en-IN",{
              minimumFractionDigits:2
            })}

          </span>

        </div>

        <div className="flex justify-between">

          <span className="font-semibold text-slate-700">

            Taxable Amount

          </span>

          <span className="font-bold">

            ₹ {calculations.taxableAmount.toLocaleString("en-IN",{
              minimumFractionDigits:2
            })}

          </span>

        </div>

      </div>

      {/* RIGHT */}

<div className="p-6 border rounded-2xl bg-slate-50">

  {invoice.taxType === "INTRA" ? (
    <>
      <div className="flex justify-between mb-4">
        <span>CGST ({invoice.cgstRate}%)</span>

        <span>
          ₹ {calculations.cgst.toFixed(2)}
        </span>
      </div>

      <div className="flex justify-between mb-4">
        <span>SGST ({invoice.sgstRate}%)</span>

        <span>
          ₹ {calculations.sgst.toFixed(2)}
        </span>
      </div>
    </>
  ) : (
    <div className="flex justify-between mb-4">
      <span>IGST ({invoice.igstRate}%)</span>

      <span>
        ₹ {calculations.igst.toFixed(2)}
      </span>
    </div>
  )}

  <div className="flex justify-between mb-4">
    <span>Total GST</span>

    <span className="font-semibold text-indigo-700">
      ₹ {calculations.totalTax.toFixed(2)}
    </span>
  </div>

  <div className="flex justify-between mb-4">
    <span>Round Off</span>

    <span>
      ₹ {calculations.roundOff.toFixed(2)}
    </span>
  </div>

  <div className="pt-5 mt-5 border-t">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">
          Grand Total
        </p>

        <h1 className="text-4xl font-extrabold text-indigo-700">
          ₹ {calculations.payable.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
          })}
        </h1>
      </div>

      <div className="px-6 py-4 text-center rounded-2xl bg-emerald-100">
        <p className="text-xs font-semibold text-emerald-700">
          STATUS
        </p>

        <h2 className="mt-1 text-lg font-bold text-emerald-800">
          Pending
        </h2>
      </div>
    </div>
  </div>

</div>

    </div>

  </div>

</div>
{/* ================= NOTES & TERMS ================= */}

<div className="grid gap-8 mb-10 lg:grid-cols-2">

  {/* Notes */}

  <div className="p-6 bg-white border shadow-sm rounded-3xl">

    <h2 className="mb-4 text-xl font-bold text-slate-800">
      Notes
    </h2>

    <textarea
      rows={6}
      value={invoice.notes}
      onChange={(e) =>
        setInvoice({
          ...invoice,
          notes: e.target.value,
        })
      }
      placeholder="Additional notes for customer..."
      className="w-full p-4 border resize-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />

  </div>

  {/* Terms */}

  <div className="p-6 bg-white border shadow-sm rounded-3xl">

    <h2 className="mb-4 text-xl font-bold text-slate-800">
      Terms & Conditions
    </h2>

    <textarea
      rows={6}
      value={invoice.termsAndConditions}
      onChange={(e) =>
        setInvoice({
          ...invoice,
          termsAndConditions: e.target.value,
        })
      }
      placeholder="Enter invoice terms..."
      className="w-full p-4 border resize-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />

  </div>

</div>

{/* ================= CREATE BUTTON ================= */}

<div className="p-8 bg-white border shadow-sm rounded-3xl">

  <div className="flex flex-col items-center justify-between gap-6 md:flex-row">

    <div>

      <h2 className="text-2xl font-bold text-slate-800">
        Ready to Generate Invoice?
      </h2>

      <p className="mt-2 text-slate-500">
        Verify the information before creating the invoice.
      </p>

    </div>

   <div className="flex items-center gap-3 mt-6">
  <button
  type="button"
  onClick={() => navigate("/invoices")}
  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-400 hover:shadow transition-all duration-200"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 19.5L8.25 12l7.5-7.5"
    />
  </svg>

  Back to Invoices
</button>

  <button
    type="button"
    onClick={() => {
      console.log("BUTTON CLICKED");
      handleSubmit();
    }}
    disabled={loading}
    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
  >
    {loading ? "Creating..." : "Create Invoice"}
  </button>
</div>
  </div>

</div>

{/* Footer */}

<div className="mt-10 text-sm text-center text-slate-400">

  ReadyTech ERP • Finance Module • GST Invoice System

</div>

</div>
</div>
</div>
);
}
