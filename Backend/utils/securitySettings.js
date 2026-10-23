// utils/securitySettings.js — Security → Password Change Reminder
import User from "../models/User.js";

export const PASSWORD_MAX_AGE_DAYS = Number(process.env.PASSWORD_MAX_AGE_DAYS || 90);
const DAY = 24 * 60 * 60 * 1000;

/* Workspace policy, stored on the workspace owner (default OFF) */
export const getSecuritySettings = async (workspaceId) => {
  const owner = workspaceId ? await User.findById(workspaceId).select("securitySettings").lean() : null;
  return { passwordReminder: owner?.securitySettings?.passwordReminder === true };
};

/* Age of the current password; legacy users fall back to account creation */
export const passwordStatus = (user, reminderEnabled) => {
  const changedAt = user.passwordChangedAt || user.createdAt || null;
  const ageDays = changedAt ? Math.floor((Date.now() - new Date(changedAt)) / DAY) : null;
  return {
    changedAt,
    ageDays,
    maxAgeDays: PASSWORD_MAX_AGE_DAYS,
    reminderEnabled: !!reminderEnabled,
    reminderDue: !!reminderEnabled && ageDays !== null && ageDays >= PASSWORD_MAX_AGE_DAYS,
  };
};
