import mongoose from "mongoose";
import SalesOrder from "../models/SalesOrder.model.js";
import Inventory from "../models/Inventory.model.js";
import Product from "../models/Product.model.js";
import Warehouse from "../models/Warehouse.model.js";
import { applyReserve, applyRelease } from "./inventory.controller.js";

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
  const { warehouse } = req.body;
  const session = await mongoose.startSession();
  try {
    let salesOrder;
    await session.withTransaction(async () => {
      salesOrder = await SalesOrder.findById(req.params.id).session(session);

      if (!salesOrder) {
        const e = new Error("Sales order not found");
        e.status = 404;
        throw e;
      }

      if (salesOrder.status !== "DRAFT") {
        const e = new Error(`Cannot approve order in ${salesOrder.status} status`);
        e.status = 400;
        throw e;
      }

      // Reserve stock when a fulfilling warehouse is supplied
      if (warehouse) {
        const wh = await Warehouse.findById(warehouse).session(session);
        if (!wh) {
          const e = new Error("Invalid warehouse ID");
          e.status = 400;
          throw e;
        }

        for (const item of salesOrder.items) {
          await applyReserve(item.product, warehouse, item.qty, session);
        }
        salesOrder.warehouse = warehouse;
      }

      salesOrder.status = "APPROVED";
      salesOrder.approvedAt = new Date();
      salesOrder.approvedBy = req.user.id;

      await salesOrder.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Sales order approved successfully",
      salesOrder,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("Approve SO Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/* ==========================================
   DELIVER SALES ORDER
========================================== */
export const deliverSalesOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let salesOrder;
    await session.withTransaction(async () => {
      salesOrder = await SalesOrder.findById(req.params.id)
        .populate("items.product")
        .session(session);

      if (!salesOrder) {
        const e = new Error("Sales order not found");
        e.status = 404;
        throw e;
      }

      if (salesOrder.status !== "APPROVED") {
        const e = new Error("Only approved sales orders can be delivered");
        e.status = 400;
        throw e;
      }

      // Deliver from the reserved warehouse when present, else from the body
      const warehouse = salesOrder.warehouse
        ? String(salesOrder.warehouse)
        : req.body.warehouse;
      if (!warehouse) {
        const e = new Error("Warehouse is required");
        e.status = 400;
        throw e;
      }

      for (const item of salesOrder.items) {
        if (!item.product) {
          const e = new Error("One or more products no longer exist");
          e.status = 400;
          throw e;
        }

        // Negative-stock prevention for each line item (physical on-hand)
        const available = await Inventory.getAvailable(
          item.product._id,
          warehouse,
          session
        );
        if (item.qty > available) {
          const e = new Error(
            `Insufficient stock for ${item.product.name || item.product._id}. Available: ${available}, required: ${item.qty}`
          );
          e.status = 400;
          throw e;
        }

        await Inventory.create(
          [
            {
              product: item.product._id,
              warehouse,
              outQty: item.qty,
              type: "SALE",
              reference: salesOrder._id,
              createdBy: req.user.id,
            },
          ],
          { session }
        );

        // Release the reservation held for this order (clamped)
        if (salesOrder.warehouse) {
          await applyRelease(item.product._id, warehouse, item.qty, session);
        }
      }

      salesOrder.status = "DELIVERED";
      salesOrder.deliveredAt = new Date();
      salesOrder.deliveredBy = req.user.id;

      await salesOrder.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Sales order delivered successfully",
      salesOrder,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("Deliver SO Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    session.endSession();
  }
};

/* ==========================================
   CANCEL SALES ORDER
========================================== */
export const cancelSalesOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let salesOrder;
    await session.withTransaction(async () => {
      salesOrder = await SalesOrder.findById(req.params.id).session(session);

      if (!salesOrder) {
        const e = new Error("Sales order not found");
        e.status = 404;
        throw e;
      }

      if (salesOrder.status === "DELIVERED") {
        const e = new Error("Delivered sales orders cannot be cancelled");
        e.status = 400;
        throw e;
      }

      // Release any stock reserved for this order
      if (salesOrder.status === "APPROVED" && salesOrder.warehouse) {
        for (const item of salesOrder.items) {
          await applyRelease(item.product, String(salesOrder.warehouse), item.qty, session);
        }
      }

      salesOrder.status = "CANCELLED";
      salesOrder.cancelledAt = new Date();
      salesOrder.cancelledBy = req.user.id;

      await salesOrder.save({ session });
    });

    return res.status(200).json({
      success: true,
      message: "Sales order cancelled successfully",
      salesOrder,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("Cancel SO Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};