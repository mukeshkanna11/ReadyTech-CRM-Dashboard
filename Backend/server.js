import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  console.log("🚀 Starting ReadyTech CRM...");

  // Fail loudly and specifically when the platform never injected the vars.
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ FATAL: MONGO_URI is undefined. .env is gitignored and never deployed, " +
        "so this must come from the Hostinger environment variables."
    );
    process.exit(1);
  }

  try {
    await connectDB();
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ FATAL: MongoDB connection failed.");
    console.error(err);
    process.exit(1);
  }

  // Seeding must never stop the API from listening — a failure here previously
  // exited the process, which is what a platform reports as HTTP 503.
  try {
    await User.createAdminIfNotExists();
    console.log("✅ Super Admin Verified");
  } catch (err) {
    console.error("⚠️  Super admin seeding failed (continuing to listen):");
    console.error(err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();

process.on("unhandledRejection", (err) => {
  console.error(err);
});

process.on("uncaughtException", (err) => {
  console.error(err);
});