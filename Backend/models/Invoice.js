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

    description: {
      type: String,
      required: true,
      trim: true,
    },

    hsnCode: {
      type: String,
      trim: true,
    },

    planType: {
      type: String,
      enum: ["Monthly", "Annual", "One-Time", "Add-on"],
      default: "One-Time",
    },

    users: {
      type: Number,
      default: 1,
      min: 1,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    taxableAmount: {
      type: Number,
      default: 0,
    },

    taxPercent: {
      type: Number,
      default: 18,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/* =============================
   INVOICE SCHEMA
============================= */
const invoiceSchema = new mongoose.Schema(
  {
    // =========================
    // BASIC DETAILS
    // =========================
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },

    orderNumber: {
      type: String,
      trim: true,
    },

    invoiceType: {
      type: String,
      enum: ["Product", "Service", "Subscription"],
      default: "Subscription",
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    // =========================
    // COMPANY SNAPSHOT
    // =========================
    companyDetails: {
      companyName: String,
      email: String,
      phone: String,
      gstNumber: String,
      address: String,
      city: String,
      state: String,
      country: String,
    },

    // =========================
    // CUSTOMER SNAPSHOT
    // =========================
    billingDetails: {
      companyName: String,
      contactPerson: String,
      email: String,
      phone: String,

      addressLine1: String,
      addressLine2: String,

      city: String,
      state: String,
      pincode: String,
      country: String,

      gstNumber: String,
    },

    // =========================
    // DATES
    // =========================
    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    issueDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    subscriptionStart: Date,

    subscriptionEnd: Date,

    // =========================
    // PLACE OF SUPPLY
    // =========================
    placeOfSupply: {
      type: String,
      trim: true,
    },

    // =========================
    // ITEMS
    // =========================
    items: [itemSchema],

    currency: {
      type: String,
      default: "INR",
    },

    // =========================
    // AMOUNTS
    // =========================
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    taxableAmount: {
      type: Number,
      default: 0,
    },

    // =========================
    // DISCOUNT
    // =========================
    discountType: {
      type: String,
      enum: ["Flat", "Percentage"],
      default: "Flat",
    },

    discountValue: {
      type: Number,
      default: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
    },

    // =========================
    // GST BREAKDOWN
    // =========================
    cgstPercent: {
      type: Number,
      default: 0,
    },

    cgstAmount: {
      type: Number,
      default: 0,
    },

    sgstPercent: {
      type: Number,
      default: 0,
    },

    sgstAmount: {
      type: Number,
      default: 0,
    },

    igstPercent: {
      type: Number,
      default: 0,
    },

    igstAmount: {
      type: Number,
      default: 0,
    },

    totalTax: {
      type: Number,
      default: 0,
    },

    // =========================
    // FINAL TOTAL
    // =========================
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    // =========================
    // PAYMENT
    // =========================
    amountPaid: {
      type: Number,
      default: 0,
    },

    balanceDue: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Partially Paid",
        "Paid",
        "Overdue",
        "Cancelled",
      ],
      default: "Pending",
    },

    paymentMode: {
      type: String,
      enum: [
        "Cash",
        "Bank Transfer",
        "UPI",
        "Card",
        "Razorpay",
        "Stripe",
      ],
    },

    paymentReference: {
      type: String,
      trim: true,
    },

    // =========================
    // NOTES
    // =========================
    notes: {
      type: String,
      trim: true,
    },

    termsAndConditions: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/* =============================
   AUTO OVERDUE CHECK
============================= */
invoiceSchema.pre("save", function () {
  if (
    this.paymentStatus !== "Paid" &&
    this.paymentStatus !== "Cancelled" &&
    this.dueDate &&
    this.dueDate < new Date()
  ) {
    this.paymentStatus = "Overdue";
  }
});

export default mongoose.model("Invoice", invoiceSchema);