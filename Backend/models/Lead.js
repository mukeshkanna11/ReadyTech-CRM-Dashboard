import mongoose from "mongoose";

const { Schema } = mongoose;

const LeadSchema = new Schema(
  {
    // =========================
    // PERSONAL INFORMATION
    // =========================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // COMPANY INFORMATION
    // =========================
    company: {
      type: String,
      trim: true,
      default: "",
    },

    industry: {
      type: String,
      trim: true,
      default: "",
    },

    website: {
      type: String,
      trim: true,
      default: "",
    },

    companySize: {
      type: String,
      enum: [
        "",
        "1-10",
        "11-50",
        "51-200",
        "201-500",
        "500+",
      ],
      default: "",
    },

    // =========================
    // ENQUIRY INFORMATION
    // =========================
    requirement: {
      type: String,
      trim: true,
      default: "",
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // LEAD SOURCE
    // =========================
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
        "Social Media",
        "Email",
        "Cold Call",
        "Event",
        "Other",
      ],
      default: "Website",
    },

    // =========================
    // OWNER
    // =========================
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    
    // =========================
// LEAD STATUS
// =========================
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
    "Closed",
  ],
  default: "New",
},

// =========================
// STATUS HISTORY
// =========================
statusHistory: [
  {
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
        "Closed",
      ],
      required: true,
    },

    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
],

    // =========================
    // PRIORITY
    // =========================
    priority: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High",
      ],
      default: "Medium",
    },

    // =========================
    // ASSIGNMENT
    // =========================
    assignedTo: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // SALES INFORMATION
    // =========================
    value: {
      type: Number,
      default: 0,
      min: 0,
    },

    expectedValue: {
      type: Number,
      default: 0,
      min: 0,
    },

  
// =========================
// FOLLOW-UP / CONTACT
// =========================

followUpDate: {
  type: Date,
  default: null,
},

lastContactedAt: {
  type: Date,
  default: null,
},

nextFollowUpAt: {
  type: Date,
  default: null,
},

    // =========================
    // DEPARTMENT
    // =========================
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

    // =========================
    // NOTES
    // =========================
    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // LEAD CONVERSION
    // =========================
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