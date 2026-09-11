// routes/user.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   USER SUMMARY (ONLY MANAGER & EMPLOYEE)
========================================================= */
router.get(
  "/summary",
  auth,
  authorize("manager", "employee"),
  (req, res) => {
    res.status(200).json({
      message: "User summary data",
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  }
);

/* =========================================================
   CHANGE OWN PASSWORD (AUTHENTICATED USER ONLY)
========================================================= */
router.patch("/change-password", auth, async (req, res) => {
  try {
    const {
      currentPassword,
      oldPassword,
      newPassword,
      confirmPassword,
      userId,
    } = req.body;

    // Own password only — never another user's
    if (userId && String(userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only change your own password",
      });
    }

    const current = (currentPassword || oldPassword || "").trim();
    const next = (newPassword || "").trim();
    const confirm = (confirmPassword || "").trim();

    if (!current || !next || !confirm) {
      return res.status(400).json({
        success: false,
        message:
          "currentPassword, newPassword and confirmPassword are required",
      });
    }

    if (next !== confirm) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
      });
    }

    if (next.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    if (next === current) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    // auth middleware returns a lean object — reload the document for its methods
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(current);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const isSameAsOld = await user.comparePassword(next);

    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    // pre("save") hook re-hashes with the existing bcrypt pattern
    user.passwordHash = next;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to change password",
    });
  }
});

export default router;
