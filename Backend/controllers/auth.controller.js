import User from "../models/User.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";
import Lead from "../models/Lead.js";

// =========================================================
// Dashboard Summary
// =========================================================
export const summary = async (req, res) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalClients,
      totalProducts,
      totalLeads,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      Client.countDocuments(),
      Product.countDocuments(),
      Lead.countDocuments(),
    ]);

    return res.status(200).json({
      totalUsers,
      totalAdmins,
      totalClients,
      totalProducts,
      totalLeads,
    });
  } catch (err) {
    console.error("❌ Summary Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// List All Users
// =========================================================
export const listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();

    console.log("========== USERS FETCH ==========");
    console.log("Total Users:", users.length);

    users.forEach((user) => {
      console.log({
        id: String(user._id),
        name: user.name,
        department: user.department,
        designation: user.designation,
        company: user.company,
      });
    });

    console.log("================================");

    return res.status(200).json(users);
  } catch (err) {
    console.error("❌ List Users Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// =========================================================
// Get Single User
// =========================================================
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-passwordHash")
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
    console.error("❌ Get User Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

// =========================================================
// Create User
// =========================================================
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

    // -------------------------------------------------------
    // Required validation
    // -------------------------------------------------------
    if (
      !name?.trim() ||
      !email?.trim() ||
      !password?.trim() ||
      !role ||
      !department?.trim() ||
      !designation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password, role, department and designation are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // -------------------------------------------------------
    // Check duplicate email
    // -------------------------------------------------------
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // -------------------------------------------------------
    // Create user
    // -------------------------------------------------------
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

    const userResponse = user.toObject();

    delete userResponse.passwordHash;

    console.log("✅ USER CREATED:");
    console.log({
      id: String(userResponse._id),
      name: userResponse.name,
      department: userResponse.department,
      designation: userResponse.designation,
      company: userResponse.company,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userResponse,
    });
  } catch (err) {
    console.error("❌ Create User Error:", err);

    // Mongoose validation error
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(
        (error) => error.message
      );

      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    // Duplicate email
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create user",
    });
  }
};

// =========================================================
// Update User
// =========================================================
export const updateUser = async (req, res) => {
  try {
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
    } = req.body;

    // -------------------------------------------------------
    // Find existing user first
    // -------------------------------------------------------
    const existingUser = await User.findById(req.params.id);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // -------------------------------------------------------
    // Build update object
    // -------------------------------------------------------
    const updateData = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }

      updateData.name = name.trim();
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check email belongs to another user
      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.params.id },
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }

      updateData.email = normalizedEmail;
    }

    if (role !== undefined) {
      updateData.role = role;
    }

    // -------------------------------------------------------
    // Department
    // -------------------------------------------------------
    if (department !== undefined) {
      if (!department.trim()) {
        return res.status(400).json({
          success: false,
          message: "Department is required",
        });
      }

      updateData.department = department.trim();
    }

    // -------------------------------------------------------
    // Designation
    // -------------------------------------------------------
    if (designation !== undefined) {
      if (!designation.trim()) {
        return res.status(400).json({
          success: false,
          message: "Designation is required",
        });
      }

      updateData.designation = designation.trim();
    }

    // -------------------------------------------------------
    // Optional fields
    // -------------------------------------------------------
    if (company !== undefined) {
      updateData.company = company?.trim() || null;
    }

    if (employeeId !== undefined) {
      updateData.employeeId = employeeId?.trim() || null;
    }

    if (joiningDate !== undefined) {
      updateData.joiningDate = joiningDate || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // -------------------------------------------------------
    // Password
    // -------------------------------------------------------
    if (password?.trim()) {
      const bcrypt = await import("bcryptjs");

      updateData.passwordHash = await bcrypt.default.hash(
        password.trim(),
        10
      );
    }

    // -------------------------------------------------------
    // Update
    // -------------------------------------------------------
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select("-passwordHash")
      .lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("✅ USER UPDATED:");
    console.log({
      id: String(updatedUser._id),
      name: updatedUser.name,
      department: updatedUser.department,
      designation: updatedUser.designation,
      company: updatedUser.company,
    });

    return res.status(200).json({
      success: true,
      message: "User updated",
      user: updatedUser,
    });
  } catch (err) {
    console.error("❌ UPDATE USER ERROR:", err);

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(
        (error) => error.message
      );

      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
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

// =========================================================
// Delete User
// =========================================================
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(
      req.params.id
    );

    if (!deletedUser) {
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
    console.error("❌ Delete User Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};