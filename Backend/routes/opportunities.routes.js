import express from "express";
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// ================= GET ALL OPPORTUNITIES =================
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", stage } = req.query;
    const query = { department: "Salesforce" };

    if (stage) query.stage = stage;
    if (search) query.title = { $regex: search, $options: "i" };

    const opportunities = await Opportunity.find(query)
      .populate("lead assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Opportunity.countDocuments(query);

    res.json({
      data: opportunities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Fetch opportunities error:", error);
    res.status(500).json({ message: "Failed to fetch opportunities" });
  }
});

// ================= CREATE OPPORTUNITY =================
router.post("/", auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.create({
      ...req.body,
      department: "Salesforce",
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
      meta: { title: opportunity.title },
    });

    res.status(201).json(opportunity);
  } catch (error) {
    console.error("Opportunity creation error:", error);
    res.status(500).json({ message: "Failed to create opportunity" });
  }
});

// ================= UPDATE OPPORTUNITY =================
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid opportunity ID" });

    const opportunity = await Opportunity.findByIdAndUpdate(id, req.body, { new: true });
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });

    await AuditLog.create({
      action: "UPDATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
    });

    res.json(opportunity);
  } catch (error) {
    console.error("Opportunity update error:", error);
    res.status(500).json({ message: "Failed to update opportunity" });
  }
});

// ================= DELETE OPPORTUNITY =================
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid opportunity ID" });

    const opportunity = await Opportunity.findByIdAndDelete(id);
    if (!opportunity) return res.status(404).json({ message: "Opportunity not found" });

    await AuditLog.create({
      action: "DELETE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
    });

    res.json({ message: "Opportunity deleted successfully" });
  } catch (error) {
    console.error("Opportunity delete error:", error);
    res.status(500).json({ message: "Failed to delete opportunity" });
  }
});

export default router;
