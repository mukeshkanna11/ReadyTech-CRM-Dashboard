// routes/user.routes.js
import express from "express";
import auth, { authorize } from "../middlewares/auth.js";

const router = express.Router();

/* =========================================================
   USER SUMMARY (ONLY MANAGER & EMPLOYEE)
========================================================= */
router.get(
  "/summary",
  auth,
  authorize("manager", "employee"),
  (req, res) => {
    res.status(200).json({
      message: "User summary data",
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  }
);

export default router;
