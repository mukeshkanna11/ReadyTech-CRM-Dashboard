import Invoice from "../models/Invoice.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

/* =====================================================
   CREATE INVOICE (Enterprise Safe Version)
===================================================== */
export const createInvoice = async (req, res) => {
  try {
    const {
      customer,
      billingDetails,
      items,
      discountType = "Flat",
      discountValue = 0,
      dueDate,
      issueDate,
      subscriptionStart,
      subscriptionEnd,
      paymentMode,
      notes,
      termsAndConditions,
      currency = "INR",
    } = req.body;

    if (!customer) {
      return res.status(400).json({ success: false, message: "Customer is required" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Invoice must contain at least one item" });
    }

    let subtotal = 0;
    let taxTotal = 0;

    const processedItems = items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const taxPercent = Number(item.taxPercent) || 0;

      if (quantity <= 0 || unitPrice <= 0) {
        throw new Error("Invalid quantity or unit price");
      }

      const baseTotal = quantity * unitPrice;
      const taxAmount = (baseTotal * taxPercent) / 100;
      const total = baseTotal + taxAmount;

      subtotal += baseTotal;
      taxTotal += taxAmount;

      return {
        ...item,
        quantity,
        unitPrice,
        taxPercent,
        taxAmount,
        total,
      };
    });

    /* ================= Discount Calculation ================= */

    let discountAmount = 0;
    const safeDiscountValue = Number(discountValue) || 0;

    if (discountType === "Percentage") {
      discountAmount = (subtotal * safeDiscountValue) / 100;
    } else {
      discountAmount = safeDiscountValue;
    }

    if (discountAmount < 0) discountAmount = 0;
    if (discountAmount > subtotal) discountAmount = subtotal;

    /* ================= Grand Total ================= */

    let grandTotal = subtotal + taxTotal - discountAmount;

    if (grandTotal < 0) grandTotal = 0;
    if (isNaN(grandTotal)) {
      return res.status(400).json({
        success: false,
        message: "Calculation error occurred",
      });
    }

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer,
      billingDetails,
      items: processedItems,
      subtotal,
      taxTotal,
      discountType,
      discountValue: safeDiscountValue,
      discountAmount,
      grandTotal,
      amountPaid: 0,
      balanceDue: grandTotal,
      status: "Draft",
      issueDate: issueDate || new Date(),
      dueDate,
      subscriptionStart,
      subscriptionEnd,
      paymentMode,
      notes,
      termsAndConditions,
      currency,
    });

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    console.error("Create Invoice Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/* =====================================================
   GET ALL INVOICES
===================================================== */
export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("customer")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error("Get Invoices Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   GET SINGLE INVOICE
===================================================== */
export const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer")
      .lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Get Single Invoice Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   RECORD PAYMENT (Enterprise Safe)
===================================================== */
export const recordPayment = async (req, res) => {
  try {
    const { amount, paymentMode, paymentReference } = req.body;

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment amount" });
    }

    invoice.amountPaid = (invoice.amountPaid || 0) + paymentAmount;

    invoice.balanceDue = invoice.grandTotal - invoice.amountPaid;

    invoice.paymentMode = paymentMode;
    invoice.paymentReference = paymentReference;

    if (invoice.balanceDue <= 0) {
      invoice.status = "Paid";
      invoice.balanceDue = 0;
    } else {
      invoice.status = "Partially Paid";
    }

    await invoice.save();

    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: invoice,
    });
  } catch (error) {
    console.error("Record Payment Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   UPDATE INVOICE STATUS
===================================================== */
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    invoice.status = status;
    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =====================================================
   DELETE INVOICE
===================================================== */
export const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    res.json({ success: true, message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Delete Invoice Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
