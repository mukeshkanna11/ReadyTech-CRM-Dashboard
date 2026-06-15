import express from "express";
import mongoose from "mongoose";

import {
  createInvoice,
  getInvoices,
  getSingleInvoice,
  getInvoicesByCustomer,
  updateInvoiceStatus,
  recordPayment,
  deleteInvoice,
} from "../controllers/invoice.controller.js";

const router = express.Router();

/* ==========================================
   MONGODB ID VALIDATOR
========================================== */
const validateObjectId = (req, res, next) => {
  const { id, customerId } = req.params;

  const value = id || customerId;

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID",
    });
  }

  next();
};

/* ==========================================
   CREATE INVOICE
========================================== */
router.post("/", createInvoice);

/* ==========================================
   GET ALL INVOICES
========================================== */
router.get("/", getInvoices);

/* ==========================================
   GET INVOICES BY CUSTOMER
========================================== */
router.get(
  "/customer/:customerId",
  validateObjectId,
  getInvoicesByCustomer
);

/* ==========================================
   GET SINGLE INVOICE
========================================== */
router.get(
  "/:id",
  validateObjectId,
  getSingleInvoice
);

/* ==========================================
   RECORD PAYMENT
========================================== */
router.put(
  "/:id/payment",
  validateObjectId,
  recordPayment
);

/* ==========================================
   UPDATE PAYMENT STATUS
========================================== */
router.put(
  "/:id/status",
  validateObjectId,
  updateInvoiceStatus
);

/* ==========================================
   DELETE INVOICE
========================================== */
router.delete(
  "/:id",
  validateObjectId,
  deleteInvoice
);

export default router;