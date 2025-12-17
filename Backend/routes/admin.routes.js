import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Admin summary
router.get("/summary", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalClients = 10; // example
    const totalProducts = 5; // example
    const totalLeads = 15;   // example

    const recentLeads = [
      { client: "Client A", source: "Email" },
      { client: "Client B", source: "Website" },
    ];

    const tasks = ["Check new leads", "Update client info"];

    res.json({ totalUsers, totalAdmins, totalClients, totalProducts, totalLeads, recentLeads, tasks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
