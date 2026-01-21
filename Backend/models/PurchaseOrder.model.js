import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  qty: { type: Number, required: true },
  cost: { type: Number, required: true },
});

const PurchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    items: [ItemSchema],
    status: { type: String, enum: ["DRAFT", "RECEIVED"], default: "DRAFT" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseOrder", PurchaseOrderSchema);
