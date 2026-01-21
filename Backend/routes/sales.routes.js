import express from "express";
import { createSalesOrder, getSalesOrders } from "../controllers/sales.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// Create new sales order
router.post("/", auth, createSalesOrder);

// Get all sales orders
router.get("/", auth, getSalesOrders);

export default router;
