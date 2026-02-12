// routes/auth.routes.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

// ===============================
// SAFETY CHECK FOR ENV
// ===============================
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is NOT configured in environment variables");
}

// Super Admin Email
const SUPER_ADMIN_EMAIL = "siva@readytechsolutions.in";

// ===============================
// GENERATE TOKEN SAFELY
// ===============================
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* =========================================================
   ADMIN LOGIN
   POST /api/auth/login
========================================================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admin allowed",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: "Admin password not set",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("🔥 ADMIN LOGIN ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

/* =========================================================
   USER LOGIN
   POST /api/auth/user-login
========================================================= */
router.post("/user-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin must login from admin panel",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: "Password not set for this user",
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("🔥 USER LOGIN ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

/* =========================================================
   REGISTER USER
   POST /api/auth/register
========================================================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      role,
      isActive: true,
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("🔥 REGISTER ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

export default router;
