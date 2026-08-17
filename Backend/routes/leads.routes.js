import express from "express";
import auth from "../middlewares/auth.js";

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

const router = express.Router();

router.get("/", auth, listLeads);
router.post("/", auth, createLead);
router.post("/public", createPublicLead);

router.get("/:id", auth, getLead);
router.put("/:id", auth, updateLead);
router.delete("/:id", auth, deleteLead);

router.post("/:id/convert", auth, convertLead);
router.get("/:id/timeline", auth, getLeadTimeline);

export default router;