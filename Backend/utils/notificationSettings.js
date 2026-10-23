// utils/notificationSettings.js
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { getWorkspaceId } from "./workspaceContext.js";
import { sendLeadEmail } from "../services/email.service.js";

/* =========================================================
   WORKSPACE NOTIFICATION PREFERENCES (Admin Settings)
   Stored on the workspace owner (workspace id = owner's _id).
   Missing values default to enabled = pre-existing behaviour.
========================================================= */
export const NOTIFICATION_KEYS = ["email", "push", "securityAlerts"];

export const getNotificationSettings = async (workspaceId = getWorkspaceId()) => {
  const settings = { email: true, push: true, securityAlerts: true };
  if (!workspaceId) return settings;

  const owner = await User.findById(workspaceId).select("notificationSettings").lean();
  NOTIFICATION_KEYS.forEach((k) => {
    if (typeof owner?.notificationSettings?.[k] === "boolean") settings[k] = owner.notificationSettings[k];
  });
  return settings;
};

/* =========================================================
   SECURITY ALERT (login, role / access changes)
   Recorded only when Security Alerts are on. Surfaced in the
   in-app feed (Push toggle) and emailed to the workspace owner
   (Email toggle). Never throws — must not break the caller.
========================================================= */
export const recordSecurityAlert = async ({ workspaceId, user, action, description }) => {
  try {
    if (!workspaceId || !user) return;
    const settings = await getNotificationSettings(workspaceId);
    if (!settings.securityAlerts) return;

    await AuditLog.create({
      user,
      action,
      entity: "Security",
      description,
      meta: { workspace: String(workspaceId), securityAlert: true },
    });

    if (settings.email) {
      const owner = await User.findById(workspaceId).select("email").lean();
      if (owner?.email) {
        sendLeadEmail({ to: owner.email, subject: "[ReadyTech CRM] Security alert", message: description })
          .catch((err) => console.error("⚠️ Security alert email failed:", err.message));
      }
    }
  } catch (err) {
    console.error("⚠️ Security alert failed:", err.message);
  }
};
