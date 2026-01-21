import mongoose from "mongoose";

const SalesOrderSchema = new mongoose.Schema({
  soNumber: { type: String, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true }, // <--- add this
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
      qty: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  status: { type: String, default: "DRAFT" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

export default mongoose.model("SalesOrder", SalesOrderSchema);
