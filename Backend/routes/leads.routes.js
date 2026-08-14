import express from "express";
import mongoose from "mongoose";

import Lead from "../models/Lead.js";
import AuditLog from "../models/AuditLog.js";
import Opportunity from "../models/Opportunity.js";
import User from "../models/User.js";

import auth from "../middlewares/auth.js";

import {
  sendLeadNotification,
  sendLeadAutoReply,
} from "../services/email.service.js";

const router = express.Router();

/* =========================================================
   GET ALL LEADS
   GET /api/leads
========================================================= */
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
    } = req.query;

    const query = {};

    /* =========================
       STATUS FILTER
    ========================= */
    if (status) {
      query.status = status;
    }

    /* =========================
       SEARCH
    ========================= */
    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
        {
          company: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const pageNumber = Math.max(Number(page), 1);
    const pageLimit = Math.max(Number(limit), 1);

    const leads = await Lead.find(query)
      .populate("owner", "name email")
      .populate("convertedOpportunity")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageLimit)
      .limit(pageLimit);

    const total = await Lead.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: pageNumber,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    console.error("FETCH LEADS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch leads",
    });
  }
});

/* =========================================================
   CREATE PUBLIC LEAD
   Website / Customer Chat / Enquiry Form

   POST /api/leads/public

   NOTE:
   This route does NOT require authentication.
========================================================= */
router.post("/public", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      requirement,
      message,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    /* =====================================================
       FIND DEFAULT LEAD OWNER
    ===================================================== */

    const defaultOwner = await User.findOne({
      role: "admin",
      isActive: true,
    }).select("_id");

    if (!defaultOwner) {
      return res.status(500).json({
        success: false,
        message: "No active lead owner found",
      });
    }

    /* =====================================================
       CREATE WEBSITE LEAD
    ===================================================== */

    const leadData = {
      name: name.trim(),

      email: email.trim().toLowerCase(),

      phone: phone?.trim() || "",

      company: company?.trim() || "",

      source: "Website",

      status: "New",

      priority: "Medium",

      value: 0,

      department: "Sales",

      notes: message?.trim() || "",

      owner: defaultOwner._id,

      isConverted: false,

      convertedAt: null,

      convertedOpportunity: null,
    };

    /*
      Add these only when your Lead schema contains
      requirement and message fields.
    */
    if (requirement !== undefined) {
      leadData.requirement = requirement?.trim() || "";
    }

    if (message !== undefined) {
      leadData.message = message?.trim() || "";
    }

    const lead = await Lead.create(leadData);

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    try {
      await AuditLog.create({
        action: "CREATE_PUBLIC_LEAD",
        entity: "Lead",
        entityId: lead._id,
        user: defaultOwner._id,
        description: "Lead created from website enquiry",
      });
    } catch (auditError) {
      console.error(
        "PUBLIC LEAD AUDIT LOG ERROR:",
        auditError
      );
    }

    /* =====================================================
       POPULATE OWNER
    ===================================================== */

    const populatedLead = await Lead.findById(
      lead._id
    )
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    /* =====================================================
       SEND COMPANY EMAIL
       Email failure should NOT fail lead creation.
    ===================================================== */

    try {
      await sendLeadNotification(populatedLead);

      console.log(
        "✅ Public lead notification email sent:",
        populatedLead.email
      );
    } catch (emailError) {
      console.error(
        "⚠️ Public lead notification email failed:",
        emailError.message
      );
    }

    /* =====================================================
       SEND CUSTOMER AUTO REPLY
       Email failure should NOT fail lead creation.
    ===================================================== */

    if (populatedLead.email) {
      try {
        await sendLeadAutoReply(populatedLead);

        console.log(
          "✅ Public lead auto-reply sent:",
          populatedLead.email
        );
      } catch (emailError) {
        console.error(
          "⚠️ Public lead auto-reply failed:",
          emailError.message
        );
      }
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(201).json({
      success: true,
      message:
        "Thank you! Your enquiry has been submitted successfully.",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(
      "CREATE PUBLIC LEAD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to submit enquiry",
    });
  }
});

/* =========================================================
   GET SINGLE LEAD
   GET /api/leads/:id
========================================================= */
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const lead = await Lead.findById(id)
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error("FETCH LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead",
    });
  }
});

/* =========================================================
   CREATE LEAD FROM CRM
   POST /api/leads

   Requires authentication.
========================================================= */
router.post("/", auth, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      source,
      status,
      priority,
      value,
      department,
      notes,
      requirement,
      message,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required",
      });
    }

    /* =====================================================
       CREATE LEAD DATA
    ===================================================== */

    const leadData = {
      name: name.trim(),

      email: email?.trim().toLowerCase() || "",

      phone: phone?.trim() || "",

      company: company?.trim() || "",

      source: source || "CRM",

      status: status || "New",

      priority: priority || "Medium",

      value: Number(value || 0),

      department: department || "Sales",

      notes: notes?.trim() || "",

      owner: req.user._id,

      isConverted: false,

      convertedAt: null,

      convertedOpportunity: null,
    };

    if (requirement !== undefined) {
      leadData.requirement =
        requirement?.trim() || "";
    }

    if (message !== undefined) {
      leadData.message =
        message?.trim() || "";
    }

    /* =====================================================
       CREATE
    ===================================================== */

    const lead = await Lead.create(leadData);

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    await AuditLog.create({
      action: "CREATE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
    });

    /* =====================================================
       POPULATE
    ===================================================== */

    const populatedLead = await Lead.findById(
      lead._id
    )
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    /* =====================================================
       COMPANY EMAIL
    ===================================================== */

    try {
      await sendLeadNotification(populatedLead);

      console.log(
        "✅ CRM lead notification email sent:",
        populatedLead.email
      );
    } catch (emailError) {
      console.error(
        "⚠️ CRM lead notification email failed:",
        emailError.message
      );
    }

    /* =====================================================
       CUSTOMER AUTO REPLY
    ===================================================== */

    if (populatedLead.email) {
      try {
        await sendLeadAutoReply(populatedLead);

        console.log(
          "✅ CRM lead auto-reply sent:",
          populatedLead.email
        );
      } catch (emailError) {
        console.error(
          "⚠️ CRM lead auto-reply failed:",
          emailError.message
        );
      }
    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(
      "CREATE CRM LEAD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create lead",
    });
  }
});

/* =========================================================
   UPDATE LEAD
   PUT /api/leads/:id
========================================================= */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const existingLead = await Lead.findById(id);

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    /* =====================================================
       UPDATE ONLY ALLOWED FIELDS
    ===================================================== */

    const allowedFields = [
      "name",
      "email",
      "phone",
      "company",
      "source",
      "status",
      "priority",
      "value",
      "department",
      "notes",
      "requirement",
      "message",
    ];

    const oldValue = existingLead.toObject();

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingLead[field] = req.body[field];
      }
    });

    /* =====================================================
       NORMALIZE
    ===================================================== */

    if (existingLead.name) {
      existingLead.name =
        existingLead.name.trim();
    }

    if (existingLead.email) {
      existingLead.email =
        existingLead.email
          .trim()
          .toLowerCase();
    }

    if (existingLead.phone) {
      existingLead.phone =
        existingLead.phone.trim();
    }

    if (existingLead.company) {
      existingLead.company =
        existingLead.company.trim();
    }

    if (existingLead.notes) {
      existingLead.notes =
        existingLead.notes.trim();
    }

    if (existingLead.requirement) {
      existingLead.requirement =
        existingLead.requirement.trim();
    }

    if (existingLead.message) {
      existingLead.message =
        existingLead.message.trim();
    }

    existingLead.value =
      Number(existingLead.value || 0);

    await existingLead.save();

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    await AuditLog.create({
      action: "UPDATE",
      entity: "Lead",
      entityId: existingLead._id,
      user: req.user._id,
      oldValue,
      newValue: existingLead,
    });

    /* =====================================================
       POPULATE
    ===================================================== */

    const populatedLead = await Lead.findById(
      existingLead._id
    )
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: populatedLead,
    });
  } catch (error) {
    console.error(
      "LEAD UPDATE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update lead",
    });
  }
});

/* =========================================================
   DELETE LEAD
   DELETE /api/leads/:id
========================================================= */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const lead = await Lead.findById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const oldValue = lead.toObject();

    await Lead.findByIdAndDelete(id);

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    await AuditLog.create({
      action: "DELETE",
      entity: "Lead",
      entityId: lead._id,
      user: req.user._id,
      oldValue,
    });

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error(
      "LEAD DELETE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete lead",
    });
  }
});

/* =========================================================
   CONVERT LEAD TO OPPORTUNITY
   POST /api/leads/:id/convert
========================================================= */
router.post("/:id/convert", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      value,
    } = req.body;

    /* =====================================================
       VALIDATE ID
    ===================================================== */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    /* =====================================================
       FIND LEAD
    ===================================================== */

    const lead = await Lead.findById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    /* =====================================================
       PREVENT DUPLICATE CONVERSION
    ===================================================== */

    if (lead.isConverted) {
      return res.status(400).json({
        success: false,
        message: "Lead already converted",
        opportunityId:
          lead.convertedOpportunity,
      });
    }

    console.log(
      "Lead Owner:",
      lead.owner
    );

    console.log(
      "Auth User:",
      req.user._id
    );

    /* =====================================================
       CREATE OPPORTUNITY
    ===================================================== */

    const opportunity =
      await Opportunity.create({
        title:
          title?.trim() ||
          `${lead.name} Opportunity`,

        lead: lead._id,

        value:
          Number(value) || 0,

        assignedTo:
          req.user._id,

        createdBy:
          req.user._id,

        department:
          lead.department ||
          "Sales",

        notes:
          lead.notes || "",

        stage:
          "Prospecting",
      });

    /* =====================================================
       UPDATE LEAD
    ===================================================== */

    // Preserve existing owner
    lead.owner =
      lead.owner ||
      req.user._id;

    lead.status = "Won";

    lead.isConverted = true;

    lead.convertedAt =
      new Date();

    lead.convertedOpportunity =
      opportunity._id;

    await lead.save();

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    await AuditLog.create({
      user: req.user._id,

      action: "CONVERT",

      entity: "Lead",

      entityId: lead._id,

      description:
        "Lead converted to Opportunity",

      meta: {
        opportunityId:
          opportunity._id,
      },
    });

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      message:
        "Lead converted successfully",

      lead,

      opportunity,
    });
  } catch (error) {
    console.error(
      "CONVERT LEAD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to convert lead",
    });
  }
});

export default router;