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
