import express from "express";
import {
  createWarehouse,
  getWarehouses,
} from "../controllers/warehouse.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/", auth, createWarehouse);
router.get("/", auth, getWarehouses);

export default router;
