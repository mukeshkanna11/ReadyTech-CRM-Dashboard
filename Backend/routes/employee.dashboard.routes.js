// routes/employee.dashboard.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   EMPLOYEE DASHBOARD DATA
   GET /api/employee/dashboard
========================================================= */
router.get("/dashboard", auth, authorize("employee"), async (req, res) => {
  try {
    // Example: employee can see only themselves + stats
    const employee = await User.findById(req.user._id).select("-passwordHash");

    // Example stats (can add leads, tasks, etc. later)
    const totalEmployees = await User.countDocuments({ role: "employee" });

    res.json({
      success: true,
      message: "Employee dashboard data",
      data: {
        employee,
        totalEmployees,
      },
    });
  } catch (error) {
    console.error("EMPLOYEE DASHBOARD ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
