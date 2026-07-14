import express from "express";
import {
  stockIn,
  stockOut,
  getStockSummary,
  getInventory,
  adjustStock,
  transferStock,
  reserveStock,
  releaseStock,
} from "../controllers/inventory.controller.js";
import {
  getInventoryPage,
  getLowStockAlerts,
  getStockMovements,
  getInventoryValuation,
  exportInventory,
} from "../controllers/inventoryReport.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/stock-in", auth, stockIn);
router.post("/stock-out", auth, stockOut);
router.post("/adjust", auth, adjustStock);
router.post("/transfer", auth, transferStock);
router.post("/reserve", auth, reserveStock);
router.post("/release", auth, releaseStock);

/* ===== Phase 4 — scalability & reporting (read-only) ===== */
router.get("/paginated", auth, getInventoryPage);
router.get("/low-stock", auth, getLowStockAlerts);
router.get("/movements", auth, getStockMovements);
router.get("/valuation", auth, getInventoryValuation);
router.get("/export", auth, exportInventory);

router.get("/summary", auth, getStockSummary);
router.get("/", auth, getInventory); // ✅ generic GET inventory

export default router;
