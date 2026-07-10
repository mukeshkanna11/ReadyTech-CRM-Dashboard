import mongoose from "mongoose";

const { Schema } = mongoose;

const ClientSchema = new Schema(
  {
    // =========================
    // COMPANY DETAILS
    // =========================
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    // =========================
    // CONTACT PERSON
    // =========================
    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    website: {
      type: String,
      trim: true,
    },

    // =========================
    // TAX DETAILS
    // =========================
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // =========================
    // BILLING ADDRESS
    // =========================
    billingAddress: {
      addressLine1: {
        type: String,
        trim: true,
      },

      addressLine2: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      pincode: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        default: "India",
      },
    },

    // =========================
    // SHIPPING ADDRESS
    // =========================
    shippingAddress: {
      addressLine1: {
        type: String,
        trim: true,
      },

      addressLine2: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      pincode: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        default: "India",
      },
    },

    // =========================
    // CLIENT TYPE
    // =========================
    clientType: {
      type: String,
      enum: ["Lead", "Customer", "Partner"],
      default: "Customer",
    },

    // =========================
    // STATUS
    // =========================
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    // =========================
    // SUBSCRIPTION INFO
    // =========================
    currentPlan: {
      type: String,
      trim: true,
    },

    subscriptionStatus: {
      type: String,
      enum: ["Trial", "Active", "Expired", "Cancelled"],
      default: "Trial",
    },

    subscriptionStartDate: Date,

    subscriptionEndDate: Date,

    // =========================
    // CRM NOTES
    // =========================
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Client", ClientSchema);