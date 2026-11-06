/* ======================================================
   RTS AI — instant on-device navigation commands
   "go to invoice", "open leads", "customers ku po",
   "இன்வாய்ஸ் திற" → navigate directly with React Router
   (no AI round-trip). Paths = routes registered in App.jsx;
   kept in sync with Backend/services/rtsAssistant/rtsTools.js
   NAV_ROUTES (checked by a backend test).
   Anything that is not a plain page command goes to the AI.
====================================================== */

export const PAGES = [
  { path: "/dashboard", name: "Dashboard", aliases: ["dashboard", "home", "home page", "டாஷ்போர்டு", "முகப்பு"] },
  { path: "/leads", name: "Leads", aliases: ["lead", "leads", "லீட்", "லீட்ஸ்"] },
  { path: "/clients", name: "Clients", aliases: ["client", "clients", "customer", "customers", "கஸ்டமர்", "கஸ்டமர்ஸ்", "வாடிக்கையாளர்", "வாடிக்கையாளர்கள்"] },
  { path: "/products", name: "CRM Products", aliases: ["crm product", "crm products", "products", "product"] },
  { path: "/users", name: "Users", aliases: ["user", "users", "யூசர்", "யூசர்ஸ்"] },
  { path: "/auditlogs", name: "Audit Logs", aliases: ["audit", "audit log", "audit logs"] },
  { path: "/automations", name: "Automations", aliases: ["automation", "automations"] },
  { path: "/automations/create", name: "Create Automation", aliases: ["create automation", "new automation"] },
  { path: "/automations/templates", name: "Automation Templates", aliases: ["automation template", "automation templates", "templates"] },
  { path: "/invoices", name: "Invoices", aliases: ["invoice", "invoices", "bill", "bills", "இன்வாய்ஸ்", "பில்"] },
  { path: "/invoices/create", name: "Create Invoice", aliases: ["create invoice", "new invoice", "add invoice"] },
  { path: "/invoices/analytics", name: "Invoice Analytics", aliases: ["invoice analytics", "analytics", "sales report", "sales reports", "revenue report", "reports", "report"] },
  { path: "/salesforce", name: "Salesforce", aliases: ["salesforce", "sales force"] },
  { path: "/salesforce/dashboard", name: "Salesforce Dashboard", aliases: ["salesforce dashboard", "sales dashboard"] },
  { path: "/salesforce/leads", name: "Salesforce Leads", aliases: ["salesforce leads"] },
  { path: "/salesforce/opportunities", name: "Opportunities", aliases: ["opportunity", "opportunities", "deals", "pipeline"] },
  { path: "/salesforce/activities", name: "Activities", aliases: ["activity", "activities", "tasks", "follow up", "follow ups", "followups"] },
  { path: "/stocks/products", name: "Stock Products", aliases: ["stock product", "stock products", "erp products", "items"] },
  { path: "/stocks/warehouses", name: "Warehouses", aliases: ["warehouse", "warehouses", "godown", "கிடங்கு"] },
  { path: "/stocks/vendors", name: "Vendors", aliases: ["vendor", "vendors", "supplier", "suppliers"] },
  { path: "/stocks/purchase-orders", name: "Purchase Orders", aliases: ["purchase order", "purchase orders", "purchase", "purchases"] },
  { path: "/stocks/sales-orders", name: "Sales Orders", aliases: ["sales order", "sales orders", "orders", "order", "sales"] },
  { path: "/stocks/inventory", name: "Inventory", aliases: ["inventory", "stock", "stocks", "ஸ்டாக்", "இருப்பு"] },
  { path: "/stocks/stock-adjustment", name: "Stock Adjustment", aliases: ["stock adjustment", "adjustment", "adjust stock"] },
  { path: "/stocks/warehouse-transfer", name: "Warehouse Transfer", aliases: ["warehouse transfer", "stock transfer", "transfer"] },
  { path: "/hr", name: "Human Resources", aliases: ["hr", "human resource", "human resources", "employee", "employees", "attendance", "leave", "payroll", "payslip", "ஊழியர்", "ஊழியர்கள்"] },
  { path: "/ai/content-generator", name: "AI Content Generator", aliases: ["content generator", "ai content"] },
  { path: "/ai/seo-tool", name: "AI SEO Tool", aliases: ["seo", "seo tool"] },
  { path: "/ai/email-generator", name: "AI Email Generator", aliases: ["email generator", "ai email"] },
  { path: "/ai/customer-communication", name: "AI Customer Communication", aliases: ["customer communication"] },
  { path: "/ai/sales-recommendations", name: "AI Sales Recommendations", aliases: ["sales recommendation", "sales recommendations"] },
  { path: "/integrations/meta", name: "Meta Integration", aliases: ["meta", "facebook", "meta integration"] },
  { path: "/integrations/whatsapp", name: "WhatsApp Inbox", aliases: ["whatsapp", "whats app", "வாட்ஸ்அப்"] },
  { path: "/integrations/instagram", name: "Instagram Inbox", aliases: ["instagram", "insta"] },
  { path: "/integrations/email", name: "Email Integration", aliases: ["email integration", "email", "mail", "mailbox"] },
  { path: "/integrations/shopify", name: "Shopify Integration", aliases: ["shopify"] },
  { path: "/settings", name: "Settings", aliases: ["settings", "setting", "ai settings", "செட்டிங்ஸ்"] },
  { path: "/notifications", name: "Notifications", aliases: ["notification", "notifications"] },
  { path: "/profile", name: "Profile", aliases: ["profile", "my profile", "account"] },
  { path: "/contact", name: "Contact", aliases: ["contact", "contact us"] },
];

// English + Tanglish + Tamil "go / open / navigate" verbs
const VERBS = [
  "go to", "goto", "go", "open up", "open", "navigate to", "navigate", "take me to", "take me", "switch to",
  "launch", "bring up", "show me the", "show the", "ku po", "ku poo", "ku polam", "kku po", "po", "poo",
  "open pannu", "open panu", "open pannunga", "thira", "thiravu", "kaatu", "kattu",
  "திற", "திறக்க", "திறந்து", "போ", "போங்க", "செல்", "காட்டு",
];
const FILLER = ["the", "a", "my", "page", "screen", "module", "section", "tab", "please", "pls", "now", "to", "me", "ku", "kku", "ah", "va", "பக்கம்", "பக்கத்துக்கு", "பக்கத்தை", "பக்கத்து", "க்கு", "கு", "ஐ"];
const QUESTION = /\b(how|why|what|when|which|steps?|explain|evlo|ethana|eppadi|epdi|enna)\b|\?|எப்படி|என்ன|எத்தனை|எவ்வளவு/i;
/* "Hey RTS" wake word as browsers commonly transcribe it.
   EN/Tanglish: hey|hay|hei|hi|hello|ok(ay) + rts / r t s / r.t.s / rt's /
   arts / artist(s) / arties / rds / rtx.  Tamil script: ஹே|ஹேய்|ஏய்|ஹாய்
   + ஆர்டிஎஸ் / ஆர் டி எஸ் (or Latin RTS). */
const WAKE_RE = new RegExp(
  "(?:^|[^a-z\u0B80-\u0BFF])" +
    "(?:(?:(?:hey|hay|hei|hi|hii|hello|ok|okay)[\\s,.!-]*|(?:he|a)[\\s,.!-]+)(?:r[\\s.]*t[\\s.'’]*s|ar[\\s.]*ts|arts|artists?|arties|artis|rds|rtx|rtc)" +
    "|^\\s*(?:r[\\s.]*t[\\s.]*s|arps)(?=[\\s,.!]+\\S)" +
    "|(?:ஹே|ஹேய்|ஏய்|ஹாய்)[\\s,.!-]*(?:ஆர்[\\s.]*டி[\\s.]*எஸ்|ஆர்டிஎஸ்|r[\\s.]*t[\\s.]*s))" +
    "(?![a-z\u0B80-\u0BFF])[\\s,.!?:;-]*",
  "i"
);

/* Returns { start, end, rest } when the wake word is present, else null.
   rest = whatever was said after it ("go to invoice"). */
export function matchWake(raw) {
  const text = String(raw || "");
  const m = WAKE_RE.exec(text);
  if (!m) return null;
  const end = m.index + m[0].length;
  return { start: m.index, end, rest: text.slice(end).trim() };
}

const stripWake = (text) => {
  const w = matchWake(text);
  return w ? w.rest : text;
};

const isLatin = (s) => /^[\x20-\x7e]+$/.test(s);
const term = (s) => (isLatin(s) ? new RegExp(`(^|[^a-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i") : new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const strip = (text, list) => list.reduce((t, w) => t.replace(term(w), " "), text);

const byLength = (list) => [...list].sort((a, b) => b.length - a.length);
const FILLER_SORTED = byLength(FILLER);
const VERBS_SORTED = byLength(VERBS);
const ALIASES = PAGES.flatMap((p) => p.aliases.map((a) => ({ alias: a, page: p }))).sort((a, b) => b.alias.length - a.alias.length);

/* Returns { path, name } for a plain page command, else null */
export function parseNavigation(raw) {
  const text = stripWake(String(raw || "")).replace(/[.,!]+/g, " ").replace(/['’]s\b/gi, "").trim().toLowerCase();
  if (!text || text.length > 80 || QUESTION.test(text)) return null;

  const verb = VERBS.some((v) => term(v).test(text));
  const hit = ALIASES.find(({ alias }) => term(alias).test(text));
  if (!hit) return null;

  // Bare page name ("invoices") also counts; otherwise a go/open verb is required
  const rest = strip(strip(strip(text, [hit.alias]), VERBS_SORTED), FILLER_SORTED).replace(/\s+/g, " ").trim();
  if (rest) return null; // extra words (a name, a filter, a question) → let the AI handle it
  if (!verb && text !== hit.alias) return null;
  return { path: hit.page.path, name: hit.page.name };
}

export const isTamil = (s) => /[஀-௿]/.test(s || "");

export const STATE_LABEL = {
  wake: "Say \"Hey RTS\"", detected: "RTS Listening…", listening: "RTS Listening…",
  thinking: "Thinking…", speaking: "Speaking…", executing: "Opening page…", error: "Voice error", idle: "",
};
