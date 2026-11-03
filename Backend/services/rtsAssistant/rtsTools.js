// services/rtsAssistant/rtsTools.js
// RTS AI Assistant tools. READ-ONLY by design: every tool runs fixed,
// parameterised Mongoose reads (no AI-generated queries), inside the
// caller's workspace scope, and honours role permissions. Nothing here
// creates, updates or deletes a record.
import Lead from "../../models/Lead.js";
import Client from "../../models/Client.js";
import Invoice from "../../models/Invoice.js";
import Opportunity from "../../models/Opportunity.js";
import Activity from "../../models/Activity.js";
import SalesOrder from "../../models/SalesOrder.model.js";
import PurchaseOrder from "../../models/PurchaseOrder.model.js";
import Employee from "../../models/hr/Employee.js";
import Attendance from "../../models/hr/Attendance.js";
import Leave from "../../models/hr/Leave.js";
import EmployeeExpense from "../../models/hr/EmployeeExpense.js";
import Vendor from "../../models/Vendor.model.js";
import Warehouse from "../../models/Warehouse.model.js";
import Product from "../../models/Product.model.js";
import { getStockSummary } from "../../controllers/inventory.controller.js";

/* ---------- Implemented app routes (Frontend/src/App.jsx) ---------- */
export const NAV_ROUTES = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/clients": "Clients",
  "/products": "CRM Products",
  "/users": "Users",
  "/auditlogs": "Audit Logs",
  "/automations": "Automations",
  "/automations/create": "Create Automation",
  "/automations/templates": "Automation Templates",
  "/invoices": "Invoices",
  "/invoices/create": "Create Invoice",
  "/invoices/analytics": "Invoice Analytics",
  "/salesforce": "Salesforce",
  "/salesforce/dashboard": "Salesforce Dashboard",
  "/salesforce/leads": "Salesforce Leads",
  "/salesforce/opportunities": "Opportunities",
  "/salesforce/activities": "Activities",
  "/stocks/products": "Stock Products",
  "/stocks/warehouses": "Warehouses",
  "/stocks/vendors": "Vendors",
  "/stocks/purchase-orders": "Purchase Orders",
  "/stocks/sales-orders": "Sales Orders",
  "/stocks/inventory": "Inventory",
  "/stocks/stock-adjustment": "Stock Adjustment",
  "/stocks/warehouse-transfer": "Warehouse Transfer",
  "/hr": "Human Resources",
  "/ai/content-generator": "AI Content Generator",
  "/ai/seo-tool": "AI SEO Tool",
  "/ai/email-generator": "AI Email Generator",
  "/ai/customer-communication": "AI Customer Communication",
  "/ai/sales-recommendations": "AI Sales Recommendations",
  "/integrations/meta": "Meta Integration",
  "/integrations/whatsapp": "WhatsApp Inbox",
  "/integrations/instagram": "Instagram Inbox",
  "/integrations/email": "Email Integration",
  "/integrations/shopify": "Shopify Integration",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/profile": "Profile",
  "/contact": "Contact",
};

/* Page knowledge for "explain this page" (from the actual page components) */
export const PAGE_GUIDE = {
  "/dashboard": "Overview cards and charts for products, sales, purchases, inventory, leads, clients, opportunities and activities of your workspace.",
  "/leads": "All CRM leads with search and status filters. \"Add New Lead\" opens the lead form; open a lead to see details, update its status (New, Contacted, Qualified, Proposal, Negotiation, Won, Lost, Closed) or \"Convert to Opportunity\".",
  "/clients": "Admin-only client (customer) list with search. \"Add New Client\" stores company, contact person, email, phone, GST/PAN and billing address; clients are used as invoice and sales-order customers.",
  "/products": "CRM product catalogue with price, category, SKU and stock quantity. \"Add New Product\" creates one.",
  "/users": "Admins manage workspace users. \"Add New User\" creates admin, employee or client logins; \"Export\" downloads the list.",
  "/auditlogs": "Admin-only history of actions in the workspace. Use \"Apply Filters\" to narrow it and \"Export CSV\" / \"Export Report\" to download.",
  "/automations": "Your automation rules. \"Create Automation\" or a template builds a trigger → \"Add Condition\" → \"Add Action\" workflow.",
  "/automations/create": "Automation builder: choose a trigger, then \"Add Condition\" and \"Add Action\", then save.",
  "/automations/templates": "Ready-made automation templates, or \"Create From Scratch\".",
  "/invoices": "All invoices with search and payment status filter (Paid, Pending, Overdue). Open an invoice to view it, download the PDF, email it or \"Add Payment\".",
  "/invoices/create": "Tax invoice form: pick the customer and products, \"+ Add Item\" for more lines, set tax/discount, then \"Create Tax Invoice\".",
  "/invoices/analytics": "Invoice and revenue analytics: totals, paid vs pending and trends — the sales report view.",
  "/salesforce": "Sales workspace with Dashboard, Leads, Opportunities and Activities tabs.",
  "/salesforce/dashboard": "Sales pipeline summary for leads, opportunities and activities.",
  "/salesforce/leads": "Salesforce leads tab: \"New Lead\", \"Convert Lead\", filters and \"Export\".",
  "/salesforce/opportunities": "Opportunities by stage (Prospecting → Closed Won/Lost) with value and probability. \"New Opportunity\", \"Export\".",
  "/salesforce/activities": "Calls, emails, meetings and tasks linked to leads/opportunities, with due dates and priority.",
  "/stocks/products": "ERP stock products. \"Add Product\", \"Import\" and \"Export\".",
  "/stocks/warehouses": "Warehouses list. \"Create Warehouse\" adds one.",
  "/stocks/vendors": "Suppliers. \"Add Vendor\" adds one; vendors are used on purchase orders.",
  "/stocks/purchase-orders": "Purchase orders to vendors. \"New Purchase Order\" → pick vendor → \"Add Item\" → \"Create Purchase Order\". Status DRAFT → RECEIVED (receiving adds stock).",
  "/stocks/sales-orders": "Sales orders to customers from a warehouse. \"Create Sales Order\" with items; status DRAFT → APPROVED → DELIVERED or CANCELLED.",
  "/stocks/inventory": "Stock per product and warehouse (on hand, reserved, available) with \"Export CSV\" / \"Export PDF\".",
  "/stocks/stock-adjustment": "Increase or decrease stock of a product in a warehouse with a reason.",
  "/stocks/warehouse-transfer": "Move stock of a product from one warehouse to another.",
  "/hr": "Human Resources: employees, attendance, leave, shifts, holidays, payroll, payslips, expenses, performance and HR reports.",
  "/ai/content-generator": "Generate marketing content with AI.",
  "/ai/seo-tool": "AI SEO suggestions for your content.",
  "/ai/email-generator": "Draft emails with AI.",
  "/ai/customer-communication": "AI-assisted customer messages.",
  "/ai/sales-recommendations": "AI sales recommendations (needs AI Suggestions enabled).",
  "/integrations/meta": "Connect Facebook/Meta lead forms and pages.",
  "/integrations/whatsapp": "WhatsApp Cloud API inbox.",
  "/integrations/instagram": "Instagram direct-message inbox.",
  "/integrations/email": "Connect mailboxes (\"Add an email account\").",
  "/integrations/shopify": "Connect a Shopify store and sync orders, customers and inventory.",
  "/settings": "Workspace settings, including AI Settings (enable/disable Claude AI). \"Save Changes\" saves.",
  "/notifications": "Your notifications. \"Mark all read\".",
  "/profile": "Your profile and account security.",
  "/contact": "Contact Ready Tech.",
};

export const METRICS = [
  "leads", "opportunities", "clients", "activities",
  "sales_orders", "purchase_orders", "invoices", "payments", "revenue",
  "inventory", "employees", "attendance", "leaves", "expenses",
];
export const PERIODS = ["today", "yesterday", "this_week", "this_month", "last_month", "this_year", "all_time"];

/* Mirrors the API route guards: /api/clients is admin-only; client-role
   users get no workspace business data through the assistant. */
const ADMIN_ONLY = new Set(["clients"]);
export const canAccessMetric = (role, metric) => {
  if (role === "admin") return true;
  if (role === "employee") return !ADMIN_ONLY.has(metric);
  return false;
};

/* ---------- Date ranges in the user's local time ----------
   tzOffset = browser Date#getTimezoneOffset() (IST = -330) */
const DAY = 86400000;
export const periodRange = (period = "today", tzOffset = 0, now = new Date()) => {
  const off = Number.isFinite(+tzOffset) && Math.abs(+tzOffset) <= 840 ? +tzOffset : 0;
  const local = new Date(now.getTime() - off * 60000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const at = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd) + off * 60000);
  const today = at(y, m, local.getUTCDate());

  switch (period) {
    case "yesterday": return { from: new Date(today - DAY), to: today };
    case "this_week": return { from: new Date(today - ((local.getUTCDay() + 6) % 7) * DAY), to: now };
    case "this_month": return { from: at(y, m, 1), to: now };
    case "last_month": return { from: at(y, m - 1, 1), to: at(y, m, 1) };
    case "this_year": return { from: at(y, 0, 1), to: now };
    case "all_time": return null;
    default: return { from: today, to: now };
  }
};

const within = (field, range) => (range ? { [field]: { $gte: range.from, $lt: range.to } } : {});
const sumBy = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
const toMap = (rows, key = "count") => Object.fromEntries(rows.map((r) => [r._id ?? "Unknown", r[key]]));
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------- Metric readers (all workspace-scoped by the mongoose plugin) ---------- */
const readers = {
  async leads(range) {
    const match = within("createdAt", range);
    const [total, byStatus, recent] = await Promise.all([
      Lead.countDocuments(match),
      Lead.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Lead.find(match).sort({ createdAt: -1 }).limit(5).select("name company status source createdAt -_id").lean(),
    ]);
    return { summary: { total }, breakdown: { byStatus: toMap(byStatus) }, records: recent };
  },

  async opportunities(range) {
    const match = within("createdAt", range);
    const rows = await Opportunity.aggregate([
      { $match: match },
      { $group: { _id: "$stage", count: { $sum: 1 }, value: { $sum: "$value" } } },
    ]);
    const open = rows.filter((r) => !String(r._id).startsWith("Closed"));
    return {
      summary: { total: sumBy(rows, "count"), totalValue: round(sumBy(rows, "value")), openPipelineValue: round(sumBy(open, "value")) },
      breakdown: { byStage: toMap(rows) },
    };
  },

  async clients(range) {
    const [inPeriod, total] = await Promise.all([Client.countDocuments(within("createdAt", range)), Client.countDocuments({})]);
    return { summary: { newInPeriod: inPeriod, totalClients: total } };
  },

  async activities(range, { tzOffset }) {
    const today = periodRange("today", tzOffset);
    const [dueToday, overdue, completed] = await Promise.all([
      Activity.countDocuments({ done: { $ne: true }, dueDate: { $gte: today.from, $lt: new Date(today.from.getTime() + DAY) } }),
      Activity.countDocuments({ done: { $ne: true }, dueDate: { $lt: today.from } }),
      Activity.countDocuments({ done: true, ...within("completedAt", range) }),
    ]);
    return { summary: { pendingDueToday: dueToday, overduePending: overdue, completedInPeriod: completed } };
  },

  async sales_orders(range) {
    const match = within("createdAt", range);
    const [rows, recent] = await Promise.all([
      SalesOrder.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } }]),
      SalesOrder.find(match).sort({ createdAt: -1 }).limit(5).select("soNumber totalAmount status createdAt -_id").lean(),
    ]);
    const active = rows.filter((r) => r._id !== "CANCELLED");
    return {
      summary: { orders: sumBy(rows, "count"), amountExcludingCancelled: round(sumBy(active, "amount")) },
      breakdown: { byStatus: toMap(rows) },
      records: recent,
    };
  },

  async purchase_orders(range) {
    const rows = await PurchaseOrder.aggregate([
      { $match: within("createdAt", range) },
      { $addFields: { total: { $sum: { $map: { input: { $ifNull: ["$items", []] }, as: "i", in: { $multiply: ["$$i.qty", "$$i.cost"] } } } } } },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$total" } } },
    ]);
    return { summary: { orders: sumBy(rows, "count"), amount: round(sumBy(rows, "amount")) }, breakdown: { byStatus: toMap(rows) } };
  },

  async invoices(range) {
    const match = within("issueDate", range);
    const [rows, recent] = await Promise.all([
      Invoice.aggregate([
        { $match: match },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 }, total: { $sum: "$grandTotal" }, paid: { $sum: "$amountPaid" }, due: { $sum: "$balanceDue" } } },
      ]),
      Invoice.find(match).sort({ issueDate: -1 }).limit(5).select("invoiceNumber grandTotal paymentStatus issueDate dueDate -_id").lean(),
    ]);
    const active = rows.filter((r) => r._id !== "Cancelled");
    return {
      summary: {
        invoices: sumBy(rows, "count"),
        invoicedAmount: round(sumBy(active, "total")),
        amountPaid: round(sumBy(active, "paid")),
        balanceDue: round(sumBy(active, "due")),
      },
      breakdown: { byPaymentStatus: toMap(rows) },
      records: recent,
    };
  },

  async payments(range) {
    const [paid, outstanding] = await Promise.all([
      Invoice.aggregate([
        { $match: { amountPaid: { $gt: 0 }, paymentStatus: { $ne: "Cancelled" }, ...within("paymentDate", range) } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amountPaid" } } },
      ]),
      Invoice.aggregate([
        { $match: { paymentStatus: { $in: ["Pending", "Partially Paid", "Overdue"] } } },
        { $group: { _id: "$paymentStatus", count: { $sum: 1 }, due: { $sum: "$balanceDue" } } },
      ]),
    ]);
    return {
      summary: {
        invoicesWithPayment: paid[0]?.count || 0,
        amountCollected: round(paid[0]?.amount),
        outstandingBalance: round(sumBy(outstanding, "due")),
        overdueInvoices: outstanding.find((r) => r._id === "Overdue")?.count || 0,
      },
      breakdown: { outstandingByStatus: toMap(outstanding) },
      note: "Collected amount is the paid total of invoices whose payment date falls in the period (invoices store their latest payment date).",
    };
  },

  async revenue(range, ctx) {
    const [inv, so] = await Promise.all([readers.invoices(range, ctx), readers.sales_orders(range, ctx)]);
    return {
      summary: {
        invoicedAmount: inv.summary.invoicedAmount,
        amountPaid: inv.summary.amountPaid,
        balanceDue: inv.summary.balanceDue,
        invoices: inv.summary.invoices,
        salesOrderAmount: so.summary.amountExcludingCancelled,
        salesOrders: so.summary.orders,
      },
      note: "Invoice figures exclude cancelled invoices; sales order amount excludes cancelled orders.",
    };
  },

  async inventory() {
    // Reuse the Inventory module's own stock summary (single source of truth)
    let rows = [];
    let failed = false;
    await getStockSummary({ query: { includeUnstocked: "true" } }, {
      status() { failed = true; return this; },
      json(body) { rows = body?.data || []; return this; },
    });
    if (failed) throw new Error("Stock summary failed");

    const byProduct = new Map();
    const byWarehouse = {};
    for (const r of rows) {
      if (r.warehouse?.name) byWarehouse[r.warehouse.name] = (byWarehouse[r.warehouse.name] || 0) + (Number(r.available) || 0);
      const id = String(r.product?._id);
      const p = byProduct.get(id) || { name: r.product?.name, sku: r.product?.sku, available: 0, lowStockLimit: Number(r.product?.lowStockLimit) || 0 };
      p.available += Number(r.available) || 0;
      byProduct.set(id, p);
    }
    const products = [...byProduct.values()];
    const low = products.filter((p) => p.available > 0 && p.available <= p.lowStockLimit);
    const out = products.filter((p) => p.available <= 0);
    return {
      summary: { products: products.length, totalAvailableUnits: sumBy(products, "available"), lowStock: low.length, outOfStock: out.length },
      breakdown: { availableUnitsByWarehouse: byWarehouse },
      records: [...out, ...low].slice(0, 8),
    };
  },

  async expenses(range) {
    const rows = await EmployeeExpense.aggregate([
      { $match: within("expenseDate", range) },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]);
    const approved = rows.filter((r) => ["Approved", "Reimbursed"].includes(r._id));
    return {
      summary: { claims: sumBy(rows, "count"), totalClaimed: round(sumBy(rows, "amount")), approvedOrReimbursed: round(sumBy(approved, "amount")) },
      breakdown: { countByStatus: toMap(rows) },
      note: "Employee expense claims (HR). The app has no accounting ledger, so profit is not calculated.",
    };
  },

  async employees() {
    const rows = await Employee.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    return { summary: { total: sumBy(rows, "count") }, breakdown: { byStatus: toMap(rows) } };
  },

  async attendance(range) {
    const rows = await Attendance.aggregate([{ $match: within("date", range) }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
    return { summary: { records: sumBy(rows, "count") }, breakdown: { byStatus: toMap(rows) } };
  },

  async leaves(range) {
    const [rows, pending] = await Promise.all([
      Leave.aggregate([{ $match: within("createdAt", range) }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Leave.countDocuments({ status: "Pending" }),
    ]);
    return { summary: { requestsInPeriod: sumBy(rows, "count"), pendingApprovalTotal: pending }, breakdown: { byStatus: toMap(rows) } };
  },
};

const PERIODLESS = new Set(["inventory", "employees"]);

/* ---------- Record search (fixed fields, escaped text, ≤5 results) ---------- */
const esc = (q) => String(q || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anyOf = (fields, q) => (q ? { $or: fields.map((f) => ({ [f]: { $regex: q, $options: "i" } })) } : {});
const link = (path, params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return qs ? `${path}?${qs}` : path;
};

export const ENTITIES = {
  invoice: {
    statuses: ["Pending", "Partially Paid", "Paid", "Overdue", "Cancelled"],
    async find(q, status) {
      const rows = await Invoice.find({ ...anyOf(["invoiceNumber", "customerDetails.name", "customerDetails.company"], q), ...(status ? { paymentStatus: status } : {}) })
        .sort({ issueDate: -1 }).limit(5)
        .select("invoiceNumber customerDetails.name customerDetails.company grandTotal amountPaid balanceDue paymentStatus issueDate dueDate").lean();
      return rows.map((r) => ({
        invoiceNumber: r.invoiceNumber, customer: r.customerDetails?.name || r.customerDetails?.company || "",
        grandTotal: r.grandTotal, amountPaid: r.amountPaid, balanceDue: r.balanceDue, paymentStatus: r.paymentStatus,
        issueDate: r.issueDate, dueDate: r.dueDate, _open: `/invoices/${r._id}`,
      }));
    },
    list: (q, status) => link("/invoices", { q, status: ["Paid", "Pending", "Overdue"].includes(status) ? status : "" }),
  },
  client: {
    adminOnly: true,
    async find(q) {
      const rows = await Client.find(anyOf(["companyName", "contactPerson", "email", "phone"], q)).sort({ createdAt: -1 }).limit(5)
        .select("companyName contactPerson email phone billingAddress.city gstNumber createdAt").lean();
      return rows.map((r) => ({ company: r.companyName, contact: r.contactPerson, email: r.email, phone: r.phone, city: r.billingAddress?.city, gst: r.gstNumber, _open: link("/clients", { q: r.companyName }) }));
    },
    list: (q) => link("/clients", { q }),
  },
  lead: {
    statuses: ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Won", "Lost", "Closed"],
    async find(q, status) {
      const rows = await Lead.find({ ...anyOf(["name", "company", "email", "phone"], q), ...(status ? { status } : {}) })
        .sort({ createdAt: -1 }).limit(5).select("name company email phone status source createdAt").lean();
      return rows.map((r) => ({ name: r.name, company: r.company, email: r.email, phone: r.phone, status: r.status, source: r.source, createdAt: r.createdAt, _open: link("/leads", { q: r.name }) }));
    },
    list: (q) => link("/leads", { q }),
  },
  sales_order: {
    statuses: ["DRAFT", "APPROVED", "DELIVERED", "CANCELLED"],
    async find(q, status) {
      const rows = await SalesOrder.find({ ...anyOf(["soNumber"], q), ...(status ? { status } : {}) })
        .sort({ createdAt: -1 }).limit(5).populate("customer", "companyName").select("soNumber totalAmount status customer createdAt").lean();
      return rows.map((r) => ({ soNumber: r.soNumber, customer: r.customer?.companyName, totalAmount: r.totalAmount, status: r.status, createdAt: r.createdAt, _open: "/stocks/sales-orders" }));
    },
    list: () => "/stocks/sales-orders",
  },
  product: {
    async find(q) {
      const rows = await Product.find(anyOf(["name", "sku", "category"], q)).sort({ createdAt: -1 }).limit(5).select("name sku category price lowStockLimit").lean();
      return rows.map((r) => ({ name: r.name, sku: r.sku, category: r.category, price: r.price, lowStockLimit: r.lowStockLimit, _open: "/stocks/products" }));
    },
    list: () => "/stocks/products",
  },
  vendor: {
    async find(q) {
      const rows = await Vendor.find(anyOf(["name", "email", "phone"], q)).limit(5).select("name email phone").lean();
      return rows.map((r) => ({ name: r.name, email: r.email, phone: r.phone, _open: "/stocks/vendors" }));
    },
    list: () => "/stocks/vendors",
  },
  warehouse: {
    async find(q) {
      const rows = await Warehouse.find(anyOf(["name", "code"], q)).limit(5).select("name code").lean();
      return rows.map((r) => ({ name: r.name, code: r.code, _open: "/stocks/warehouses" }));
    },
    list: () => "/stocks/warehouses",
  },
  employee: {
    statuses: ["Active", "Inactive", "On Leave"],
    // Directory fields only — never salary, bank, documents or personal data
    async find(q, status) {
      const rows = await Employee.find({ ...anyOf(["firstName", "lastName", "employeeCode", "department", "designation"], q), ...(status ? { status } : {}) })
        .limit(5).select("employeeCode firstName lastName department designation status email dateOfJoining").lean();
      return rows.map((r) => ({ code: r.employeeCode, name: `${r.firstName || ""} ${r.lastName || ""}`.trim(), department: r.department, designation: r.designation, status: r.status, email: r.email, joined: r.dateOfJoining, _open: "/hr" }));
    },
    list: () => "/hr",
  },
};

/* Same rule as metrics: client-role users get no workspace records */
export const canAccessEntity = (role, entity) =>
  role === "admin" || (role === "employee" && !ENTITIES[entity]?.adminOnly);

/* ---------- Claude tool definitions ---------- */
export const toolDefinitions = [
  {
    name: "navigate",
    description: "Open a page of the Ready Tech app for the user. Use only when the user asks to go to / open / show a page.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", enum: Object.keys(NAV_ROUTES) } },
      required: ["path"],
    },
  },
  {
    name: "get_business_data",
    description:
      "Read live figures from the user's own workspace (read-only). Metrics: leads, opportunities, clients (admin only), activities, sales_orders, purchase_orders, invoices, payments (collected + pending/overdue), revenue (= sales: invoices + sales orders), inventory (stock, low/out of stock, per warehouse), employees, attendance, leaves, expenses (HR expense claims). Call once per metric needed.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: METRICS },
        period: { type: "string", enum: PERIODS, description: "Defaults to today. Ignored for inventory and employees." },
      },
      required: ["metric"],
    },
  },
  {
    name: "find_records",
    description:
      "Search the user's own workspace records (read-only, max 5) by name, number, company, email or phone, optionally by status. Use for: a specific customer/client, invoice ('Ram's invoice', 'INV-001'), lead, sales order, product, vendor, warehouse or employee; 'find overdue payments' = entity invoice + status Overdue. Set open=true when the user asks to show/open it: the app opens the best match (or the filtered list).",
    input_schema: {
      type: "object",
      properties: {
        entity: { type: "string", enum: Object.keys(ENTITIES) },
        query: { type: "string", description: "Name / number / text to search; omit to list latest" },
        status: { type: "string", description: "Optional status filter, e.g. Overdue, Pending, Paid, New, Won, DRAFT, Active" },
        open: { type: "boolean" },
      },
      required: ["entity"],
    },
  },
];

/* Runs one tool call. Returns { content (for Claude), card?, action? } */
export const runTool = async (name, input = {}, ctx = {}) => {
  if (name === "navigate") {
    const path = input?.path;
    if (!NAV_ROUTES[path]) return { content: { ok: false, error: "Unknown page" } };
    return { content: { ok: true, opened: NAV_ROUTES[path] }, action: { type: "navigate", path, label: NAV_ROUTES[path] } };
  }

  if (name === "get_business_data") {
    const metric = METRICS.includes(input?.metric) ? input.metric : null;
    if (!metric) return { content: { ok: false, error: "Unknown metric" } };
    if (!canAccessMetric(ctx.role, metric)) {
      return { content: { ok: false, error: "PERMISSION_DENIED: the user's role cannot view this data" } };
    }
    const period = PERIODLESS.has(metric) ? "current" : PERIODS.includes(input?.period) ? input.period : "today";
    const range = PERIODLESS.has(metric) ? null : periodRange(period, ctx.tzOffset);
    const data = await readers[metric](range, ctx);
    const result = { ok: true, metric, period, ...data };
    return { content: result, card: result };
  }

  if (name === "find_records") {
    const entity = ENTITIES[input?.entity] ? input.entity : null;
    if (!entity) return { content: { ok: false, error: "Unknown record type" } };
    if (!canAccessEntity(ctx.role, entity)) {
      return { content: { ok: false, error: "PERMISSION_DENIED: the user's role cannot view these records" } };
    }
    const def = ENTITIES[entity];
    const status = def.statuses?.find((st) => st.toLowerCase() === String(input?.status || "").toLowerCase()) || "";
    const q = esc(input?.query);
    const found = await def.find(q, status);
    const records = found.map(({ _open, ...r }) => r);
    const result = { ok: true, type: "records", entity, query: input?.query || "", status, count: records.length, records };
    let action;
    if (input?.open) {
      const path = found.length === 1 ? found[0]._open : def.list(String(input?.query || "").trim().slice(0, 60), status);
      action = { type: "navigate", path, label: found.length === 1 ? `Open ${entity.replace("_", " ")}` : `${entity.replace("_", " ")} list` };
    }
    return { content: { ...result, opened: action?.path || null }, card: result, action };
  }

  return { content: { ok: false, error: "Unknown tool" } };
};
