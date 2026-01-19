import express from "express";
import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import Opportunity from "../models/Opportunity.js";
import Activity from "../models/Activity.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* =========================================================
   LEADS CRUD
========================================================= */
// GET ALL LEADS
router.get("/leads", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;
    const query = { department: "Salesforce" };
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
      .skip((page - 1) * limit)
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
  } catch (err) {
    console.error("Fetch leads error:", err);
    res.status(500).json({ message: "Failed to fetch leads" });
  }
});

// CREATE LEAD
router.post("/leads", auth, async (req, res) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      department: "Salesforce",
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
      meta: { leadName: lead.name },
    });

    res.status(201).json(lead);
  } catch (err) {
    console.error("Lead creation error:", err);
    res.status(500).json({ message: "Failed to create lead" });
  }
});

// UPDATE LEAD
router.put("/leads/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const lead = await Lead.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await AuditLog.create({
      action: "UPDATE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
    });

    res.json(lead);
  } catch (err) {
    console.error("Lead update error:", err);
    res.status(500).json({ message: "Failed to update lead" });
  }
});

// DELETE LEAD
router.delete("/leads/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await AuditLog.create({
      action: "DELETE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
    });

    res.json({ message: "Lead deleted successfully" });
  } catch (err) {
    console.error("Lead delete error:", err);
    res.status(500).json({ message: "Failed to delete lead" });
  }
});

/* =========================================================
   OPPORTUNITIES CRUD
========================================================= */
// GET ALL OPPORTUNITIES
router.get("/opportunities", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", stage } = req.query;
    const query = { department: "Salesforce" };
    if (stage) query.stage = stage;
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const opportunities = await Opportunity.find(query)
      .populate("lead")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
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
  } catch (err) {
    console.error("Fetch opportunities error:", err);
    res.status(500).json({ message: "Failed to fetch opportunities" });
  }
});

// CREATE OPPORTUNITY
router.post("/opportunities", auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.create({
      ...req.body,
      department: "Salesforce",
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
      meta: { title: opportunity.title },
    });

    res.status(201).json(opportunity);
  } catch (err) {
    console.error("Opportunity creation error:", err);
    res.status(500).json({ message: "Failed to create opportunity" });
  }
});

// UPDATE OPPORTUNITY
router.put("/opportunities/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const opportunity = await Opportunity.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!opportunity)
      return res.status(404).json({ message: "Opportunity not found" });

    await AuditLog.create({
      action: "UPDATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
    });

    res.json(opportunity);
  } catch (err) {
    console.error("Opportunity update error:", err);
    res.status(500).json({ message: "Failed to update opportunity" });
  }
});

// DELETE OPPORTUNITY
router.delete("/opportunities/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const opportunity = await Opportunity.findByIdAndDelete(id);
    if (!opportunity)
      return res.status(404).json({ message: "Opportunity not found" });

    await AuditLog.create({
      action: "DELETE",
      entity: "Opportunity",
      entityId: opportunity._id,
      user: req.user._id,
    });

    res.json({ message: "Opportunity deleted successfully" });
  } catch (err) {
    console.error("Opportunity delete error:", err);
    res.status(500).json({ message: "Failed to delete opportunity" });
  }
});

/* =========================================================
   ACTIVITIES CRUD
========================================================= */
// GET ALL ACTIVITIES
router.get("/activities", auth, async (req, res) => {
  try {
    const { leadId, opportunityId } = req.query;
    const query = {};
    if (leadId) query.lead = leadId;
    if (opportunityId) query.opportunity = opportunityId;

    const activities = await Activity.find(query)
      .populate("lead", "name email")
      .populate("opportunity", "title")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    console.error("Fetch activities error:", err);
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// CREATE ACTIVITY
router.post("/activities", auth, async (req, res) => {
  try {
    const activity = await Activity.create({
      ...req.body,
      createdBy: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Activity",
      entityId: activity._id,
      user: req.user._id,
      meta: { type: activity.type },
    });

    res.status(201).json(activity);
  } catch (err) {
    console.error("Activity creation error:", err);
    res.status(500).json({ message: "Failed to create activity" });
  }
});

// UPDATE ACTIVITY
router.put("/activities/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const activity = await Activity.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );

    if (!activity) return res.status(404).json({ message: "Activity not found" });

    await AuditLog.create({
      action: "UPDATE",
      entity: "Activity",
      entityId: activity._id,
      user: req.user._id,
    });

    res.json(activity);
  } catch (err) {
    console.error("Activity update error:", err);
    res.status(500).json({ message: "Failed to update activity" });
  }
});

// DELETE ACTIVITY
router.delete("/activities/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID" });

    const activity = await Activity.findByIdAndDelete(id);
    if (!activity) return res.status(404).json({ message: "Activity not found" });

    await AuditLog.create({
      action: "DELETE",
      entity: "Activity",
      entityId: activity._id,
      user: req.user._id,
    });

    res.json({ message: "Activity deleted successfully" });
  } catch (err) {
    console.error("Activity delete error:", err);
    res.status(500).json({ message: "Failed to delete activity" });
  }
});

export default router;
