import Lead from "../../models/Lead.js";
import User from "../../models/User.js";

/* =========================================================
   INSTAGRAM DM -> CRM LEAD
   Reads the Instagram messaging webhook and creates/updates
   a Lead using the EXISTING Lead model. Owner resolution
   mirrors createPublicLead (first active admin).
   De-duplication key: Instagram sender ID (IGSID).
========================================================= */

const MESSAGE_LOG_LIMIT = 4000;

/* ================= FIELD EXTRACTION ================= */

/* Words that follow "I am" / "I'm" but are never a name */
const NOT_A_NAME = new Set([
  "interested",
  "looking",
  "trying",
  "from",
  "here",
  "unable",
  "having",
  "not",
  "a",
  "an",
  "the",
  "in",
  "at",
  "your",
  "just",
  "still",
  "also",
  "asking",
  "enquiring",
  "waiting",
]);

/* "My name is Mukesh." -> Mukesh   (stops at punctuation, max 4 words) */
const NAME_PATTERNS = [
  /\bmy\s+name\s+is\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i,
  /\bname\s*[:\-]\s*([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i,
  /\bthis\s+is\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i,
  /\bi\s+am\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i,
  /\bi'?m\s+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,3})/i,
];

export const extractName = (text) => {
  for (const pattern of NAME_PATTERNS) {
    const candidate = text.match(pattern)?.[1]?.trim();

    if (!candidate) continue;

    const words = candidate.split(/\s+/);

    if (NOT_A_NAME.has(words[0].toLowerCase())) continue;

    // Drop trailing filler ("Mukesh and my phone" -> "Mukesh")
    const cleaned = [];
    for (const word of words) {
      if (NOT_A_NAME.has(word.toLowerCase()) || /^(and|my)$/i.test(word)) break;
      cleaned.push(word);
    }

    if (cleaned.length) return cleaned.join(" ");
  }

  return null;
};

/* 10-digit Indian mobile, with or without +91 / 0 and separators */
export const extractPhone = (text) => {
  const candidates = text.match(/\+?\d[\d\s\-().]{7,}\d/g) || [];

  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, "");

    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

    if (/^[6-9]\d{9}$/.test(digits)) return digits;
    if (digits.length >= 10 && digits.length <= 15) return digits;
  }

  return null;
};

export const extractEmail = (text) =>
  text.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0]?.toLowerCase() || null;

export const parseEnquiry = (text) => {
  const clean = String(text || "").trim();

  return {
    text: clean,
    name: extractName(clean),
    phone: extractPhone(clean),
    email: extractEmail(clean),
  };
};

/* ================= WEBHOOK PAYLOAD ================= */

/* Inbound text DMs only — echoes, reactions, reads and
   deliveries must never create a Lead. */
export const extractMessagingEvents = (payload) => {
  if (payload?.object !== "instagram") return [];

  const events = [];

  for (const entry of payload.entry || []) {
    for (const messaging of entry.messaging || []) {
      const message = messaging.message;

      if (!message?.text) continue;
      if (message.is_echo || message.is_deleted) continue;
      if (!messaging.sender?.id) continue;

      events.push({
        senderId: String(messaging.sender.id),
        text: message.text,
        sentAt: messaging.timestamp ? new Date(Number(messaging.timestamp)) : null,
      });
    }
  }

  return events;
};

/* ================= LEAD UPSERT ================= */

const fallbackName = (senderId) =>
  `Instagram user ${String(senderId).slice(-4)}`;

const isPlaceholderName = (name) => /^instagram user/i.test(String(name || ""));

const appendMessage = (previous, text) => {
  const combined = previous ? `${previous}\n${text}` : text;

  return combined.length > MESSAGE_LOG_LIMIT
    ? combined.slice(-MESSAGE_LOG_LIMIT)
    : combined;
};

/* Same default-owner rule as createPublicLead */
const resolveDefaultOwner = () =>
  User.findOne({ role: "admin", isActive: true }).select("_id name");

export const upsertLeadFromInstagram = async ({ senderId, text, sentAt }) => {
  const parsed = parseEnquiry(text);

  if (!senderId || !parsed.text) return { skipped: true };

  const contactedAt = sentAt || new Date();

  /* Existing DM thread — enrich, never duplicate */
  const existing = await Lead.findOne({ instagramSenderId: senderId });

  if (existing) {
    if (parsed.name && isPlaceholderName(existing.name)) {
      existing.name = parsed.name;
    }
    if (parsed.phone && !existing.phone) existing.phone = parsed.phone;
    if (parsed.email && !existing.email) existing.email = parsed.email;
    if (!existing.requirement) existing.requirement = parsed.text;

    existing.message = appendMessage(existing.message, parsed.text);
    existing.lastContactedAt = contactedAt;

    await existing.save();

    return { leadId: existing._id, created: false };
  }

  const owner = await resolveDefaultOwner();

  if (!owner) throw new Error("No active lead owner found");

  const lead = await Lead.create({
    name: parsed.name || fallbackName(senderId),
    email: parsed.email || "",
    phone: parsed.phone || "",
    source: "Instagram",
    requirement: parsed.text,
    message: parsed.text,
    status: "New",
    statusHistory: [
      { status: "New", changedBy: owner._id, changedAt: new Date() },
    ],
    priority: "Medium",
    department: "Sales",
    owner: owner._id,
    assignedTo: owner.name || "",
    instagramSenderId: senderId,
    lastContactedAt: contactedAt,
  });

  return { leadId: lead._id, created: true };
};

/* ================= ENTRY POINT ================= */
export const processWebhookPayload = async (payload) => {
  const result = { messages: 0, created: 0, updated: 0, ignored: 0 };

  const events = extractMessagingEvents(payload);

  if (!events.length) {
    result.ignored += 1;
    return result;
  }

  for (const event of events) {
    try {
      const outcome = await upsertLeadFromInstagram(event);

      if (outcome.skipped) {
        result.ignored += 1;
        continue;
      }

      result.messages += 1;
      outcome.created ? (result.created += 1) : (result.updated += 1);
    } catch (error) {
      console.error("Instagram inbound error:", error.message);
      result.ignored += 1;
    }
  }

  return result;
};
