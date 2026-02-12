// routes/admin.routes.js
import express from "express";
import User from "../models/User.js";
import auth, { requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

/* =========================================================
   🔐 ALL ROUTES PROTECTED + ADMIN ONLY
========================================================= */
router.use(auth, requireAdmin);

/* =========================================================
   GET ALL USERS
========================================================= */
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("-passwordHash -__v")
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

/* =========================================================
   CREATE NEW USER
========================================================= */
router.post("/users", async (req, res) => {
  try {
    const { name, email, role = "employee", status = "Active", company, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email & password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const user = await User.create({
      name,
      email,
      role,
      isActive: status === "Active",
      company,
      passwordHash: password, // will be hashed in User model pre-save
    });

    res.status(201).json({ success: true, message: "User created", user });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

/* =========================================================
   UPDATE USER
========================================================= */
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.status) {
      updates.isActive = updates.status === "Active";
      delete updates.status;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select("-passwordHash -__v");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, message: "User updated", user });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

/* =========================================================
   DELETE USER
========================================================= */
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

export default router;
