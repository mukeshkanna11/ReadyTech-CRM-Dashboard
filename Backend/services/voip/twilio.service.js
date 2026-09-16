import twilio from "twilio";

/* =========================================================
   CONFIG
   Same shape as getMetaConfig() / getWhatsAppConfig():
   { ...values, missing, configured }
========================================================= */
export const getVoipConfig = () => {
  const config = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKeySid: process.env.TWILIO_API_KEY_SID,
    apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
    twimlAppSid: process.env.TWILIO_TWIML_APP_SID,
    callerId: process.env.TWILIO_CALLER_ID,
    // Only needed to validate inbound webhook signatures
    authToken: process.env.TWILIO_AUTH_TOKEN,
    // Public base URL of THIS api host, used to build the statusCallback
    publicUrl: (process.env.TWILIO_PUBLIC_URL || process.env.API_PUBLIC_URL || "")
      .replace(/\/+$/, ""),
    tokenTtl: Number(process.env.TWILIO_TOKEN_TTL || 3600),
  };

  const missing = Object.entries({
    TWILIO_ACCOUNT_SID: config.accountSid,
    TWILIO_API_KEY_SID: config.apiKeySid,
    TWILIO_API_KEY_SECRET: config.apiKeySecret,
    TWILIO_TWIML_APP_SID: config.twimlAppSid,
    TWILIO_CALLER_ID: config.callerId,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return { ...config, missing, configured: missing.length === 0 };
};

/* =========================================================
   IDENTITY
   The CRM user id travels inside the Twilio Client identity,
   so the voice webhook can attribute the call without
   trusting anything the browser sends.
========================================================= */
export const identityForUser = (userId) => `crm_${String(userId)}`;

export const userIdFromCaller = (from) => {
  const match = /^client:crm_([a-fA-F0-9]{24})$/.exec(String(from || "").trim());
  return match ? match[1] : null;
};

/* =========================================================
   ACCESS TOKEN (Voice, outgoing only)
========================================================= */
export const createVoiceToken = (userId) => {
  const { configured, missing, accountSid, apiKeySid, apiKeySecret, twimlAppSid, tokenTtl } =
    getVoipConfig();

  if (!configured) {
    const error = new Error(`Twilio Voice is not configured. Missing: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const { AccessToken } = twilio.jwt;

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: identityForUser(userId),
    ttl: tokenTtl,
  });

  token.addGrant(
    new AccessToken.VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      // Outbound only — inbound calling is out of scope
      incomingAllow: false,
    })
  );

  return { token: token.toJwt(), identity: identityForUser(userId), expiresIn: tokenTtl };
};

/* =========================================================
   E.164 NORMALIZATION
   Lead.phone is stored unnormalized ("+91 98765 00003",
   "98765-00003"), but Twilio requires strict E.164.
========================================================= */
export const toE164 = (value, defaultCountryCode = process.env.TWILIO_DEFAULT_COUNTRY_CODE || "91") => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const hadPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (hadPlus) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
};

/* =========================================================
   TwiML — dial the lead from the browser client
========================================================= */
export const buildDialTwiml = ({ to, leadId, userId }) => {
  const { callerId, publicUrl } = getVoipConfig();
  const response = new twilio.twiml.VoiceResponse();

  if (!to) {
    response.say("No destination number was provided.");
    return response.toString();
  }

  const dial = response.dial({
    callerId,
    answerOnBridge: true,
    timeout: 30,
  });

  // statusCallback is built server-side so leadId / userId cannot be spoofed
  // by the browser beyond what the authenticated token already established.
  const number = { };
  if (publicUrl && leadId && userId) {
    const url = new URL(`${publicUrl}/api/voip/status`);
    url.searchParams.set("leadId", leadId);
    url.searchParams.set("userId", userId);
    number.statusCallback = url.toString();
    number.statusCallbackEvent = "completed";
    number.statusCallbackMethod = "POST";
  }

  dial.number(number, to);

  return response.toString();
};

/* =========================================================
   WEBHOOK SIGNATURE
   Twilio signs form-encoded webhooks over the parsed params,
   so no raw-body capture is needed.
========================================================= */
export const validateTwilioRequest = (req) => {
  const { authToken } = getVoipConfig();

  // Without an auth token we cannot verify. Fail closed in production.
  if (!authToken) return process.env.NODE_ENV !== "production";

  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;

  const { publicUrl } = getVoipConfig();
  const base = publicUrl || `${req.protocol}://${req.get("host")}`;
  const url = `${base}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, url, req.body || {});
};

/* =========================================================
   CALL STATUS -> Activity.outcome
   Maps onto the EXISTING Activity fields only.
========================================================= */
export const outcomeForStatus = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return "Completed";
    case "busy":
      return "Busy";
    case "no-answer":
      return "No Answer";
    case "canceled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
};
