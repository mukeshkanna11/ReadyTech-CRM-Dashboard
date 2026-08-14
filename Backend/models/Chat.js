// models/Chat.js

import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    /* =========================================================
       VISITOR INFORMATION
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
       ENQUIRY DETAILS

       IMPORTANT:
       category is intentionally NOT an enum.

       Customer can enter:
       - CRM Software
       - ERP Software
       - AI Automation
       - Custom CRM
       - Website Redesign
       - Payment Integration
       - Any other requirement
    ========================================================= */

    category: {
      type: String,
      trim: true,
      default: "General Enquiry",
      maxlength: 150,
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
       SOURCE
    ========================================================= */

    source: {
      type: String,
      trim: true,
      default: "Website",
      maxlength: 100,
    },

    /* =========================================================
       CRM WORKFLOW
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
      enum: [
        "Low",
        "Medium",
        "High",
        "Urgent",
      ],
      default: "Medium",
    },

    /* =========================================================
       CRM RELATIONS
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
       ADMIN NOTES
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
       FLAGS
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
   INDEXES
========================================================= */

chatSchema.index({
  email: 1,
});

chatSchema.index({
  status: 1,
});

chatSchema.index({
  category: 1,
});

chatSchema.index({
  createdAt: -1,
});

/* =========================================================
   EXPORT
========================================================= */

export default mongoose.model("Chat", chatSchema);