// Run: node --test src/services/whatsappSignupOptions.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmbeddedSignupLoginOptions } from "./whatsappSignupOptions.js";

const cfg = { configId: "28354355967574972", sessionInfoVersion: "3", esVersion: "v4" };

test("coexistence launch sends featureType inside extras (v4, no version key)", () => {
  const opts = buildEmbeddedSignupLoginOptions(cfg, { coexistence: true });
  assert.equal(opts.config_id, "28354355967574972");
  assert.equal(opts.response_type, "code");
  assert.equal(opts.override_default_response_type, true);
  assert.deepEqual(opts.extras, {
    setup: {},
    sessionInfoVersion: "3",
    featureType: "whatsapp_business_app_onboarding",
  });
});

test("standard launch (Connect / Reconnect / Change) has no featureType", () => {
  const opts = buildEmbeddedSignupLoginOptions(cfg);
  assert.deepEqual(opts.extras, { setup: {}, sessionInfoVersion: "3" });
});

test("non-default ES version is sent explicitly; v4 never is", () => {
  assert.equal(buildEmbeddedSignupLoginOptions({ ...cfg, esVersion: "v3" }, { coexistence: true }).extras.version, "v3");
  assert.equal("version" in buildEmbeddedSignupLoginOptions(cfg, { coexistence: true }).extras, false);
});
