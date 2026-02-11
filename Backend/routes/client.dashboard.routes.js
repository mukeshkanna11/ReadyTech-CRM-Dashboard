// routes/client.dashboard.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   CLIENT DASHBOARD DATA
   GET /api/client/dashboard
========================================================= */
router.get("/dashboard", auth, authorize("client"), async (req, res) => {
  try {
    // Client can see only their own info + optional company info
    const client = await User.findById(req.user._id).select("-passwordHash");

    res.json({
      success: true,
      message: "Client dashboard data",
      data: {
        client,
      },
    });
  } catch (error) {
    console.error("CLIENT DASHBOARD ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
