import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    default: "",
    trim: true,
  },

  category: {
    type: String,
    default: "General",
    trim: true,
  },

  price: {
    type: Number,
    required: true,
    min: 0,
  },

  stockQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },

  sku: {
    type: String,
    default: function () {
      return (
        "SKU-" +
        Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase()
      );
    },
  },

barcode: {
  type: String,
  required: true,
  trim: true,
  default: function () {
    return (
      "RTS" +
      Date.now().toString().slice(-8) +
      Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, "0")
    );
  },
},

  costPrice: {
    type: Number,
    default: 0,
  },
  
  status: {
  type: String,
  enum: ["Active", "Inactive"],
  default: "Active",
},

  unit: {
    type: String,
    default: "pcs",
  },

  lowStockLimit: {
    type: Number,
    default: 10,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
},
{
  timestamps: true,
}
);

// Unique per workspace, so each workspace can reuse SKUs / barcodes
productSchema.index({ workspace: 1, sku: 1 }, { unique: true });
productSchema.index({ workspace: 1, barcode: 1 }, { unique: true });

export default mongoose.model("Product", productSchema);