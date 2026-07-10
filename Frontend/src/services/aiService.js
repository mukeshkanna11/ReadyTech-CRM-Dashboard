// services/aiService.js
import API from "./api";

/* ======================================================
   LEAD MANAGEMENT — AI FEATURE REGISTRY
   (keeps UI + backend types in one source of truth)
====================================================== */
export const LEAD_AI_FEATURES = [
  {
    type: "summary",
    label: "Lead Summary",
    description: "Executive overview of this lead",
    icon: "FileText",
  },
  {
    type: "recommendations",
    label: "Sales Recommendations",
    description: "How to move this deal forward",
    icon: "Target",
  },
  {
    type: "quality",
    label: "Lead Quality",
    description: "Score, tier & conversion odds",
    icon: "Gauge",
  },
  {
    type: "followup",
    label: "Next Follow-up",
    description: "Best next action & message",
    icon: "CalendarClock",
  },
  {
    type: "sentiment",
    label: "Sentiment",
    description: "Customer mood & engagement",
    icon: "Smile",
  },
];

/* ======================================================
   CALL: generate a single AI insight for a lead
====================================================== */
export async function getLeadInsight(type, lead) {
  const res = await API.post("/ai/lead-insight", { type, lead });
  return res.data; // { success, type, label, insight, model, generatedAt }
}

/* ======================================================
   CLIENT MANAGEMENT — AI FEATURE REGISTRY
====================================================== */
export const CLIENT_AI_FEATURES = [
  {
    type: "summary",
    label: "Client Summary",
    description: "Executive overview of this account",
    icon: "FileText",
  },
  {
    type: "analytics",
    label: "Customer Analytics",
    description: "Health score, churn risk & signals",
    icon: "Gauge",
  },
  {
    type: "communication",
    label: "Communication",
    description: "Draft outreach & talking points",
    icon: "MessageSquare",
  },
  {
    type: "followup",
    label: "Next Follow-up",
    description: "Best next action & message",
    icon: "CalendarClock",
  },
  {
    type: "upsell",
    label: "Upsell / Cross-sell",
    description: "Growth & expansion opportunities",
    icon: "TrendingUp",
  },
];

/* ======================================================
   CALL: generate a single AI insight for a client
====================================================== */
export async function getClientInsight(type, client) {
  const res = await API.post("/ai/client-insight", { type, client });
  return res.data; // { success, type, label, insight, model, generatedAt }
}

/* ======================================================
   INVENTORY — AI FEATURE REGISTRY
====================================================== */
export const INVENTORY_AI_FEATURES = [
  {
    type: "insights",
    label: "Inventory Insights",
    description: "Overall stock health overview",
    icon: "BarChart3",
  },
  {
    type: "lowstock",
    label: "Low Stock Analysis",
    description: "Stockout risks & urgent items",
    icon: "AlertTriangle",
  },
  {
    type: "overstock",
    label: "Overstock Analysis",
    description: "Excess stock & holding cost",
    icon: "Layers",
  },
  {
    type: "restock",
    label: "Restock Recommendations",
    description: "Reorder plan & priorities",
    icon: "PackagePlus",
  },
];

/* ======================================================
   CALL: generate an AI insight for the inventory list
====================================================== */
export async function getInventoryInsight(type, inventory) {
  const res = await API.post("/ai/inventory-insight", { type, inventory });
  return res.data; // { success, type, label, insight, model, generatedAt }
}
