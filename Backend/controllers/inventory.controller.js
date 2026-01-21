import Stock from "../models/StockTransaction.model.js";

export const stockIn = async (req, res) => {
  try {
    const { product, warehouse, quantity, reference } = req.body;

    const stock = await Stock.create({
      product,
      warehouse,
      quantity,
      type: "IN",
      reference,
      createdBy: req.user.id,
    });

    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const stockOut = async (req, res) => {
  try {
    const { product, warehouse, quantity, reference } = req.body;

    const stock = await Stock.create({
      product,
      warehouse,
      quantity,
      type: "OUT",
      reference,
      createdBy: req.user.id,
    });

    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getStockSummary = async (req, res) => {
  try {
    const summary = await Stock.aggregate([
      {
        $group: {
          _id: { product: "$product", warehouse: "$warehouse" },
          inQty: {
            $sum: { $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0] },
          },
          outQty: {
            $sum: { $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0] },
          },
        },
      },
    ]);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
