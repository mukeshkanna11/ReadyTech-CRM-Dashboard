import express from "express";
import mongoose from "mongoose";
import {
  createInvoice,
  getInvoices,
  getSingleInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  recordPayment,
} from "../controllers/invoice.controller.js";

const router = express.Router();

/* ==========================================
   CREATE INVOICE
========================================== */
router.post("/", createInvoice);

/* ==========================================
   GET ALL INVOICES
========================================== */
router.get("/", getInvoices);

/* ==========================================
   GET SINGLE INVOICE (SAFE VERSION)
========================================== */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Invoice ID" });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}, getSingleInvoice);

/* ==========================================
   RECORD PAYMENT (NEW - IMPORTANT)
========================================== */
router.put("/:id/payment", async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Invoice ID" });
  }

  next();
}, recordPayment);

/* ==========================================
   UPDATE STATUS
========================================== */
router.put("/:id/status", async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Invoice ID" });
  }

  next();
}, updateInvoiceStatus);

/* ==========================================
   DELETE INVOICE
========================================== */
router.delete("/:id", async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Invoice ID" });
  }

  next();
}, deleteInvoice);

export default router;
