// server.js
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import { askClaude } from "./services/claudeService.js";

const PORT = process.env.PORT || 3000;

console.log("=================================");
console.log("🚀 Starting ReadyTech CRM");
console.log("=================================");

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", PORT);
console.log("MONGO_URI:", process.env.MONGO_URI ? "FOUND ✅" : "MISSING ❌");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "FOUND ✅" : "MISSING ❌");
console.log(
  "CLAUDE_API_KEY:",
  process.env.CLAUDE_API_KEY ? "FOUND ✅" : "MISSING ❌"
);

// Start Express immediately
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Express Server Running on Port ${PORT}`);
});

// Background startup
(async () => {
  try {
    /* ==========================
       MongoDB
    ========================== */
    console.log("⏳ Connecting MongoDB...");
    await connectDB();
    console.log("✅ MongoDB Connected");

    /* ==========================
       Claude API Test
    ========================== */
    try {
      console.log("⏳ Testing Claude API...");

      const result = await askClaude("Reply with only: OK", {
        maxTokens: 10,
      });

      console.log("✅ Claude Working:", true);
      console.log("🤖 Model:", result.model);
    } catch (err) {
      console.log("❌ Claude Working:", false);
      console.error(err.message);
    }

    /* ==========================
       Super Admin
    ========================== */
    try {
      console.log("⏳ Checking Super Admin...");
      await User.createAdminIfNotExists();
      console.log("✅ Super Admin Verified");
    } catch (err) {
      console.error("⚠️ Super Admin Error:", err);
    }

    console.log("🎉 Application Started Successfully");
  } catch (err) {
    console.error("❌ MongoDB Startup Error");
    console.error(err);
    process.exit(1);
  }
})();

/* ==========================
   Graceful Shutdown
========================== */
process.on("SIGINT", () => {
  console.log("🛑 SIGINT received");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received");
  server.close(() => process.exit(0));
});

/* ==========================
   Global Error Handlers
========================== */
process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:");
  console.error(err);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:");
  console.error(err);
});