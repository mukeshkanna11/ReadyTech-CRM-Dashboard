import mongoose from "mongoose";

/* =============================
   ITEM SCHEMA
============================= */
const itemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    description: { type: String, required: true, trim: true },
    planType: {
      type: String,
      enum: ["Monthly", "Annual", "One-Time", "Add-on"],
      default: "One-Time",
    },
    users: { type: Number, default: 1, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

/* =============================
   INVOICE SCHEMA
============================= */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    billingDetails: {
      name: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      gstNumber: String,
    },
    currency: { type: String, default: "INR" },
    items: [itemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["Flat", "Percentage"], default: "Flat" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"],
      default: "Draft",
    },
    paymentMode: { type: String, enum: ["Cash", "Bank Transfer", "UPI", "Card", "Razorpay", "Stripe"] },
    paymentReference: { type: String },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    subscriptionStart: Date,
    subscriptionEnd: Date,
    notes: String,
    termsAndConditions: String,
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
