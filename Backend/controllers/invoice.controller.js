import Invoice from "../models/Invoice.js";
import Client from "../models/Client.js";
import generateInvoiceNumber from "../utils/generateInvoiceNumber.js";

/* =====================================================
   CREATE INVOICE
===================================================== */
export const createInvoice = async (req, res) => {
  try {
    const {
      customer,
      items,
      discountType = "Flat",
      discountValue = 0,
      dueDate,
      issueDate = new Date(),
      purchaseDate = new Date(),
      subscriptionStart,
      subscriptionEnd,
      paymentMode,
      notes = "",
      termsAndConditions = "",
      currency = "INR",
      orderNumber = "",
      invoiceType = "Subscription",
    } = req.body;

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer is required",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: "Due date is required",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invoice must contain at least one item",
      });
    }

    const client = await Client.findById(customer);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    /* =========================
       CUSTOMER SNAPSHOT
    ========================= */
    const billingDetails = {
      companyName:
        client.companyName ||
        client.name ||
        "",

      contactPerson:
        client.contactPerson ||
        client.name ||
        "",

      email:
        client.email || "",

      phone:
        client.phone || "",

      gstNumber:
        client.gstNumber || "",

      addressLine1:
        client.billingAddress?.addressLine1 || "",

      addressLine2:
        client.billingAddress?.addressLine2 || "",

      city:
        client.billingAddress?.city || "",

      state:
        client.billingAddress?.state || "",

      pincode:
        client.billingAddress?.pincode || "",

      country:
        client.billingAddress?.country || "India",
    };

    let subtotal = 0;

    const processedItems = items.map((item) => {
  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unitPrice || 0);
  const taxPercent = Number(item.taxPercent || 0);

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }

  if (unitPrice < 0) {
    throw new Error("Unit price cannot be negative");
  }

  const taxableAmount = quantity * unitPrice;

  const taxAmount = (taxableAmount * taxPercent) / 100;

  const total = taxableAmount + taxAmount;

  subtotal += taxableAmount;

  return {
    product: item.product || null,
    description: item.description || "",
    hsnCode: item.hsnCode || "",
    planType: item.planType || "One-Time",
    users: Number(item.users || 1),
    quantity,
    unitPrice,
    taxableAmount,
    taxPercent,
    taxAmount,   // ✅ FIXED
    total        // ✅ FIXED
  };
});

    /* =========================
       DISCOUNT
    ========================= */
    const taxableAmount = subtotal;

    let discountAmount = 0;

    if (discountType === "Percentage") {
      discountAmount =
        (taxableAmount *
          Number(discountValue || 0)) /
        100;
    } else {
      discountAmount =
        Number(discountValue || 0);
    }

    const netAmount =
      taxableAmount - discountAmount;

    /* =========================
       GST CALCULATION
    ========================= */
    const COMPANY_STATE = "Tamil Nadu";

    const customerState =
      billingDetails.state?.trim() || "";

    let cgstPercent = 0;
    let sgstPercent = 0;
    let igstPercent = 0;

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (
      customerState &&
      customerState.toLowerCase() ===
        COMPANY_STATE.toLowerCase()
    ) {
      cgstPercent = 9;
      sgstPercent = 9;

      cgstAmount =
        (netAmount * cgstPercent) / 100;

      sgstAmount =
        (netAmount * sgstPercent) / 100;
    } else {
      igstPercent = 18;

      igstAmount =
        (netAmount * igstPercent) / 100;
    }

    const totalTax =
      cgstAmount +
      sgstAmount +
      igstAmount;

    const grandTotal =
      netAmount + totalTax;

    /* =========================
       INVOICE NUMBER
    ========================= */
    const invoiceNumber =
      await generateInvoiceNumber();

    /* =========================
       CREATE INVOICE
    ========================= */
    const invoice =
      await Invoice.create({
        invoiceNumber,
        orderNumber,
        invoiceType,

        customer,
        billingDetails,

        purchaseDate,
        issueDate,
        dueDate,

        subscriptionStart,
        subscriptionEnd,

        currency,

        items: processedItems,

        subtotal,
        taxableAmount,

        discountType,
        discountValue,
        discountAmount,

        cgstPercent,
        cgstAmount,

        sgstPercent,
        sgstAmount,

        igstPercent,
        igstAmount,

        totalTax,

        grandTotal,

        amountPaid: 0,
        balanceDue: grandTotal,

        paymentStatus: "Pending",

        paymentMode,

        notes,
        termsAndConditions,
      });

    const populatedInvoice =
      await Invoice.findById(invoice._id)
        .populate(
          "customer",
          "companyName contactPerson name email phone"
        );

    res.status(201).json({
      success: true,
      message:
        "Invoice created successfully",
      data: populatedInvoice,
    });
  } catch (err) {
    console.error(
      "CREATE INVOICE ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* =====================================================
   GET ALL INVOICES
===================================================== */
export const getInvoices = async (
  req,
  res
) => {
  try {
    await Invoice.updateMany(
      {
        dueDate: {
          $lt: new Date(),
        },
        paymentStatus: {
          $nin: [
            "Paid",
            "Cancelled",
          ],
        },
      },
      {
        paymentStatus:
          "Overdue",
      }
    );

    const invoices =
      await Invoice.find()
        .populate("customer")
        .sort({
          createdAt: -1,
        });

    res.json({
      success: true,
      data: invoices,
    });
  } catch (err) {
    console.error(
      "GET INVOICES ERROR:",
      err
    );

    res.status(500).json({
      message: err.message,
    });
  }
};

/* =====================================================
   GET SINGLE INVOICE
===================================================== */
export const getSingleInvoice =
  async (req, res) => {
    try {
      const invoice =
        await Invoice.findById(
          req.params.id
        ).populate("customer");

      if (!invoice) {
        return res
          .status(404)
          .json({
            message:
              "Invoice not found",
          });
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (err) {
      console.error(
        "GET SINGLE INVOICE ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  };

/* =====================================================
   GET CUSTOMER INVOICES
===================================================== */
export const getInvoicesByCustomer =
  async (req, res) => {
    try {
      const invoices =
        await Invoice.find({
          customer:
            req.params.customerId,
        })
          .populate("customer")
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        data: invoices,
      });
    } catch (err) {
      res.status(500).json({
        message: err.message,
      });
    }
  };

/* =====================================================
   UPDATE PAYMENT STATUS
===================================================== */
export const updateInvoiceStatus =
  async (req, res) => {
    try {
      const {
        paymentStatus,
      } = req.body;

      const invoice =
        await Invoice.findById(
          req.params.id
        );

      if (!invoice) {
        return res
          .status(404)
          .json({
            message:
              "Invoice not found",
          });
      }

      invoice.paymentStatus =
        paymentStatus;

      await invoice.save();

      res.json({
        success: true,
        data: invoice,
      });
    } catch (err) {
      console.error(
        "UPDATE STATUS ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  };

/* =====================================================
   RECORD PAYMENT
===================================================== */
export const recordPayment =
  async (req, res) => {
    try {
      const {
        amount,
        paymentMode,
        paymentReference,
      } = req.body;

      const invoice =
        await Invoice.findById(
          req.params.id
        );

      if (!invoice) {
        return res
          .status(404)
          .json({
            message:
              "Invoice not found",
          });
      }

      const paymentAmount =
        Number(amount);

      if (
        !paymentAmount ||
        paymentAmount <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid payment amount",
          });
      }

      invoice.amountPaid +=
        paymentAmount;

      invoice.balanceDue =
        invoice.grandTotal -
        invoice.amountPaid;

      invoice.paymentMode =
        paymentMode;

      invoice.paymentReference =
        paymentReference;

      if (
        invoice.balanceDue <= 0
      ) {
        invoice.paymentStatus =
          "Paid";
      } else {
        invoice.paymentStatus =
          "Partially Paid";
      }

      await invoice.save();

      res.json({
        success: true,
        data: invoice,
      });
    } catch (err) {
      console.error(
        "RECORD PAYMENT ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  };

/* =====================================================
   DELETE INVOICE
===================================================== */
export const deleteInvoice =
  async (req, res) => {
    try {
      const invoice =
        await Invoice.findByIdAndDelete(
          req.params.id
        );

      if (!invoice) {
        return res
          .status(404)
          .json({
            message:
              "Invoice not found",
          });
      }

      res.json({
        success: true,
        message:
          "Invoice deleted successfully",
      });
    } catch (err) {
      console.error(
        "DELETE INVOICE ERROR:",
        err
      );

      res.status(500).json({
        message: err.message,
      });
    }
  };