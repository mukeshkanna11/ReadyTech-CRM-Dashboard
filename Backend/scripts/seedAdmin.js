import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../src/models/User.js";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

(async function seed() {
  await mongoose.connect(MONGODB_URI);
  const email = "admin@readytech.com";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Admin already exists:", existing.email);
    process.exit(0);
  }
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("Admin@1234", salt);

  const admin = new User({
    name: "Admin",
    email,
    passwordHash,
    role: "admin"
  });
  await admin.save();
  console.log("Admin created:", admin.email, "password: Admin@1234");
  process.exit(0);
})();
