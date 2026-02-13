// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
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
   HASH PASSWORD BEFORE SAVE
========================================================= */
userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

/* =========================================================
   COMPARE PASSWORD METHOD
========================================================= */
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

/* =========================================================
   REMOVE PASSWORD FROM RESPONSE
========================================================= */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

/* =========================================================
   CREATE SUPER ADMIN IF NOT EXISTS
========================================================= */
userSchema.statics.createAdminIfNotExists = async function () {
  const adminEmail = "siva@readytechsolutions.in";

  const existingAdmin = await this.findOne({ email: adminEmail });

  if (!existingAdmin) {
    const admin = new this({
      name: "Super Admin",
      email: adminEmail,
      passwordHash: "siva@123", // auto hashed
      role: "admin",
      isActive: true,
    });

    await admin.save();
    console.log("✅ Super Admin created");
  } else {
    console.log("ℹ️ Super Admin already exists");
  }
};

export default mongoose.model("User", userSchema);
