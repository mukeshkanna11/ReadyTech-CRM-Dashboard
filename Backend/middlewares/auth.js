// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    /* ======================================================
       🚨 BYPASS CORS PREFLIGHT
    ====================================================== */
    if (req.method === "OPTIONS") {
      return next();
    }

    /* ======================================================
       GET TOKEN
    ====================================================== */
    const authHeader =
      req.headers.authorization || req.headers["x-auth-token"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    /* ======================================================
       VERIFY TOKEN
    ====================================================== */
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

    /* ======================================================
       VALIDATE PAYLOAD
    ====================================================== */
    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    /* ======================================================
       LOAD USER
    ====================================================== */
    const user = await User.findById(decoded.id)
      .select("-passwordHash")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    /* ======================================================
       ATTACH USER
    ====================================================== */
    req.user = user;

    next();
  } catch (error) {
    console.error("🔐 AUTH MIDDLEWARE ERROR:", error);

    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export default auth;
