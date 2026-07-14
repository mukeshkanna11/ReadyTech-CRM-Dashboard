// controllers/inventory.controller.js
import mongoose from "mongoose";
import Inventory from "../models/Inventory.model.js";
import Product from "../models/Product.model.js";
import Warehouse from "../models/Warehouse.model.js";
import StockLevel from "../models/StockLevel.model.js";
import AuditLog from "../models/AuditLog.js";

/* ================================
   Shared validation helper
================================ */
const validateRefs = async (product, warehouse, session) => {
  const productExists = await Product.findById(product).session(session);
  if (!productExists) {
    const e = new Error("Invalid product ID");
    e.status = 400;
    throw e;
  }
  const warehouseExists = await Warehouse.findById(warehouse).session(session);
  if (!warehouseExists) {
    const e = new Error("Invalid warehouse ID");
    e.status = 400;
    throw e;
  }
};

const ensureWarehouse = async (id, session) => {
  const exists = await Warehouse.findById(id).session(session);
  if (!exists) {
    const e = new Error("Invalid warehouse ID");
    e.status = 400;
    throw e;
  }
  return exists;
};

/* ================================
   RESERVATION CORE (shared with Sales Order flow)
   available-to-promise = onHand (ledger) − reserved
================================ */
export const applyReserve = async (product, warehouse, qty, session) => {
  const onHand = await Inventory.getAvailable(product, warehouse, session);
  const reserved = await StockLevel.getReserved(product, warehouse, session);
  const available = onHand - reserved;

  if (qty > available) {
    const e = new Error(`Insufficient available stock. Available: ${available}, requested: ${qty}`);
    e.status = 400;
    throw e;
  }

  await StockLevel.updateOne(
    { product, warehouse },
    { $inc: { reserved: qty } },
    { upsert: true, session }
  );
};

// strict=true rejects releasing more than reserved; otherwise clamps (used by SO flow)
export const applyRelease = async (product, warehouse, qty, session, { strict = false } = {}) => {
  const reserved = await StockLevel.getReserved(product, warehouse, session);

  if (strict && qty > reserved) {
    const e = new Error(`Cannot release more than reserved. Reserved: ${reserved}, requested: ${qty}`);
    e.status = 400;
    throw e;
  }

  const dec = Math.min(qty, reserved);
  if (dec > 0) {
    await StockLevel.updateOne(
      { product, warehouse },
      { $inc: { reserved: -dec } },
      { session }
    );
  }
  return dec;
};

/* ================================
   STOCK IN
================================ */
export const stockIn = async (req, res, next) => {
  const { product, warehouse, quantity, reference } = req.body;

  if (!product || !warehouse || !quantity) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
  }

  const session = await mongoose.startSession();
  try {
    let stock;
    await session.withTransaction(async () => {
      await validateRefs(product, warehouse, session);

      const [doc] = await Inventory.create(
        [
          {
            product,
            warehouse,
            inQty: qty,
            type: "PURCHASE",
            reference: reference || null,
            createdBy: req.user.id,
          },
        ],
        { session }
      );
      stock = doc;
    });

    return res.json({ success: true, data: stock });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ STOCK IN ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/* ================================
   STOCK OUT
   Prevents stock from going negative.
================================ */
export const stockOut = async (req, res, next) => {
  const { product, warehouse, quantity, reference } = req.body;

  if (!product || !warehouse || !quantity) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
  }

  const session = await mongoose.startSession();
  try {
    let stock;
    await session.withTransaction(async () => {
      await validateRefs(product, warehouse, session);

      // Negative-stock prevention — check available inside the transaction
      const available = await Inventory.getAvailable(product, warehouse, session);
      if (qty > available) {
        const e = new Error(`Insufficient stock. Available: ${available}, requested: ${qty}`);
        e.status = 400;
        throw e;
      }

      const [doc] = await Inventory.create(
        [
          {
            product,
            warehouse,
            outQty: qty,
            type: "SALE",
            reference: reference || null,
            createdBy: req.user.id,
          },
        ],
        { session }
      );
      stock = doc;
    });

    return res.json({ success: true, data: stock });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ STOCK OUT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
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
        $lookup: {
          from: "stocklevels",
          let: { p: "$_id.product", w: "$_id.warehouse" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$product", "$$p"] }, { $eq: ["$warehouse", "$$w"] }] } } },
            { $project: { _id: 0, reserved: 1 } },
          ],
          as: "level",
        },
      },
      {
        $addFields: {
          onHand: { $subtract: ["$inQty", "$outQty"] },
          reserved: { $ifNull: [{ $arrayElemAt: ["$level.reserved", 0] }, 0] },
        },
      },
      {
        $project: {
          _id: 0,
          product: {
            _id: "$product._id",
            name: "$product.name",
            sku: "$product.sku",
            price: "$product.price",
            lowStockLimit: "$product.lowStockLimit",
          },
          warehouse: { _id: "$warehouse._id", name: "$warehouse.name" },
          inQty: 1,
          outQty: 1,
          onHand: 1,
          reserved: 1,
          available: { $subtract: ["$onHand", "$reserved"] },
        },
      },
    ]);

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("❌ GET STOCK SUMMARY ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================
   STOCK ADJUSTMENT
   Body: { product, warehouse, delta, reason }
   delta > 0 → increase, delta < 0 → decrease.
   Requires a reason (audited). Prevents negative stock.
================================ */
export const adjustStock = async (req, res, next) => {
  const { product, warehouse, delta, reason } = req.body;

  if (!product || !warehouse || delta === undefined || delta === null) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) {
    return res.status(400).json({ success: false, message: "Adjustment quantity must be a non-zero number" });
  }

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: "A reason is required for stock adjustments" });
  }

  const session = await mongoose.startSession();
  try {
    let stock;
    await session.withTransaction(async () => {
      await validateRefs(product, warehouse, session);

      // Negative-stock prevention for decreases
      if (d < 0) {
        const available = await Inventory.getAvailable(product, warehouse, session);
        if (Math.abs(d) > available) {
          const e = new Error(`Insufficient stock. Available: ${available}, requested decrease: ${Math.abs(d)}`);
          e.status = 400;
          throw e;
        }
      }

      const [doc] = await Inventory.create(
        [
          {
            product,
            warehouse,
            inQty: d > 0 ? d : 0,
            outQty: d < 0 ? Math.abs(d) : 0,
            type: "ADJUSTMENT",
            reason: String(reason).trim(),
            createdBy: req.user.id,
          },
        ],
        { session }
      );
      stock = doc;

      await AuditLog.create(
        [
          {
            user: req.user.id,
            action: "UPDATE",
            entity: "Inventory",
            entityId: doc._id,
            description: `Stock adjusted by ${d > 0 ? "+" : ""}${d}`,
            meta: { product, warehouse, delta: d, reason: String(reason).trim() },
          },
        ],
        { session }
      );
    });

    return res.json({ success: true, data: stock });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ STOCK ADJUSTMENT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/* ================================
   WAREHOUSE TRANSFER
   Body: { product, fromWarehouse, toWarehouse, quantity, reason }
   Creates two linked ledger legs (TRANSFER_OUT + TRANSFER_IN)
   atomically. Prevents negative stock in the source warehouse.
================================ */
export const transferStock = async (req, res, next) => {
  const { product, fromWarehouse, toWarehouse, quantity, reason } = req.body;

  if (!product || !fromWarehouse || !toWarehouse || !quantity) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  if (String(fromWarehouse) === String(toWarehouse)) {
    return res.status(400).json({ success: false, message: "Source and destination warehouses must differ" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
  }

  const session = await mongoose.startSession();
  try {
    let legs;
    await session.withTransaction(async () => {
      // product + source warehouse
      await validateRefs(product, fromWarehouse, session);
      // destination warehouse
      await ensureWarehouse(toWarehouse, session);

      const available = await Inventory.getAvailable(product, fromWarehouse, session);
      if (qty > available) {
        const e = new Error(`Insufficient stock in source warehouse. Available: ${available}, requested: ${qty}`);
        e.status = 400;
        throw e;
      }

      // Shared reference links both legs of the transfer
      const transferRef = new mongoose.Types.ObjectId();
      const note = reason ? String(reason).trim() : "";

      legs = await Inventory.create(
        [
          {
            product,
            warehouse: fromWarehouse,
            outQty: qty,
            type: "TRANSFER_OUT",
            reference: transferRef,
            reason: note,
            createdBy: req.user.id,
          },
          {
            product,
            warehouse: toWarehouse,
            inQty: qty,
            type: "TRANSFER_IN",
            reference: transferRef,
            reason: note,
            createdBy: req.user.id,
          },
        ],
        { session, ordered: true }
      );

      await AuditLog.create(
        [
          {
            user: req.user.id,
            action: "UPDATE",
            entity: "Inventory",
            entityId: transferRef,
            description: `Transferred ${qty} units between warehouses`,
            meta: { product, fromWarehouse, toWarehouse, quantity: qty, reason: note, transferRef },
          },
        ],
        { session }
      );
    });

    return res.json({ success: true, data: legs });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ WAREHOUSE TRANSFER ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/* ================================
   RESERVE STOCK
   Body: { product, warehouse, quantity, reference? }
================================ */
export const reserveStock = async (req, res, next) => {
  const { product, warehouse, quantity, reference } = req.body;

  if (!product || !warehouse || !quantity) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await validateRefs(product, warehouse, session);
      await applyReserve(product, warehouse, qty, session);

      await AuditLog.create(
        [
          {
            user: req.user.id,
            action: "UPDATE",
            entity: "Inventory",
            description: `Reserved ${qty} units`,
            meta: { product, warehouse, quantity: qty, reference: reference || null },
          },
        ],
        { session }
      );
    });

    const reserved = await StockLevel.getReserved(product, warehouse);
    return res.json({ success: true, data: { product, warehouse, reserved } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ RESERVE STOCK ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

/* ================================
   RELEASE STOCK
   Body: { product, warehouse, quantity, reference? }
================================ */
export const releaseStock = async (req, res, next) => {
  const { product, warehouse, quantity, reference } = req.body;

  if (!product || !warehouse || !quantity) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be a positive number" });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await validateRefs(product, warehouse, session);
      await applyRelease(product, warehouse, qty, session, { strict: true });

      await AuditLog.create(
        [
          {
            user: req.user.id,
            action: "UPDATE",
            entity: "Inventory",
            description: `Released ${qty} reserved units`,
            meta: { product, warehouse, quantity: qty, reference: reference || null },
          },
        ],
        { session }
      );
    });

    const reserved = await StockLevel.getReserved(product, warehouse);
    return res.json({ success: true, data: { product, warehouse, reserved } });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error("❌ RELEASE STOCK ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};
