import express from "express";
import mongoose from "mongoose";
import {
  createInvoice,
  getInvoices,
  getSingleInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  recordPayment,
  downloadInvoicePdf,
  sendInvoiceEmail,
} from "../controllers/invoice.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* Validate :id early */
const validateId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid Invoice ID" });
  }
  next();
};

router.post("/", auth, createInvoice);
router.get("/", auth, getInvoices);

router.get("/:id", auth, validateId, getSingleInvoice);
router.get("/:id/pdf", auth, validateId, downloadInvoicePdf);
router.post("/:id/send", auth, validateId, sendInvoiceEmail);
router.put("/:id/payment", auth, validateId, recordPayment);
router.put("/:id/status", auth, validateId, updateInvoiceStatus);
router.delete("/:id", auth, validateId, deleteInvoice);

export default router;
