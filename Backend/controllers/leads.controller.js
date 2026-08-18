import mongoose from "mongoose";
import Lead from "../models/Lead.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import Opportunity from "../models/Opportunity.js";
import {
  sendLeadNotification,
  sendLeadAutoReply,
} from "../services/email.service.js";
/* =========================================================
   CREATE LEAD
========================================================= */
export const createLead = async (req, res) => {
  try {
    const {
  name,
  designation,
  email,
  phone,
  company,
  industry,
  website,
  companySize,
  requirement,
  message,
  source,
  status,
  priority,
  assignedTo,
  value,
  expectedValue,
  followUpDate,
lastContactedAt,
nextFollowUpAt,
  department,
  notes,
}  = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required",
      });
    }

    const lead = new Lead({
  // Personal Information
  name: name.trim(),
  designation: designation?.trim() || "",
  email: email?.trim().toLowerCase() || "",
  phone: phone?.trim() || "",

  // Company Information
  company: company?.trim() || "",
  industry: industry?.trim() || "",
  website: website?.trim() || "",
  companySize: companySize || "",

  // Enquiry Information
  requirement: requirement?.trim() || "",
  message: message?.trim() || "",

  // Lead Source
  source: source || "Website",

  // Lead Status
  status: status || "New",

  statusHistory: [
  {
    status: status || "New",
    changedBy: req.user._id,
    changedAt: new Date(),
  },
],
  // Priority
  priority: priority || "Medium",

  // Assignment
  assignedTo: assignedTo?.trim() || "",

  // Sales Information
  value: Number(value || 0),
  expectedValue: Number(expectedValue || 0),

  // Follow-up
  followUpDate: followUpDate || null,

  // Department
  department: department || "Sales",

  // Notes
  notes: notes?.trim() || "",

  // Owner
  owner: req.user._id,

  // Conversion
  isConverted: false,
  convertedAt: null,
  convertedOpportunity: null,
});
    await lead.save();

   await AuditLog.create({
  user: req.user._id,
  action: "CREATE",
  entity: "Lead",
  entityId: lead._id,
  description: "Created a new lead",
  target: lead.name,
  meta: {
    lead: lead._id,
    source: lead.source,
    status: lead.status,
  },
});

    const populatedLead = await Lead.findById(lead._id).populate(
      "owner",
      "name email"
    );

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead: populatedLead,
    });
  } catch (error) {
    console.error("CREATE LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create lead",
    });
  }
};

/* =========================================================
   CREATE PUBLIC LEAD
   Website / Chat / Enquiry Form
========================================================= */
export const createPublicLead = async (req, res) => {
  try {
    const {
  name,
  designation,
  email,
  phone,
  company,
  industry,
  website,
  companySize,
  requirement,
  message,
  source,
  status,
  priority,
  assignedTo,
  value,
  expectedValue,
  followUpDate,
  department,
  notes,
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
       FIND DEFAULT OWNER
    ===================================================== */

    // Temporary approach:
    // Replace this with your User model / company admin logic.

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
       CREATE LEAD
    ===================================================== */

    const lead = new Lead({
      name: name.trim(),

      email: email.trim().toLowerCase(),

      phone: phone?.trim() || "",

      company: company?.trim() || "",

      source: "Website",

      status: "New",
status: "New",

statusHistory: [
  {
    status: "New",
    changedBy: defaultOwner._id,
    changedAt: new Date(),
  },
],

priority: "Medium",
      priority: "Medium",

      value: 0,

      department: "Sales",

      notes: message?.trim() || "",

      requirement: requirement?.trim() || "",

      message: message?.trim() || "",

      owner: defaultOwner._id,

      isConverted: false,

      convertedAt: null,

      convertedOpportunity: null,
    });

    await lead.save();

    /* =====================================================
       AUDIT LOG
    ===================================================== */

    await AuditLog.create({
  user: defaultOwner._id,
  action: "CREATE",
  entity: "Lead",
  entityId: lead._id,
  description: "Created a new public lead from website",
  target: lead.name,
  meta: {
    lead: lead._id,
    source: "Website",
    email: lead.email,
  },
});
    /* =====================================================
       POPULATE
    ===================================================== */

    const populatedLead = await Lead.findById(
      lead._id
    ).populate(
      "owner",
      "name email"
    );

    /* =====================================================
       COMPANY EMAIL
    ===================================================== */

    try {
      await sendLeadNotification(populatedLead);

      console.log(
        `✅ Public lead notification sent: ${lead._id}`
      );
    } catch (emailError) {
      console.error(
        "⚠️ Public lead notification failed:",
        emailError.message
      );
    }

    /* =====================================================
       CUSTOMER AUTO REPLY
    ===================================================== */

    try {
      await sendLeadAutoReply(populatedLead);

      console.log(
        `✅ Public lead auto reply sent: ${email}`
      );
    } catch (emailError) {
      console.error(
        "⚠️ Public lead auto reply failed:",
        emailError.message
      );
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
};

/* =========================================================
   LIST LEADS
========================================================= */
export const listLeads = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate("owner", "name email")
      .populate("convertedOpportunity")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leads.length,
      data: leads,
    });
  } catch (error) {
    console.error("LIST LEADS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch leads",
    });
  }
};

/* =========================================================
   GET SINGLE LEAD
========================================================= */
export const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
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
    console.error("GET LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lead",
    });
  }
};

/* =========================================================
   UPDATE LEAD
========================================================= */
export const updateLead = async (req, res) => {
  try {
    const leadId = req.params.id;

    // =====================================================
    // 1. FIND EXISTING LEAD
    // =====================================================

    const existingLead = await Lead.findById(leadId);

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // =====================================================
    // 2. KEEP OLD VALUES FOR AUDIT
    // =====================================================

    const oldValue = existingLead.toObject();
    const oldStatus = existingLead.status;

    // =====================================================
    // 3. ALLOWED FIELDS
    // =====================================================

    const allowedFields = [
      "name",
      "designation",
      "email",
      "phone",
      "company",
      "industry",
      "website",
      "companySize",
      "requirement",
      "message",
      "source",
      "status",
      "priority",
      "assignedTo",
      "value",
      "expectedValue",
      "followUpDate",
      "department",
      "notes",
    ];

    // =====================================================
    // 4. UPDATE ALLOWED FIELDS
    // =====================================================

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingLead[field] = req.body[field];
      }
    });

    // =====================================================
    // 5. STATUS HISTORY
    // =====================================================

    if (
      req.body.status !== undefined &&
      req.body.status !== oldStatus
    ) {
      existingLead.statusHistory.push({
        status: req.body.status,
        changedBy: req.user._id,
        changedAt: new Date(),
      });
    }

    // =====================================================
    // 6. NORMALIZE STRING FIELDS
    // =====================================================

    const stringFields = [
      "name",
      "designation",
      "email",
      "phone",
      "company",
      "industry",
      "website",
      "companySize",
      "requirement",
      "message",
      "source",
      "priority",
      "department",
      "notes",
    ];

    stringFields.forEach((field) => {
      if (
        existingLead[field] !== undefined &&
        existingLead[field] !== null
      ) {
        existingLead[field] =
          String(existingLead[field]).trim();
      }
    });

    // =====================================================
    // 7. NORMALIZE EMAIL
    // =====================================================

    if (existingLead.email) {
      existingLead.email =
        existingLead.email.toLowerCase();
    }

    // =====================================================
    // 8. ASSIGNED USER ID
    // assignedTo is String in schema
    // =====================================================

    if (
      existingLead.assignedTo !== undefined &&
      existingLead.assignedTo !== null
    ) {
      existingLead.assignedTo =
        String(existingLead.assignedTo).trim();
    }

    // =====================================================
    // 9. NORMALIZE NUMBERS
    // =====================================================

    existingLead.value = Number(
      existingLead.value || 0
    );

    existingLead.expectedValue = Number(
      existingLead.expectedValue || 0
    );

    // =====================================================
    // 10. SAVE LEAD
    // =====================================================

    console.log(
      "UPDATE: saving lead..."
    );

    console.log(
      "UPDATE: assignedTo:",
      existingLead.assignedTo
    );

    await existingLead.save();

    console.log(
      "UPDATE: lead saved:",
      existingLead._id
    );

    // =====================================================
    // 11. AUDIT LOG
    // Audit failure should NOT break lead update
    // =====================================================

    try {
      console.log(
        "UPDATE: creating audit log..."
      );

      await AuditLog.create({
        user: req.user._id,
        action: "UPDATE",
        entity: "Lead",
        entityId: existingLead._id,
        description: `Updated lead ${existingLead.name}`,
        target: existingLead.name,
        meta: {
          oldValue,
          newValue: existingLead.toObject(),
        },
      });

      console.log(
        "UPDATE: audit log created"
      );
    } catch (auditError) {
      console.error(
        "AUDIT LOG ERROR:",
        auditError
      );
    }

    // =====================================================
    // 12. FETCH UPDATED LEAD
    // IMPORTANT:
    // assignedTo is String, so DO NOT populate assignedTo
    // =====================================================

    console.log(
      "UPDATE: fetching updated lead..."
    );

    const populatedLead = await Lead.findById(
      existingLead._id
    )
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    console.log(
      "UPDATE: updated lead fetched"
    );

    // =====================================================
    // 13. SUCCESS RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: populatedLead,
    });

  } catch (error) {
    // =====================================================
    // ERROR HANDLER
    // =====================================================

    console.error(
      "UPDATE LEAD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update lead",
    });
  }
};
/* =========================================================
   DELETE LEAD
========================================================= */
export const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Keep old data for audit
    const oldValue = lead.toObject();

    await Lead.findByIdAndDelete(req.params.id);

   await AuditLog.create({
  user: req.user._id,
  action: "DELETE",
  entity: "Lead",
  entityId: lead._id,
  description: `Deleted lead ${lead.name}`,
  target: lead.name,
  meta: {
    oldValue,
  },
});

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("DELETE LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete lead",
    });
  }
};

/* =========================================================
   CONVERT LEAD → OPPORTUNITY
========================================================= */
export const convertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Prevent duplicate conversion
    if (lead.isConverted) {
      return res.status(400).json({
        success: false,
        message: "Lead already converted",
        opportunityId: lead.convertedOpportunity,
      });
    }

    /*
      Opportunity value:
      Frontend can send value.
      Otherwise use Lead value.
    */
    const opportunityValue = Number(
      req.body?.value ?? lead.value ?? 0
    );

    const opportunity = await Opportunity.create({
      title:
        req.body?.title?.trim() ||
        `${lead.name} Opportunity`,

      value: opportunityValue,

      lead: lead._id,

      customerName: lead.name,

      email: lead.email || "",

      phone: lead.phone || "",

      company: lead.company || "",

      source: lead.source,

      stage: "Prospecting",

      owner: req.user._id,
    });


    const oldValue = {
  status: lead.status,
  isConverted: lead.isConverted,
  convertedAt: lead.convertedAt,
  convertedOpportunity: lead.convertedOpportunity,
};

    // Update lead conversion details
    lead.status = "Won";

lead.statusHistory.push({
  status: "Won",
  changedBy: req.user._id,
  changedAt: new Date(),
});

lead.isConverted = true;
lead.convertedAt = new Date();
lead.convertedOpportunity = opportunity._id;

await lead.save();

// Audit conversion
await AuditLog.create({
  user: req.user._id,
  action: "CONVERT",
  entity: "Lead",
  entityId: lead._id,
  description: `Converted lead ${lead.name} into opportunity`,
  target: lead.name,
  meta: {
    oldValue,
    newValue: {
      status: lead.status,
      isConverted: lead.isConverted,
      convertedAt: lead.convertedAt,
      convertedOpportunity: opportunity._id,
    },
    opportunityId: opportunity._id,
  },
});

    const updatedLead = await Lead.findById(lead._id)
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    return res.status(201).json({
      success: true,
      message: "Lead converted successfully",
      lead: updatedLead,
      opportunity,
    });
  } catch (error) {
    console.error("CONVERT LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to convert lead",
    });
  }
};

/* =========================================================
   GET LEAD TIMELINE
========================================================= */
export const getLeadTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const lead = await Lead.findById(id)
      .populate(
        "owner",
        "name email"
      )
      .populate(
        "statusHistory.changedBy",
        "name email"
      )
      .populate(
        "convertedOpportunity"
      );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const activities = await Activity.find({
      lead: id,
    })
      .populate(
        "assignedTo",
        "name email"
      )
      .populate(
        "createdBy",
        "name email"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,

      lead: {
        _id: lead._id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        priority: lead.priority,
        owner: lead.owner,
      },

      statusHistory: lead.statusHistory,

      activities,

      timeline: [
        ...lead.statusHistory.map((item) => ({
          type: "STATUS_CHANGE",
          title: `Status changed to ${item.status}`,
          date: item.changedAt,
          user: item.changedBy,
        })),

        ...activities.map((activity) => ({
          type: "ACTIVITY",
          title: `${activity.type} activity`,
          date: activity.createdAt,
          activity,
        })),
      ].sort(
        (a, b) =>
          new Date(b.date) -
          new Date(a.date)
      ),
    });
  } catch (error) {
    console.error(
      "GET LEAD TIMELINE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch lead timeline",
    });
  }
};