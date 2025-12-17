// controllers/audit.controller.js
import AuditLog from "../models/AuditLog.js";

// Get all audit logs (admin only)
export const getAllAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("user", "name email role") // Make sure 'user' matches your AuditLog schema field
      .sort({ createdAt: -1 });

    if (!logs || logs.length === 0) {
      return res.status(200).json([]); // Return empty array if no logs
    }

    res.status(200).json(logs);
  } catch (err) {
    console.error("Error fetching all audit logs:", err.message);
    res.status(500).json({ message: "Server error while fetching audit logs" });
  }
};

// Get audit logs for a specific user (admin only)
export const getAuditLogsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const logs = await AuditLog.find({ user: userId })
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    if (!logs || logs.length === 0) {
      return res.status(200).json([]); // Return empty array if no logs for this user
    }

    res.status(200).json(logs);
  } catch (err) {
    console.error(`Error fetching audit logs for user ${req.params.userId}:`, err.message);
    res.status(500).json({ message: "Server error while fetching audit logs for user" });
  }
};
