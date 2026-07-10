import express from "express";
import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* =====================================================
   GET ALL ACTIVITIES
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      lead,
      opportunity,
      done,
      search = "",
    } = req.query;

    const query = {};

    if (lead) query.lead = lead;
    if (opportunity) query.opportunity = opportunity;

    if (done !== undefined) {
      query.done = done === "true";
    }

    if (search) {
      query.notes = {
        $regex: search,
        $options: "i",
      };
    }

    const activities = await Activity.find(query)
      .populate("lead", "name status")
      .populate("opportunity", "title stage")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Activity.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Fetch activities error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
    });
  }
});

/* =====================================================
   GET SINGLE ACTIVITY
===================================================== */
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findById(id)
      .populate("lead", "name status")
      .populate("opportunity", "title stage")
      .populate("assignedTo", "name email");

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Get activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity",
    });
  }
});

/* =====================================================
   CREATE ACTIVITY
===================================================== */
router.post("/", auth, async (req, res) => {
  try {
    const {
      type,
      lead,
      opportunity,
      assignedTo,
      notes,
    } = req.body;

    const activity = await Activity.create({
      type,
      lead,
      opportunity,
      notes,
      assignedTo: assignedTo || req.user._id,
      done: false,
    });

    await AuditLog.create({
  user: req.user._id,
  action: "CREATE",
  entity: "Activity",
  entityId: activity._id,
  description: `Created ${activity.type} activity`,
  target: activity.type,
  meta: {
    lead: activity.lead,
    opportunity: activity.opportunity,
  },
});

    const populatedActivity = await Activity.findById(activity._id)
      .populate("lead", "name")
      .populate("opportunity", "title")
      .populate("assignedTo", "name email");

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: populatedActivity,
    });
  } catch (error) {
    console.error("Activity creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create activity",
    });
  }
});

/* =====================================================
   UPDATE ACTIVITY
===================================================== */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("lead", "name")
      .populate("opportunity", "title")
      .populate("assignedTo", "name email");

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await AuditLog.create({
  user: req.user._id,
  action: "UPDATE",
  entity: "Activity",
  entityId: activity._id,
  description: `Updated ${activity.type} activity`,
  target: activity.type,
});

    return res.status(200).json({
      success: true,
      message: "Activity updated successfully",
      data: activity,
    });
  } catch (error) {
    console.error("Activity update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update activity",
    });
  }
});

/* =====================================================
   MARK ACTIVITY COMPLETE
===================================================== */
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    activity.done = true;

    await activity.save();

    await AuditLog.create({
      user: req.user._id,
      action: "COMPLETE_ACTIVITY",
      description: `Completed ${activity.type} activity`,
      target: activity._id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: "Activity marked as completed",
      data: activity,
    });
  } catch (error) {
    console.error("Complete activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete activity",
    });
  }
});

/* =====================================================
   DELETE ACTIVITY
===================================================== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findByIdAndDelete(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await AuditLog.create({
  user: req.user._id,
  action: "DELETE",
  entity: "Activity",
  entityId: activity._id,
  description: `Deleted ${activity.type} activity`,
  target: activity.type,
});

    return res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("Activity delete error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete activity",
    });
  }
});

/* =====================================================
   DASHBOARD STATS
===================================================== */
router.get("/dashboard/stats/summary", auth, async (req, res) => {
  try {
    const total = await Activity.countDocuments();
    const completed = await Activity.countDocuments({ done: true });
    const pending = await Activity.countDocuments({ done: false });

    const calls = await Activity.countDocuments({
      type: "Call",
    });

    const emails = await Activity.countDocuments({
      type: "Email",
    });

    const meetings = await Activity.countDocuments({
      type: "Meeting",
    });

    return res.status(200).json({
      success: true,
      stats: {
        total,
        completed,
        pending,
        calls,
        emails,
        meetings,
      },
    });
  } catch (error) {
    console.error("Activity stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity stats",
    });
  }
});

export default router;