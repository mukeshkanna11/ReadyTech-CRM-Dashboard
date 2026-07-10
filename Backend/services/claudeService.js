// services/claudeService.js
import Anthropic from "@anthropic-ai/sdk";

/* =========================================================
   CONFIG
========================================================= */
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 1200;

/* =========================================================
   CLIENT (lazy singleton so a missing key fails gracefully)
========================================================= */
let client = null;

const getClient = () => {
  const apiKey = process.env.CLAUDE_API_KEY?.trim();

  if (!apiKey) {
    const err = new Error("Claude API key is not configured");
    err.statusCode = 500;
    throw err;
  }

  if (!client) {
    client = new Anthropic({ apiKey });
  }

  return client;
};

/* =========================================================
   LOW-LEVEL: reusable single-shot call
========================================================= */
export const askClaude = async (prompt, options = {}) => {
  const {
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
    system,
  } = options;

  if (!prompt || !prompt.trim()) {
    const err = new Error("Prompt is required");
    err.statusCode = 400;
    throw err;
  }

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  return {
    text: response.content?.[0]?.text?.trim() || "",
    usage: response.usage || {},
    model: response.model || model,
  };
};

/* =========================================================
   LEAD CONTEXT SERIALIZER
   Keeps prompts consistent & noise-free across all features.
========================================================= */
const buildLeadContext = (lead = {}) => {
  const fields = {
    Name: lead.name,
    Email: lead.email,
    Phone: lead.phone,
    Company: lead.company,
    Source: lead.source,
    Status: lead.status,
    Department: lead.department,
    Notes: lead.notes,
    "Created At": lead.createdAt,
    "Last Updated": lead.updatedAt,
  };

  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== "")
    .map(([k, v]) => `- ${k}: ${v}`);

  return lines.length ? lines.join("\n") : "- No structured data available.";
};

const SYSTEM_PROMPT =
  "You are an expert B2B sales strategist embedded inside the ReadyTech CRM. " +
  "You analyze CRM lead records and return concise, actionable insights for a " +
  "sales representative. Always respond in clean, well-structured GitHub-flavored " +
  "Markdown using headings, bold labels and bullet points. Never invent data that " +
  "is not present; if information is missing, say so and note what to collect next.";

/* =========================================================
   LEAD INSIGHT TYPES (feature registry)
   Each entry is reusable & self-describing.
========================================================= */
export const LEAD_INSIGHT_TYPES = {
  summary: {
    label: "AI Lead Summary",
    maxTokens: 900,
    buildPrompt: (ctx) => `Write a concise executive **summary** of this CRM lead.

Lead Data:
${ctx}

Return Markdown with:
- A one-paragraph overview
- **Key Highlights** (bullet points)
- **Current Status & Context**
- **Missing Information** worth collecting`,
  },

  recommendations: {
    label: "AI Sales Recommendations",
    maxTokens: 1100,
    buildPrompt: (ctx) => `Act as a senior sales strategist and give **sales recommendations** to move this lead forward.

Lead Data:
${ctx}

Return Markdown with:
- **Recommended Sales Approach**
- **Talking Points / Value Propositions**
- **Objections to Anticipate**
- **Suggested Offer or Next Step**`,
  },

  quality: {
    label: "AI Lead Quality Analysis",
    maxTokens: 1000,
    buildPrompt: (ctx) => `Evaluate the **quality** of this lead.

Lead Data:
${ctx}

Return Markdown with:
- **Lead Score**: an integer 0-100 (bold it)
- **Quality Tier**: Hot / Warm / Cold
- **Conversion Probability**: a percentage
- **Strengths** (bullets)
- **Risks / Red Flags** (bullets)
- **Reasoning** (2-3 sentences)`,
  },

  followup: {
    label: "AI Next Follow-up Suggestions",
    maxTokens: 1000,
    buildPrompt: (ctx) => `Suggest the **next follow-up plan** for this lead.

Lead Data:
${ctx}

Return Markdown with:
- **Recommended Next Action**
- **Best Channel & Timing**
- **Draft Follow-up Message** (short, ready to send)
- **Follow-up Cadence** (bulleted timeline)`,
  },

  sentiment: {
    label: "AI Customer Sentiment Analysis",
    maxTokens: 900,
    buildPrompt: (ctx) => `Analyze the **customer sentiment** based on this lead's data and notes.

Lead Data:
${ctx}

Return Markdown with:
- **Overall Sentiment**: Positive / Neutral / Negative (bold it)
- **Confidence**: a percentage
- **Signals Detected** (bullets, cite the notes/fields)
- **Engagement Level**
- **Recommended Tone** for the next interaction`,
  },
};

export const LEAD_INSIGHT_KEYS = Object.keys(LEAD_INSIGHT_TYPES);

/* =========================================================
   HIGH-LEVEL: generate a lead insight (reusable)
========================================================= */
export const generateLeadInsight = async ({ lead, type }) => {
  if (!type || !LEAD_INSIGHT_TYPES[type]) {
    const err = new Error(
      `Invalid insight type. Allowed: ${LEAD_INSIGHT_KEYS.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
    const err = new Error("A valid 'lead' object is required");
    err.statusCode = 400;
    throw err;
  }

  if (!lead.name || !`${lead.name}`.trim()) {
    const err = new Error("Lead must include at least a name");
    err.statusCode = 400;
    throw err;
  }

  const feature = LEAD_INSIGHT_TYPES[type];
  const ctx = buildLeadContext(lead);
  const prompt = feature.buildPrompt(ctx);

  const { text, usage, model } = await askClaude(prompt, {
    maxTokens: feature.maxTokens,
    system: SYSTEM_PROMPT,
  });

  return {
    type,
    label: feature.label,
    insight: text,
    usage,
    model,
  };
};

/* =========================================================
   CLIENT CONTEXT SERIALIZER
========================================================= */
const buildClientContext = (client = {}) => {
  const addr = (a = {}) =>
    [a.addressLine1, a.addressLine2, a.city, a.state, a.pincode, a.country]
      .filter((v) => v && `${v}`.trim() !== "")
      .join(", ");

  const fields = {
    "Company Name": client.companyName,
    "Contact Person": client.contactPerson,
    Email: client.email,
    Phone: client.phone,
    Website: client.website,
    "GST Number": client.gstNumber,
    "PAN Number": client.panNumber,
    "Client Type": client.clientType,
    Status: client.status,
    "Current Plan": client.currentPlan,
    "Subscription Status": client.subscriptionStatus,
    "Subscription Start": client.subscriptionStartDate,
    "Subscription End": client.subscriptionEndDate,
    "Billing Address": addr(client.billingAddress),
    "Shipping Address": addr(client.shippingAddress),
    Notes: client.notes,
    "Created At": client.createdAt,
    "Last Updated": client.updatedAt,
  };

  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== "")
    .map(([k, v]) => `- ${k}: ${v}`);

  return lines.length ? lines.join("\n") : "- No structured data available.";
};

const CLIENT_SYSTEM_PROMPT =
  "You are an expert B2B account manager and customer success strategist embedded " +
  "inside the ReadyTech CRM. You analyze client/account records and return concise, " +
  "actionable insights for an account manager. Always respond in clean, well-structured " +
  "GitHub-flavored Markdown using headings, bold labels and bullet points. Never invent " +
  "data that is not present; if information is missing, say so and note what to collect next.";

/* =========================================================
   CLIENT INSIGHT TYPES (feature registry)
========================================================= */
export const CLIENT_INSIGHT_TYPES = {
  summary: {
    label: "AI Client Summary",
    maxTokens: 900,
    buildPrompt: (ctx) => `Write a concise executive **summary** of this CRM client account.

Client Data:
${ctx}

Return Markdown with:
- A one-paragraph account overview
- **Key Highlights** (bullet points)
- **Relationship & Subscription Status**
- **Missing Information** worth collecting`,
  },

  analytics: {
    label: "AI Customer Analytics",
    maxTokens: 1100,
    buildPrompt: (ctx) => `Act as a customer success analyst and produce **customer analytics** for this account.

Client Data:
${ctx}

Return Markdown with:
- **Account Health Score**: an integer 0-100 (bold it)
- **Health Tier**: Healthy / At-Risk / Critical
- **Churn Risk**: a percentage
- **Value & Growth Signals** (bullets)
- **Risks / Red Flags** (bullets)
- **Reasoning** (2-3 sentences)`,
  },

  communication: {
    label: "AI Communication Assistance",
    maxTokens: 1100,
    buildPrompt: (ctx) => `Act as an account manager and draft **client communication** assistance.

Client Data:
${ctx}

Return Markdown with:
- **Recommended Tone & Approach**
- **Draft Email** (subject + short body, ready to send)
- **Key Talking Points** (bullets)
- **Do's and Don'ts** for this account`,
  },

  followup: {
    label: "AI Follow-up Suggestions",
    maxTokens: 1000,
    buildPrompt: (ctx) => `Suggest the **next follow-up plan** for this client account.

Client Data:
${ctx}

Return Markdown with:
- **Recommended Next Action**
- **Best Channel & Timing**
- **Draft Follow-up Message** (short, ready to send)
- **Follow-up Cadence** (bulleted timeline)`,
  },

  upsell: {
    label: "AI Upsell / Cross-sell Recommendations",
    maxTokens: 1100,
    buildPrompt: (ctx) => `Identify **upsell and cross-sell** opportunities for this client account.

Client Data:
${ctx}

Return Markdown with:
- **Upsell Opportunities** (bullets with rationale)
- **Cross-sell Opportunities** (bullets with rationale)
- **Recommended Offer / Bundle**
- **Best Timing & Pitch Angle**
- **Expected Value / Impact**`,
  },
};

export const CLIENT_INSIGHT_KEYS = Object.keys(CLIENT_INSIGHT_TYPES);

/* =========================================================
   HIGH-LEVEL: generate a client insight (reusable)
========================================================= */
export const generateClientInsight = async ({ client: clientData, type }) => {
  if (!type || !CLIENT_INSIGHT_TYPES[type]) {
    const err = new Error(
      `Invalid insight type. Allowed: ${CLIENT_INSIGHT_KEYS.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!clientData || typeof clientData !== "object" || Array.isArray(clientData)) {
    const err = new Error("A valid 'client' object is required");
    err.statusCode = 400;
    throw err;
  }

  const name = clientData.companyName || clientData.contactPerson;
  if (!name || !`${name}`.trim()) {
    const err = new Error("Client must include at least a company name or contact person");
    err.statusCode = 400;
    throw err;
  }

  const feature = CLIENT_INSIGHT_TYPES[type];
  const ctx = buildClientContext(clientData);
  const prompt = feature.buildPrompt(ctx);

  const { text, usage, model } = await askClaude(prompt, {
    maxTokens: feature.maxTokens,
    system: CLIENT_SYSTEM_PROMPT,
  });

  return {
    type,
    label: feature.label,
    insight: text,
    usage,
    model,
  };
};

/* =========================================================
   INVENTORY CONTEXT SERIALIZER
   Serializes an array of stock-summary rows into a table.
========================================================= */
const buildInventoryContext = (inventory = []) => {
  if (!Array.isArray(inventory) || inventory.length === 0) {
    return "- No inventory records available.";
  }

  const rows = inventory.map((s, i) => {
    const product = s.product?.name || s.productName || s.product || "Unknown";
    const sku = s.product?.sku || s.sku || "—";
    const warehouse = s.warehouse?.name || s.warehouseName || s.warehouse || "—";
    const available = s.available ?? s.availableQty ?? s.quantity ?? 0;
    const inQty = s.inQty ?? s.totalIn ?? "—";
    const outQty = s.outQty ?? s.totalOut ?? "—";
    const limit = s.lowStockLimit ?? s.product?.lowStockLimit ?? "—";

    return `${i + 1}. Product: ${product} (SKU: ${sku}) | Warehouse: ${warehouse} | Available: ${available} | In: ${inQty} | Out: ${outQty} | Low-Stock Limit: ${limit}`;
  });

  return `Total items: ${inventory.length}\n${rows.join("\n")}`;
};

const INVENTORY_SYSTEM_PROMPT =
  "You are an expert supply-chain and inventory analyst embedded inside the ReadyTech " +
  "ERP. You analyze warehouse stock records and return concise, actionable inventory " +
  "insights for an operations manager. Always respond in clean, well-structured " +
  "GitHub-flavored Markdown using headings, bold labels, tables and bullet points. " +
  "Reference specific products/warehouses by name. Never invent data that is not present; " +
  "if information is missing, say so and note what to collect next.";

/* =========================================================
   INVENTORY INSIGHT TYPES (feature registry)
========================================================= */
export const INVENTORY_INSIGHT_TYPES = {
  insights: {
    label: "AI Inventory Insights",
    maxTokens: 1200,
    buildPrompt: (ctx) => `Provide an executive **inventory overview** for the following stock.

Inventory Data:
${ctx}

Return Markdown with:
- A one-paragraph overall summary
- **Key Metrics** (total products, total available, notable concentrations)
- **Health Assessment** (bullets)
- **Immediate Attention Items** (bullets)`,
  },

  lowstock: {
    label: "AI Low Stock Analysis",
    maxTokens: 1200,
    buildPrompt: (ctx) => `Perform a **low stock analysis** on the following inventory.

Inventory Data:
${ctx}

Return Markdown with:
- **Low Stock Items** (a table: Product | Warehouse | Available | Risk Level)
- **Stockout Risk Ranking** (most urgent first)
- **Business Impact** of each shortage
- **Recommended Immediate Actions** (bullets)`,
  },

  overstock: {
    label: "AI Overstock Analysis",
    maxTokens: 1200,
    buildPrompt: (ctx) => `Perform an **overstock analysis** on the following inventory.

Inventory Data:
${ctx}

Return Markdown with:
- **Overstocked Items** (a table: Product | Warehouse | Available | Concern)
- **Capital / Holding Cost Risk**
- **Slow-Moving Indicators**
- **Recommended Actions** to reduce excess (bullets)`,
  },

  restock: {
    label: "AI Restock Recommendations",
    maxTokens: 1300,
    buildPrompt: (ctx) => `Generate **restock recommendations** for the following inventory.

Inventory Data:
${ctx}

Return Markdown with:
- **Reorder Plan** (a table: Product | Warehouse | Current | Suggested Reorder Qty | Priority)
- **Prioritization Rationale**
- **Suggested Timing / Cadence**
- **Optimization Tips** to balance stock levels (bullets)`,
  },
};

export const INVENTORY_INSIGHT_KEYS = Object.keys(INVENTORY_INSIGHT_TYPES);

/* =========================================================
   HIGH-LEVEL: generate an inventory insight (reusable)
========================================================= */
export const generateInventoryInsight = async ({ inventory, type }) => {
  if (!type || !INVENTORY_INSIGHT_TYPES[type]) {
    const err = new Error(
      `Invalid insight type. Allowed: ${INVENTORY_INSIGHT_KEYS.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(inventory) || inventory.length === 0) {
    const err = new Error("A non-empty 'inventory' array is required");
    err.statusCode = 400;
    throw err;
  }

  const feature = INVENTORY_INSIGHT_TYPES[type];
  const ctx = buildInventoryContext(inventory);
  const prompt = feature.buildPrompt(ctx);

  const { text, usage, model } = await askClaude(prompt, {
    maxTokens: feature.maxTokens,
    system: INVENTORY_SYSTEM_PROMPT,
  });

  return {
    type,
    label: feature.label,
    insight: text,
    usage,
    model,
  };
};
