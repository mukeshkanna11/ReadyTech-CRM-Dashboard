// services/llm/localOpenAiAdapter.js
// RTS Assistant adapter for a self-hosted, OpenAI-compatible inference server
// (vLLM, llama.cpp server, Ollama /v1, …) using Node's built-in fetch.
//
// The RTS help loop speaks the Anthropic Messages shape (system, messages with
// text / tool_use / tool_result blocks, tools with input_schema, tool_choice,
// response.content + stop_reason). This adapter converts that shape to
// /chat/completions and back, so the loop itself is provider-agnostic.
//
// Env (read per call):
//   LOCAL_LLM_BASE_URL   e.g. http://10.0.0.5:8000/v1   (required)
//   LOCAL_LLM_MODEL      model name served there        (required)
//   LOCAL_LLM_API_KEY    optional bearer token for the inference server
//   LOCAL_LLM_TIMEOUT_MS optional per-call timeout (default 30000)

const DEFAULT_TIMEOUT_MS = 30000;

const fail = (message, { status, code } = {}) => {
  const err = new Error(message);
  if (status) err.status = status;
  if (code) err.code = code;
  return err;
};

export const localConfig = (env = process.env) => ({
  baseUrl: (env.LOCAL_LLM_BASE_URL || "").trim().replace(/\/+$/, ""),
  model: (env.LOCAL_LLM_MODEL || "").trim(),
  apiKey: (env.LOCAL_LLM_API_KEY || "").trim(),
  timeoutMs: Number(env.LOCAL_LLM_TIMEOUT_MS) > 0 ? Number(env.LOCAL_LLM_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
});

export const isLocalConfigured = (env = process.env) => {
  const { baseUrl, model } = localConfig(env);
  return Boolean(model) && /^https?:\/\/[^\s]+$/i.test(baseUrl);
};

/* ---------- Anthropic-shaped request → OpenAI chat/completions ---------- */
const toToolChoice = (choice) => {
  if (!choice?.type) return undefined;
  if (choice.type === "any") return "required";
  if (choice.type === "auto") return "auto";
  if (choice.type === "none") return "none";
  if (choice.type === "tool" && choice.name) return { type: "function", function: { name: choice.name } };
  return undefined;
};

const resultText = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((b) => b?.type === "text").map((b) => b.text).join("");
  return JSON.stringify(content ?? "");
};

const convertMessage = (m) => {
  if (typeof m.content === "string") return [{ role: m.role, content: m.content }];
  const blocks = Array.isArray(m.content) ? m.content : [];
  const text = blocks.filter((b) => b?.type === "text").map((b) => b.text).join("");

  if (m.role === "assistant") {
    const calls = blocks.filter((b) => b?.type === "tool_use").map((b) => ({
      id: b.id,
      type: "function",
      function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
    }));
    return [{ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) }];
  }

  // user turn: tool results become role "tool" messages (in order), any text after them
  const out = blocks
    .filter((b) => b?.type === "tool_result")
    .map((b) => ({ role: "tool", tool_call_id: b.tool_use_id, content: resultText(b.content) }));
  if (text) out.push({ role: "user", content: text });
  return out;
};

export const toOpenAiRequest = ({ system, messages = [], tools, max_tokens, tool_choice } = {}, model) => {
  const body = {
    model,
    messages: [...(system ? [{ role: "system", content: system }] : []), ...messages.flatMap(convertMessage)],
    ...(max_tokens ? { max_tokens } : {}),
    stream: false,
  };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description || "", parameters: t.input_schema || { type: "object", properties: {} } },
    }));
    const choice = toToolChoice(tool_choice);
    if (choice) body.tool_choice = choice;
  }
  return body;
};

/* ---------- OpenAI chat/completions → Anthropic-shaped response ---------- */
const parseArgs = (raw) => {
  if (raw && typeof raw === "object") return raw;
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {}; // runTool validates every input; bad args become a tool error, never a query
  }
};

let seq = 0;
export const fromOpenAiResponse = (json) => {
  const choice = json?.choices?.[0];
  if (!choice?.message) throw fail("Local LLM returned no message", { status: 502 });
  const msg = choice.message;

  const content = [];
  if (typeof msg.content === "string" && msg.content.trim()) content.push({ type: "text", text: msg.content });
  const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  for (const c of calls) {
    if (!c?.function?.name) continue;
    content.push({
      type: "tool_use",
      id: c.id || `call_local_${Date.now().toString(36)}_${(seq += 1)}`,
      name: c.function.name,
      input: parseArgs(c.function.arguments),
    });
  }

  const hasTools = content.some((b) => b.type === "tool_use");
  const stop_reason = hasTools ? "tool_use" : choice.finish_reason === "length" ? "max_tokens" : "end_turn";
  return { role: "assistant", content, stop_reason, model: json.model, usage: json.usage || {} };
};

/* ---------- Call ---------- */
export const makeLocalMessage = ({ fetchImpl = (...a) => fetch(...a), env = process.env } = {}) => async (params) => {
  if (!isLocalConfigured(env)) {
    throw fail("Local LLM is not configured", { code: "LLM_NOT_CONFIGURED" });
  }
  const { baseUrl, model, apiKey, timeoutMs } = localConfig(env);

  let res;
  try {
    res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(toOpenAiRequest(params, model)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw fail(timedOut ? "Local LLM timed out" : "Local LLM is unreachable", { status: 502, code: "LLM_UNREACHABLE" });
  }

  // 429 / 503 = overloaded → the help loop reports "busy" (retryable)
  if ([429, 503].includes(res.status)) throw fail(`Local LLM busy (HTTP ${res.status})`, { status: 429 });
  if (!res.ok) throw fail(`Local LLM error (HTTP ${res.status})`, { status: 502 });

  let json;
  try {
    json = await res.json();
  } catch {
    throw fail("Local LLM returned invalid JSON", { status: 502 });
  }
  return fromOpenAiResponse(json);
};

export const createLocalMessage = makeLocalMessage();
