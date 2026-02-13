import Invoice from "../models/Invoice.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

/* ==========================================
   CREATE INVOICE
========================================== */
export const createInvoice = async (req, res) => {
  try {
    const { customer, items, tax, discount, dueDate } = req.body;

    let subtotal = 0;

    const updatedItems = items.map((item) => {
      const total = item.quantity * item.price;
      subtotal += total;
      return { ...item, total };
    });

    const totalAmount =
      subtotal + (subtotal * tax) / 100 - (discount || 0);

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer,
      items: updatedItems,
      subtotal,
      tax,
      discount,
      totalAmount,
      dueDate,
    });

    res.status(201).json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================
   GET ALL INVOICES
========================================== */
export const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================
   GET SINGLE INVOICE
========================================== */
export const getSingleInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer");

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================
   UPDATE STATUS
========================================== */
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { status, paymentMode } = req.body;

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { status, paymentMode },
      { new: true }
    );

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================
   DELETE
========================================== */
export const deleteInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: "Invoice Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
