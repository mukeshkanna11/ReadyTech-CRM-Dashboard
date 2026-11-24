// services/llm/rtsProvider.js
// Provider interface for the RTS Assistant (/api/ai/help only).
//
// Contract: createRtsMessage(params) takes and returns the Anthropic Messages
// shape used by controllers/rtsHelp.controller.js. Each adapter honours it.
//
//   LLM_PROVIDER = "claude" (default, unset) → existing Claude adapter
//   LLM_PROVIDER = "local"                    → OpenAI-compatible local server
//
// Any other value is treated as misconfigured. Local mode NEVER falls back to
// Claude: if the local server is unconfigured or down, the call fails safely.
import { createClaudeMessage } from "../claudeService.js";
import { createLocalMessage, isLocalConfigured } from "./localOpenAiAdapter.js";

export const RTS_PROVIDERS = ["claude", "local"];

export const getRtsProviderName = (env = process.env) => {
  const raw = String(env.LLM_PROVIDER ?? "").trim().toLowerCase();
  return raw || "claude";
};

export const isRtsProviderConfigured = (env = process.env) => {
  const name = getRtsProviderName(env);
  if (name === "claude") return Boolean(env.CLAUDE_API_KEY?.trim());
  if (name === "local") return isLocalConfigured(env);
  return false;
};

const notConfigured = (name) => {
  const err = new Error(`RTS AI provider "${name}" is not available`);
  err.code = "LLM_NOT_CONFIGURED";
  return err;
};

/* Picks the adapter for the current env. Adapters are injectable for tests. */
export const selectRtsProvider = (
  env = process.env,
  adapters = { claude: createClaudeMessage, local: createLocalMessage }
) => {
  const name = getRtsProviderName(env);
  if (!RTS_PROVIDERS.includes(name)) {
    return async () => { throw notConfigured(name); };
  }
  return adapters[name];
};

/* Resolved per call so LLM_PROVIDER is honoured without import-order effects */
export const createRtsMessage = (params) => selectRtsProvider()(params);
