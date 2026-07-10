import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    inQty: {
      type: Number,
      default: 0,
    },

    outQty: {
      type: Number,
      default: 0,
    },

    type: {
      type: String,
      enum: ["PURCHASE", "SALE", "ADJUSTMENT"], // 🔹 Use "SALE" here
      required: true,
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId, // Can reference SalesOrder or PurchaseOrder
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/* =====================================================
   Prevent OverwriteModelError in ESM / Hot Reload
===================================================== */
const Inventory =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", inventorySchema);

export default Inventory;
