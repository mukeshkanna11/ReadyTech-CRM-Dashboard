// routes/admin.routes.js

import express from "express";
import auth, { requireAdmin } from "../middlewares/auth.js";

import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/admin.controller.js";
import User from "../models/User.js";
import { NOTIFICATION_KEYS, getNotificationSettings } from "../utils/notificationSettings.js";

const router = express.Router();

/* =========================================================
   AUTH + ADMIN PROTECTION
========================================================= */

router.use(auth, requireAdmin);

/* =========================================================
   USERS
========================================================= */

router.get("/users", listUsers);

router.get("/users/:id", getUserById);

router.post("/users", createUser);

router.put("/users/:id", updateUser);

router.delete("/users/:id", deleteUser);

/* =========================================================
   NOTIFICATION SETTINGS (per workspace)
========================================================= */

router.get("/settings/notifications", async (req, res) => {
  try {
    res.json({ success: true, data: await getNotificationSettings(req.workspace) });
  } catch (error) {
    console.error("Get notification settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load notification settings" });
  }
});

router.put("/settings/notifications", async (req, res) => {
  try {
    const $set = {};
    for (const k of NOTIFICATION_KEYS) {
      if (req.body?.[k] === undefined) continue;
      if (typeof req.body[k] !== "boolean") {
        return res.status(400).json({ success: false, message: `${k} must be true or false` });
      }
      $set[`notificationSettings.${k}`] = req.body[k];
    }
    if (!Object.keys($set).length) {
      return res.status(400).json({ success: false, message: "No notification settings provided" });
    }

    const { matchedCount } = await User.updateOne({ _id: req.workspace }, { $set });
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });

    res.json({ success: true, data: await getNotificationSettings(req.workspace) });
  } catch (error) {
    console.error("Update notification settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save notification settings" });
  }
});

export default router;