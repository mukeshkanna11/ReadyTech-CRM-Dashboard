// models/Chat.js

import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    /* =========================================================
       Visitor Information
    ========================================================= */

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20,
    },

    company: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    /* =========================================================
       Enquiry Details
    ========================================================= */

    category: {
      type: String,
      enum: [
        "CRM Demo",
        "ERP Demo",
        "Pricing",
        "Sales",
        "Support",
        "Custom Development",
        "Website Development",
        "Mobile App Development",
        "Digital Marketing",
        "General Enquiry",
      ],
      default: "General Enquiry",
      index: true,
    },

    subject: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: 5000,
    },

    /* =========================================================
       Source
    ========================================================= */

    source: {
      type: String,
      enum: [
        "Website",
        "Landing Page",
        "CRM",
        "ERP",
        "Mobile App",
      ],
      default: "Website",
    },

    /* =========================================================
       CRM Workflow
    ========================================================= */

    status: {
      type: String,
      enum: [
        "New",
        "Viewed",
        "Assigned",
        "In Progress",
        "Contacted",
        "Qualified",
        "Closed",
      ],
      default: "New",
      index: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    /* =========================================================
       CRM Relations
    ========================================================= */

    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* =========================================================
       Admin Notes
    ========================================================= */

    notes: [
      {
        note: {
          type: String,
          trim: true,
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    /* =========================================================
       Flags
    ========================================================= */

    isRead: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* =========================================================
   Indexes
========================================================= */

chatSchema.index({ email: 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ category: 1 });
chatSchema.index({ createdAt: -1 });

export default mongoose.model("Chat", chatSchema);