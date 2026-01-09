import express from "express";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   GET ALL USERS
   GET /api/admin/users
========================================================= */
router.get("/users", async (req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GET SINGLE USER
   GET /api/admin/users/:id
========================================================= */
router.get("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   UPDATE USER
   PUT /api/admin/users/:id
========================================================= */
router.put("/users/:id", async (req, res, next) => {
  try {
    const { name, role, isActive } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   DELETE USER
   DELETE /api/admin/users/:id
========================================================= */
router.delete("/users/:id", async (req, res, next) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   ADMIN SUMMARY
   GET /api/admin/summary
========================================================= */
router.get("/summary", async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });

    // Replace with real models later
    const totalClients = 10;
    const totalProducts = 5;
    const totalLeads = 15;

    const recentLeads = [
      { client: "Client A", source: "Email" },
      { client: "Client B", source: "Website" },
    ];

    const tasks = [
      "Check new leads",
      "Update client information",
    ];

    res.json({
      totalUsers,
      totalAdmins,
      totalClients,
      totalProducts,
      totalLeads,
      recentLeads,
      tasks,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
