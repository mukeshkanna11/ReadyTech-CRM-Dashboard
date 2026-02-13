import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    tax: Number,
    discount: Number,
    totalAmount: Number,
    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Cancelled"],
      default: "Draft",
    },
    paymentMode: String,
    dueDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Invoice", invoiceSchema);
