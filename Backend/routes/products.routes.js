import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct
} from "../controllers/products.controller.js";

import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";

const router = express.Router();

// Admin only routes
router.post("/", auth, role("admin"), createProduct);
router.get("/", auth, role("admin"), getProducts);
router.get("/:id", auth, role("admin"), getProductById);
router.put("/:id", auth, role("admin"), updateProduct);
router.delete("/:id", auth, role("admin"), deleteProduct);

export default router;
