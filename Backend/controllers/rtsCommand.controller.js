// controllers/rtsCommand.controller.js
// RTS structured commands WITHOUT Claude: a rule-based parser
// (services/rtsAssistant/rtsIntent.js) picks one of the existing
// read-only tools in rtsTools.js, which runs inside this login's
// workspace and honours role permissions. Nothing is ever written.
import { runTool } from "../services/rtsAssistant/rtsTools.js";
import { parseIntent, detectLang, formatReply, MESSAGES } from "../services/rtsAssistant/rtsIntent.js";
import { runWithWorkspace } from "../utils/workspaceContext.js";

const MAX_LENGTH = 300;
const READ_TOOLS = new Set(["get_business_data", "find_records"]);

const reply = (res, text, extra = {}) =>
  res.status(200).json({ success: true, data: { role: "assistant", text, cards: [], actions: [], ...extra } });

/* POST /api/rts/command  { text, tzOffset? }
   → { success, data: { role, text, cards, actions, handled, intent } }
   handled=false means "not a structured command" (the client may fall back to /api/ai/help). */
export const makeRtsCommand = (tools = { runTool }) => async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, MAX_LENGTH) : "";
  if (!text) return res.status(400).json({ success: false, message: "A command is required" });

  const lang = detectLang(text);
  const intent = parseIntent(text);
  if (!intent) return reply(res, MESSAGES.unknown[lang], { handled: false, intent: null });
  if (intent.blocked) return reply(res, MESSAGES.blocked[lang], { handled: true, intent: "blocked" });
  if (!READ_TOOLS.has(intent.tool)) return reply(res, MESSAGES.unknown[lang], { handled: false, intent: null });

  // Never fall back to the default workspace: no bound workspace → no data
  const workspace = req.workspace;
  if (!workspace) return res.status(403).json({ success: false, message: "No workspace for this login" });

  const ctx = { role: req.user?.role, tzOffset: Number(req.body?.tzOffset) || 0 };
  let out;
  try {
    out = await runWithWorkspace(workspace, () => tools.runTool(intent.tool, intent.input, ctx));
  } catch (err) {
    console.error("❌ RTS command error:", intent.tool, err.message);
    return reply(res, MESSAGES.failed[lang], { handled: true, intent: intent.tool, error: true });
  }

  return reply(res, formatReply(out.content, lang), {
    handled: true,
    intent: intent.tool,
    input: intent.input,
    cards: out.card ? [out.card] : [],
    actions: out.action ? [out.action] : [],
    ...(out.content?.ok === false ? { error: true } : {}),
  });
};

export const rtsCommand = makeRtsCommand();
