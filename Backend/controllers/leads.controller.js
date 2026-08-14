import Lead from "../models/Lead.js";
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
      email,
      phone,
      company,
      source,
      status,
      priority,
      value,
      department,
      notes,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Lead name is required",
      });
    }

    const lead = new Lead({
      name: name.trim(),
      email: email?.trim() || "",
      phone: phone?.trim() || "",
      company: company?.trim() || "",
      source: source || "Website",
      status: status || "New",
      priority: priority || "Medium",
      value: Number(value || 0),
      department: department || "Sales",
      notes: notes?.trim() || "",

      // Logged-in user becomes owner
      owner: req.user._id,

      // Conversion fields
      isConverted: false,
      convertedAt: null,
      convertedOpportunity: null,
    });

    await lead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "create_lead",
      target: lead._id,
      newValue: lead,
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
      userId: defaultOwner._id,

      action: "create_public_lead",

      target: lead._id,

      newValue: lead,
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

    // Check existing lead
    const existingLead = await Lead.findById(leadId);

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Keep audit old value
    const oldValue = existingLead.toObject();

    /*
      Only update allowed Lead fields.
      This prevents accidental modification of owner/conversion
      fields from frontend payload.
    */
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
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        existingLead[field] = req.body[field];
      }
    });

    // Normalize values
    if (existingLead.name) {
      existingLead.name = existingLead.name.trim();
    }

    if (existingLead.email) {
      existingLead.email = existingLead.email.trim().toLowerCase();
    }

    if (existingLead.phone) {
      existingLead.phone = existingLead.phone.trim();
    }

    if (existingLead.company) {
      existingLead.company = existingLead.company.trim();
    }

    if (existingLead.notes) {
      existingLead.notes = existingLead.notes.trim();
    }

    existingLead.value = Number(existingLead.value || 0);

    await existingLead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "update_lead",
      target: existingLead._id,
      oldValue,
      newValue: existingLead,
    });

    const populatedLead = await Lead.findById(existingLead._id)
      .populate("owner", "name email")
      .populate("convertedOpportunity");

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: populatedLead,
    });
  } catch (error) {
    console.error("UPDATE LEAD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update lead",
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
      userId: req.user._id,
      action: "delete_lead",
      target: lead._id,
      oldValue,
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

    // Update lead conversion details
    lead.status = "Won";
    lead.isConverted = true;
    lead.convertedAt = new Date();
    lead.convertedOpportunity = opportunity._id;

    await lead.save();

    // Audit conversion
    await AuditLog.create({
      userId: req.user._id,
      action: "convert_lead",
      target: lead._id,
      oldValue: {
        status: lead.status,
        isConverted: false,
      },
      newValue: opportunity,
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