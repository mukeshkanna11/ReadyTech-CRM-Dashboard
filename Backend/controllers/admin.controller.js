import User from "../models/User.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";
import Lead from "../models/Lead.js";

// ===================== Dashboard Summary =====================
export const summary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalClients = await Client.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalLeads = await Lead.countDocuments();

    res.status(200).json({
      totalUsers,
      totalAdmins,
      totalClients,
      totalProducts,
      totalLeads,
    });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================== Users Management =====================

// List all users
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.status(200).json(users);
  } catch (err) {
    console.error("List Users Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get single user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("Get User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user
export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User updated", user });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
