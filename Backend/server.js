import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  console.log("=================================");
  console.log("🚀 Starting ReadyTech CRM...");
  console.log("=================================");

  /* ===============================
     Validate Environment Variables
  =============================== */
  if (!process.env.MONGO_URI) {
    console.error("❌ FATAL: MONGO_URI is missing.");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error("❌ FATAL: JWT_SECRET is missing.");
    process.exit(1);
  }

  try {
    /* ===============================
       Connect MongoDB
    =============================== */
    await connectDB();
    console.log("✅ MongoDB Connected");

    /* ===============================
       Create Super Admin
    =============================== */
    try {
      await User.createAdminIfNotExists();
      console.log("✅ Super Admin Verified");
    } catch (err) {
      console.error("⚠️ Super Admin creation failed.");
      console.error(err);
      console.log("⚠️ Continuing without stopping server...");
    }

    /* ===============================
       Start Express Server
    =============================== */
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("=================================");
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log("=================================");
    });

    /* ===============================
       Graceful Shutdown
    =============================== */
    process.on("SIGINT", () => {
      console.log("🛑 Server stopped.");
      server.close(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
      console.log("🛑 Server stopped.");
      server.close(() => process.exit(0));
    });

  } catch (err) {
    console.error("❌ SERVER STARTUP FAILED");
    console.error(err);
    process.exit(1);
  }
}

startServer();

/* ===============================
   Global Error Handlers
=============================== */

process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:");
  console.error(err);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:");
  console.error(err);
});