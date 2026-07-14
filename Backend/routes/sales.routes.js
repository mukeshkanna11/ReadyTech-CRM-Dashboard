import express from "express";
import {
  createSalesOrder,
  getSalesOrders,
  approveSalesOrder,
  deliverSalesOrder,
  cancelSalesOrder,
} from "../controllers/sales.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* ===============================
   SALES ORDERS ROUTES
================================ */
router.post("/", auth, createSalesOrder);
router.get("/", auth, getSalesOrders);

// 🔥 Workflow actions
router.post("/:id/approve", auth, approveSalesOrder);
router.post("/:id/deliver", auth, deliverSalesOrder);
router.post("/:id/cancel", auth, cancelSalesOrder);

export default router;
