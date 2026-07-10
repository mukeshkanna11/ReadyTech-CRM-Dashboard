import mongoose from "mongoose";

const { Schema } = mongoose;

const LeadSchema = new Schema(
  {
    name: {
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

    company: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: [
        "Website",
        "Referral",
        "Facebook",
        "Instagram",
        "LinkedIn",
        "Google Ads",
        "Email Campaign",
        "WhatsApp",
        "Phone Call",
        "Walk-In",
        "Other",
      ],
      default: "Website",
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Qualified",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost",
      ],
      default: "New",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
    },

    department: {
      type: String,
      enum: [
        "Sales",
        "Marketing",
        "Support",
        "ERP",
        "CRM",
        "Digital Marketing",
      ],
      default: "Sales",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // Enterprise CRM Fields
    isConverted: {
      type: Boolean,
      default: false,
    },

    convertedAt: {
      type: Date,
      default: null,
    },

    convertedOpportunity: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Lead", LeadSchema);