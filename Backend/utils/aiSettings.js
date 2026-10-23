// utils/aiSettings.js
import User from "../models/User.js";
import { getWorkspaceId } from "./workspaceContext.js";

/* =========================================================
   WORKSPACE AI PREFERENCES (Admin Settings → AI Settings)
   Stored on the workspace owner. Missing = enabled (pre-existing
   behaviour).
========================================================= */
export const AI_KEYS = ["claude", "suggestions"];

export const getAiSettings = async (workspaceId = getWorkspaceId()) => {
  const settings = { claude: true, suggestions: true };
  if (!workspaceId) return settings;

  const owner = await User.findById(workspaceId).select("aiSettings").lean();
  AI_KEYS.forEach((k) => {
    if (typeof owner?.aiSettings?.[k] === "boolean") settings[k] = owner.aiSettings[k];
  });
  return settings;
};

/* Insight types that produce recommendations / suggestions */
export const SUGGESTION_TYPES = {
  lead: ["recommendations", "followup"],
  client: ["followup", "upsell"],
  inventory: ["restock"],
};

const disabled = (res, code, message) => res.status(403).json({ success: false, code, message });

/* Blocks every Claude call while Claude AI Assistant is OFF */
export const requireClaudeAi = async (req, res, next) => {
  try {
    const { claude } = await getAiSettings(req.workspace);
    if (!claude) {
      return disabled(res, "AI_DISABLED",
        "Claude AI Assistant is disabled for this workspace. An admin can enable it in Settings → AI Settings.");
    }
    if (!process.env.CLAUDE_API_KEY?.trim()) {
      return res.status(503).json({ success: false, code: "AI_NOT_CONFIGURED", message: "Claude API key is not configured on the server." });
    }
    next();
  } catch (error) {
    console.error("AI settings check failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to verify AI settings" });
  }
};

/* Blocks suggestion-type requests while AI Suggestions is OFF.
   kind = key of SUGGESTION_TYPES (uses req.body.type) or true = always a suggestion */
export const requireAiSuggestions = (kind) => async (req, res, next) => {
  try {
    const isSuggestion = kind === true || SUGGESTION_TYPES[kind]?.includes(req.body?.type);
    if (!isSuggestion) return next();
    const { suggestions } = await getAiSettings(req.workspace);
    if (!suggestions) {
      return disabled(res, "AI_SUGGESTIONS_DISABLED",
        "AI Suggestions are disabled for this workspace. An admin can enable them in Settings → AI Settings.");
    }
    next();
  } catch (error) {
    console.error("AI settings check failed:", error.message);
    res.status(500).json({ success: false, message: "Failed to verify AI settings" });
  }
};
