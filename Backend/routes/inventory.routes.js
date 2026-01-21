import express from "express";
import {
  stockIn,
  stockOut,
  getStockSummary,
} from "../controllers/inventory.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/stock-in", auth, stockIn);
router.post("/stock-out", auth, stockOut);
router.get("/summary", auth, getStockSummary);

export default router;
