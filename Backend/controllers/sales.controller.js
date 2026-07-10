import SalesOrder from "../models/SalesOrder.model.js";
import Inventory from "../models/Inventory.model.js";
import Product from "../models/Product.model.js";

/* ==========================================
   GENERATE SALES ORDER NUMBER
========================================== */
const generateSONumber = async () => {
  const lastSO = await SalesOrder.findOne()
    .sort({ createdAt: -1 })
    .select("soNumber");

  if (!lastSO) {
    return "SO-1001";
  }

  const lastNumber =
    parseInt(lastSO.soNumber?.split("-")[1]) || 1000;

  return `SO-${lastNumber + 1}`;
};

/* ==========================================
   CREATE SALES ORDER
========================================== */
export const createSalesOrder = async (req, res) => {
  try {
    const { customer, items, notes } = req.body;

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Customer is required",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    /* ---------------------------
       VALIDATE PRODUCTS
    ---------------------------- */
    const productIds = items.map((item) => item.product);

    const products = await Product.find({
      _id: { $in: productIds },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more products are invalid",
      });
    }

    /* ---------------------------
       CALCULATE TOTAL
    ---------------------------- */
    let totalAmount = 0;

    const formattedItems = items.map((item) => {
      const lineTotal = item.qty * item.price;

      totalAmount += lineTotal;

      return {
        product: item.product,
        qty: item.qty,
        price: item.price,
        lineTotal,
      };
    });

    /* ---------------------------
       GENERATE SO NUMBER
    ---------------------------- */
    const soNumber = await generateSONumber();

    const salesOrder = await SalesOrder.create({
      soNumber,
      customer,
      items: formattedItems,
      totalAmount,
      notes,
      status: "DRAFT",
      createdBy: req.user.id,
    });

    const populatedSO = await SalesOrder.findById(
      salesOrder._id
    )
      .populate("customer", "name email phone")
      .populate("items.product", "name sku price");

    return res.status(201).json({
      success: true,
      message: "Sales order created successfully",
      salesOrder: populatedSO,
    });
  } catch (err) {
    console.error("Create SO Error:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate sales order number. Please try again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==========================================
   GET ALL SALES ORDERS
========================================== */
export const getSalesOrders = async (req, res) => {
  try {
    const salesOrders = await SalesOrder.find()
      .populate("customer", "name email phone")
      .populate("items.product", "name sku price")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: salesOrders.length,
      salesOrders,
    });
  } catch (err) {
    console.error("Get SO Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==========================================
   GET SINGLE SALES ORDER
========================================== */
export const getSalesOrderById = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(
      req.params.id
    )
      .populate("customer", "name email phone")
      .populate("items.product", "name sku price")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .populate("deliveredBy", "name email");

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    return res.status(200).json({
      success: true,
      salesOrder,
    });
  } catch (err) {
    console.error("Get SO By ID Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==========================================
   APPROVE SALES ORDER
========================================== */
export const approveSalesOrder = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(
      req.params.id
    );

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    if (salesOrder.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve order in ${salesOrder.status} status`,
      });
    }

    salesOrder.status = "APPROVED";
    salesOrder.approvedAt = new Date();
    salesOrder.approvedBy = req.user.id;

    await salesOrder.save();

    return res.status(200).json({
      success: true,
      message: "Sales order approved successfully",
      salesOrder,
    });
  } catch (err) {
    console.error("Approve SO Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==========================================
   DELIVER SALES ORDER
========================================== */
export const deliverSalesOrder = async (req, res) => {
  try {
    const { warehouse } = req.body;

    if (!warehouse) {
      return res.status(400).json({
        success: false,
        message: "Warehouse is required",
      });
    }

    const salesOrder = await SalesOrder.findById(
      req.params.id
    ).populate("items.product");

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    if (salesOrder.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message:
          "Only approved sales orders can be delivered",
      });
    }

    for (const item of salesOrder.items) {
      if (!item.product) {
        return res.status(400).json({
          success: false,
          message:
            "One or more products no longer exist",
        });
      }

      await Inventory.create({
        product: item.product._id,
        warehouse,
        outQty: item.qty,
        type: "SALE",
        reference: salesOrder._id,
        createdBy: req.user.id,
      });
    }

    salesOrder.status = "DELIVERED";
    salesOrder.deliveredAt = new Date();
    salesOrder.deliveredBy = req.user.id;

    await salesOrder.save();

    return res.status(200).json({
      success: true,
      message: "Sales order delivered successfully",
      salesOrder,
    });
  } catch (err) {
    console.error("Deliver SO Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/* ==========================================
   CANCEL SALES ORDER
========================================== */
export const cancelSalesOrder = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findById(
      req.params.id
    );

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    if (salesOrder.status === "DELIVERED") {
      return res.status(400).json({
        success: false,
        message:
          "Delivered sales orders cannot be cancelled",
      });
    }

    salesOrder.status = "CANCELLED";
    salesOrder.cancelledAt = new Date();
    salesOrder.cancelledBy = req.user.id;

    await salesOrder.save();

    return res.status(200).json({
      success: true,
      message: "Sales order cancelled successfully",
      salesOrder,
    });
  } catch (err) {
    console.error("Cancel SO Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};