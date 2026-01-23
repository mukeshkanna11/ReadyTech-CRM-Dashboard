import express from "express";
import {
  stockIn,
  stockOut,
  getStockSummary,
  getInventory, // ✅ new function
} from "../controllers/inventory.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/stock-in", auth, stockIn);
router.post("/stock-out", auth, stockOut);
router.get("/summary", auth, getStockSummary);
router.get("/", auth, getInventory); // ✅ generic GET inventory

export default router;
