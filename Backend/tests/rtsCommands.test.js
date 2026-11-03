// RTS AI Assistant: on-device navigation commands (Frontend/src/components/rtsCommands.js)
// Run: node --test tests/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Load the frontend module as ESM regardless of the Frontend package type
const src = fs.readFileSync(new URL("../../Frontend/src/components/rtsCommands.js", import.meta.url), "utf8");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rts-")), "rtsCommands.mjs");
fs.writeFileSync(tmp, src);
const { parseNavigation, PAGES, matchWake } = await import(tmp);
const { NAV_ROUTES } = await import("../services/rtsAssistant/rtsTools.js");

test("frontend command pages match backend NAV_ROUTES and App.jsx routes", () => {
  assert.deepEqual(PAGES.map((p) => p.path).sort(), Object.keys(NAV_ROUTES).sort());
  const app = fs.readFileSync(new URL("../../Frontend/src/App.jsx", import.meta.url), "utf8");
  for (const p of PAGES) {
    const last = p.path.split("/").pop();
    assert.ok(app.includes(`path="${p.path.slice(1)}"`) || app.includes(`path="${last}"`), p.path);
  }
});

test("page commands navigate directly (EN / Tanglish / Tamil)", () => {
  const cases = {
    "Hey RTS, go to Invoice": "/invoices", "Hey RTS, go to Leads": "/leads", "Open leads": "/leads",
    "Go to customers": "/clients", "Open inventory": "/stocks/inventory", "Navigate to sales reports": "/invoices/analytics",
    "customers ku po": "/clients", "invoice open pannu": "/invoices", "இன்வாய்ஸ் திற": "/invoices",
    "லீட்ஸ் பக்கத்துக்கு போ": "/leads", "leads ku po": "/leads", "open customers": "/clients", "go to invoice": "/invoices", "take me to the purchase orders page": "/stocks/purchase-orders",
  };
  for (const [q, want] of Object.entries(cases)) assert.equal(parseNavigation(q)?.path, want, q);
});

test("data, record and how-to questions are left to the AI", () => {
  for (const q of ["Today's sales?", "show Ram's invoice", "how do I open invoice", "open invoice of Ram", "inniku evlo sales", "Find overdue payments", "Explain this page"]) {
    assert.equal(parseNavigation(q), null, q);
  }
});

test("wake word: EN / Tanglish / Tamil transcription variants, no false positives", () => {
  for (const t of ["Hey RTS", "hey r t s", "hey r.t.s.", "Hey RT's", "Hey artist", "hey arts", "hi RTS", "Hello RTS", "okay rts", "hey RDS", "ஹே ஆர்டிஎஸ்", "ஹே ஆர் டி எஸ்", "ஹாய் RTS", "so hey rts open customers"]) {
    assert.ok(matchWake(t), t);
  }
  for (const t of ["hey there", "the arts festival", "hearts", "hey", "party starts", "they arts", "go to invoice"]) {
    assert.equal(matchWake(t), null, t);
  }
});

test("wake + command in one utterance: rest is the command, wake word never sent as text", () => {
  assert.equal(matchWake("Hey RTS, go to invoice").rest, "go to invoice");
  assert.equal(matchWake("Hey RTS").rest, "");
  assert.equal(matchWake("ஹே ஆர் டி எஸ் இன்வாய்ஸ் திற").rest, "இன்வாய்ஸ் திற");
  assert.equal(parseNavigation(matchWake("hey rts leads ku po").rest)?.path, "/leads");
  assert.equal(parseNavigation("Hey RTS"), null);
});
