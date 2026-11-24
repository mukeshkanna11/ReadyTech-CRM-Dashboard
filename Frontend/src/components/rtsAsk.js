/* ======================================================
   RTS AI — answer a non-navigation command
   1. POST /api/rts/command  (rule-based, read-only, no Claude credits)
      handled=true  → use its reply as-is
   2. otherwise POST /api/ai/help (Claude). The server only runs it when
      Claude is enabled for the workspace (requireClaudeAi).
   3. Claude disabled / not configured / failing → a friendly
      "unsupported command" reply instead of an error.
   Cancelled requests re-throw so the widget can drop them silently.
====================================================== */

const CLAUDE_OFF = new Set(["AI_DISABLED", "AI_NOT_CONFIGURED"]);
const TAMIL = /[஀-௿]/;

export const isCanceled = (err, signal) => err?.code === "ERR_CANCELED" || Boolean(signal?.aborted);

/* Claude cannot answer: switched off, no API key, or the Claude call failed
   (e.g. no credits → /ai/help 502). A 503 "busy" stays a retryable error. */
export const isClaudeUnavailable = (err) =>
  CLAUDE_OFF.has(err?.response?.data?.code) || err?.response?.status === 502;

export const unsupportedText = (question) =>
  TAMIL.test(question || "")
    ? "மன்னிக்கவும், இந்தக் கட்டளையை இப்போது செய்ய முடியாது. \"இன்று விற்பனை எவ்வளவு\" அல்லது \"இன்வாய்ஸ் திற\" போல கேளுங்கள்."
    : "Sorry, I can't handle that command right now. Try \"today's sales\", \"how many leads this month\", \"find invoice INV-001\" or \"go to invoices\".";

const list = (v) => (Array.isArray(v) ? v : []);

export async function askRts({ api, question, history, product, page, tzOffset, signal }) {
  let unsupported = "";
  try {
    const { data } = await api.post("/rts/command", { text: question, tzOffset }, { timeout: 30000, silent: true, signal });
    const d = data?.data || {};
    if (d.handled) {
      return { role: "assistant", text: d.text || "Done.", cards: list(d.cards), actions: list(d.actions), ...(d.error ? { error: true } : {}) };
    }
    unsupported = d.text || "";
  } catch (err) {
    if (isCanceled(err, signal)) throw err;
    // Structured endpoint unreachable → still try the AI path below
  }

  try {
    const { data } = await api.post(
      "/ai/help",
      { product, page, tzOffset, messages: history },
      { timeout: 60000, silent: true, signal } // tool lookups can exceed the 15s default
    );
    const d = data?.data || {};
    return { role: "assistant", text: d.text || "Sorry, I have no answer for that.", cards: list(d.cards), actions: list(d.actions) };
  } catch (err) {
    if (isCanceled(err, signal)) throw err;
    if (isClaudeUnavailable(err)) return { role: "assistant", text: unsupported || unsupportedText(question), cards: [], actions: [] };
    return {
      role: "assistant",
      error: true,
      text:
        err?.response?.data?.message ||
        (err?.code === "ECONNABORTED" ? "RTS AI took too long to answer. Please try again." : "RTS AI is unavailable right now. Please try again."),
    };
  }
}
