// controllers/rtsHelp.controller.js
// RTS AI help assistant for the floating support widget.
// Assistance ONLY: this handler reads no business data and writes
// nothing — no leads, enquiries, chats or any other record.
import { chatClaude } from "../services/claudeService.js";

const MAX_HISTORY = 12;
const MAX_MESSAGE_LENGTH = 2000;

export const RTS_PRODUCT_GUIDE = `
Ready Tech CRM (web app) — sidebar modules and their pages:
- Dashboard (/dashboard): overview of products, sales, purchases, inventory, leads, clients, opportunities and activities.
- Users (/users): admins create and manage users of their workspace (roles: admin, employee, client).
- Clients (/clients), CRM Products (/products), Leads (/leads), Automations (/automations), Salesforce (/salesforce), Invoices (/invoices: list, create, analytics), Audit Logs (/auditlogs).
- Stocks: Products (/stocks/products), Warehouses (/stocks/warehouses), Vendors (/stocks/vendors), Purchase Orders (/stocks/purchase-orders), Sales Orders (/stocks/sales-orders), Inventory (/stocks/inventory), Stock Adjustment (/stocks/stock-adjustment), Warehouse Transfer (/stocks/warehouse-transfer).
- Human Resources (/hr).
- AI tools: AI Lead Analysis (in Leads), AI Client Insights (in Clients), AI Content Generator, AI SEO Tool, AI Email Generator, AI Customer Communication, AI Sales Recommendations (under /ai/...).
- Integrations: Meta Integration (/integrations/meta), WhatsApp Inbox (/integrations/whatsapp), Instagram Inbox (/integrations/instagram).
- Each login works in its own isolated workspace; data is never shared between workspaces.

Ready Tech ERP (web app) — sidebar modules:
- Dashboard, Companies, Branches, Users, HR, Customers, Vendors, Products, Inventory, Purchase, Sales, Quotations, Sales Orders, Invoices, Payments, Expenses, Finance (accounting), Projects, Tasks, Workflow, Reports.
- AI: AI Dashboard, AI Assistant (answers questions about your company's ERP data), AI Document & Data Summaries, AI Business Insights, AI Forecasting, AI Workflow Assistance.
- Helpdesk (/support) to contact the Ready Tech team.
`.trim();

export const buildSystemPrompt = (product = "CRM") =>
  [
    `You are RTS AI, the in-app help assistant of Ready Tech ${product === "ERP" ? "ERP" : "CRM"} by Ready Tech Solutions.`,
    "Help users understand and use Ready Tech CRM and ERP features, modules and navigation.",
    "Answer ONLY from the product guide below. If the guide does not cover something, say you are not sure and suggest the user contacts the Ready Tech team through the support form. Never invent features, prices, settings or steps.",
    "If a question is unrelated to Ready Tech CRM/ERP, politely say you can only help with Ready Tech CRM and ERP and suggest a related topic.",
    "You cannot perform actions: you never create, update, convert or submit leads, enquiries or any records. If asked, explain where in the app the user can do it themselves.",
    "Keep replies short (under 120 words), plain text, suitable to be read aloud.",
    "",
    "PRODUCT GUIDE:",
    RTS_PRODUCT_GUIDE,
  ].join("\n");

export const toChatMessages = (history) => {
  const messages = (Array.isArray(history) ? history : [])
    .filter(
      (m) =>
        ["user", "assistant"].includes(m?.role) &&
        typeof m.text === "string" &&
        m.text.trim()
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.text.trim().slice(0, MAX_MESSAGE_LENGTH) }));

  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
};

export const makeRtsHelp = (ask) => async (req, res) => {
  const messages = toChatMessages(req.body?.messages);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ success: false, message: "A user message is required" });
  }

  try {
    const text = await ask({
      system: buildSystemPrompt(req.body?.product),
      messages,
      maxTokens: 500,
    });

    return res.status(200).json({ success: true, data: { role: "assistant", text } });
  } catch (error) {
    console.error("❌ RTS help error:", error.message);
    return res.status(error.statusCode || 502).json({
      success: false,
      message: "RTS AI is unavailable right now. Please try again or use the contact form.",
    });
  }
};

export const rtsHelp = makeRtsHelp(chatClaude);
