import express from "express";
import {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
} from "../controllers/vendor.controller.js";
import auth from "../middlewares/auth.js";

import role from "../middlewares/role.js";
const adminOnly = role("admin");
const router = express.Router();

router.post("/", auth, createVendor);
router.get("/", auth, getVendors);
router.put("/:id", auth, updateVendor);
router.delete("/:id", auth, adminOnly, deleteVendor);

export default router;
