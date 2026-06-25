import Lead from "../models/Lead.js";
import AuditLog from "../models/AuditLog.js";

export const createLead = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "name required" });

  const lead = new Lead({ ...req.body, owner: req.user._id });
  await lead.save();

  await AuditLog.create({
    userId: req.user._id,
    action: "create_lead",
    target: lead._id,
    newValue: lead
  });

  res.status(201).json(lead);
};

export const listLeads = async (req, res) => {
  const leads = await Lead.find().populate("owner", "name email").sort({ createdAt: -1 });
  res.json(leads);
};

export const getLead = async (req, res) => {
  const lead = await Lead.findById(req.params.id).populate("owner", "name email");
  if (!lead) return res.status(404).json({ message: "Not found" });
  res.json(lead);
};

export const updateLead = async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!lead) return res.status(404).json({ message: "Not found" });

  await AuditLog.create({
    userId: req.user._id,
    action: "update_lead",
    target: lead._id,
    newValue: lead
  });

  res.json(lead);
};

export const deleteLead = async (req, res) => {
  const lead = await Lead.findByIdAndDelete(req.params.id);
  if (!lead) return res.status(404).json({ message: "Not found" });

  await AuditLog.create({
    userId: req.user._id,
    action: "delete_lead",
    target: lead._id,
    oldValue: lead
  });

  res.json({ message: "Deleted" });
};

export const convertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: "Lead not found",
      });
    }

    const opportunity = await Opportunity.create({
      title: `${lead.name} Opportunity`,
      value: req.body.value || 0,
      lead: lead._id,
      customerName: lead.name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      stage: "Prospecting",
      owner: req.user._id,
    });

    lead.status = "Qualified";
    await lead.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "convert_lead",
      target: lead._id,
      newValue: opportunity,
    });

    res.status(201).json({
      success: true,
      message: "Lead converted successfully",
      opportunity,
    });
  } catch (error) {
    console.error("CONVERT ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};