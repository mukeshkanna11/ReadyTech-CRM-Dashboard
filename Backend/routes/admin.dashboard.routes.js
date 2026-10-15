// routes/admin.dashboard.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";
import { userWorkspaceFilter } from "../utils/workspaceContext.js";

const router = express.Router();

/* =========================================================
   ADMIN DASHBOARD DATA
   GET /api/admin/dashboard
========================================================= */
router.get("/dashboard", auth, authorize("admin"), async (req, res) => {
  try {
    const scope = userWorkspaceFilter(req.workspace);
    const totalEmployees = await User.countDocuments({ ...scope, role: "employee" });
    const totalClients = await User.countDocuments({ ...scope, role: "client" });
    const allUsers = await User.find(scope).select("-passwordHash");

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
