// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "employee", "client"], default: "client" },
    company: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

/* =========================================================
   PASSWORD COMPARISON HELPER
========================================================= */
userSchema.methods.comparePassword = async function (password) {
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
   ⚡ Modern Mongoose: async function, no next()
========================================================= */
userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
});

export default mongoose.model("User", userSchema);
