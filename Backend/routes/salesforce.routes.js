import express from "express";
import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import Opportunity from "../models/Opportunity.js";
import Activity from "../models/Activity.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* ==================================================
   LEADS
================================================== */

// GET LEADS
router.get("/leads", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    const query = {};

    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { source: { $regex: search, $options: "i" } },
      ];
    }

    const leads = await Lead.find(query)
      .populate("owner", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Lead.countDocuments(query);

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch leads",
    });
  }
});

// CREATE LEAD
router.post("/leads", auth, async (req, res) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      owner: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: "CREATE_LEAD",
      description: `Lead created: ${lead.name}`,
      target: lead._id.toString(),
    });

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create lead",
    });
  }
});

// UPDATE LEAD
router.put("/leads/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead id",
      });
    }

    const lead = await Lead.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "UPDATE_LEAD",
      description: `Lead updated: ${lead.name}`,
      target: lead._id.toString(),
    });

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update lead",
    });
  }
});

// DELETE LEAD
router.delete("/leads/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findByIdAndDelete(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "DELETE_LEAD",
      description: `Lead deleted: ${lead.name}`,
      target: lead._id.toString(),
    });

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete lead",
    });
  }
});

/* ==================================================
   OPPORTUNITIES
================================================== */

// GET OPPORTUNITIES
router.get("/opportunities", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, stage, search } = req.query;

    const query = {};

    if (stage) query.stage = stage;

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    const opportunities = await Opportunity.find(query)
      .populate("lead")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Opportunity.countDocuments(query);

    res.json({
      success: true,
      data: opportunities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch opportunities",
    });
  }
});

// CREATE OPPORTUNITY
router.post("/opportunities", auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.create(req.body);

    await AuditLog.create({
      user: req.user._id,
      action: "CREATE_OPPORTUNITY",
      description: `Opportunity created: ${opportunity.title}`,
      target: opportunity._id.toString(),
    });

    res.status(201).json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create opportunity",
    });
  }
});

// UPDATE OPPORTUNITY
router.put("/opportunities/:id", auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "UPDATE_OPPORTUNITY",
      description: `Opportunity updated: ${opportunity.title}`,
      target: opportunity._id.toString(),
    });

    res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update opportunity",
    });
  }
});

// DELETE OPPORTUNITY
router.delete("/opportunities/:id", auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findByIdAndDelete(
      req.params.id
    );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "DELETE_OPPORTUNITY",
      description: `Opportunity deleted: ${opportunity.title}`,
      target: opportunity._id.toString(),
    });

    res.json({
      success: true,
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete opportunity",
    });
  }
});

/* ==================================================
   ACTIVITIES
================================================== */

// GET ACTIVITIES
router.get("/activities", auth, async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate("lead", "name")
      .populate("opportunity", "title")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
    });
  }
});

// CREATE ACTIVITY
router.post("/activities", auth, async (req, res) => {
  try {
    const activity = await Activity.create({
      ...req.body,
      assignedTo: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: "CREATE_ACTIVITY",
      description: `Activity created: ${activity.type}`,
      target: activity._id.toString(),
    });

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create activity",
    });
  }
});

// UPDATE ACTIVITY
router.put("/activities/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "UPDATE_ACTIVITY",
      description: `Activity updated`,
      target: activity._id.toString(),
    });

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update activity",
    });
  }
});

// DELETE ACTIVITY
router.delete("/activities/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "DELETE_ACTIVITY",
      description: `Activity deleted`,
      target: activity._id.toString(),
    });

    res.json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete activity",
    });
  }
});

export default router;