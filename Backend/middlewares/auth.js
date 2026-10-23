// middlewares/auth.js
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../models/User.js";
import { runWithWorkspace } from "../utils/workspaceContext.js";

/* =========================================================
   🔐 AUTHENTICATION MIDDLEWARE
   Verifies JWT token from Authorization header
========================================================= */
const auth = async (req, res, next) => {
  try {
    // ✅ Allow CORS preflight requests
    if (req.method === "OPTIONS") return res.sendStatus(200);

    // 🔌 External API key (Admin Settings → Integrations → CRM API Access)
    if (req.headers["x-api-key"] && !req.headers.authorization) {
      return apiKeyAuth(req, res, next);
    }

    // 🔑 Extract token
    const authHeader = req.headers.authorization || req.headers["x-auth-token"];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "Invalid or empty token",
      });
    }

    // 🔐 Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      });
    }

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // 👤 Fetch user from DB (exclude sensitive fields)
    const user = await User.findById(decoded.id)
      .select("-passwordHash -__v")
      .lean();

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // ❌ Block inactive users
    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: "Account is inactive" });
    }

    // 📎 Attach user to request
    req.user = user;

    // 🧱 Bind this request to the user's own workspace. The workspace id
    // IS the user id, so every login email is isolated automatically.
    // Employees created by an admin carry that admin's workspace.
    const workspaceId = user.workspace || user._id;
    req.workspace = workspaceId;

    return runWithWorkspace(workspaceId, next);
  } catch (error) {
    console.error("🔐 AUTH MIDDLEWARE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication middleware error",
    });
  }
};

/* =========================================================
   🔌 WORKSPACE API KEY — read-only access to core CRM data.
   Acts as the workspace owner, so every query stays scoped to
   that workspace. Rejected while CRM API Access is OFF.
========================================================= */
export const hashApiKey = (key) => crypto.createHash("sha256").update(String(key)).digest("hex");

const API_KEY_PATHS = ["/api/leads", "/api/clients", "/api/opportunities", "/api/products", "/api/invoices", "/api/activities"];

const apiKeyAuth = async (req, res, next) => {
  const owner = await User.findOne({ "integrationSettings.apiKeyHash": hashApiKey(req.headers["x-api-key"]) })
    .select("-passwordHash -__v")
    .lean();

  if (!owner) return res.status(401).json({ success: false, message: "Invalid API key" });
  if (owner.isActive === false) return res.status(403).json({ success: false, message: "Account is inactive" });
  if (!owner.integrationSettings?.apiAccess) {
    return res.status(403).json({ success: false, message: "CRM API access is disabled for this workspace" });
  }

  const path = req.originalUrl.split("?")[0];
  if (req.method !== "GET" || !API_KEY_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return res.status(403).json({ success: false, message: "API keys allow read-only access to CRM data endpoints" });
  }

  req.user = owner;
  req.apiKey = true;
  req.workspace = owner.workspace || owner._id;
  return runWithWorkspace(req.workspace, next);
};

/* =========================================================
   🛡 ROLE-BASED AUTHORIZATION
   Usage: authorize("admin", "employee")
========================================================= */
export const authorize = (...allowedRoles) => (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied: insufficient permissions" });
    }

    next();
  } catch (error) {
    console.error("⚠️ AUTHORIZE ERROR:", error);
    return res.status(403).json({ success: false, message: "Access denied" });
  }
};

/* =========================================================
   🔒 ROLE SHORTCUTS
========================================================= */
export const requireAdmin = authorize("admin");
export const requireEmployee = authorize("employee");
export const requireClient = authorize("client");
export const authorizeRoles = (...roles) => authorize(...roles);

export default auth;
