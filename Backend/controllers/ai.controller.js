// controllers/ai.controller.js
import {
  generateLeadInsight,
  LEAD_INSIGHT_KEYS,
  generateClientInsight,
  CLIENT_INSIGHT_KEYS,
  generateInventoryInsight,
  INVENTORY_INSIGHT_KEYS,
} from "../services/claudeService.js";

/* =========================================================
   POST /api/ai/lead-insight
   Body: { type: string, lead: object }
   Generates a Claude-powered insight for a single lead.
========================================================= */
export const leadInsight = async (req, res) => {
  try {
    const { type, lead } = req.body || {};

    /* -------- Validation -------- */
    if (!type) {
      return res.status(400).json({
        success: false,
        message: `'type' is required. Allowed: ${LEAD_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!LEAD_INSIGHT_KEYS.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid 'type'. Allowed: ${LEAD_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
      return res.status(400).json({
        success: false,
        message: "A valid 'lead' object is required",
      });
    }

    if (!lead.name || !`${lead.name}`.trim()) {
      return res.status(400).json({
        success: false,
        message: "Lead must include at least a name",
      });
    }

    /* -------- Generate -------- */
    const result = await generateLeadInsight({ lead, type });

    return res.status(200).json({
      success: true,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Lead Insight Error:", error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Failed to generate AI insight. Please try again."
          : error.message,
    });
  }
};

/* =========================================================
   POST /api/ai/client-insight
   Body: { type: string, client: object }
   Generates a Claude-powered insight for a single client.
========================================================= */
export const clientInsight = async (req, res) => {
  try {
    const { type, client } = req.body || {};

    /* -------- Validation -------- */
    if (!type) {
      return res.status(400).json({
        success: false,
        message: `'type' is required. Allowed: ${CLIENT_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!CLIENT_INSIGHT_KEYS.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid 'type'. Allowed: ${CLIENT_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!client || typeof client !== "object" || Array.isArray(client)) {
      return res.status(400).json({
        success: false,
        message: "A valid 'client' object is required",
      });
    }

    if (!client.companyName && !client.contactPerson) {
      return res.status(400).json({
        success: false,
        message: "Client must include at least a company name or contact person",
      });
    }

    /* -------- Generate -------- */
    const result = await generateClientInsight({ client, type });

    return res.status(200).json({
      success: true,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Client Insight Error:", error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Failed to generate AI insight. Please try again."
          : error.message,
    });
  }
};

/* =========================================================
   POST /api/ai/inventory-insight
   Body: { type: string, inventory: object[] }
   Generates a Claude-powered insight for the inventory list.
========================================================= */
export const inventoryInsight = async (req, res) => {
  try {
    const { type, inventory } = req.body || {};

    /* -------- Validation -------- */
    if (!type) {
      return res.status(400).json({
        success: false,
        message: `'type' is required. Allowed: ${INVENTORY_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!INVENTORY_INSIGHT_KEYS.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid 'type'. Allowed: ${INVENTORY_INSIGHT_KEYS.join(", ")}`,
      });
    }

    if (!Array.isArray(inventory) || inventory.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A non-empty 'inventory' array is required",
      });
    }

    /* -------- Generate -------- */
    const result = await generateInventoryInsight({ inventory, type });

    return res.status(200).json({
      success: true,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Inventory Insight Error:", error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message:
        status === 500
          ? "Failed to generate AI insight. Please try again."
          : error.message,
    });
  }
};
