import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },

  description: { type: String },

  price: { type: Number, required: true },

  sku: {
    type: String,
    unique: true,
    default: function () {
      return "SKU-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Product", productSchema);
