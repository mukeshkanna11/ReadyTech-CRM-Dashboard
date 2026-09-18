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
    // INSTAGRAM DM REFERENCE
    // Sender ID (IGSID) of the Instagram DM thread this lead came
    // from. Used to de-duplicate webhook leads and to enrich the
    // same lead across multiple messages.
    // =========================
    instagramSenderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
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

// Latest customer interaction on this lead (inbound DM, website
// enquiry, WhatsApp message, logged Call/Email/Meeting activity).
// Initialized for new leads by the pre-save hook below — a schema
// `default` cannot be used here, because Mongoose would also apply
// it while hydrating older leads that predate the field, making
// every one of them look contacted "just now".
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

// =========================
// LEAD RECENCY
// Every new lead starts its recency clock at creation, whatever
// source built it (manual, website form, chat, WhatsApp, Instagram),
// so the Leads list can order all sources consistently. Sources that
// pass an explicit time (Instagram DM) keep theirs. `isNew` guards
// existing leads: editing an old lead must not fake a contact.
// =========================
LeadSchema.pre("save", function (next) {
  if (this.isNew && !this.lastContactedAt) {
    this.lastContactedAt = new Date();
  }

  next();
});

export default mongoose.model("Lead", LeadSchema);