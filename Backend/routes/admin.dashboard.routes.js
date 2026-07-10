// routes/admin.dashboard.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   ADMIN DASHBOARD DATA
   GET /api/admin/dashboard
========================================================= */
router.get("/dashboard", auth, authorize("admin"), async (req, res) => {
  try {
    const totalEmployees = await User.countDocuments({ role: "employee" });
    const totalClients = await User.countDocuments({ role: "client" });
    const allUsers = await User.find().select("-passwordHash");

    res.json({
      success: true,
      message: "Admin dashboard data",
      data: {
        totalEmployees,
        totalClients,
        users: allUsers,
      },
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
