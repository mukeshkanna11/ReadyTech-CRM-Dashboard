import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  leadInsight,
  clientInsight,
  inventoryInsight,
} from "../controllers/ai.controller.js";

const router = express.Router();

/* ==========================================
   LEAD MANAGEMENT — AI INSIGHTS
   POST /api/ai/lead-insight  { type, lead }
   Types: summary | recommendations | quality
          | followup | sentiment
========================================== */
router.post("/lead-insight", leadInsight);

/* ==========================================
   CLIENT MANAGEMENT — AI INSIGHTS
   POST /api/ai/client-insight  { type, client }
   Types: summary | analytics | communication
          | followup | upsell
========================================== */
router.post("/client-insight", clientInsight);

/* ==========================================
   INVENTORY — AI INSIGHTS
   POST /api/ai/inventory-insight  { type, inventory }
   Types: insights | lowstock | overstock | restock
========================================== */
router.post("/inventory-insight", inventoryInsight);

/* ==========================================
   HEALTH CHECK
========================================== */

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Claude AI",
    configured: !!process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    timestamp: new Date().toISOString(),
  });
});

/* ==========================================
   GENERAL CHAT
========================================== */

router.post("/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    if (!process.env.CLAUDE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Claude API Key not configured",
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY.trim(),
    });

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      answer: response.content?.[0]?.text || "",
      usage: response.usage || {},
    });
  } catch (error) {
    console.error("❌ Claude Chat Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ==========================================
   CRM LEAD ANALYSIS
========================================== */

router.post("/analyze-lead", async (req, res) => {
  try {
    const { lead } = req.body;

    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY.trim(),
    });

    const prompt = `
Analyze this CRM Lead.

Lead Data:
${JSON.stringify(lead, null, 2)}

Provide:

1. Lead Score (0-100)
2. Lead Quality
3. Conversion Probability
4. Recommended Next Action
5. Follow-up Strategy
6. Sales Insights
`;

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.json({
      success: true,
      analysis: response.content?.[0]?.text || "",
    });
  } catch (error) {
    console.error("❌ Lead Analysis Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* ==========================================
   ERP INVENTORY ANALYSIS
========================================== */

router.post("/inventory-analysis", async (req, res) => {
  try {
    const { inventory } = req.body;

    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY.trim(),
    });

    const prompt = `
Analyze the following inventory.

Inventory Data:
${JSON.stringify(inventory, null, 2)}

Provide:

1. Low Stock Items
2. Overstock Items
3. Reorder Recommendations
4. Inventory Risks
5. Business Insights
6. Cost Optimization Suggestions
`;

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return res.json({
      success: true,
      analysis: response.content?.[0]?.text || "",
    });
  } catch (error) {
    console.error("❌ Inventory Analysis Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;