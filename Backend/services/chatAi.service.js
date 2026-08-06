// services/chatAi.service.js
//
// Token-efficient chat-support pipeline:
//
//   user message
//     -> duplicate guard            (0 tokens)
//     -> FAQ / rule-based match     (0 tokens)
//     -> ONE Claude call            (reply + intent + priority + lead score)
//     -> static fallback on failure (0 tokens)
//
// Claude never receives the full transcript. It receives, at most:
//   * a frozen business-context system prompt
//   * a <=60-word rolling summary
//   * the last 2 exchanges, truncated
//   * the current message
//
// Everything Claude returns comes back in one structured-output call, so intent
// detection, priority detection, lead qualification and the reply do not cost
// four separate round trips.

import ChatConversation, {
  CHAT_INTENTS,
  CHAT_PRIORITIES,
} from "../models/ChatConversation.js";
import { askClaudeStructured } from "./claudeService.js";

/* =========================================================
   MODEL / TOKEN CONFIGURATION
   All overridable via env so cost can be tuned without a deploy.
========================================================= */
export const CHAT_AI_CONFIG = {
  // Haiku 4.5 is the cheapest current model ($1 / $5 per MTok) and is more than
  // sufficient for support replies. Override with CHAT_CLAUDE_MODEL.
  model: process.env.CHAT_CLAUDE_MODEL || "claude-haiku-4-5",

  // Deliberately small: support answers should be short, and max_tokens is a
  // hard cost ceiling per call.
  replyMaxTokens: Number(process.env.CHAT_REPLY_MAX_TOKENS || 500),
  summaryMaxTokens: Number(process.env.CHAT_SUMMARY_MAX_TOKENS || 200),

  // How much conversation context is sent. Never the whole history.
  recentTurns: Number(process.env.CHAT_RECENT_TURNS || 2),
  maxCharsPerTurn: 240,
  maxMessageChars: 1000,

  // Summary is refreshed only every N stored messages.
  summaryEveryNMessages: Number(process.env.CHAT_SUMMARY_EVERY || 6),

  // A resent identical message inside this window reuses the previous reply.
  dedupeWindowMs: Number(process.env.CHAT_DEDUPE_WINDOW_MS || 45_000),

  // Above this length a message is treated as multi-intent and skips keyword
  // FAQ matching — a single keyword shouldn't hijack a detailed question.
  faqMaxChars: Number(process.env.CHAT_FAQ_MAX_CHARS || 140),
};

/* =========================================================
   BUSINESS CONTEXT (frozen system prompt)

   Deliberately contains no dates, IDs or counters: a stable prefix is the
   precondition for prompt caching. NOTE: caching only engages once the prefix
   exceeds the model's minimum (4096 tokens on Haiku 4.5, 512 on Opus 5), and
   this prompt is far below that — so no cache_control marker is set here. It
   would be inert and would still charge the cache-write premium.
========================================================= */
const SYSTEM_PROMPT = [
  "You are the ReadyTech Solutions support assistant on the company website.",
  "",
  "ReadyTech Solutions sells and supports a CRM & ERP platform (Growth Suite):",
  "leads, clients, opportunities, invoicing with Indian GST, products,",
  "inventory, warehouses, users and role-based access. The company also does",
  "custom development, website and mobile app development, and digital marketing.",
  "",
  "Rules:",
  "- Answer in at most 3 short sentences. No preamble, no markdown headings.",
  "- Only state facts about ReadyTech given above or by the customer. Never",
  "  invent pricing, timelines, discounts, features or contractual terms.",
  "- If you do not know, say so and offer to connect a human from the team.",
  "- For pricing, custom scope or contract quest, collect the requirement and",
  "  offer a callback rather than quoting a number.",
].join("\n");

/* =========================================================
   RULE-BASED FAQ TABLE

   A hit here returns instantly and costs zero Claude tokens. Ordered — the
   first match wins, so put narrow patterns above broad ones.
========================================================= */
export const FAQS = [
  {
    id: "greeting",
    match: /^(hi|hey|hello|hii+|good (morning|afternoon|evening))\b[\s!.]*$/i,
    exact: true,
    answer:
      "Hi! You're chatting with the ReadyTech Solutions assistant. Ask me about our CRM & ERP platform, a demo, pricing or support — how can I help?",
  },
  {
    id: "thanks",
    match: /^(thanks|thank you|thx|ty|great|perfect|ok|okay)\b[\s!.]*$/i,
    exact: true,
    answer: "Happy to help! Anything else you'd like to know?",
  },
  {
    id: "demo",
    match: /\b(demo|trial|free trial|walkthrough|see it in action)\b/i,
    intent: "Demo Request",
    answer:
      "We'd be glad to arrange a demo. Share your name, email and preferred time and our team will schedule a 30-minute walkthrough of the CRM & ERP suite.",
  },
  {
    id: "pricing",
    match: /\b(pric|cost|quote|quotation|how much|rate|fees|budget|plan)\w*\b/i,
    intent: "Sales Enquiry",
    answer:
      "Pricing depends on the modules and user count you need, so we quote per requirement. Tell me your team size and the modules you're interested in, and our sales team will send a written quote.",
  },
  {
    id: "gst_invoice",
    match: /\b(gst|gstin|hsn|tax invoice|e-?invoic|cgst|sgst|igst)\w*\b/i,
    intent: "Support Issue",
    answer:
      "Yes — invoicing is GST-compliant: GSTIN on buyer and seller, HSN/SAC per line, and automatic CGST/SGST for intra-state or IGST for inter-state billing. Which part would you like help with?",
  },
  {
    id: "login",
    match: /\b(can'?t log ?in|cannot log ?in|forgot password|reset password|locked out|login (issue|problem|error))\b/i,
    intent: "Support Issue",
    priority: "High",
    answer:
      "Sorry about that. Admin access is managed by your organisation's super admin — ask them to reset it from User & Access Management. If you're the admin and still locked out, share your registered email and we'll help you recover it.",
  },
  {
    id: "support_hours",
    match: /\b(support hours|working hours|office hours|when are you (open|available)|timing)\b/i,
    answer:
      "Our support team is available Monday to Saturday, 9:30 AM to 6:30 PM IST. Leave your question here any time and we'll follow up by email.",
  },
  {
    id: "contact",
    match: /\b(contact|phone number|email address|reach you|call you|whatsapp)\b/i,
    answer:
      "You can reach us at quries.readytechsolutions@gmail.com or +91 70107 97721. Prefer a callback? Leave your number and a good time.",
  },
  {
    id: "modules",
    match: /\b(what (do you|does it) (do|offer)|features|modules|capabilit|what is included)\w*\b/i,
    answer:
      "The platform covers CRM (leads, clients, opportunities, activities) and ERP (products, inventory, warehouses, GST invoicing), plus user and role management. Which area matters most to you?",
  },
  {
    id: "mobile_app",
    match: /\b(mobile app|android|ios|app version|on my phone)\b/i,
    answer:
      "Yes — there's a companion mobile app for Android and iOS covering the dashboard, clients, leads, products, invoices and users. Want a demo of it?",
  },
  {
    id: "human",
    match: /\b(human|real person|agent|talk to (someone|somebody)|speak to (someone|somebody))\b/i,
    priority: "High",
    answer:
      "Of course — I'll pass this to our team. Share your name and email (or phone) and someone will get back to you shortly.",
  },
];

/* =========================================================
   STRUCTURED OUTPUT SCHEMA (one call, four answers)
========================================================= */
const REPLY_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "The customer-facing answer. At most 3 short sentences.",
    },
    intent: {
      type: "string",
      enum: CHAT_INTENTS,
      description:
        "Sales Enquiry = evaluating or wants to buy. Demo Request = asking to see the product. Support Issue = something is broken or they need help using it. Complaint = dissatisfied with the product or the service they have received, including being ignored or an unresolved issue. Complaint wins over Support Issue when the customer expresses frustration. General Enquiry only when none of the others fit.",
    },
    priority: { type: "string", enum: CHAT_PRIORITIES },
    lead_qualified: {
      type: "boolean",
      description: "True only if this looks like a genuine buying enquiry.",
    },
    lead_score: {
      type: "integer",
      description: "Buying-intent score from 0 to 100.",
    },
    lead_reason: {
      type: "string",
      description: "One short sentence explaining the score.",
    },
  },
  required: [
    "reply",
    "intent",
    "priority",
    "lead_qualified",
    "lead_score",
    "lead_reason",
  ],
  additionalProperties: false,
};

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "Third-person summary of the conversation in at most 60 words. Keep the customer's requirement, product interest and any contact details.",
    },
  },
  required: ["summary"],
  additionalProperties: false,
};

/* =========================================================
   HELPERS
========================================================= */
const clamp = (text, max) =>
  !text ? "" : text.length <= max ? text : `${text.slice(0, max)}…`;

const normalize = (text) => (text || "").trim().replace(/\s+/g, " ");

/**
 * A canned answer is only safe for a short, single-intent message. A long or
 * multi-question message that merely *contains* a keyword ("...track stock
 * across 3 warehouses and issue GST invoices to our Kerala customers?") needs a
 * real answer, so keyword FAQs are skipped and it goes to Claude.
 *
 * Anchored patterns (greeting/thanks, `exact: true`) are always allowed — they
 * match the whole string, so they cannot over-trigger.
 */
const isMultiIntent = (clean) =>
  clean.length > CHAT_AI_CONFIG.faqMaxChars ||
  (clean.match(/[?]/g) || []).length > 1 ||
  /\b(and also|as well as)\b/i.test(clean);

export const matchFaq = (text) => {
  const clean = normalize(text);
  if (!clean) return null;

  const complex = isMultiIntent(clean);

  return (
    FAQS.find((faq) => (complex ? faq.exact : true) && faq.match.test(clean)) ||
    null
  );
};

/**
 * Rule-based intent, used when a FAQ answers the message so no Claude call
 * happens. Falls back to the conversation's existing intent.
 */
const ruleIntent = (text, current) => {
  const faq = matchFaq(text);
  if (faq?.intent) return faq.intent;

  const clean = (text || "").toLowerCase();
  if (/\b(refund|angry|unacceptable|worst|complain|escalat)\w*\b/.test(clean))
    return "Complaint";
  if (/\b(error|bug|not working|broken|issue|fail)\w*\b/.test(clean))
    return "Support Issue";
  if (/\b(buy|purchase|pricing|quote|subscribe)\w*\b/.test(clean))
    return "Sales Enquiry";
  return current || "General Enquiry";
};

/** Adds one call's token usage onto the conversation's running totals. */
const recordUsage = (conversation, usage, model) => {
  const u = conversation.usage;
  u.claudeCalls += 1;
  u.inputTokens += Number(usage?.input_tokens || 0);
  u.outputTokens += Number(usage?.output_tokens || 0);
  u.cacheReadInputTokens += Number(usage?.cache_read_input_tokens || 0);
  u.cacheCreationInputTokens += Number(usage?.cache_creation_input_tokens || 0);
  if (model) u.lastModel = model;

  console.log(
    `[chat-ai] session=${conversation.sessionId} model=${model} ` +
      `in=${usage?.input_tokens ?? 0} out=${usage?.output_tokens ?? 0} ` +
      `cacheRead=${usage?.cache_read_input_tokens ?? 0} ` +
      `calls=${u.claudeCalls} faqHits=${u.faqHits}`
  );
};

/**
 * The compact context sent to Claude. This function is the whole token budget:
 * summary + last N truncated turns + the current message. Nothing else.
 */
const buildPrompt = (conversation, userText) => {
  const parts = [];

  if (conversation.summary) {
    parts.push(`CONVERSATION_SO_FAR: ${conversation.summary}`);
  }

  const recent = conversation.messages
    .slice(-(CHAT_AI_CONFIG.recentTurns * 2))
    .map(
      (m) =>
        `${m.role === "user" ? "Customer" : "Assistant"}: ${clamp(
          m.text,
          CHAT_AI_CONFIG.maxCharsPerTurn
        )}`
    );

  if (recent.length) parts.push(`RECENT_TURNS:\n${recent.join("\n")}`);

  parts.push(
    `CUSTOMER_MESSAGE: ${clamp(userText, CHAT_AI_CONFIG.maxMessageChars)}`
  );

  parts.push(
    "Reply to CUSTOMER_MESSAGE, and classify the conversation. Return JSON only."
  );

  return parts.join("\n\n");
};

/* =========================================================
   SUMMARY GENERATION
   One small call, only every N messages, and never on the hot path for the
   first few turns.
========================================================= */
const maybeUpdateSummary = async (conversation) => {
  const total = conversation.messages.length;
  const due =
    total >= CHAT_AI_CONFIG.summaryEveryNMessages &&
    total - conversation.summarizedUpTo >= CHAT_AI_CONFIG.summaryEveryNMessages;

  if (!due) return;

  const transcript = conversation.messages
    .slice(-(CHAT_AI_CONFIG.summaryEveryNMessages * 2))
    .map(
      (m) =>
        `${m.role === "user" ? "Customer" : "Assistant"}: ${clamp(m.text, 200)}`
    )
    .join("\n");

  try {
    const { data, usage, model } = await askClaudeStructured(
      [
        conversation.summary
          ? `PREVIOUS_SUMMARY: ${conversation.summary}`
          : null,
        `NEW_MESSAGES:\n${transcript}`,
        "Merge these into one updated summary of at most 60 words. Return JSON only.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      SUMMARY_SCHEMA,
      {
        model: CHAT_AI_CONFIG.model,
        maxTokens: CHAT_AI_CONFIG.summaryMaxTokens,
        system:
          "You compress customer-support conversations into a short factual summary. No preamble.",
      }
    );

    conversation.summary = clamp(data.summary || "", 1200);
    conversation.summaryUpdatedAt = new Date();
    conversation.summarizedUpTo = total;
    recordUsage(conversation, usage, model);
  } catch (error) {
    // A failed summary must never break the chat — the next turn retries.
    console.error("[chat-ai] summary failed:", error.message);
  }
};

/* =========================================================
   PUBLIC: get or create a conversation
========================================================= */
export const getOrCreateConversation = async (sessionId, visitor = {}) => {
  if (!sessionId || !sessionId.trim()) {
    const err = new Error("sessionId is required");
    err.statusCode = 400;
    throw err;
  }

  let conversation = await ChatConversation.findOne({
    sessionId: sessionId.trim(),
    isDeleted: false,
  });

  if (!conversation) {
    conversation = await ChatConversation.create({
      sessionId: sessionId.trim(),
      visitor: {
        name: visitor.name?.trim() || "",
        email: visitor.email?.trim()?.toLowerCase() || "",
        phone: visitor.phone?.trim() || "",
      },
    });
  }

  return conversation;
};

/* =========================================================
   PUBLIC: handle one customer message
========================================================= */
export const handleUserMessage = async ({ sessionId, message, visitor }) => {
  const text = normalize(message);

  if (!text) {
    const err = new Error("Message is required");
    err.statusCode = 400;
    throw err;
  }

  if (text.length > CHAT_AI_CONFIG.maxMessageChars * 4) {
    const err = new Error("Message is too long");
    err.statusCode = 400;
    throw err;
  }

  const conversation = await getOrCreateConversation(sessionId, visitor);

  // Late-arriving contact details (visitor typed them mid-conversation).
  if (visitor?.name && !conversation.visitor.name)
    conversation.visitor.name = visitor.name.trim();
  if (visitor?.email && !conversation.visitor.email)
    conversation.visitor.email = visitor.email.trim().toLowerCase();
  if (visitor?.phone && !conversation.visitor.phone)
    conversation.visitor.phone = visitor.phone.trim();

  /* ---------- 1. Duplicate guard: avoid a repeat AI call ---------- */
  const isDuplicate =
    conversation.lastUserMessage &&
    conversation.lastUserMessage === text &&
    conversation.lastUserMessageAt &&
    Date.now() - conversation.lastUserMessageAt.getTime() <
      CHAT_AI_CONFIG.dedupeWindowMs &&
    conversation.lastAssistantMessage;

  if (isDuplicate) {
    conversation.usage.dedupeHits += 1;
    await conversation.save();

    return {
      conversation,
      reply: conversation.lastAssistantMessage,
      source: "duplicate",
      aiUsed: false,
    };
  }

  conversation.messages.push({ role: "user", text, source: "user" });
  conversation.lastUserMessage = text;
  conversation.lastUserMessageAt = new Date();

  /* ---------- 2. FAQ / rule-based: zero tokens ---------- */
  const faq = matchFaq(text);

  if (faq) {
    conversation.usage.faqHits += 1;
    conversation.intent = ruleIntent(text, conversation.intent);
    if (faq.priority) conversation.priority = faq.priority;

    conversation.messages.push({
      role: "assistant",
      text: faq.answer,
      source: "faq",
      faqId: faq.id,
    });
    conversation.lastAssistantMessage = faq.answer;

    await conversation.save();

    return {
      conversation,
      reply: faq.answer,
      source: "faq",
      faqId: faq.id,
      aiUsed: false,
    };
  }

  /* ---------- 3. One Claude call: reply + intent + priority + lead ---------- */
  try {
    const { data, usage, model } = await askClaudeStructured(
      buildPrompt(conversation, text),
      REPLY_SCHEMA,
      {
        model: CHAT_AI_CONFIG.model,
        maxTokens: CHAT_AI_CONFIG.replyMaxTokens,
        system: SYSTEM_PROMPT,
      }
    );

    const reply =
      normalize(data.reply) ||
      "Thanks for the details — let me get someone from the team to confirm.";

    if (CHAT_INTENTS.includes(data.intent)) conversation.intent = data.intent;
    if (CHAT_PRIORITIES.includes(data.priority))
      conversation.priority = data.priority;

    conversation.leadQualified = Boolean(data.lead_qualified);
    conversation.leadScore = Math.max(
      0,
      Math.min(100, Number(data.lead_score) || 0)
    );
    conversation.leadReason = clamp(data.lead_reason || "", 500);
    conversation.suggestedReply = clamp(reply, 2000);

    conversation.messages.push({
      role: "assistant",
      text: reply,
      source: "claude",
    });
    conversation.lastAssistantMessage = reply;

    recordUsage(conversation, usage, model);

    await maybeUpdateSummary(conversation);
    await conversation.save();

    return { conversation, reply, source: "claude", aiUsed: true };
  } catch (error) {
    /* ---------- 4. Fallback: never leave the widget hanging ---------- */
    console.error("[chat-ai] claude call failed:", error.message);

    const fallback =
      "I'm not able to answer that automatically right now. Leave your email or phone and our team will get back to you shortly.";

    conversation.usage.fallbacks += 1;
    conversation.intent = ruleIntent(text, conversation.intent);
    conversation.messages.push({
      role: "assistant",
      text: fallback,
      source: "fallback",
    });
    conversation.lastAssistantMessage = fallback;

    await conversation.save();

    return {
      conversation,
      reply: fallback,
      source: "fallback",
      aiUsed: false,
      degraded: true,
    };
  }
};

/* =========================================================
   PUBLIC: history / admin reads
========================================================= */
export const getConversation = async (sessionId) => {
  const conversation = await ChatConversation.findOne({
    sessionId,
    isDeleted: false,
  }).lean();

  if (!conversation) {
    const err = new Error("Conversation not found");
    err.statusCode = 404;
    throw err;
  }

  return conversation;
};

export const listConversations = async (filters = {}) => {
  const query = { isDeleted: false };

  if (filters.intent) query.intent = filters.intent;
  if (filters.status) query.status = filters.status;
  if (filters.leadQualified !== undefined)
    query.leadQualified = filters.leadQualified === "true";

  if (filters.search) {
    query.$or = [
      { "visitor.name": { $regex: filters.search, $options: "i" } },
      { "visitor.email": { $regex: filters.search, $options: "i" } },
      { summary: { $regex: filters.search, $options: "i" } },
    ];
  }

  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;

  const total = await ChatConversation.countDocuments(query);

  const data = await ChatConversation.find(query)
    .select("-messages")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return { total, page, pages: Math.ceil(total / limit), data };
};

/** Clears the transcript but keeps the session row for analytics. */
export const clearConversation = async (sessionId) => {
  const conversation = await ChatConversation.findOneAndUpdate(
    { sessionId, isDeleted: false },
    {
      messages: [],
      summary: "",
      summarizedUpTo: 0,
      summaryUpdatedAt: null,
      suggestedReply: "",
      lastUserMessage: "",
      lastAssistantMessage: "",
      lastUserMessageAt: null,
    },
    { new: true }
  );

  if (!conversation) {
    const err = new Error("Conversation not found");
    err.statusCode = 404;
    throw err;
  }

  return conversation;
};
