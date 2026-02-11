// middlewares/auth.js

import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =========================================================
   🔐 VERIFY AUTH TOKEN MIDDLEWARE
========================================================= */
const auth = async (req, res, next) => {
  try {
    /* ✅ Allow CORS preflight */
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    /* 🔑 Get Token from Header */
    const authHeader =
      req.headers.authorization || req.headers["x-auth-token"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    /* ✅ Extract Bearer Token */
    let token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "Invalid or empty token",
      });
    }

    /* 🔐 Verify JWT */
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message:
          err.name === "TokenExpiredError"
            ? "Token expired"
            : "Invalid token",
      });
    }

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    /* 👤 Fetch User */
    const user = await User.findById(decoded.id)
      .select("-passwordHash -__v")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    /* ❌ Block inactive users */
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    /* 📎 Attach user to request */
    req.user = user;

    next();
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
========================================================= */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied: insufficient permissions",
        });
      }

      next();
    } catch (error) {
      console.error("⚠️ AUTHORIZE ERROR:", error);
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
  };
};

/* =========================================================
   🔒 ADMIN ONLY SHORTCUT
========================================================= */
export const requireAdmin = authorize("admin");

/* =========================================================
   👨‍💼 EMPLOYEE ONLY SHORTCUT
========================================================= */
export const requireEmployee = authorize("employee");

/* =========================================================
   👤 CLIENT ONLY SHORTCUT
========================================================= */
export const requireClient = authorize("client");

/* =========================================================
   🔄 MULTI ROLE SHORTCUT
   Example: authorizeRoles("admin", "employee")
========================================================= */
export const authorizeRoles = (...roles) => authorize(...roles);

export default auth;
