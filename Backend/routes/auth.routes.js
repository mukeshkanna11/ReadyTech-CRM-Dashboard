import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

const router = express.Router();

const SUPER_ADMIN_EMAIL = "siva@readytechsolutions.in";

/* =========================================================
   TOKEN
========================================================= */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
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

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user || user.role !== "admin") {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await user.comparePassword(password);

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
      user,
    });
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
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

    const user = await User.findOne({
      email: normalizedEmail,
    });

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

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("USER LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================================================
   REGISTER
   POST /api/auth/register
========================================================= */
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      department,
      designation,
      company,
      employeeId,
      joiningDate,
      isActive,
    } = req.body;

    /* ---------------- VALIDATION ---------------- */

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!password?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!department) {
      return res.status(400).json({
        success: false,
        message: "Department is required",
      });
    }

    if (!designation) {
      return res.status(400).json({
        success: false,
        message: "Designation is required",
      });
    }

    /* ---------------- EMAIL ---------------- */

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    /* ---------------- CREATE USER ---------------- */

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: password.trim(),

      role,

      department: department.trim(),
      designation: designation.trim(),

      company: company?.trim() || null,
      employeeId: employeeId?.trim() || null,
      joiningDate: joiningDate || null,

      isActive: isActive ?? true,
    });

    await user.save();

    /* ---------------- RESPONSE ---------------- */

    const token = generateToken(user);

    const userResponse = user.toObject();

    delete userResponse.passwordHash;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        ...userResponse,
        id: user._id,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    /* Mongoose validation error */
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err) => err.message
      );

      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    /* Duplicate email */
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
});

export default router;