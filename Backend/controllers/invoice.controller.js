import Invoice from "../models/Invoice.js";
import Client from "../models/Client.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";
import { buildInvoicePdf } from "../services/invoicePdf.service.js";

/* =====================================================
   COMPANY PROFILE (env-overridable defaults)
   No backend company model exists yet, so these act as
   the seller snapshot stored on each invoice.
===================================================== */
const DEFAULT_COMPANY = {
  companyName: process.env.COMPANY_NAME || "ReadyTechSolutions",
  logo: process.env.COMPANY_LOGO || "",
  website: process.env.COMPANY_WEBSITE || "www.readytechsolutions.com",
  email: process.env.COMPANY_EMAIL || "quries.readytechsolutions@gmail.com",
  phone: process.env.COMPANY_PHONE || "+91 70107 97721",
  gstNumber: process.env.COMPANY_GSTIN || "29ABCDE1234F1Z5",
  panNumber: process.env.COMPANY_PAN || "ABCDE1234F",
  address: process.env.COMPANY_ADDRESS || "2nd Floor, 149, Sri Nagar, CBE, Chitra Nagar, Hope College, Stop, Peelamedu, Coimbatore, Tamil Nadu",
  city: process.env.COMPANY_CITY || "Coimbatore",
  state: process.env.COMPANY_STATE || "TamilNadu",
  pincode: process.env.COMPANY_PINCODE || "641004",
  country: process.env.COMPANY_COUNTRY || "India",
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const norm = (s) => String(s || "").trim().toLowerCase();

/* =====================================================
   VALIDATION — enterprise mandatory fields
===================================================== */
const validateInvoicePayload = ({ company, billing, items, paymentMode }) => {
  const errors = [];

  // Company
  if (!company.companyName) errors.push("Company name is required");
  if (!company.gstNumber) errors.push("Company GSTIN is required");
  if (!company.address) errors.push("Company address is required");
  if (!company.email && !company.phone) errors.push("Company contact (email or phone) is required");

  // Customer
  if (!billing.contactPerson && !billing.companyName) errors.push("Customer name is required");
  if (!billing.email) errors.push("Customer email is required");
  if (!billing.phone) errors.push("Customer phone is required");
  if (!billing.addressLine1) errors.push("Customer billing address is required");

  // Items
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Invoice must contain at least 1 item");
  } else {
    items.forEach((it, i) => {
      const n = i + 1;
      if (!it.description) errors.push(`Item ${n}: product/service name is required`);
      if (!it.hsnCode && !it.sacCode) errors.push(`Item ${n}: HSN/SAC code is required`);
      if (!(Number(it.quantity) > 0)) errors.push(`Item ${n}: quantity must be greater than 0`);
      if (!(Number(it.unitPrice) >= 0)) errors.push(`Item ${n}: unit price is invalid`);
      if (it.taxPercent === undefined || it.taxPercent === null || Number(it.taxPercent) < 0)
        errors.push(`Item ${n}: tax percentage is required`);
    });
  }

  // Payment
  if (!paymentMode) errors.push("Payment method is required");

  return errors;
};

/* =====================================================
   CREATE INVOICE
===================================================== */
export const createInvoice = async (req, res) => {
  try {
    const {
      customer,
      companyDetails = {},
      billingDetails = {},
      shippingDetails = {},
      items = [],
      invoiceType,
      orderNumber,
      orderDate,
      discountType = "Flat",
      discountValue = 0,
      dueDate,
      issueDate = new Date(),
      purchaseDate,
      subscriptionStart,
      subscriptionEnd,
      taxType: taxTypeIn,
      cgstRate = 9,
      sgstRate = 9,
      igstRate = 18,
      paymentMode,
      notes = "",
      termsAndConditions = "",
      currency = "INR",
    } = req.body;

    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!dueDate) return res.status(400).json({ message: "Due date is required" });

    // Load client for the customer snapshot
    const client = await Client.findById(customer);
    if (!client) return res.status(400).json({ message: "Invalid customer" });

    // ---- Seller (company) snapshot ----
    const company = { ...DEFAULT_COMPANY, ...companyDetails };

    // ---- Customer (billing) snapshot: payload overrides client record ----
    const billing = {
      companyName: billingDetails.companyName || client.companyName,
      contactPerson: billingDetails.contactPerson || client.contactPerson,
      email: billingDetails.email || client.email,
      phone: billingDetails.phone || client.phone,
      addressLine1:
 billingDetails.addressLine1 ||
 client.billingAddress?.addressLine1 ||
 client.billingAddress?.address ||
 client.billingAddress?.street ||
 "",
      addressLine2: billingDetails.addressLine2 || client.billingAddress?.addressLine2,
      city: billingDetails.city || client.billingAddress?.city,
      state: billingDetails.state || client.billingAddress?.state,
      pincode: billingDetails.pincode || client.billingAddress?.pincode,
      country: billingDetails.country || client.billingAddress?.country || "India",
      gstNumber: billingDetails.gstNumber || client.gstNumber,
      panNumber: billingDetails.panNumber || client.panNumber,
    };

    // ---- Shipping snapshot (falls back to billing) ----
    const shipping = {
      companyName: shippingDetails.companyName || billing.companyName,
      contactPerson: shippingDetails.contactPerson || billing.contactPerson,
      phone: shippingDetails.phone || billing.phone,
      addressLine1: shippingDetails.addressLine1 || client.shippingAddress?.addressLine1 || billing.addressLine1,
      addressLine2: shippingDetails.addressLine2 || client.shippingAddress?.addressLine2 || billing.addressLine2,
      city: shippingDetails.city || client.shippingAddress?.city || billing.city,
      state: shippingDetails.state || client.shippingAddress?.state || billing.state,
      pincode: shippingDetails.pincode || client.shippingAddress?.pincode || billing.pincode,
      country: shippingDetails.country || client.shippingAddress?.country || billing.country,
    };

    // ---- Mandatory validation ----
    const errors = validateInvoicePayload({
  company,
  billing,
  items,
  paymentMode
});


if (errors.length) {

  console.log(
    "INVOICE VALIDATION FAILED",
    errors
  );


  return res.status(400).json({
    success:false,
    message: errors.join(", "),
    errors
  });

}
    // ---- GST type: state-driven (intra vs inter), payload can override ----
    const sameState =
      company.state && billing.state && norm(company.state) === norm(billing.state);
    const taxType = taxTypeIn || (sameState ? "INTRA" : "INTER");
    const effGstRate = taxType === "INTRA" ? Number(cgstRate) + Number(sgstRate) : Number(igstRate);

   // ---- Line items ----
let subtotal = 0;
let totalTax = 0;

const processedItems = items.map((item) => {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unitPrice || item.rate || 0);

  // Line Amount
  const lineAmount = round2(quantity * unitPrice);

  // Item Discount
  const itemDiscountType = item.discountType || "Flat";
  const itemDiscountValue = Number(item.discountValue || 0);

  let itemDiscount =
    itemDiscountType === "Percentage"
      ? round2((lineAmount * itemDiscountValue) / 100)
      : round2(itemDiscountValue);

  itemDiscount = Math.min(itemDiscount, lineAmount);

  // Taxable Amount
  const taxableAmount = round2(lineAmount - itemDiscount);

  // GST %
  const taxPercent = Number(item.taxPercent ?? effGstRate);

  // GST Amount
  const taxAmount = round2((taxableAmount * taxPercent) / 100);

  // Line Total
  const total = round2(taxableAmount + taxAmount);

  subtotal += lineAmount;
  totalTax += taxAmount;

  return {
    product: item.product || null,
    description: item.description || "",
    hsnCode: item.hsnCode || "",
    sacCode: item.sacCode || "",
    planType: item.planType || "One-Time",
    users: Number(item.users || 1),

    quantity,
    unitPrice,

    lineAmount,

    discountType: itemDiscountType,
    discountValue: itemDiscountValue,
    discountAmount: itemDiscount,

    taxableAmount,

    taxPercent,
    taxAmount,

    total,
  };
});

subtotal = round2(subtotal);
totalTax = round2(totalTax);

// ----------------------------
// Invoice Discount
// ----------------------------
let invoiceDiscount =
  discountType === "Percentage"
    ? round2((subtotal * Number(discountValue || 0)) / 100)
    : round2(Number(discountValue || 0));

invoiceDiscount = Math.min(invoiceDiscount, subtotal);

// ----------------------------
// Final Taxable Amount
// ----------------------------
const taxableAmount = round2(subtotal - invoiceDiscount);

// ----------------------------
// GST Split
// ----------------------------
let cgstAmount = 0;
let sgstAmount = 0;
let igstAmount = 0;

let cgstP = 0;
let sgstP = 0;
let igstP = 0;

if (taxType === "INTRA") {
  cgstP = Number(cgstRate);
  sgstP = Number(sgstRate);

  cgstAmount = round2((taxableAmount * cgstP) / 100);
  sgstAmount = round2((taxableAmount * sgstP) / 100);

  totalTax = round2(cgstAmount + sgstAmount);
} else {
  igstP = Number(igstRate);

  igstAmount = round2((taxableAmount * igstP) / 100);

  totalTax = round2(igstAmount);
}


// ----------------------------
// Grand Total
// ----------------------------
const preRound = round2(taxableAmount + totalTax);

const grandTotal = Math.round(preRound);

const roundOff = round2(grandTotal - preRound);

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer,
      invoiceType,
      orderNumber,
      companyDetails: company,
      billingDetails: billing,
      shippingDetails: shipping,
      orderDate: orderDate || purchaseDate || issueDate,
      purchaseDate: purchaseDate || issueDate,
      issueDate,
      dueDate,
      subscriptionStart: subscriptionStart || null,
      subscriptionEnd: subscriptionEnd || null,
      placeOfSupply: billing.state || "",
      items: processedItems,
      currency,
      subtotal,
taxableAmount,

discountType,
discountValue: Number(discountValue || 0),

discountAmount: invoiceDiscount,
invoiceDiscountAmount: invoiceDiscount,
discountBeforeTax: true,
taxType,

cgstPercent: cgstP,
cgstAmount,

sgstPercent: sgstP,
sgstAmount,

igstPercent: igstP,
igstAmount,

totalTax,

roundOff,

grandTotal,

amountPaid: 0,
balanceDue: round2(grandTotal),

status: "Draft",
paymentStatus: "Pending",
paymentMode,
notes,
termsAndConditions,
createdBy: req.user?.id,
statusHistory: [
  {
    status: "Draft",
    changedBy: req.user?.id,
    at: new Date(),
  },
],
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    console.error("CREATE INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   GET ALL INVOICES
===================================================== */
export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("customer").sort({ createdAt: -1 });
    res.json({ success: true, data: invoices });
  } catch (err) {
    console.error("GET INVOICES ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   GET SINGLE INVOICE
   ?view=1 auto-marks Sent→Viewed (audited)
===================================================== */
export const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    if (req.query.view && invoice.status === "Sent") {
      invoice.status = "Viewed";
      invoice.statusHistory.push({ status: "Viewed", changedBy: req.user?.id, at: new Date() });
      await invoice.save();
    }

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("GET SINGLE INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   UPDATE INVOICE STATUS (workflow)
   Accepts { status } or legacy { paymentStatus }
===================================================== */
const WORKFLOW = ["Draft", "Sent", "Viewed", "Paid", "Partially Paid", "Overdue", "Cancelled"];

export const updateInvoiceStatus = async (req, res) => {
  try {
    const nextStatus = req.body.status || req.body.paymentStatus;
    if (!WORKFLOW.includes(nextStatus)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${WORKFLOW.join(", ")}` });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.status = nextStatus;
    invoice.updatedBy = req.user?.id;

    // Keep legacy paymentStatus + payment fields consistent
    if (nextStatus === "Paid") {
      invoice.paymentStatus = "Paid";
      invoice.amountPaid = invoice.grandTotal;
      invoice.balanceDue = 0;
      invoice.paymentDate = invoice.paymentDate || new Date();
    } else if (nextStatus === "Partially Paid") {
      invoice.paymentStatus = "Partially Paid";
    } else if (nextStatus === "Cancelled") {
      invoice.paymentStatus = "Cancelled";
    } else if (nextStatus === "Overdue") {
      invoice.paymentStatus = "Overdue";
    }

    invoice.statusHistory.push({
      status: nextStatus,
      note: req.body.note || "",
      changedBy: req.user?.id,
      at: new Date(),
    });

    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("UPDATE INVOICE STATUS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   RECORD PAYMENT
===================================================== */
export const recordPayment = async (req, res) => {
  try {
    const { amount, paymentMode, paymentReference, transactionId, paymentDate } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0)
      return res.status(400).json({ message: "Invalid payment amount" });
    if (!paymentMode) return res.status(400).json({ message: "Payment method is required" });
    if (paymentAmount > invoice.balanceDue + 0.01)
      return res.status(400).json({ message: `Amount exceeds balance due (${invoice.balanceDue})` });

    invoice.amountPaid = round2(invoice.amountPaid + paymentAmount);
    invoice.balanceDue = round2(invoice.grandTotal - invoice.amountPaid);
    invoice.paymentMode = paymentMode;
    invoice.paymentReference = paymentReference || invoice.paymentReference;
    invoice.transactionId = transactionId || invoice.transactionId;
    invoice.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    invoice.updatedBy = req.user?.id;

    const fullyPaid = invoice.balanceDue <= 0;
    invoice.status = fullyPaid ? "Paid" : "Partially Paid";
    invoice.paymentStatus = fullyPaid ? "Paid" : "Partially Paid";

    invoice.paymentHistory.push({
      amount: paymentAmount,
      mode: paymentMode,
      reference: paymentReference || "",
      transactionId: transactionId || "",
      date: invoice.paymentDate,
      recordedBy: req.user?.id,
    });
    invoice.statusHistory.push({
      status: invoice.status,
      note: `Payment ${paymentAmount} recorded`,
      changedBy: req.user?.id,
      at: new Date(),
    });

    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("RECORD PAYMENT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   DOWNLOAD / STREAM PDF
===================================================== */
export const downloadInvoicePdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    await buildInvoicePdf(invoice.toObject(), res);
  } catch (err) {
    console.error("INVOICE PDF ERROR:", err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   SEND INVOICE (email) — marks as Sent + audits.
   NOTE: SMTP dispatch is not wired (no mailer configured);
   this transitions workflow state and records the intent.
===================================================== */
export const sendInvoiceEmail = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const to = req.body.email || invoice.billingDetails?.email || invoice.customer?.email;
    if (!to) return res.status(400).json({ message: "No recipient email available" });

    if (!["Paid", "Cancelled"].includes(invoice.status)) {
      invoice.status = "Sent";
    }
    invoice.updatedBy = req.user?.id;
    invoice.statusHistory.push({
      status: "Sent",
      note: `Emailed to ${to}`,
      changedBy: req.user?.id,
      at: new Date(),
    });
    await invoice.save();

    res.json({ success: true, message: `Invoice queued to ${to}`, data: invoice });
  } catch (err) {
    console.error("SEND INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   DELETE INVOICE
===================================================== */
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json({ success: true, message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("DELETE INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
