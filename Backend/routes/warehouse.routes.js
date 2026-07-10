import express from "express";
import {
  createWarehouse,
  getWarehouses,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseById,
} from "../controllers/warehouse.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* ================= GET ALL ================= */
router.get("/", auth, getWarehouses);

/* ================= GET SINGLE ================= */
router.get("/:id", auth, getWarehouseById);

/* ================= CREATE ================= */
router.post("/", auth, createWarehouse);

/* ================= UPDATE ================= */
router.put("/:id", auth, updateWarehouse);

/* ================= DELETE ================= */
router.delete("/:id", auth, deleteWarehouse);

export default router;