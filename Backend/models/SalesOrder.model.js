import mongoose from "mongoose";

const SalesOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    qty: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const SalesOrderSchema = new mongoose.Schema(
  {
    soNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    items: {
      type: [SalesOrderItemSchema],
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "At least one item is required",
      },
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "APPROVED",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "DRAFT",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    crmSyncStatus: {
      type: String,
      enum: [
        "PENDING",
        "SYNCED",
        "FAILED",
      ],
      default: "PENDING",
    },

    salesforceId: {
      type: String,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ==========================================
   AUTO CALCULATE LINE TOTAL + GRAND TOTAL
========================================== */
SalesOrderSchema.pre("save", function (next) {
  let grandTotal = 0;

  this.items.forEach((item) => {
    item.lineTotal = item.qty * item.price;
    grandTotal += item.lineTotal;
  });

  this.totalAmount = grandTotal;

  next();
});

/* ==========================================
   INDEXES
========================================== */
SalesOrderSchema.index({ customer: 1 });
SalesOrderSchema.index({ createdAt: -1 });
SalesOrderSchema.index({ status: 1 });

export default mongoose.model(
  "SalesOrder",
  SalesOrderSchema
);