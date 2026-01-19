import express from "express";
import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import AuditLog from "../models/AuditLog.js";
import Opportunity from "../models/Opportunity.js";
const router = express.Router();

/* =========================================================
   GET ALL LEADS
   GET /api/leads
========================================================= */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

    const query = {};

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Lead.countDocuments(query);

    res.json({
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Fetch leads error:", error);
    res.status(500).json({ message: "Failed to fetch leads" });
  }
});

/* =========================================================
   GET SINGLE LEAD
   GET /api/leads/:id
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findById(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    res.json(lead);
  } catch (error) {
    console.error("Fetch lead error:", error);
    res.status(500).json({ message: "Failed to fetch lead" });
  }
});

/* =========================================================
   CREATE LEAD
   POST /api/leads
========================================================= */
router.post("/", async (req, res) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      createdBy: req.user._id, // from auth middleware
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
      meta: {
        leadName: lead.name,
      },
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error("Lead creation error:", error);
    res.status(500).json({ message: "Failed to create lead" });
  }
});

/* =========================================================
   UPDATE LEAD
   PUT /api/leads/:id
========================================================= */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await AuditLog.create({
      action: "UPDATE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
    });

    res.json(lead);
  } catch (error) {
    console.error("Lead update error:", error);
    res.status(500).json({ message: "Failed to update lead" });
  }
});

/* =========================================================
   DELETE LEAD
   DELETE /api/leads/:id
========================================================= */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await AuditLog.create({
      action: "DELETE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
    });

    res.json({ message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Lead delete error:", error);
    res.status(500).json({ message: "Failed to delete lead" });
  }
});






/* =========================================================
   CONVERT LEAD TO OPPORTUNITY
   POST /api/leads/:id/convert
========================================================= */
router.post("/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, value } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid lead ID" });
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Prevent double conversion
    if (lead.status === "Converted") {
      return res.status(400).json({ message: "Lead already converted" });
    }

    // Create Opportunity
    const opportunity = await Opportunity.create({
      title: title || `${lead.name} Opportunity`,
      lead: lead._id,
      value: value || 0,
      assignedTo: lead.owner,
      department: lead.department || "Salesforce",
    });

    // Update Lead
    lead.status = "Converted";
    await lead.save();

    res.json({
      message: "Lead converted successfully",
      lead,
      opportunity,
    });
  } catch (error) {
    console.error("Lead convert error:", error);
    res.status(500).json({ message: "Failed to convert lead" });
  }
});

export default router;
