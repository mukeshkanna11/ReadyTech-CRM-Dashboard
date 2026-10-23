// routes/user.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";
import User from "../models/User.js";
import Lead from "../models/Lead.js";
import Opportunity from "../models/Opportunity.js";
import Invoice from "../models/Invoice.js";
import SalesOrder from "../models/SalesOrder.model.js";
import PurchaseOrder from "../models/PurchaseOrder.model.js";
import AutomationExecution from "../models/AutomationExecution.js";
import AuditLog from "../models/AuditLog.js";
import { getNotificationSettings } from "../utils/notificationSettings.js";

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
   NOTIFICATIONS — derived from real records (no separate store, so an
   event can never be duplicated or re-processed). Every query is
   workspace-scoped by the scope plugin. id = "<type>:<recordId>".
========================================================= */
const money = (v) => (Number.isFinite(Number(v)) && Number(v) ? ` · ₹${Number(v).toLocaleString("en-IN")}` : "");

const SOURCES = [
  {
    type: "lead", model: Lead, title: "New lead", link: "/leads",
    select: "name company source createdAt",
    detail: (d) => ({ name: d.name, meta: [d.company, d.source].filter(Boolean).join(" · ") }),
  },
  {
    type: "opportunity", model: Opportunity, title: "New opportunity", link: "/salesforce/opportunities",
    select: "title value stage createdAt",
    detail: (d) => ({ name: d.title, meta: `${d.stage || ""}${money(d.value)}`.replace(/^ · /, "") }),
  },
  {
    type: "invoice", model: Invoice, title: "Invoice created", link: "/invoices",
    select: "invoiceNumber grandTotal total status createdAt",
    detail: (d) => ({ name: d.invoiceNumber || "Invoice", meta: `${d.status || ""}${money(d.grandTotal ?? d.total)}`.replace(/^ · /, "") }),
  },
  {
    type: "sales_order", model: SalesOrder, title: "Sales order created", link: "/stocks/sales-orders",
    select: "soNumber totalAmount status createdAt",
    detail: (d) => ({ name: d.soNumber || "Sales order", meta: `${d.status || ""}${money(d.totalAmount)}`.replace(/^ · /, "") }),
  },
  {
    type: "purchase_order", model: PurchaseOrder, title: "Purchase order created", link: "/stocks/purchase-orders",
    select: "poNumber status createdAt",
    detail: (d) => ({ name: d.poNumber || "Purchase order", meta: d.status || "" }),
  },
];

// Automation "sendNotification" steps that actually ran
const AUTOMATION_MATCH = { actions: { $elemMatch: { type: "sendNotification", status: "success" } } };
const GENERIC_ACTION_MSG = "Notification action executed"; // pre-fix log text

router.get("/me/notifications", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const me = await User.findById(req.user._id).select("notificationsReadAt").lean();
    const readAt = me?.notificationsReadAt || null;
    const after = readAt ? { createdAt: { $gt: readAt } } : {};

    /* Admin Settings → Notifications: Push off = no alerts delivered */
    const prefs = await getNotificationSettings(req.workspace);
    if (!prefs.push) {
      return res.json({ success: true, data: { items: [], unread: 0, readAt, disabled: true } });
    }

    /* Security alerts (AuditLog is not scope-plugged → filter by workspace).
       Admins see the whole workspace; others only alerts about themselves. */
    const securityMatch = prefs.securityAlerts
      ? {
          entity: "Security",
          "meta.workspace": String(req.workspace),
          ...(req.user.role === "admin" ? {} : { user: req.user._id }),
        }
      : null;

    const [lists, counts, runs, runCount, alerts, alertCount] = await Promise.all([
      Promise.all(SOURCES.map((s) => s.model.find().sort({ createdAt: -1 }).limit(limit).select(s.select).lean())),
      Promise.all(SOURCES.map((s) => s.model.countDocuments(after))),
      AutomationExecution.find(AUTOMATION_MATCH)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("automation actions createdAt")
        .populate("automation", "name")
        .lean(),
      AutomationExecution.countDocuments({ ...AUTOMATION_MATCH, ...after }),
      securityMatch
        ? AuditLog.find(securityMatch).sort({ createdAt: -1 }).limit(limit).select("action description createdAt").lean()
        : [],
      securityMatch ? AuditLog.countDocuments({ ...securityMatch, ...after }) : 0,
    ]);

    const isRead = (d) => !!readAt && new Date(d) <= new Date(readAt);

    const items = SOURCES.flatMap((s, i) =>
      lists[i].map((d) => ({
        id: `${s.type}:${d._id}`,
        type: s.type,
        title: s.title,
        ...s.detail(d),
        link: s.link,
        createdAt: d.createdAt,
        read: isRead(d.createdAt),
      }))
    );

    runs.forEach((run) =>
      run.actions.forEach((a, idx) => {
        if (a.type !== "sendNotification" || a.status !== "success") return;
        items.push({
          id: `automation:${run._id}:${idx}`,
          type: "automation",
          title: run.automation?.name || "Automation",
          name: a.message && a.message !== GENERIC_ACTION_MSG ? a.message : "Automation notification",
          meta: "Automation",
          link: "/automations",
          createdAt: a.completedAt || run.createdAt,
          read: isRead(a.completedAt || run.createdAt),
        });
      })
    );

    alerts.forEach((a) =>
      items.push({
        id: `security:${a._id}`,
        type: "security",
        title: "Security alert",
        name: a.description,
        meta: a.action === "LOGIN" ? "Login" : "Access change",
        link: req.user.role === "admin" ? "/auditlogs" : "/notifications",
        createdAt: a.createdAt,
        read: isRead(a.createdAt),
      })
    );

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: {
        items: items.slice(0, limit),
        unread: counts.reduce((a, b) => a + b, 0) + runCount + alertCount,
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
