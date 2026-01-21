import express from "express";
import { createVendor, getVendors } from "../controllers/vendor.controller.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.post("/", auth, createVendor);
router.get("/", auth, getVendors);

export default router;
