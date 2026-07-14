import mongoose from "mongoose";
import PurchaseOrder from "../models/PurchaseOrder.model.js";
import Inventory from "../models/Inventory.model.js";

/* ===================== CREATE PURCHASE ORDER ===================== */
export const createPO = async (req, res) => {
  try {
    const poCount = await PurchaseOrder.countDocuments();
    const po = await PurchaseOrder.create({
      ...req.body,
      poNumber: `PO-${poCount + 1}`,
      createdBy: req.user.id,
    });

    res.status(201).json(po);
  } catch (err) {
    console.error("Error creating PO:", err);
    res.status(500).json({ message: "Failed to create purchase order", error: err.message });
  }
};

/* ===================== RECEIVE PURCHASE ORDER ===================== */
export const receivePO = async (req, res) => {
  const { warehouse } = req.body;
  if (!warehouse) {
    return res.status(400).json({ message: "Warehouse is required" });
  }

  const session = await mongoose.startSession();
  try {
    let po;
    await session.withTransaction(async () => {
      po = await PurchaseOrder.findById(req.params.id).session(session);

      if (!po) {
        const e = new Error("Purchase order not found");
        e.status = 404;
        throw e;
      }

      // Idempotency: never receive the same PO twice (prevents phantom stock)
      if (po.status === "RECEIVED") {
        const e = new Error("Purchase order already received");
        e.status = 400;
        throw e;
      }

      // Add stock for each item via the shared Inventory ledger
      const entries = po.items.map((item) => ({
        product: item.product,
        warehouse,
        inQty: item.qty,
        type: "PURCHASE",
        reference: po._id,
        createdBy: req.user.id,
      }));
      await Inventory.create(entries, { session });

      po.status = "RECEIVED";
      await po.save({ session });
    });

    res.json({ message: "PO received & stock updated", po });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Error receiving PO:", err);
    res.status(500).json({ message: "Failed to receive purchase order", error: err.message });
  } finally {
    session.endSession();
  }
};

/* ===================== GET ALL PURCHASE ORDERS ===================== */
export const getAllPOs = async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .populate("vendor", "name")
      .populate("items.product", "name");
    res.json(pos);
  } catch (err) {
    console.error("Error fetching POs:", err);
    res.status(500).json({ message: "Failed to fetch purchase orders", error: err.message });
  }
};

/* ===================== GET SINGLE PURCHASE ORDER ===================== */
export const getPOById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate("vendor", "name")
      .populate("items.product", "name");

    if (!po) return res.status(404).json({ message: "Purchase order not found" });

    res.json(po);
  } catch (err) {
    console.error("Error fetching PO:", err);
    res.status(500).json({ message: "Failed to fetch purchase order", error: err.message });
  }
};
