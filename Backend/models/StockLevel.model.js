import mongoose from "mongoose";

/* =====================================================
   STOCK LEVEL (reservation cache)
   Physical on-hand stays in the Inventory ledger
   (Σ inQty − Σ outQty). This layer tracks the soft
   allocation (reserved) per product + warehouse so that
   available-to-promise = onHand − reserved.
===================================================== */
const stockLevelSchema = new mongoose.Schema(
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
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

/* One row per product + warehouse */
stockLevelSchema.index({ product: 1, warehouse: 1 }, { unique: true });

/* Currently reserved quantity (0 when no row exists) */
stockLevelSchema.statics.getReserved = async function (product, warehouse, session = null) {
  const doc = await this.findOne({ product, warehouse }).session(session);
  return doc ? doc.reserved : 0;
};

const StockLevel =
  mongoose.models.StockLevel || mongoose.model("StockLevel", stockLevelSchema);

export default StockLevel;
