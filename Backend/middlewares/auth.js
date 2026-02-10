// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    /* ======================================================
       ✅ ALWAYS ALLOW CORS PREFLIGHT
       Browsers expect 200 OK for OPTIONS
    ====================================================== */
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    /* ======================================================
       🔑 READ AUTH HEADER
    ====================================================== */
    const authHeader =
      req.headers.authorization || req.headers["x-auth-token"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({
        success: false,
        message: "Invalid or empty token",
      });
    }

    /* ======================================================
       🔐 VERIFY TOKEN
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
       🧾 VALIDATE PAYLOAD
    ====================================================== */
    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    /* ======================================================
       👤 LOAD USER
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
       📎 ATTACH USER
    ====================================================== */
    req.user = user;

    next();
  } catch (error) {
    console.error("🔐 AUTH MIDDLEWARE CRASH:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication middleware error",
    });
  }
};

export default auth;
