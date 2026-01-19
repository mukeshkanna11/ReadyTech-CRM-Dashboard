import express from "express";
import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

// ================= GET ALL ACTIVITIES =================
router.get("/", auth, async (req, res) => {
  try {
    const { lead, opportunity } = req.query;
    const query = {};

    if (lead) query.lead = lead;
    if (opportunity) query.opportunity = opportunity;

    const activities = await Activity.find(query)
      .populate("lead opportunity assignedTo", "name title email")
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    console.error("Fetch activities error:", error);
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// ================= CREATE ACTIVITY =================
router.post("/", auth, async (req, res) => {
  try {
    const activity = await Activity.create({
      ...req.body,
      assignedTo: req.user._id,
    });

    await AuditLog.create({
      action: "CREATE",
      entity: "Activity",
      entityId: activity._id,
      user: req.user._id,
      meta: { type: activity.type },
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error("Activity creation error:", error);
    res.status(500).json({ message: "Failed to create activity" });
  }
});

// ================= UPDATE ACTIVITY =================
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid activity ID" });

    const activity = await Activity.findByIdAndUpdate(id, req.body, { new: true });
    if (!activity) return res.status(404).json({ message: "Activity not found" });

    res.json(activity);
  } catch (error) {
    console.error("Activity update error:", error);
    res.status(500).json({ message: "Failed to update activity" });
  }
});

// ================= DELETE ACTIVITY =================
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid activity ID" });

    const activity = await Activity.findByIdAndDelete(id);
    if (!activity) return res.status(404).json({ message: "Activity not found" });

    res.json({ message: "Activity deleted successfully" });
  } catch (error) {
    console.error("Activity delete error:", error);
    res.status(500).json({ message: "Failed to delete activity" });
  }
});

export default router;
