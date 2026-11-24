// services/rtsAssistant/rtsIntent.js
// Rule-based (no AI) intent parser + template replies for RTS structured
// commands. Maps English / Tanglish / Tamil phrases onto the EXISTING
// read-only tools in rtsTools.js (get_business_data, find_records).
// It never produces a write, update, delete or approval action.

/* ---------- matching helpers (same approach as Frontend rtsCommands.js) ---------- */
const isLatin = (s) => /^[\x20-\x7e]+$/.test(s);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const term = (s) => (isLatin(s) ? new RegExp(`(^|[^a-z0-9])${escRe(s)}(?=$|[^a-z0-9])`, "i") : new RegExp(escRe(s)));
const has = (text, list) => list.some((w) => term(w).test(text));
const byLength = (list) => [...list].sort((a, b) => b.length - a.length);
const strip = (text, list) => byLength(list).reduce((t, w) => t.replace(new RegExp(term(w).source, isLatin(w) ? "gi" : "g"), " "), text);

const normalize = (raw) =>
  String(raw || "")
    .toLowerCase()
    .replace(/([a-z0-9])['’]s\b/g, "$1") // "ram's invoice" → "ram invoice"
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- vocabulary ---------- */
const PERIOD_WORDS = {
  yesterday: ["yesterday", "netru", "nethu", "nethiku", "nethikku", "நேற்று"],
  this_week: ["this week", "intha vaaram", "indha vaaram", "intha week", "indha week", "இந்த வாரம்"],
  last_month: ["last month", "previous month", "pona masam", "pona maasam", "pona month", "கடந்த மாதம்", "போன மாதம்"],
  this_month: ["this month", "intha masam", "indha maasam", "intha maasam", "intha month", "indha month", "இந்த மாதம்"],
  this_year: ["this year", "intha varusham", "indha varusham", "intha year", "indha year", "இந்த ஆண்டு", "இந்த வருடம்"],
  all_time: ["all time", "overall", "so far", "ever", "ithuvarai", "இதுவரை"],
  today: ["today", "todays", "inniku", "innaiku", "innikku", "innaikku", "indru", "இன்று", "இன்னைக்கு"],
};

/* Longest phrase wins (sales order before sales, low stock before stock) */
const METRIC_WORDS = {
  sales_orders: ["sales order", "sales orders"],
  purchase_orders: ["purchase order", "purchase orders", "purchase", "purchases"],
  inventory: ["inventory", "stock", "stocks", "low stock", "out of stock", "ஸ்டாக்", "இருப்பு"],
  revenue: ["revenue", "sales", "sale", "turnover", "income", "vikkapanai", "விற்பனை", "வருமானம்"],
  invoices: ["invoice", "invoices", "bill", "bills", "இன்வாய்ஸ்", "பில்"],
  payments: ["payment", "payments", "collection", "collections", "collected", "outstanding", "dues", "பேமெண்ட்"],
  leads: ["lead", "leads", "லீட்", "லீட்ஸ்"],
  opportunities: ["opportunity", "opportunities", "deal", "deals", "pipeline"],
  clients: ["client", "clients", "customer", "customers", "கஸ்டமர்", "வாடிக்கையாளர்"],
  activities: ["activity", "activities", "task", "tasks", "follow up", "follow ups", "followups"],
  employees: ["employee", "employees", "staff", "ஊழியர்", "ஊழியர்கள்"],
  attendance: ["attendance", "வருகை"],
  leaves: ["leave", "leaves", "leave request", "leave requests", "விடுப்பு"],
  expenses: ["expense", "expenses", "expense claim", "expense claims", "செலவு"],
};

const ENTITY_WORDS = {
  sales_order: ["sales order", "sales orders"],
  invoice: ["invoice", "invoices", "bill", "bills", "payment", "payments", "இன்வாய்ஸ்", "பில்"],
  client: ["client", "clients", "customer", "customers", "கஸ்டமர்", "வாடிக்கையாளர்"],
  lead: ["lead", "leads", "லீட்", "லீட்ஸ்"],
  product: ["product", "products", "item", "items"],
  vendor: ["vendor", "vendors", "supplier", "suppliers"],
  warehouse: ["warehouse", "warehouses", "godown", "கிடங்கு"],
  employee: ["employee", "employees", "staff", "ஊழியர்"],
};

const STATUS_WORDS = {
  Overdue: ["overdue"], "Partially Paid": ["partially paid", "partial"], Paid: ["paid"], Pending: ["pending", "unpaid"],
  Cancelled: ["cancelled", "canceled"], New: ["new"], Contacted: ["contacted"], Qualified: ["qualified"],
  Proposal: ["proposal"], Negotiation: ["negotiation"], Won: ["won"], Lost: ["lost"], Closed: ["closed"],
  DRAFT: ["draft"], APPROVED: ["approved"], DELIVERED: ["delivered"], Active: ["active"], Inactive: ["inactive"],
};

const COUNT_WORDS = ["how many", "how much", "number of", "count", "total", "evlo", "evvalavu", "ethana", "ethanai", "எத்தனை", "எவ்வளவு", "மொத்தம்"];
const FIND_WORDS = ["find", "search", "look up", "lookup", "show", "show me", "open", "details", "detail", "get", "list", "thedu", "theadu", "kaatu", "kattu", "thira", "தேடு", "காட்டு", "திற"];
const OPEN_WORDS = ["open", "thira", "திற"];
const WRITE_WORDS = [
  "create", "add", "delete", "remove", "update", "edit", "modify", "change", "approve", "reject", "convert",
  "send", "submit", "mark", "assign", "cancel", "pay", "import", "uruvaakku", "uruvakku", "neekku", "maathu",
  "உருவாக்கு", "நீக்கு", "அழி", "சேர்", "மாற்று", "அனுமதி",
];
const QUESTION_WORDS = ["how do", "how to", "how can", "how should", "why", "explain", "eppadi", "epdi", "yen", "எப்படி", "ஏன்", "விளக்கு"];
const FILLER = [
  "the", "a", "an", "my", "me", "of", "for", "to", "in", "with", "named", "called", "please", "pls", "all", "record", "records",
  "number", "no", "is", "are", "what", "whats", "and", "info", "information", "status", "today", "can you", "could you", "i want",
  "oda", "ode", "udaiya", "ku", "kku", "ah", "va", "da", "pa", "iruku", "irukku", "vandhuchu", "vanthuchu", "enna", "pannu", "panunga",
  "ஓட", "உடைய", "விவரம்", "என்ன",
];
const TANGLISH = /\b(evlo|ethana|inniku|innaiku|indru|netru|nethu|kaatu|kattu|thedu|thira|vandhuchu|vanthuchu|iruku|irukku|oda|pannu|masam|maasam|vaaram|varusham|enna|motham|illa)\b/;

const firstKey = (text, map) => {
  const hits = Object.entries(map).flatMap(([key, words]) => words.filter((w) => term(w).test(text)).map((w) => ({ key, w })));
  hits.sort((a, b) => b.w.length - a.w.length);
  return hits[0]?.key || null;
};

export const detectLang = (raw) => {
  if (/[஀-௿]/.test(raw || "")) return "ta";
  return TANGLISH.test(normalize(raw)) ? "tl" : "en";
};

/* Returns one of:
     { tool: "get_business_data", input: { metric, period } }
     { tool: "find_records", input: { entity, query?, status?, open? } }
     { blocked: true }  — a create/update/delete/approve request (never executed)
     null               — not a structured command (caller may fall back to AI) */
export const parseIntent = (raw) => {
  const text = normalize(raw);
  if (!text || text.length > 200) return null;
  if (has(text, QUESTION_WORDS)) return null; // how-to: leave to the guide / AI
  if (has(text, WRITE_WORDS)) return { blocked: true };

  const periodKey = firstKey(text, PERIOD_WORDS);
  const period = periodKey || "today";
  const metric = firstKey(text, METRIC_WORDS);
  const counting = has(text, COUNT_WORDS);

  if (!counting && has(text, FIND_WORDS)) {
    const entity = firstKey(text, ENTITY_WORDS);
    if (entity) {
      const statusKey = firstKey(text, STATUS_WORDS);
      const allPeriod = Object.values(PERIOD_WORDS).flat();
      const allStatus = Object.values(STATUS_WORDS).flat();
      const query = strip(strip(strip(strip(text, [...Object.values(ENTITY_WORDS).flat(), ...Object.values(METRIC_WORDS).flat()]), FIND_WORDS), allPeriod), [...allStatus, ...FILLER])
        .replace(/\s+/g, " ").trim().slice(0, 60);
      const open = has(text, OPEN_WORDS);
      if (query.length >= 2) return { tool: "find_records", input: { entity, query, ...(statusKey ? { status: statusKey } : {}), open } };
      if (statusKey) return { tool: "find_records", input: { entity, status: statusKey, open } };
      if (!metric) return { tool: "find_records", input: { entity, open } }; // vendors / warehouses: latest list
    }
  }

  if (metric) return { tool: "get_business_data", input: { metric, period } };
  return null;
};

/* ---------- template replies ---------- */
const PERIOD_LABEL = {
  today: { en: "today", ta: "இன்று", tl: "inniku" },
  yesterday: { en: "yesterday", ta: "நேற்று", tl: "nethu" },
  this_week: { en: "this week", ta: "இந்த வாரம்", tl: "indha vaaram" },
  this_month: { en: "this month", ta: "இந்த மாதம்", tl: "indha maasam" },
  last_month: { en: "last month", ta: "கடந்த மாதம்", tl: "pona maasam" },
  this_year: { en: "this year", ta: "இந்த ஆண்டு", tl: "indha varusham" },
  all_time: { en: "in total", ta: "இதுவரை", tl: "ithuvarai" },
  current: { en: "right now", ta: "தற்போது", tl: "ippo" },
};

const L = (en, ta, tl = en) => ({ en, ta, tl });
/* [summary key, label, money?] — labels are read aloud after the title */
const METRIC_TEMPLATES = {
  leads: [L("Leads", "லீட்ஸ்"), [["total", L("total", "மொத்தம்", "motham")]]],
  opportunities: [L("Opportunities", "வாய்ப்புகள்"), [["total", L("total", "மொத்தம்", "motham")], ["totalValue", L("worth", "மதிப்பு", "value"), 1], ["openPipelineValue", L("open pipeline", "திறந்த பைப்லைன்", "open pipeline"), 1]]],
  clients: [L("Clients", "வாடிக்கையாளர்கள்"), [["newInPeriod", L("new", "புதியவை", "pudhusu")], ["totalClients", L("total clients", "மொத்த வாடிக்கையாளர்கள்", "motham clients")]]],
  activities: [L("Activities", "செயல்பாடுகள்"), [["pendingDueToday", L("due today", "இன்று நிலுவை", "inniku due")], ["overduePending", L("overdue", "காலாவதியானவை", "overdue")], ["completedInPeriod", L("completed", "முடிந்தவை", "mudinjadhu")]]],
  sales_orders: [L("Sales orders", "விற்பனை ஆர்டர்கள்"), [["orders", L("orders", "ஆர்டர்கள்", "orders")], ["amountExcludingCancelled", L("worth", "மதிப்பு", "value"), 1]]],
  purchase_orders: [L("Purchase orders", "கொள்முதல் ஆர்டர்கள்"), [["orders", L("orders", "ஆர்டர்கள்", "orders")], ["amount", L("worth", "மதிப்பு", "value"), 1]]],
  invoices: [L("Invoices", "இன்வாய்ஸ்கள்"), [["invoices", L("invoices", "இன்வாய்ஸ்கள்", "invoices")], ["invoicedAmount", L("invoiced", "பில் தொகை", "invoiced"), 1], ["amountPaid", L("paid", "செலுத்தியது", "paid"), 1], ["balanceDue", L("balance due", "நிலுவை", "balance"), 1]]],
  payments: [L("Payments", "பேமெண்ட்கள்"), [["amountCollected", L("collected", "வசூல்", "collect aanadhu"), 1], ["invoicesWithPayment", L("invoices paid", "செலுத்திய இன்வாய்ஸ்கள்", "paid invoices")], ["outstandingBalance", L("outstanding", "நிலுவை", "outstanding"), 1], ["overdueInvoices", L("overdue invoices", "காலாவதி இன்வாய்ஸ்கள்", "overdue invoices")]]],
  revenue: [L("Sales", "விற்பனை", "Sales"), [["invoicedAmount", L("invoiced", "பில் தொகை", "invoiced"), 1], ["invoices", L("invoices", "இன்வாய்ஸ்கள்", "invoices")], ["amountPaid", L("collected", "வசூல்", "collect aanadhu"), 1], ["salesOrderAmount", L("sales orders worth", "விற்பனை ஆர்டர் மதிப்பு", "sales order value"), 1], ["salesOrders", L("sales orders", "விற்பனை ஆர்டர்கள்", "sales orders")]]],
  inventory: [L("Inventory", "இருப்பு", "Stock"), [["products", L("products", "பொருட்கள்", "products")], ["totalAvailableUnits", L("units available", "கிடைக்கும் அலகுகள்", "units iruku")], ["lowStock", L("low stock", "குறைந்த இருப்பு", "low stock")], ["outOfStock", L("out of stock", "இருப்பு இல்லை", "stock illa")]]],
  employees: [L("Employees", "ஊழியர்கள்"), [["total", L("total", "மொத்தம்", "motham")]]],
  attendance: [L("Attendance", "வருகை"), [["records", L("records", "பதிவுகள்", "records")]]],
  leaves: [L("Leave requests", "விடுப்பு கோரிக்கைகள்"), [["requestsInPeriod", L("requests", "கோரிக்கைகள்", "requests")], ["pendingApprovalTotal", L("pending approval overall", "மொத்தம் நிலுவையில்", "motham pending")]]],
  expenses: [L("Expense claims", "செலவு கோரிக்கைகள்"), [["claims", L("claims", "கோரிக்கைகள்", "claims")], ["totalClaimed", L("claimed", "கோரியது", "claim"), 1], ["approvedOrReimbursed", L("approved or reimbursed", "அனுமதி/திருப்பி வழங்கியது", "approved"), 1]]],
};

const money = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const MESSAGES = {
  blocked: L(
    "I can only read your data. I can't create, change, approve or delete records — please do that on the page itself.",
    "நான் தரவைப் படிக்க மட்டுமே முடியும். பதிவுகளை உருவாக்க, மாற்ற, அனுமதிக்க அல்லது நீக்க முடியாது — அதை பக்கத்திலேயே செய்யவும்.",
    "Naan data-va read mattum dhaan panna mudiyum. Create, update, approve, delete panna mudiyadhu — page-la neengale pannunga."
  ),
  unknown: L(
    "Sorry, I didn't understand that command. Try \"today's sales\", \"how many leads this month\" or \"find invoice INV-001\".",
    "மன்னிக்கவும், அந்தக் கட்டளை புரியவில்லை. \"இன்று விற்பனை எவ்வளவு\" போல கேளுங்கள்.",
    "Sorry, adhu puriyala. \"inniku sales evlo\" illa \"Ram invoice kaatu\" maadhiri kelunga."
  ),
  denied: L("Your role cannot view this data.", "உங்கள் பங்கிற்கு இந்தத் தரவைப் பார்க்க அனுமதி இல்லை.", "Unga role-ku indha data paaka permission illa."),
  failed: L("The data could not be loaded right now. Please try again.", "தரவை இப்போது ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.", "Data ippo load aagala. Thirumba try pannunga."),
};

const describeRecord = (entity, r) => {
  switch (entity) {
    case "invoice": return [r.invoiceNumber, r.customer, r.paymentStatus, r.balanceDue ? `balance ${money(r.balanceDue)}` : ""];
    case "client": return [r.company, r.contact, r.city];
    case "lead": return [r.name, r.company, r.status];
    case "sales_order": return [r.soNumber, r.customer, r.status, r.totalAmount != null ? money(r.totalAmount) : ""];
    case "product": return [r.name, r.sku];
    case "employee": return [r.name, r.code, r.designation || r.department, r.status];
    default: return [r.name, r.code];
  }
};

/* Spoken / chat text for a runTool() result */
export const formatReply = (content, lang = "en") => {
  if (!content?.ok) return /PERMISSION_DENIED/.test(content?.error || "") ? MESSAGES.denied[lang] : MESSAGES.failed[lang];

  if (content.type === "records") {
    const what = content.entity.replace("_", " ");
    if (!content.count) {
      return { en: `No matching ${what} records found.`, ta: "பொருந்தும் பதிவுகள் எதுவும் இல்லை.", tl: `Matching ${what} records edhuvum illa.` }[lang];
    }
    const list = content.records.slice(0, 3).map((r) => describeRecord(content.entity, r).filter(Boolean).join(", ")).join("; ");
    const head = { en: `Found ${content.count} ${what}${content.count > 1 ? "s" : ""}`, ta: `${content.count} பதிவுகள் கிடைத்தன`, tl: `${content.count} ${what} kedaichadhu` }[lang];
    return `${head}: ${list}.`;
  }

  const tpl = METRIC_TEMPLATES[content.metric];
  if (!tpl) return MESSAGES.failed[lang];
  const [title, fields] = tpl;
  const p = (PERIOD_LABEL[content.period] || PERIOD_LABEL.today)[lang];
  const s = content.summary || {};
  if (fields.every(([k]) => !Number(s[k]))) {
    return { en: `There are no ${title.en.toLowerCase()} records ${p}.`, ta: `${p} ${title.ta} பதிவுகள் இல்லை.`, tl: `${p} ${title.tl.toLowerCase()} records edhuvum illa.` }[lang];
  }
  const parts = fields.map(([k, label, isMoney]) => `${label[lang]} ${isMoney ? money(s[k]) : Number(s[k]) || 0}`);
  return `${title[lang]} ${p}: ${parts.join(", ")}.`;
};
