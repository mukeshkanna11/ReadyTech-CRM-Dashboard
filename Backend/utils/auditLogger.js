import AuditLog from "../models/AuditLog.js";

export const logAction = async (userId, action, details = {}) => {
  try {
    await AuditLog.create({ userId, action, details });
  } catch (err) {
    console.error("Audit logging failed:", err.message);
  }
};
