// server.js
import dotenv from "dotenv";
dotenv.config();

console.log("Claude Loaded:", !!process.env.CLAUDE_API_KEY);
console.log("Claude Length:", process.env.CLAUDE_API_KEY?.length);
console.log("Claude Prefix:", process.env.CLAUDE_API_KEY?.substring(0, 15));
console.log("Claude Suffix:", process.env.CLAUDE_API_KEY?.slice(-4));

import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";

const PORT = process.env.PORT || 5000;

/* =========================================================
   START SERVER FUNCTION
========================================================= */
const startServer = async () => {
  try {
    // Connect Database
    await connectDB();
    console.log("✅ MongoDB connected successfully");

    // Create Super Admin if not exists
    await User.createAdminIfNotExists();
    console.log("👤 Super Admin check completed");

    // Start Express Server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();

/* =========================================================
   GLOBAL ERROR HANDLERS (Important for Render)
========================================================= */
process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  process.exit(1);
});
