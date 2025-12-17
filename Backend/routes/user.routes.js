// routes/user.routes.js
import express from "express";
import auth from "../middlewares/auth.js";

const router = express.Router();

router.get("/summary", auth, (req, res) => {
  // Return only user-specific summary
  res.json({ message: "User summary data", user: req.user.name });
});

export default router;
