// services/scheduler.js — in-process scheduler (no Redis / job queue is
// configured). Runs hourly while the server is up; each job is idempotent
// (skips work done in the last day), so restarts don't duplicate it.
import User from "../models/User.js";
import RestorePoint from "../models/RestorePoint.js";
import { createRestorePoint } from "./backup.service.js";
import { sendLeadEmail } from "./email.service.js";
import { getNotificationSettings } from "../utils/notificationSettings.js";
import { passwordStatus } from "../utils/securitySettings.js";
import { userWorkspaceFilter } from "../utils/workspaceContext.js";

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_REPEAT = 7 * DAY;

export const schedulerState = { running: false, startedAt: null, lastRunAt: null, lastError: null };

/* Backup & Recovery → Restore Points ON: one scheduled checkpoint per day */
const runRestorePoints = async () => {
  const owners = await User.find({ "backupSettings.restorePoints": true }).select("_id").lean();
  for (const { _id } of owners) {
    const last = await RestorePoint.findOne({ workspace: _id, trigger: "scheduled", status: "completed" })
      .sort({ createdAt: -1 }).select("createdAt").lean();
    if (last && Date.now() - new Date(last.createdAt) < DAY - 60 * 60 * 1000) continue;
    try {
      await createRestorePoint(_id, { trigger: "scheduled" });
    } catch (err) {
      schedulerState.lastError = `Restore point for ${_id}: ${err.message}`;
      console.error("❌ Scheduled restore point failed:", _id, err.message);
    }
  }
};

/* Security → Password Change Reminder ON: email users whose password is
   past the max age (once per password, repeated weekly). Respects the
   workspace's Email Notifications setting; the in-app reminder always shows. */
const runPasswordReminders = async () => {
  const owners = await User.find({ "securitySettings.passwordReminder": true }).select("_id").lean();
  for (const { _id } of owners) {
    if (!(await getNotificationSettings(_id)).email) continue;
    const users = await User.find({ ...userWorkspaceFilter(_id), isActive: { $ne: false } })
      .select("name email passwordChangedAt createdAt passwordReminderSentAt").lean();

    for (const u of users) {
      const st = passwordStatus(u, true);
      if (!st.reminderDue) continue;
      const sent = u.passwordReminderSentAt && new Date(u.passwordReminderSentAt);
      if (sent && sent > new Date(st.changedAt) && Date.now() - sent < REMINDER_REPEAT) continue;
      try {
        await sendLeadEmail({
          to: u.email,
          subject: "[ReadyTech CRM] Time to change your password",
          message: `Hi ${u.name},\n\nYour ReadyTech CRM password is ${st.ageDays} days old. Your workspace asks members to change it every ${st.maxAgeDays} days. Please sign in and update it.\n\nReadyTech CRM`,
        });
        await User.updateOne({ _id: u._id }, { $set: { passwordReminderSentAt: new Date() } });
      } catch (err) {
        schedulerState.lastError = `Password reminder to ${u.email}: ${err.message}`;
        console.error("⚠️ Password reminder failed:", u.email, err.message);
      }
    }
  }
};

export const runScheduledJobs = async () => {
  schedulerState.lastError = null;
  await runRestorePoints();
  await runPasswordReminders();
  schedulerState.lastRunAt = new Date();
};

export const startScheduler = () => {
  if (schedulerState.running || process.env.DISABLE_SCHEDULER === "true") return;
  schedulerState.running = true;
  schedulerState.startedAt = new Date();
  const tick = () =>
    runScheduledJobs().catch((err) => {
      schedulerState.lastError = err.message;
      console.error("❌ Scheduler run failed:", err.message);
    });
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
  console.log("⏰ Scheduler started (hourly: restore points, password reminders)");
};
