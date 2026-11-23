import express from "express";
import {
  createSalesOrder,
  getSalesOrders,
  getSalesOrderById,
  updateSalesOrder,
  deleteSalesOrder,
  approveSalesOrder,
  deliverSalesOrder,
  cancelSalesOrder,
} from "../controllers/sales.controller.js";
import auth from "../middlewares/auth.js";

import role from "../middlewares/role.js";
const adminOnly = role("admin");
const router = express.Router();

/* ===============================
   SALES ORDERS ROUTES
================================ */
router.post("/", auth, createSalesOrder);
router.get("/", auth, getSalesOrders);
router.get("/:id", auth, getSalesOrderById);
router.put("/:id", auth, updateSalesOrder);
router.delete("/:id", auth, adminOnly, deleteSalesOrder);

// 🔥 Workflow actions
router.post("/:id/approve", auth, adminOnly, approveSalesOrder);
router.post("/:id/deliver", auth, deliverSalesOrder);
router.post("/:id/cancel", auth, adminOnly, cancelSalesOrder);

export default router;
