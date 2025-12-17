import express from "express";
import auth from "../middlewares/auth.js";
import {
  createLead,
  listLeads,
  getLead,
  updateLead,
  deleteLead
} from "../controllers/leads.controller.js";

const router = express.Router();

router.get("/", auth, listLeads);
router.post("/", auth, createLead);
router.get("/:id", auth, getLead);
router.put("/:id", auth, updateLead);
router.delete("/:id", auth, deleteLead);

export default router;
