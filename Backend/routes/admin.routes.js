// routes/admin.routes.js

import express from "express";
import crypto from "node:crypto";
import auth, { requireAdmin, hashApiKey } from "../middlewares/auth.js";

import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/admin.controller.js";
import User from "../models/User.js";
import { NOTIFICATION_KEYS, getNotificationSettings } from "../utils/notificationSettings.js";
import { AI_KEYS, getAiSettings } from "../utils/aiSettings.js";
import { getSecuritySettings, PASSWORD_MAX_AGE_DAYS } from "../utils/securitySettings.js";
import {
  createRestorePoint, listRestorePoints, validateRestorePoint, restoreFromPoint, RESTORE_POINT_RETENTION,
} from "../services/backup.service.js";
import { schedulerState } from "../services/scheduler.js";

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

/* =========================================================
   INTEGRATION SETTINGS (per workspace)
   Third-party providers: no Slack / Google Workspace / Microsoft
   Teams implementation or credentials exist in this project, so
   they are reported as unavailable — never as connected.
========================================================= */

const INTEGRATION_KEYS = ["apiAccess", "thirdPartyApps"];
const PROVIDERS = [
  { id: "slack", name: "Slack" },
  { id: "google_workspace", name: "Google Workspace" },
  { id: "microsoft_teams", name: "Microsoft Teams" },
].map((p) => ({ ...p, status: "not_available", reason: "No OAuth app, credentials or integration code configured" }));

const integrationPayload = async (workspaceId) => {
  const owner = await User.findById(workspaceId).select("integrationSettings").lean();
  const s = owner?.integrationSettings || {};
  return {
    apiAccess: s.apiAccess === true,
    thirdPartyApps: s.thirdPartyApps === true,
    apiKey: s.apiKeyPrefix ? { prefix: s.apiKeyPrefix, createdAt: s.apiKeyCreatedAt } : null,
    providers: PROVIDERS,
  };
};

router.get("/settings/integrations", async (req, res) => {
  try {
    res.json({ success: true, data: await integrationPayload(req.workspace) });
  } catch (error) {
    console.error("Get integration settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load integration settings" });
  }
});

router.put("/settings/integrations", async (req, res) => {
  try {
    const $set = {};
    for (const k of INTEGRATION_KEYS) {
      if (req.body?.[k] === undefined) continue;
      if (typeof req.body[k] !== "boolean") {
        return res.status(400).json({ success: false, message: `${k} must be true or false` });
      }
      $set[`integrationSettings.${k}`] = req.body[k];
    }
    if (!Object.keys($set).length) {
      return res.status(400).json({ success: false, message: "No integration settings provided" });
    }

    const { matchedCount } = await User.updateOne({ _id: req.workspace }, { $set });
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });

    res.json({ success: true, data: await integrationPayload(req.workspace) });
  } catch (error) {
    console.error("Update integration settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save integration settings" });
  }
});

/* Generate / rotate the workspace API key. Plain key returned ONCE. */
router.post("/settings/integrations/api-key", async (req, res) => {
  try {
    const key = `rtk_${crypto.randomBytes(24).toString("hex")}`;
    const { matchedCount } = await User.updateOne(
      { _id: req.workspace },
      {
        $set: {
          "integrationSettings.apiKeyHash": hashApiKey(key),
          "integrationSettings.apiKeyPrefix": key.slice(0, 12),
          "integrationSettings.apiKeyCreatedAt": new Date(),
        },
      }
    );
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });

    res.status(201).json({ success: true, data: { ...(await integrationPayload(req.workspace)), key } });
  } catch (error) {
    console.error("Generate API key error:", error.message);
    res.status(500).json({ success: false, message: "Failed to generate API key" });
  }
});

router.delete("/settings/integrations/api-key", async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.workspace },
      {
        $set: {
          "integrationSettings.apiKeyHash": null,
          "integrationSettings.apiKeyPrefix": null,
          "integrationSettings.apiKeyCreatedAt": null,
        },
      }
    );
    res.json({ success: true, data: await integrationPayload(req.workspace) });
  } catch (error) {
    console.error("Revoke API key error:", error.message);
    res.status(500).json({ success: false, message: "Failed to revoke API key" });
  }
});

/* =========================================================
   AI SETTINGS (per workspace) — enforced in routes/ai.routes.js
   and services/chatAi.service.js
========================================================= */

const aiPayload = async (workspaceId) => ({
  ...(await getAiSettings(workspaceId)),
  configured: !!process.env.CLAUDE_API_KEY?.trim(),
});

router.get("/settings/ai", async (req, res) => {
  try {
    res.json({ success: true, data: await aiPayload(req.workspace) });
  } catch (error) {
    console.error("Get AI settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load AI settings" });
  }
});

router.put("/settings/ai", async (req, res) => {
  try {
    const $set = {};
    for (const k of AI_KEYS) {
      if (req.body?.[k] === undefined) continue;
      if (typeof req.body[k] !== "boolean") {
        return res.status(400).json({ success: false, message: `${k} must be true or false` });
      }
      $set[`aiSettings.${k}`] = req.body[k];
    }
    if (!Object.keys($set).length) {
      return res.status(400).json({ success: false, message: "No AI settings provided" });
    }

    const { matchedCount } = await User.updateOne({ _id: req.workspace }, { $set });
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });

    res.json({ success: true, data: await aiPayload(req.workspace) });
  } catch (error) {
    console.error("Update AI settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save AI settings" });
  }
});

/* =========================================================
   SECURITY SETTINGS (per workspace) — Password Change Reminder.
   2FA is per user: /api/user/me/2fa/*
========================================================= */

router.get("/settings/security", async (req, res) => {
  try {
    res.json({ success: true, data: { ...(await getSecuritySettings(req.workspace)), maxAgeDays: PASSWORD_MAX_AGE_DAYS } });
  } catch (error) {
    console.error("Get security settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load security settings" });
  }
});

router.put("/settings/security", async (req, res) => {
  try {
    if (typeof req.body?.passwordReminder !== "boolean") {
      return res.status(400).json({ success: false, message: "passwordReminder must be true or false" });
    }
    const { matchedCount } = await User.updateOne(
      { _id: req.workspace },
      { $set: { "securitySettings.passwordReminder": req.body.passwordReminder } }
    );
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });
    res.json({ success: true, data: { ...(await getSecuritySettings(req.workspace)), maxAgeDays: PASSWORD_MAX_AGE_DAYS } });
  } catch (error) {
    console.error("Update security settings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save security settings" });
  }
});

/* =========================================================
   BACKUP & RECOVERY (per workspace)
   - Automatic Backup needs off-site storage, which is not configured
     in this project → it cannot be enabled (no fake backups).
   - Restore Points: in-database workspace snapshots (services/backup.service.js)
========================================================= */

const BACKUP_STORAGE_GAP =
  "No off-site backup storage is configured (no S3 / cloud storage credentials or SDK in this project). Automatic Backup cannot be enabled.";

const backupPayload = async (workspaceId) => {
  const owner = await User.findById(workspaceId).select("backupSettings").lean();
  const points = await listRestorePoints(workspaceId);
  return {
    autoBackup: false,
    autoBackupAvailable: false,
    autoBackupReason: BACKUP_STORAGE_GAP,
    restorePoints: owner?.backupSettings?.restorePoints === true,
    retention: RESTORE_POINT_RETENTION,
    scheduler: { running: schedulerState.running, lastRunAt: schedulerState.lastRunAt, lastError: schedulerState.lastError },
    points: points.map((p) => ({
      id: p._id, trigger: p.trigger, status: p.status, error: p.error, totalDocs: p.totalDocs,
      sizeBytes: p.sizeBytes, createdAt: p.createdAt, completedAt: p.completedAt, lastRestoredAt: p.lastRestoredAt,
    })),
  };
};

const sendError = (res, error, fallback) => {
  console.error(fallback, error.message);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
    ...(error.problems ? { problems: error.problems } : {}),
  });
};

router.get("/settings/backup", async (req, res) => {
  try {
    res.json({ success: true, data: await backupPayload(req.workspace) });
  } catch (error) {
    sendError(res, error, "Failed to load backup settings");
  }
});

router.put("/settings/backup", async (req, res) => {
  try {
    const { autoBackup, restorePoints } = req.body || {};
    if (autoBackup !== undefined && typeof autoBackup !== "boolean") {
      return res.status(400).json({ success: false, message: "autoBackup must be true or false" });
    }
    if (restorePoints !== undefined && typeof restorePoints !== "boolean") {
      return res.status(400).json({ success: false, message: "restorePoints must be true or false" });
    }
    if (autoBackup === true) {
      return res.status(409).json({ success: false, code: "BACKUP_STORAGE_NOT_CONFIGURED", message: BACKUP_STORAGE_GAP });
    }
    if (restorePoints === undefined && autoBackup === undefined) {
      return res.status(400).json({ success: false, message: "No backup settings provided" });
    }

    const $set = { "backupSettings.autoBackup": false };
    if (restorePoints !== undefined) $set["backupSettings.restorePoints"] = restorePoints;
    const { matchedCount } = await User.updateOne({ _id: req.workspace }, { $set });
    if (!matchedCount) return res.status(404).json({ success: false, message: "Workspace not found" });

    res.json({ success: true, data: await backupPayload(req.workspace) });
  } catch (error) {
    sendError(res, error, "Failed to save backup settings");
  }
});

/* Manual checkpoint — only while Restore Points is ON */
router.post("/backup/restore-points", async (req, res) => {
  try {
    const owner = await User.findById(req.workspace).select("backupSettings").lean();
    if (owner?.backupSettings?.restorePoints !== true) {
      return res.status(409).json({ success: false, message: "Restore Points are disabled. Enable them first." });
    }
    const rp = await createRestorePoint(req.workspace, { trigger: "manual", createdBy: req.user._id });
    res.status(201).json({ success: true, message: `Restore point created (${rp.totalDocs} records)`, data: await backupPayload(req.workspace) });
  } catch (error) {
    sendError(res, error, "Failed to create restore point");
  }
});

router.post("/backup/restore-points/:id/validate", async (req, res) => {
  try {
    const { valid, problems, restorePoint } = await validateRestorePoint(req.workspace, req.params.id);
    if (!restorePoint) return res.status(404).json({ success: false, message: "Restore point not found" });
    res.json({
      success: true,
      data: {
        valid, problems, totalDocs: restorePoint.totalDocs, createdAt: restorePoint.createdAt,
        collections: (restorePoint.collections || []).map((c) => ({ name: c.name, count: c.count })),
      },
    });
  } catch (error) {
    sendError(res, error, "Failed to validate restore point");
  }
});

/* Restore — requires { confirm: "RESTORE" }. Current data is snapshotted
   first ("pre-restore"), so nothing is overwritten without a way back. */
router.post("/backup/restore-points/:id/restore", async (req, res) => {
  try {
    if (req.body?.confirm !== "RESTORE") {
      return res.status(400).json({
        success: false,
        message: 'Restoring replaces this workspace\'s current CRM data. Send { "confirm": "RESTORE" } to proceed.',
      });
    }
    const { restored, safetyPoint } = await restoreFromPoint(req.workspace, req.params.id, { createdBy: req.user._id });
    res.json({
      success: true,
      message: `Restored ${restored.totalDocs} records from ${new Date(restored.createdAt).toISOString()}. Previous data saved as restore point ${safetyPoint._id}.`,
      data: await backupPayload(req.workspace),
    });
  } catch (error) {
    sendError(res, error, "Restore failed");
  }
});

export default router;
