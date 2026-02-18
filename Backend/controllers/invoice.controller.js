import Invoice from "../models/Invoice.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

/* =====================================================
   CREATE INVOICE
===================================================== */
export const createInvoice = async (req, res) => {
  try {
    const {
      customer,
      billingDetails = {},
      items,
      discountType = "Flat",
      discountValue = 0,
      dueDate,
      issueDate = new Date(),
      subscriptionStart,
      subscriptionEnd,
      paymentMode,
      notes = "",
      termsAndConditions = "",
      currency = "INR",
    } = req.body;

    // VALIDATION
    if (!customer) return res.status(400).json({ message: "Customer is required" });
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Invoice must contain at least 1 item" });

    let subtotal = 0;
    let taxTotal = 0;

    // PROCESS ITEMS
    const processedItems = items.map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || item.rate || 0);
      const taxPercent = Number(item.taxPercent || 0);

      if (quantity <= 0 || unitPrice < 0) {
        throw new Error("Invalid quantity or unit price in items");
      }

      const taxAmount = (quantity * unitPrice * taxPercent) / 100;
      const total = quantity * unitPrice + taxAmount;

      subtotal += quantity * unitPrice;
      taxTotal += taxAmount;

      return {
        product: item.product || null,
        description: item.description || "",
        quantity,
        unitPrice,
        taxPercent,
        taxAmount,
        total,
      };
    });

    // DISCOUNT
    let discountAmount = 0;
    if (discountType === "Percentage") {
      discountAmount = (subtotal * Number(discountValue)) / 100;
    } else {
      discountAmount = Number(discountValue || 0);
    }

    const grandTotal = subtotal + taxTotal - discountAmount;

    // GENERATE UNIQUE INVOICE NUMBER
    const invoiceNumber = await generateInvoiceNumber();

    // CREATE INVOICE
    const invoice = await Invoice.create({
      invoiceNumber,
      customer,
      billingDetails,
      items: processedItems,
      subtotal,
      taxTotal,
      discountType,
      discountValue,
      discountAmount,
      grandTotal,
      balanceDue: grandTotal,
      status: "Draft",
      issueDate,
      dueDate,
      subscriptionStart,
      subscriptionEnd,
      paymentMode,
      notes,
      termsAndConditions,
      currency,
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
    const invoices = await Invoice.find()
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: invoices });
  } catch (err) {
    console.error("GET INVOICES ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   GET SINGLE INVOICE
===================================================== */
export const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("GET SINGLE INVOICE ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

/* =====================================================
   UPDATE INVOICE STATUS
===================================================== */
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.status = status;
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
    const { amount, paymentMode, paymentReference } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) return res.status(400).json({ message: "Invalid payment amount" });

    invoice.amountPaid += paymentAmount;
    invoice.balanceDue = invoice.grandTotal - invoice.amountPaid;
    invoice.paymentMode = paymentMode;
    invoice.paymentReference = paymentReference;

    invoice.status = invoice.balanceDue <= 0 ? "Paid" : "Partially Paid";

    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error("RECORD PAYMENT ERROR:", err);
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
