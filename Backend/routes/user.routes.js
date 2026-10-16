// routes/user.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";
import Lead from "../models/Lead.js";

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

/* =========================================================
   MY PROFILE (own record only)
========================================================= */
const PROFILE_FIELDS = "name email phone avatar role department designation createdAt";
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 400 * 1024; // ~300 KB image after base64

router.get("/me", async (req, res) => {
  const user = await User.findById(req.user._id).select(PROFILE_FIELDS).lean();
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: user });
});

router.patch("/me", async (req, res) => {
  try {
    const { name, phone, avatar } = req.body || {};
    const $set = {};

    if (name !== undefined) {
      const clean = String(name).trim();
      if (clean.length < 2 || clean.length > 80) {
        return res.status(400).json({ success: false, message: "Name must be 2–80 characters" });
      }
      $set.name = clean;
    }

    if (phone !== undefined) {
      const clean = String(phone).trim();
      if (clean && !/^\+?[0-9\s\-()]{7,20}$/.test(clean)) {
        return res.status(400).json({ success: false, message: "Enter a valid phone number" });
      }
      $set.phone = clean;
    }

    if (avatar !== undefined) {
      if (avatar !== null && (!AVATAR_RE.test(avatar) || avatar.length > AVATAR_MAX)) {
        return res.status(400).json({ success: false, message: "Photo must be a PNG, JPEG or WebP under 300 KB" });
      }
      $set.avatar = avatar;
    }

    // updateOne: never re-validates unrelated legacy fields
    await User.updateOne({ _id: req.user._id }, { $set });
    const user = await User.findById(req.user._id).select(PROFILE_FIELDS).lean();
    res.json({ success: true, message: "Profile updated", data: user });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
});

/* =========================================================
   NOTIFICATIONS — real "new lead" events (workspace-scoped by the
   scope plugin; same visibility as GET /api/leads). One entry per
   lead id, so there are no duplicates.
========================================================= */
router.get("/me/notifications", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const me = await User.findById(req.user._id).select("notificationsReadAt").lean();
    const readAt = me?.notificationsReadAt || null;

    const [leads, unread] = await Promise.all([
      Lead.find().sort({ createdAt: -1 }).limit(limit).select("name company source createdAt").lean(),
      Lead.countDocuments(readAt ? { createdAt: { $gt: readAt } } : {}),
    ]);

    res.json({
      success: true,
      data: {
        items: leads.map((l) => ({
          id: String(l._id),
          leadId: l._id,
          title: "New lead",
          name: l.name,
          company: l.company || "",
          source: l.source || "",
          createdAt: l.createdAt,
          read: !!readAt && new Date(l.createdAt) <= new Date(readAt),
        })),
        unread,
        readAt,
      },
    });
  } catch (error) {
    console.error("Notifications error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
});

router.patch("/me/notifications/read", async (req, res) => {
  const readAt = new Date();
  await User.updateOne({ _id: req.user._id }, { $set: { notificationsReadAt: readAt } });
  res.json({ success: true, data: { readAt, unread: 0 } });
});

export default router;
