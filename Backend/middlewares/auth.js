// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer <token>) or x-auth-token
    const authHeader = req.headers.authorization || req.headers["x-auth-token"];

    if (!authHeader) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

    if (!token) return res.status(401).json({ message: "Token not found" });

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: "Invalid token" });

    // Find user
    const user = await User.findById(decoded.id).select("-passwordHash");
    if (!user) return res.status(401).json({ message: "User not found" });

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("🔐 AUTH ERROR:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Malformed token" });
    }

    res.status(401).json({ message: "Authentication failed" });
  }
};

export default auth;
