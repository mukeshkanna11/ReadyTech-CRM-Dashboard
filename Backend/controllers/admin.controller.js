import User from "../models/User.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";
import Lead from "../models/Lead.js";
import bcrypt from "bcryptjs";

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

export const summary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalClients = await Client.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalLeads = await Lead.countDocuments();

    return res.status(200).json({
      success: true,
      totalUsers,
      totalAdmins,
      totalClients,
      totalProducts,
      totalLeads,
    });
  } catch (err) {
    console.error("SUMMARY ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================================================
   GET ALL USERS
========================================================= */

export const listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash -__v")
      .sort({ createdAt: -1 })
      .lean();

    console.log("========== GET USERS ==========");
    console.log("USER COUNT:", users.length);

    console.table(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        department: u.department,
        designation: u.designation,
        company: u.company,
      }))
    );

    return res.status(200).json(users);
  } catch (err) {
    console.error("LIST USERS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

/* =========================================================
   GET SINGLE USER
========================================================= */

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-passwordHash -__v")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("GET USER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

/* =========================================================
   CREATE USER
========================================================= */

export const createUser = async (req, res) => {
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

    /* ---------------- NORMALIZE EMAIL ---------------- */

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    /* ---------------- CREATE ---------------- */

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: password.trim(),
      role,

      department,
      designation,

      company: company?.trim() || null,
      employeeId: employeeId?.trim() || null,
      joiningDate: joiningDate || null,

      isActive: isActive ?? true,
    });

    await user.save();

    /* ---------------- RESPONSE ---------------- */

    const userResponse = user.toObject();

    delete userResponse.passwordHash;
    delete userResponse.__v;

    console.log("========== USER CREATED ==========");
    console.log(userResponse);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);

    /* Mongoose validation error */

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message: messages,
      });
    }

    /* Duplicate email */

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

/* =========================================================
   UPDATE USER
========================================================= */

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      email,
      role,
      department,
      designation,
      company,
      employeeId,
      joiningDate,
      isActive,
      password,
      currentPassword,
      confirmPassword,
    } = req.body;

    console.log("=================================");
    console.log("UPDATE USER REQUEST");
    console.log("ID:", id);
    console.log("BODY:", req.body);
    console.log("=================================");

    /* =====================================================
       FIND USER FIRST
    ===================================================== */

    const existingUser = await User.findById(id);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* =====================================================
       EMAIL
    ===================================================== */

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();

      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      existingUser.email = normalizedEmail;
    }

    /* =====================================================
       BASIC FIELDS
    ===================================================== */

    if (name !== undefined) {
      existingUser.name = name.trim();
    }

    if (role !== undefined) {
      existingUser.role = role;
    }

    /* =====================================================
       DEPARTMENT
    ===================================================== */

    if (department !== undefined) {
      existingUser.department = department || null;
    }

    /* =====================================================
       DESIGNATION
    ===================================================== */

    if (designation !== undefined) {
      existingUser.designation = designation || null;
    }

    /* =====================================================
       COMPANY
    ===================================================== */

    if (company !== undefined) {
      existingUser.company = company || null;
    }

    /* =====================================================
       EMPLOYEE ID
    ===================================================== */

    if (employeeId !== undefined) {
      existingUser.employeeId = employeeId || null;
    }

    /* =====================================================
       JOINING DATE
    ===================================================== */

    if (joiningDate !== undefined) {
      existingUser.joiningDate = joiningDate || null;
    }

    /* =====================================================
       ACTIVE STATUS
    ===================================================== */

    if (isActive !== undefined) {
      existingUser.isActive = Boolean(isActive);
    }

    /* =====================================================
       PASSWORD (OPTIONAL)
       Blank => password left untouched. When a new password is
       supplied, the user's CURRENT password must be verified first.
       Assignment goes through the existing bcrypt pre("save") hook,
       so nothing is ever stored in plain text.
    ===================================================== */

    const newPassword = password?.trim();

    if (newPassword) {
      const current = currentPassword?.trim();

      if (!current) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to change the password",
        });
      }

      const isMatch = await existingUser.comparePassword(current);

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }

      if (confirmPassword !== undefined && newPassword !== confirmPassword.trim()) {
        return res.status(400).json({
          success: false,
          message: "New password and confirm password do not match",
        });
      }

      existingUser.passwordHash = newPassword;
    }

    /* =====================================================
       SAVE
       IMPORTANT:
       Using save() ensures schema validation + middleware.
    ===================================================== */

    await existingUser.save();

    /* =====================================================
       RETURN FRESH USER
    ===================================================== */

    const updatedUser = await User.findById(id)
      .select("-passwordHash -__v")
      .lean();

    console.log("========== USER UPDATED ==========");
    console.log(updatedUser);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);

    /* Mongoose validation */

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors)
        .map((e) => e.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message: messages,
      });
    }

    /* Duplicate email */

    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to update user",
    });
  }
};

/* =========================================================
   DELETE USER
========================================================= */

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};