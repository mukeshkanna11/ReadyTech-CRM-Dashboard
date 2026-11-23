import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
const staff = role("admin", "employee");
const adminOnly = role("admin");
import rateLimit from "express-rate-limit";
/* Public enquiry form: per-IP cap (each submit emails the visitor + the company) */
const publicLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Too many enquiries from this network. Please try again later." },
});

import {
  createLead,
  createPublicLead,
  listLeads,
  getLead,
  updateLead,
  deleteLead,
  convertLead,
  getLeadTimeline,
} from "../controllers/leads.controller.js";
import { sendLeadMessage } from "../controllers/leadMessage.controller.js";

const router = express.Router();

router.get("/", auth, staff, listLeads);
router.post("/", auth, staff, createLead);
router.post("/public", publicLeadLimiter, createPublicLead);

router.get("/:id", auth, staff, getLead);
router.put("/:id", auth, staff, updateLead);
router.delete("/:id", auth, adminOnly, deleteLead);

router.post("/:id/convert", auth, staff, convertLead);
router.get("/:id/timeline", auth, staff, getLeadTimeline);
router.post("/:id/message", auth, staff, sendLeadMessage);

export default router;