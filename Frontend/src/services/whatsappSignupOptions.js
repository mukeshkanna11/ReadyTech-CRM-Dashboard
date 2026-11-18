/* FB.login options for WhatsApp Embedded Signup. Dependency-free so the
   exact runtime options can be unit tested (whatsappSignupOptions.test.js). */
export const COEXISTENCE_FEATURE_TYPE = "whatsapp_business_app_onboarding";

export const buildEmbeddedSignupLoginOptions = (cfg, { coexistence = false } = {}) => ({
  config_id: cfg.configId,
  response_type: "code",
  override_default_response_type: true,
  extras: {
    setup: {},
    sessionInfoVersion: cfg.sessionInfoVersion,
    // v4 is Meta's default (selected by the Login for Business
    // configuration) — only non-default versions are sent explicitly
    ...(cfg.esVersion && cfg.esVersion !== "v4" ? { version: cfg.esVersion } : {}),
    // WhatsApp Business app number (Coexistence) onboarding
    ...(coexistence ? { featureType: COEXISTENCE_FEATURE_TYPE } : {}),
  },
});
