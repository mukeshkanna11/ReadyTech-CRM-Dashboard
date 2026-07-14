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
      enum: ["PURCHASE", "SALE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT"],
      required: true,
    },

    reference: {
      type: mongoose.Schema.Types.ObjectId, // SalesOrder / PurchaseOrder, or shared transfer id linking both legs
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/* =====================================================
   INDEXES
===================================================== */
inventorySchema.index({ product: 1, warehouse: 1 });
inventorySchema.index({ warehouse: 1 });
inventorySchema.index({ type: 1 });
inventorySchema.index({ createdAt: -1 });

/* =====================================================
   AVAILABLE STOCK — single source of truth
   available = Σ inQty − Σ outQty  (per product + warehouse)
   Accepts an optional session so callers can read inside
   the same transaction they write in.
===================================================== */
inventorySchema.statics.getAvailable = async function (product, warehouse, session = null) {
  const [row] = await this.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(product),
        warehouse: new mongoose.Types.ObjectId(warehouse),
      },
    },
    {
      $group: {
        _id: null,
        inQty: { $sum: "$inQty" },
        outQty: { $sum: "$outQty" },
      },
    },
  ]).session(session);

  return row ? row.inQty - row.outQty : 0;
};

/* =====================================================
   Prevent OverwriteModelError in ESM / Hot Reload
===================================================== */
const Inventory =
  mongoose.models.Inventory ||
  mongoose.model("Inventory", inventorySchema);

export default Inventory;
