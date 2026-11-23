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
import role from "../middlewares/role.js";
const staff = role("admin", "employee");
const adminOnly = role("admin");
import rateLimit from "express-rate-limit";
/* Outbound invoice email: per-user cap (spam / phishing guard) */
const invoiceSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `invoice-send:${req.user?._id}`,
  message: { success: false, message: "Too many invoice emails sent. Please try again later." },
});

const router = express.Router();

/* Validate :id early */
const validateId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid Invoice ID" });
  }
  next();
};

router.post("/", auth, staff, createInvoice);
router.get("/", auth, staff, getInvoices);

router.get("/:id", auth, staff, validateId, getSingleInvoice);
router.get("/:id/pdf", auth, staff, validateId, downloadInvoicePdf);
router.post("/:id/send", auth, staff, invoiceSendLimiter, validateId, sendInvoiceEmail);
router.put("/:id/payment", auth, adminOnly, validateId, recordPayment);
router.put("/:id/status", auth, adminOnly, validateId, updateInvoiceStatus);
router.delete("/:id", auth, adminOnly, validateId, deleteInvoice);

export default router;
