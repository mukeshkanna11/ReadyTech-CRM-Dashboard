import express from "express";
import {
  createInvoice,
  getInvoices,
  getSingleInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "../controllers/invoice.controller.js";

const router = express.Router();

router.post("/", createInvoice);
router.get("/", getInvoices);
router.get("/:id", getSingleInvoice);
router.put("/:id/status", updateInvoiceStatus);
router.delete("/:id", deleteInvoice);

export default router;
