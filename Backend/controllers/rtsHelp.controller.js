// controllers/rtsHelp.controller.js
// RTS AI Assistant (floating widget). Answers how-to questions, opens
// pages and reads LIVE workspace figures through fixed read-only tools
// (services/rtsAssistant/rtsTools.js). It never creates, updates or
// deletes anything — no leads, enquiries, chats or any other record.
import { createClaudeMessage } from "../services/claudeService.js";
import { toolDefinitions, runTool, NAV_ROUTES, PAGE_GUIDE } from "../services/rtsAssistant/rtsTools.js";
import { runWithWorkspace } from "../utils/workspaceContext.js";

const MAX_HISTORY = 12;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_STEPS = 5;

/* Questions that MUST be answered from tools (live data, records, navigation),
   never from general text. English, Tamil and Tanglish keywords. */
const HOW_TO = /\b(how (do|can|to|should)|steps?|explain|what (is|does)|meaning|help me understand)\b|எப்படி|என்ன(து)?\s*இது|vilakku|eppadi|epdi|enna pannanum/i;
const NEEDS_TOOL =
  /\b(how many|how much|total|count|today'?s?|yesterday|this (week|month|year)|last month|show|find|list|open|go ?to|navigate|take me|search|latest|recent|pending|overdue|low stock|out of stock|sales?|revenue|invoices?|orders?|leads?|payments?|customers?|clients?|stock|inventory|warehouse|expenses?|employees?|attendance|leaves?|evlo|ethana|inniku|indru|netru|kaatu|kattu|thira|po)\b|எத்தனை|எவ்வளவு|இன்று|இன்னைக்கு|நேற்று|காட்டு|திற|போ|விற்பனை|வருமானம்|பில்|ஸ்டாக்|லீட்/i;

export const needsTool = (text = "") => NEEDS_TOOL.test(text) && !HOW_TO.test(text);

export const RTS_PRODUCT_GUIDE = `
Ready Tech CRM + ERP (this web app). Pages (path — name):
${Object.entries(NAV_ROUTES).map(([p, n]) => `- ${p} — ${n}${PAGE_GUIDE[p] ? `: ${PAGE_GUIDE[p]}` : ""}`).join("\n")}

How-to (button labels as they appear in the app):
- Add a lead: Leads (/leads) → "Add New Lead" → fill the form → save. Convert a lead: open it → "Convert to Opportunity".
- Salesforce (/salesforce): tabs Dashboard, Leads ("New Lead", "Convert Lead", "Export"), Opportunities ("New Opportunity", "Export"), Activities.
- Add a client (admins only): Clients (/clients) → "Add New Client".
- Add a CRM product: Products (/products) → "Add New Product".
- Add a user (admins): Users (/users) → "Add New User" (roles: admin, employee, client).
- Create an invoice: Invoices → Create (/invoices/create) → choose customer/product → "+ Add Item" for more lines → "Create Tax Invoice". Record a payment: open the invoice → "Add Payment". Invoice Analytics: /invoices/analytics.
- Stock products: Stocks → Products → "Add Product"; "Import" / "Export" for bulk.
- Warehouses: "Create Warehouse". Vendors: "Add Vendor".
- Purchase order: Stocks → Purchase Orders → "New Purchase Order" → pick vendor → "Add Item" → "Create Purchase Order". Status DRAFT → RECEIVED.
- Sales order: Stocks → Sales Orders → pick customer and warehouse → "Add Item" → "Create Sales Order". Status DRAFT → APPROVED → DELIVERED (or CANCELLED).
- Inventory (/stocks/inventory): stock per product and warehouse; "Export CSV" / "Export PDF". Stock Adjustment and Warehouse Transfer have their own pages.
- Automations: "Create Automation" (or pick a template / "Create From Scratch") → "Add Condition" → "Add Action".
- Audit Logs (admins): "Apply Filters", "Export CSV".
- Integrations: Meta, WhatsApp Inbox, Instagram Inbox, Email ("Add an email account"), Shopify.
- Settings (/settings): "Save Changes". Admins enable/disable Claude AI in Settings → AI Settings.
- Human Resources (/hr): employees, attendance, leave, shifts, holidays, payroll, payslips, expenses, performance, reports.
- Each login works in its own isolated workspace; data is never shared between workspaces.
- To contact the Ready Tech team, use the brain support icon at the bottom-right.
`.trim();

const LANGUAGE_RULE =
  "Reply in the language of the user's latest message: English → English; Tamil script → Tamil; Tanglish (Tamil written in English letters, e.g. 'inniku evlo leads vandhuchu') → Tanglish. Understand all three.";

export const buildSystemPrompt = ({ product = "CRM", page = "", role = "", today = "" } = {}) =>
  [
    `You are RTS AI, the voice and chat assistant of Ready Tech ${product === "ERP" ? "ERP" : "CRM"} by Ready Tech Solutions.`,
    "Scope: ONLY Ready Tech CRM/ERP features, navigation and this workspace's own data. If a question is unrelated to Ready Tech CRM/ERP, politely say you can only help with Ready Tech CRM and ERP and suggest a related topic. Never use outside knowledge.",
    "Feature questions: answer ONLY from the product guide below, as numbered step-by-step instructions. If the guide does not cover it, say you are not sure and suggest the brain support icon. Never invent features, buttons, prices, settings or steps.",
    "Data questions (sales, orders, leads, revenue, payments, invoices, inventory, HR…): ALWAYS call get_business_data and use ONLY the numbers it returns. Never guess, estimate or reuse figures from memory. If a total is 0 or there are no records, clearly say there are no records for that period. If a tool returns PERMISSION_DENIED, say the user's role cannot view that data.",
    "Navigation: when the user asks to go to / open / show a page (e.g. 'go to invoice', 'open customers' = /clients, 'sales reports' = /invoices/analytics), ALWAYS call navigate — the app opens it immediately. Never answer with where-to-click instructions instead. Then confirm in one short sentence.",
    "Records: for a specific customer, invoice, lead, order, product, vendor, warehouse or employee (e.g. 'show Ram's invoice', 'find overdue payments'), call find_records (open=true when they want to see/open it), then explain the matching records' details. If nothing matches, say so plainly.",
    "Sales/revenue questions → metric revenue. Profit is NOT calculated by this app (no accounting ledger): say so; you may report invoiced revenue and expense claims separately without subtracting them. Only give reasons for a zero result when the returned data supports it (e.g. invoices exist but none today).",
    "You cannot perform actions: you never create, update, convert, delete or submit leads, enquiries or any records. If asked, explain the steps and offer to open the page (navigate) so the user can do it and confirm it themselves. Never claim you changed data.",
    "Follow-ups: use the conversation to resolve references like 'what about yesterday?' or 'and this month?'.",
    LANGUAGE_RULE,
    "Style: plain text (no markdown tables or symbols), suitable to be read aloud. For data, start with the headline figure, then explain the breakdown in a few sentences. Keep replies under 180 words.",
    PAGE_GUIDE[page] ? `About the current page (${NAV_ROUTES[page]}): ${PAGE_GUIDE[page]} For "explain this page", explain this in detail as numbered points.` : "",
    `Context: user role = ${role || "unknown"}; current page = ${page || "unknown"}${NAV_ROUTES[page] ? ` (${NAV_ROUTES[page]})` : ""}; user's local date/time = ${today || "unknown"}. Use the current page to interpret vague questions ("how do I add one here?").`,
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

const textOf = (response) =>
  (response?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();

const localNow = (tzOffset) => {
  const d = new Date(Date.now() - (Number(tzOffset) || 0) * 60000);
  return `${d.toISOString().slice(0, 16).replace("T", " ")} (${d.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })})`;
};

export const makeRtsHelp = (createMessage, tools = { toolDefinitions, runTool }) => async (req, res) => {
  const messages = toChatMessages(req.body?.messages);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ success: false, message: "A user message is required" });
  }

  const tzOffset = Number(req.body?.tzOffset) || 0;
  const page = typeof req.body?.page === "string" ? req.body.page.slice(0, 100) : "";
  const ctx = { role: req.user?.role, tzOffset };
  const workspace = req.workspace;

  const cards = [];
  const actions = [];

  try {
    const system = buildSystemPrompt({ product: req.body?.product, page, role: ctx.role, today: localNow(tzOffset) });
    const convo = [...messages];
    let text = "";

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const force = step === 0 && needsTool(messages[messages.length - 1].content);
      const response = await createMessage({
        system,
        messages: convo,
        tools: tools.toolDefinitions,
        max_tokens: 1024,
        ...(force ? { tool_choice: { type: "any" } } : {}),
      });
      text = textOf(response);
      const calls = (response?.content || []).filter((b) => b.type === "tool_use");
      if (response?.stop_reason !== "tool_use" || !calls.length) break;

      convo.push({ role: "assistant", content: response.content });
      const results = [];
      for (const call of calls) {
        let out;
        if (call.name === "get_business_data" && !workspace) {
          out = { content: { ok: false, error: "No workspace" } };
        } else {
          try {
            // Explicit workspace binding: every read is isolated to this login's workspace
            out = await runWithWorkspace(workspace, () => tools.runTool(call.name, call.input, ctx));
          } catch (err) {
            console.error("❌ RTS tool error:", call.name, err.message);
            out = { content: { ok: false, error: "The data could not be loaded right now" } };
          }
        }
        if (out.card) cards.push(out.card);
        if (out.action && !actions.some((a) => a.path === out.action.path)) actions.push(out.action);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(out.content),
          ...(out.content?.ok === false ? { is_error: true } : {}),
        });
      }
      convo.push({ role: "user", content: results });
    }

    if (!text) text = cards.length || actions.length ? "Done." : "Sorry, I could not answer that. Please try rephrasing.";

    return res.status(200).json({ success: true, data: { role: "assistant", text, cards, actions } });
  } catch (error) {
    console.error("❌ RTS help error:", error.message);
    const busy = [429, 529].includes(error.status);
    return res.status(busy ? 503 : 502).json({
      success: false,
      message: busy
        ? "RTS AI is busy right now. Please try again in a moment."
        : "RTS AI is unavailable right now. Please try again or use the brain support icon.",
    });
  }
};

export const rtsHelp = makeRtsHelp(createClaudeMessage);
