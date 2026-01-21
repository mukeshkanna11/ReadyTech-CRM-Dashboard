import Warehouse from "../models/Warehouse.model.js";

export const createWarehouse = async (req, res) => {
  try {
    const warehouse = await Warehouse.create(req.body);
    res.json({ success: true, warehouse });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getWarehouses = async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
