import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, unique: true, required: true },
    price: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    unit: { type: String, default: "pcs" },
    lowStockLimit: { type: Number, default: 10 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
