// controllers/inventory.controller.js
import Inventory from "../models/Inventory.model.js";
import Product from "../models/Product.model.js";
import Warehouse from "../models/Warehouse.model.js";

/* ================================
   STOCK IN
================================ */
export const stockIn = async (req, res, next) => {
  try {
    const { product, warehouse, quantity, reference } = req.body;

    if (!product || !warehouse || !quantity) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate product
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    // Validate warehouse
    const warehouseExists = await Warehouse.findById(warehouse);
    if (!warehouseExists) {
      return res.status(400).json({ success: false, message: "Invalid warehouse ID" });
    }

    const stock = await Inventory.create({
      product,
      warehouse,
      inQty: Number(quantity),
      type: "PURCHASE",
      reference: reference || null,
      createdBy: req.user.id,
    });

    return res.json({ success: true, data: stock });
  } catch (err) {
    console.error("❌ STOCK IN ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================
   STOCK OUT
================================ */
export const stockOut = async (req, res, next) => {
  try {
    const { product, warehouse, quantity, reference } = req.body;

    if (!product || !warehouse || !quantity) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate product
    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    // Validate warehouse
    const warehouseExists = await Warehouse.findById(warehouse);
    if (!warehouseExists) {
      return res.status(400).json({ success: false, message: "Invalid warehouse ID" });
    }

    const stock = await Inventory.create({
      product,
      warehouse,
      outQty: Number(quantity),
      type: "SALE",
      reference: reference || null,
      createdBy: req.user.id,
    });

    return res.json({ success: true, data: stock });
  } catch (err) {
    console.error("❌ STOCK OUT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================
   GET ALL INVENTORY
================================ */
export const getInventory = async (req, res, next) => {
  try {
    const inventory = await Inventory.find()
      .populate("product", "name sku price")
      .populate("warehouse", "name location")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: inventory });
  } catch (err) {
    console.error("❌ GET INVENTORY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================
   GET STOCK SUMMARY
================================ */
export const getStockSummary = async (req, res, next) => {
  try {
    const summary = await Inventory.aggregate([
      {
        $group: {
          _id: { product: "$product", warehouse: "$warehouse" },
          inQty: { $sum: "$inQty" },
          outQty: { $sum: "$outQty" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "warehouses",
          localField: "_id.warehouse",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      { $unwind: "$warehouse" },
      {
        $project: {
          _id: 0,
          product: { _id: "$product._id", name: "$product.name", sku: "$product.sku" },
          warehouse: { _id: "$warehouse._id", name: "$warehouse.name" },
          inQty: 1,
          outQty: 1,
          available: { $subtract: ["$inQty", "$outQty"] },
        },
      },
    ]);

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("❌ GET STOCK SUMMARY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
