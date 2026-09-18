// middlewares/auth.js
import jwt from "jsonwebtoken";
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
    req.workspace = user._id;

    return runWithWorkspace(user._id, next);
  } catch (error) {
    console.error("🔐 AUTH MIDDLEWARE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication middleware error",
    });
  }
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
