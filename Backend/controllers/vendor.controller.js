import Vendor from "../models/Vendor.model.js";

export const createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.json(vendor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getVendors = async (req, res) => {
  const vendors = await Vendor.find();
  res.json(vendors);
};
