import PurchaseOrder from "../models/PurchaseOrder.model.js";
import Stock from "../models/StockTransaction.model.js";

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
  try {
    const po = await PurchaseOrder.findById(req.params.id);

    if (!po) return res.status(404).json({ message: "Purchase order not found" });

    // Add stock for each item
    for (const item of po.items) {
      await Stock.create({
        product: item.product,
        warehouse: req.body.warehouse,
        quantity: item.qty,
        type: "IN",
        reference: po.poNumber,
        createdBy: req.user.id,
      });
    }

    po.status = "RECEIVED";
    await po.save();

    res.json({ message: "PO received & stock updated", po });
  } catch (err) {
    console.error("Error receiving PO:", err);
    res.status(500).json({ message: "Failed to receive purchase order", error: err.message });
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
