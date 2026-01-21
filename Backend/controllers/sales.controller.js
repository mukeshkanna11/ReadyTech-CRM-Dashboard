import SalesOrder from "../models/SalesOrder.model.js";

export const createSalesOrder = async (req, res) => {
  try {
    const so = await SalesOrder.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.json(so);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSalesOrders = async (req, res) => {
  try {
    const salesOrders = await SalesOrder.find()
      .populate("customer")        // populate customer details
      .populate("items.product");  // populate product details

    res.json(salesOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
