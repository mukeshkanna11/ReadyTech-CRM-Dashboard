import SalesOrder from "../models/SalesOrder.model.js";
import Inventory from "../models/Inventory.model.js";
import Product from "../models/Product.model.js";

/* ===============================
   HELPER: AUTO-GENERATE UNIQUE SO NUMBER
================================ */
const generateSONumber = async () => {
  const lastSO = await SalesOrder.findOne().sort({ createdAt: -1 });
  if (!lastSO) return "SO-1001";
  const lastNumber = parseInt(lastSO.soNumber.split("-")[1]);
  return `SO-${lastNumber + 1}`;
};

/* ===============================
   CREATE SALES ORDER
   (VALIDATES PRODUCTS + UNIQUE SO NUMBER)
================================ */
export const createSalesOrder = async (req, res) => {
  try {
    const { items, customer, totalAmount } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: "Sales order items required" });
    }

    // 🔒 Validate product IDs BEFORE creating SO
    for (const item of items) {
      const productExists = await Product.findById(item.product);
      if (!productExists) {
        return res.status(400).json({
          message: `Invalid product ID: ${item.product}`,
        });
      }
    }

    // 🔢 Generate unique SO number
    const soNumber = await generateSONumber();

    const salesOrder = await SalesOrder.create({
      soNumber,
      customer,
      items,
      totalAmount,
      createdBy: req.user.id,
      status: "DRAFT",
    });

    res.status(201).json({
      message: "Sales order created successfully",
      salesOrder,
    });
  } catch (err) {
    // ✅ Handle duplicate SO number gracefully
    if (err.code === 11000) {
      return res.status(400).json({
        message: "Sales order number already exists. Try again.",
      });
    }
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   GET SALES ORDERS
================================ */
export const getSalesOrders = async (req, res) => {
  try {
    const orders = await SalesOrder.find()
      .populate("customer", "name email")
      .populate("items.product", "name sku price")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   APPROVE SALES ORDER
================================ */
export const approveSalesOrder = async (req, res) => {
  try {
    const so = await SalesOrder.findById(req.params.id);

    if (!so) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (so.status !== "DRAFT") {
      return res.status(400).json({
        message: `Cannot approve sales order in ${so.status} status`,
      });
    }

    so.status = "APPROVED";
    so.approvedAt = new Date();
    so.approvedBy = req.user.id;

    await so.save();

    res.json({
      message: "Sales order approved successfully",
      salesOrder: so,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===============================
   DELIVER SALES ORDER
================================ */
export const deliverSalesOrder = async (req, res) => {
  try {
    const { warehouse } = req.body;

    if (!warehouse) {
      return res.status(400).json({ message: "Warehouse is required" });
    }

    const so = await SalesOrder.findById(req.params.id).populate(
      "items.product"
    );

    if (!so) {
      return res.status(404).json({ message: "Sales order not found" });
    }

    if (so.status !== "APPROVED") {
      return res.status(400).json({
        message: "Only approved sales orders can be delivered",
      });
    }

    // 🔻 Reduce inventory safely
    for (const item of so.items) {
      if (!item.product) {
        return res.status(400).json({
          message:
            "One or more products in this sales order no longer exist",
        });
      }

      await Inventory.create({
        product: item.product._id,
        warehouse,
        outQty: item.qty,
        type: "SALE",
        reference: so._id,
        createdBy: req.user.id,
      });
    }

    so.status = "DELIVERED";
    so.deliveredAt = new Date();
    so.deliveredBy = req.user.id;

    await so.save();

    res.json({
      message: "Sales order delivered successfully",
      salesOrder: so,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
