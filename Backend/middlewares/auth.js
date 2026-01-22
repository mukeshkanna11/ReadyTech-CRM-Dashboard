// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    // 1️⃣ Get token from headers
    const authHeader =
      req.headers.authorization || req.headers["x-auth-token"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    // 2️⃣ Extract token
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    // 3️⃣ Verify token (DO NOT IGNORE EXPIRY)
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

    // 4️⃣ Validate payload
    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // 5️⃣ Load user
    const user = await User.findById(decoded.id).select("-passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // 6️⃣ Attach user
    req.user = user;

    next();
  } catch (error) {
    console.error("🔐 AUTH MIDDLEWARE ERROR:", error);

    // 7️⃣ ALWAYS JSON (NO HTML EVER)
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export default auth;
