import express from "express";
import auth from "../middlewares/auth.js";
import {
  createPO,
  receivePO,
  getAllPOs,
  getPOById,
} from "../controllers/purchase.controller.js";

const router = express.Router();

// GET all POs
router.get("/", auth, getAllPOs);

// GET single PO
router.get("/:id", auth, getPOById);

// CREATE PO
router.post("/", auth, createPO);

// RECEIVE PO
router.post("/:id/receive", auth, receivePO);

export default router;
