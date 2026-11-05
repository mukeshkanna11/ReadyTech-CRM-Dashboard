// DB-free tests for Leads → Send Email (POST /api/leads/:id/message, channel "email").
// Run: node --test tests/leadEmail.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-jwt";
process.env.RESEND_API_KEY ||= "re_test";
process.env.RESEND_FROM_EMAIL ||= "ReadyTech <noreply@test.dev>";
process.env.COMPANY_EMAIL ||= "support@test.dev";

const svc = await import("../services/emailOAuth.service.js");
const { default: EmailConnection } = await import("../models/EmailConnection.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: Activity } = await import("../models/Activity.js");
const { sendLeadMessage } = await import("../controllers/leadMessage.controller.js");

const WS = "64b0000000000000000000a1";
const USER = "64b0000000000000000000c3";
const LEAD_ID = "64b0000000000000000000d4";

const q = (v) => ({ select() { return this; }, sort() { return this; }, lean: async () => v, then: (a, b) => Promise.resolve(v).then(a, b) });
let lead, activities, sent, accounts;
const gmailAccount = () => ({
  _id: "64b0000000000000000000e5", workspace: WS, provider: "google", email: "quries.readytechsolutions@gmail.com",
  isDefault: true, status: "connected", accessToken: svc.encrypt("AT"), refreshToken: svc.encrypt("RT"),
  expiresAt: new Date(Date.now() + 3600_000), save: async () => {},
});

beforeEach(() => {
  lead = { _id: LEAD_ID, name: "Asha", email: "asha@lead.com", phone: "" };
  activities = [];
  sent = [];
  accounts = [gmailAccount()];
  Lead.findById = () => q(lead);
  Activity.create = async (d) => activities.push(d);
  EmailConnection.find = (f) => q(accounts.filter((a) => String(a.workspace) === String(f.workspace)));
  EmailConnection.findOne = () => q(null);
  EmailConnection.updateOne = async () => {};
  global.fetch = async (url, opts = {}) => {
    sent.push({ url: String(url), body: JSON.parse(opts.body || "{}") });
    return { ok: true, status: 200, json: async () => ({ id: "gm-1" }) };
  };
});

const call = async (body) => {
  const r = { statusCode: 200 };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  await sendLeadMessage({ params: { id: LEAD_ID }, body: { channel: "email", ...body }, user: { _id: USER }, workspace: WS }, r);
  return r;
};
const mimeTo = (s) => Buffer.from(s.body.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString().match(/^To: (.*)$/m)?.[1];

test("sends from the workspace's default Gmail mailbox to the lead email", async () => {
  const r = await call({ subject: "Hello", message: "Hi Asha" });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.data.from, "quries.readytechsolutions@gmail.com");
  assert.equal(r.body.data.to, "asha@lead.com");
  assert.match(sent[0].url, /gmail\.googleapis\.com/);
  assert.equal(mimeTo(sent[0]), "asha@lead.com");
  assert.match(activities[0].notes, /via Gmail/);
  const out = JSON.stringify(r.body);
  assert.doesNotMatch(out, /accessToken|refreshToken|smtpPassword/);
  assert.ok(!out.includes(accounts[0].accessToken) && !out.includes(accounts[0].refreshToken));
});

test("edited recipient is used and validated", async () => {
  const ok = await call({ to: "other@lead.com", subject: "S", message: "M" });
  assert.equal(ok.body.data.to, "other@lead.com");
  assert.equal(mimeTo(sent[0]), "other@lead.com");
  for (const to of ["not-an-email", "a@b.com, c@d.com", "a@b.com\r\nBcc: x@y.com"]) {
    const bad = await call({ to, subject: "S", message: "M" });
    assert.equal(bad.statusCode, 400, to);
    assert.match(bad.body.message, /valid recipient/);
  }
  assert.equal(sent.length, 1);
});

test("lead without email: helpful error unless a recipient is entered", async () => {
  lead.email = "";
  const r = await call({ subject: "S", message: "M" });
  assert.equal(r.statusCode, 400);
  assert.match(r.body.message, /no email address/);
  assert.equal((await call({ to: "typed@lead.com", subject: "S", message: "M" })).statusCode, 200);
});

test("subject / message validation", async () => {
  assert.match((await call({ subject: "", message: "M" })).body.message, /Subject is required/);
  assert.match((await call({ subject: "S", message: "  " })).body.message, /Message is required/);
  assert.match((await call({ subject: "x".repeat(201), message: "M" })).body.message, /200 characters/);
  assert.equal(sent.length, 0);
});

test("another workspace's mailbox is never used", async () => {
  accounts = [{ ...gmailAccount(), workspace: "64b0000000000000000000b2" }];
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ id: "re-1" }), headers: new Map() };
  };
  const r = await call({ subject: "S", message: "M" });
  assert.ok(!urls.some((u) => /gmail/.test(u)), "other workspace's Gmail must not be used");
  assert.notEqual(r.body?.data?.from, "quries.readytechsolutions@gmail.com");
  assert.equal(r.body?.data?.provider ?? "resend", "resend");
});

test("mailbox send failure returns a clear message and is logged", async () => {
  global.fetch = async () => ({ ok: false, status: 401, statusText: "x", json: async () => ({ error: { message: "Invalid Credentials" } }) });
  const r = await call({ subject: "S", message: "M" });
  assert.equal(r.statusCode, 502);
  assert.match(r.body.message, /reconnect the account/);
  assert.equal(activities[0].outcome, "Failed");
});
