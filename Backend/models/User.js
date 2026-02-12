// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }, // hashed password
    role: {
      type: String,
      enum: ["admin", "employee", "client"],
      default: "client",
    },
    company: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

/* =========================================================
   PASSWORD COMPARISON HELPER
   Returns true/false for a given plain password
========================================================= */
userSchema.methods.comparePassword = async function (password) {
  if (!password || !this.passwordHash) {
    throw new Error("Password not provided or not set");
  }
  return bcrypt.compare(password, this.passwordHash);
};

/* =========================================================
   REMOVE PASSWORD FROM JSON RESPONSE
========================================================= */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

/* =========================================================
   PRE-SAVE HOOK TO HASH PASSWORD
   Only hashes when passwordHash is modified
========================================================= */
userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
});

/* =========================================================
   STATIC METHOD TO CREATE SUPER ADMIN USER IF NOT EXISTS
========================================================= */
userSchema.statics.createAdminIfNotExists = async function () {
  const User = this;
  const adminEmail = "siva@readytechsolutions.in";
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    const admin = await User.create({
      name: "Super Admin",
      email: adminEmail,
      passwordHash: "siva@123", // will be hashed automatically
      role: "admin",
      isActive: true,
    });
    console.log("✅ Super Admin created:", admin.email);
  } else {
    console.log("ℹ️ Super Admin already exists:", existingAdmin.email);
  }
};

/* =========================================================
   HELPER STATIC METHOD TO FETCH ALL USERS (without password)
========================================================= */
userSchema.statics.getAllUsers = async function () {
  return this.find().select("-passwordHash").sort({ createdAt: -1 });
};

export default mongoose.model("User", userSchema);
