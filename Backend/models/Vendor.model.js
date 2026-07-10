import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    address: String,
  },
  { timestamps: true }
);

export default mongoose.model("Vendor", vendorSchema);
