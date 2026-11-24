// Run: node --test src/pages/SalesforceModule.apiBase.test.js
// Regression: Salesforce dashboard stats were fetched from a hard-coded,
// retired Render host (503 without CORS headers) while Leads/Users used
// VITE_API_URL. The stats call must use the same configured API base.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./SalesforceModule.jsx", import.meta.url), "utf8");

test("SalesforceModule API base comes from VITE_API_URL", () => {
  assert.match(src, /const API_URL\s*=\s*import\.meta\.env\.VITE_API_URL\b/);
});

test("SalesforceModule has no hard-coded remote API host", () => {
  assert.doesNotMatch(src, /onrender\.com/);
  assert.doesNotMatch(src, /["'`]https:\/\/[^"'`]*\/api["'`]/);
});

test("dashboard stats request uses API_URL and keeps the Bearer header", () => {
  assert.match(src, /`\$\{API_URL\}\/activities\/dashboard\/stats\/summary`/);
  assert.match(src, /Authorization:\s*`Bearer \$\{token\}`/);
});
