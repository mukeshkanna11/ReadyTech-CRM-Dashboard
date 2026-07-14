// controllers/inventoryReport.controller.js
// Phase 4 — scalability & reporting (read-only, additive).
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Inventory from "../models/Inventory.model.js";

/* ================================================
   Helpers
================================================ */
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePage = (q) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

/* Base aggregation: on-hand from ledger, reserved from stocklevels,
   available = on-hand − reserved, plus computed low-stock status.
   Reservation data is READ ONLY here — never mutated. */
const buildSummaryPipeline = ({ search, warehouse, status } = {}) => {
  const pipeline = [
    { $group: { _id: { product: "$product", warehouse: "$warehouse" }, inQty: { $sum: "$inQty" }, outQty: { $sum: "$outQty" } } },
    { $lookup: { from: "products", localField: "_id.product", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $lookup: { from: "warehouses", localField: "_id.warehouse", foreignField: "_id", as: "warehouse" } },
    { $unwind: "$warehouse" },
    {
      $lookup: {
        from: "stocklevels",
        let: { p: "$_id.product", w: "$_id.warehouse" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$product", "$$p"] }, { $eq: ["$warehouse", "$$w"] }] } } },
          { $project: { _id: 0, reserved: 1 } },
        ],
        as: "level",
      },
    },
    {
      $addFields: {
        onHand: { $subtract: ["$inQty", "$outQty"] },
        reserved: { $ifNull: [{ $arrayElemAt: ["$level.reserved", 0] }, 0] },
        limit: { $ifNull: ["$product.lowStockLimit", 10] },
      },
    },
    { $addFields: { available: { $subtract: ["$onHand", "$reserved"] } } },
    {
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $lte: ["$available", 0] }, then: "out" },
              { case: { $lte: ["$available", "$limit"] }, then: "low" },
            ],
            default: "ok",
          },
        },
      },
    },
  ];

  const match = {};
  if (warehouse && mongoose.isValidObjectId(warehouse)) {
    match["warehouse._id"] = new mongoose.Types.ObjectId(warehouse);
  }
  if (status && status !== "All") match.status = status;
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    match.$or = [{ "product.name": rx }, { "product.sku": rx }, { "warehouse.name": rx }];
  }
  if (Object.keys(match).length) pipeline.push({ $match: match });

  return pipeline;
};

const PROJECT_SUMMARY = {
  $project: {
    _id: 0,
    product: {
      _id: "$product._id",
      name: "$product.name",
      sku: "$product.sku",
      price: "$product.price",
      costPrice: "$product.costPrice",
      lowStockLimit: "$limit",
    },
    warehouse: { _id: "$warehouse._id", name: "$warehouse.name" },
    inQty: 1,
    outQty: 1,
    onHand: 1,
    reserved: 1,
    available: 1,
    limit: 1,
    status: 1,
  },
};

/* ================================================
   1. PAGINATED + FILTERED INVENTORY
   GET /inventory/paginated?page&limit&search&warehouse&status&sortBy&order
================================================ */
export const getInventoryPage = async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const sortBy = ["available", "onHand", "reserved"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "product.name";
    const order = req.query.order === "desc" ? -1 : 1;

    const pipeline = buildSummaryPipeline(req.query);
    pipeline.push({
      $facet: {
        data: [{ $sort: { [sortBy]: order } }, { $skip: skip }, { $limit: limit }, PROJECT_SUMMARY],
        meta: [{ $count: "total" }],
      },
    });

    const [result] = await Inventory.aggregate(pipeline);
    const total = result?.meta?.[0]?.total || 0;

    return res.json({
      success: true,
      data: result?.data || [],
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("❌ INVENTORY PAGE ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================================
   2. LOW STOCK ALERTS
   GET /inventory/low-stock?warehouse
================================================ */
export const getLowStockAlerts = async (req, res) => {
  try {
    const pipeline = buildSummaryPipeline({ warehouse: req.query.warehouse });
    pipeline.push({ $match: { status: { $in: ["low", "out"] } } });
    pipeline.push({ $sort: { available: 1 } });
    pipeline.push(PROJECT_SUMMARY);

    const rows = await Inventory.aggregate(pipeline);

    return res.json({
      success: true,
      count: rows.length,
      lowStock: rows.filter((r) => r.status === "low").length,
      outOfStock: rows.filter((r) => r.status === "out").length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ LOW STOCK ALERT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================================
   3. STOCK MOVEMENT HISTORY (ledger)
   GET /inventory/movements?page&limit&product&warehouse&type&from&to
================================================ */
export const getStockMovements = async (req, res) => {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const q = {};
    if (req.query.product && mongoose.isValidObjectId(req.query.product)) q.product = req.query.product;
    if (req.query.warehouse && mongoose.isValidObjectId(req.query.warehouse)) q.warehouse = req.query.warehouse;
    if (req.query.type) q.type = req.query.type;
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) q.createdAt.$lte = new Date(req.query.to);
    }

    const [items, total] = await Promise.all([
      Inventory.find(q)
        .populate("product", "name sku")
        .populate("warehouse", "name")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(q),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("❌ STOCK MOVEMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================================
   4. INVENTORY VALUATION
   GET /inventory/valuation?search&warehouse&status
   stockValue = onHand × costPrice, retailValue = onHand × price
================================================ */
export const getInventoryValuation = async (req, res) => {
  try {
    const pipeline = buildSummaryPipeline(req.query);
    pipeline.push({
      $addFields: {
        stockValue: { $multiply: ["$onHand", { $ifNull: ["$product.costPrice", 0] }] },
        retailValue: { $multiply: ["$onHand", { $ifNull: ["$product.price", 0] }] },
      },
    });
    pipeline.push({
      $project: {
        _id: 0,
        product: { _id: "$product._id", name: "$product.name", sku: "$product.sku", price: "$product.price", costPrice: "$product.costPrice" },
        warehouse: { _id: "$warehouse._id", name: "$warehouse.name" },
        onHand: 1,
        reserved: 1,
        available: 1,
        stockValue: 1,
        retailValue: 1,
      },
    });
    pipeline.push({ $sort: { stockValue: -1 } });

    const rows = await Inventory.aggregate(pipeline);
    const totals = rows.reduce(
      (a, r) => ({
        units: a.units + (r.onHand || 0),
        stockValue: a.stockValue + (r.stockValue || 0),
        retailValue: a.retailValue + (r.retailValue || 0),
      }),
      { units: 0, stockValue: 0, retailValue: 0 }
    );
    totals.potentialProfit = totals.retailValue - totals.stockValue;

    return res.json({ success: true, count: rows.length, totals, data: rows });
  } catch (err) {
    console.error("❌ INVENTORY VALUATION ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ================================================
   5. CSV / PDF EXPORT
   GET /inventory/export?type=inventory|valuation|movements&format=csv|pdf
================================================ */
const EXPORT_CAP = 5000;

const COLUMNS = {
  inventory: [
    { label: "Product", get: (r) => r.product?.name },
    { label: "SKU", get: (r) => r.product?.sku },
    { label: "Warehouse", get: (r) => r.warehouse?.name },
    { label: "On Hand", get: (r) => r.onHand },
    { label: "Reserved", get: (r) => r.reserved },
    { label: "Available", get: (r) => r.available },
    { label: "Status", get: (r) => r.status },
  ],
  valuation: [
    { label: "Product", get: (r) => r.product?.name },
    { label: "SKU", get: (r) => r.product?.sku },
    { label: "Warehouse", get: (r) => r.warehouse?.name },
    { label: "On Hand", get: (r) => r.onHand },
    { label: "Cost Price", get: (r) => r.product?.costPrice ?? 0 },
    { label: "Stock Value", get: (r) => r.stockValue },
    { label: "Price", get: (r) => r.product?.price ?? 0 },
    { label: "Retail Value", get: (r) => r.retailValue },
  ],
  movements: [
    { label: "Date", get: (r) => new Date(r.createdAt).toISOString() },
    { label: "Product", get: (r) => r.product?.name },
    { label: "SKU", get: (r) => r.product?.sku },
    { label: "Warehouse", get: (r) => r.warehouse?.name },
    { label: "Type", get: (r) => r.type },
    { label: "In", get: (r) => r.inQty || 0 },
    { label: "Out", get: (r) => r.outQty || 0 },
    { label: "Reason", get: (r) => r.reason || "" },
    { label: "User", get: (r) => r.createdBy?.name || "" },
  ],
};

const fetchReportRows = async (type, query) => {
  if (type === "movements") {
    const q = {};
    if (query.warehouse && mongoose.isValidObjectId(query.warehouse)) q.warehouse = query.warehouse;
    if (query.product && mongoose.isValidObjectId(query.product)) q.product = query.product;
    if (query.type) q.type = query.type;
    return Inventory.find(q)
      .populate("product", "name sku")
      .populate("warehouse", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(EXPORT_CAP)
      .lean();
  }

  const pipeline = buildSummaryPipeline(query);
  if (type === "valuation") {
    pipeline.push({
      $addFields: {
        stockValue: { $multiply: ["$onHand", { $ifNull: ["$product.costPrice", 0] }] },
        retailValue: { $multiply: ["$onHand", { $ifNull: ["$product.price", 0] }] },
      },
    });
  }
  pipeline.push(PROJECT_SUMMARY, { $limit: EXPORT_CAP });
  return Inventory.aggregate(pipeline);
};

const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const streamPdf = (res, title, columns, rows, filename) => {
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).font("Helvetica-Bold").text(title);
  doc.moveDown(0.2);
  doc.fontSize(9).font("Helvetica").fillColor("#666")
    .text(`Generated: ${new Date().toLocaleString()}   •   Records: ${rows.length}`);
  doc.moveDown(0.6).fillColor("#000");

  const left = doc.page.margins.left;
  const usable = doc.page.width - left - doc.page.margins.right;
  const colW = usable / columns.length;
  const bottom = doc.page.height - doc.page.margins.bottom - 20;

  const drawHeader = (y) => {
    doc.font("Helvetica-Bold").fontSize(9);
    columns.forEach((c, i) => doc.text(String(c.label), left + i * colW, y, { width: colW - 4, ellipsis: true }));
    doc.moveTo(left, y + 13).lineTo(doc.page.width - doc.page.margins.right, y + 13).stroke("#cccccc");
    return y + 18;
  };

  let y = drawHeader(doc.y);
  doc.font("Helvetica").fontSize(8);
  rows.forEach((r) => {
    if (y > bottom) {
      doc.addPage();
      y = drawHeader(doc.page.margins.top);
      doc.font("Helvetica").fontSize(8);
    }
    columns.forEach((c, i) => {
      const v = c.get(r);
      doc.text(v === null || v === undefined ? "" : String(v), left + i * colW, y, { width: colW - 4, ellipsis: true });
    });
    y += 14;
  });

  doc.end();
};

export const exportInventory = async (req, res) => {
  try {
    const type = ["inventory", "valuation", "movements"].includes(req.query.type) ? req.query.type : "inventory";
    const format = req.query.format === "pdf" ? "pdf" : "csv";
    const columns = COLUMNS[type];
    const rows = await fetchReportRows(type, req.query);
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}`;
    const title = `${type.charAt(0).toUpperCase() + type.slice(1)} Report`;

    if (format === "pdf") {
      return streamPdf(res, title, columns, rows, filename);
    }

    const header = columns.map((c) => csvEscape(c.label)).join(",");
    const body = rows.map((r) => columns.map((c) => csvEscape(c.get(r))).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(`${header}\n${body}`);
  } catch (err) {
    console.error("❌ INVENTORY EXPORT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
