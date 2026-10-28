// Focused, DB-free tests for WhatsApp Embedded Signup, connection
// lifecycle and cross-workspace isolation (mocked model + Graph calls).
// Run: node --test tests/
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

process.env.META_APP_ID = "app-1";
process.env.META_APP_SECRET = "test-secret-test-secret-test-secret";
process.env.META_API_VERSION = "v21.0";
process.env.WHATSAPP_VERIFY_TOKEN = "verify";
process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID = "cfg-1";
process.env.WHATSAPP_PHONE_NUMBER_ID = "999";

await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const { default: MetaConnection } = await import("../models/MetaConnection.js");
const wa = await import("../services/meta/whatsapp.service.js");
const { decryptToken } = await import("../services/meta/tokenVault.js");

const SIVA = "64b000000000000000000001";
const SARA = "64b000000000000000000002";
const BOB = "64b000000000000000000003";
ctx.setDefaultWorkspaceId(SIVA);

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
afterEach(() => {
  while (restore.length) restore.pop()();
});

/* One in-memory MetaConnection doc per workspace key */
const fakeDocs = () => {
  const docs = {};
  stub(MetaConnection, "getSingleton", async () => {
    const key = (await import("../models/MetaConnection.js")).metaKeyFor();
    docs[key] ||= new MetaConnection({ key });
    docs[key].save = async () => docs[key];
    return docs[key];
  });
  stub(MetaConnection, "findOne", (filter) => ({
    select: () => ({
      lean: async () =>
        Object.values(docs).find(
          (d) => d.whatsapp.phoneNumberId === filter["whatsapp.phoneNumberId"] && d.key !== filter.key?.$ne
        ) || null,
    }),
  }));
  return docs;
};

/* Graph mock — records calls, answers like Meta */
const fakeGraph = ({ phones = [{ id: "111", display_phone_number: "+91 98765 43210", verified_name: "Sara Co", platform_type: "NOT_APPLICABLE" }], register = true, tokenOk = true } = {}) => {
  const calls = [];
  stub(globalThis, "fetch", async (url, opts = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    const bad = (message) => ({ ok: false, status: 400, json: async () => ({ error: { message, code: 100 } }) });
    if (u.pathname.endsWith("/oauth/access_token")) return tokenOk ? ok({ access_token: "BIZ_TOKEN" }) : bad("Invalid code");
    if (u.pathname.endsWith("/phone_numbers")) return ok({ data: phones });
    if (u.pathname.endsWith("/subscribed_apps")) return ok({ success: true });
    if (u.pathname.endsWith("/register")) return register ? ok({ success: true }) : bad("Registration failed");
    if (u.pathname.match(/\/\d+$/)) return ok({ id: u.pathname.split("/").pop(), display_phone_number: "+91 98765 43210", verified_name: "Sara Co" });
    return bad("unexpected");
  });
  return calls;
};

const signup = (ws, user, body) =>
  ctx.runWithWorkspace(ws, () =>
    wa.completeEmbeddedSignup({ code: "c", state: wa.createSignupState(user), phoneNumberId: "111", wabaId: "222", ...body }, user)
  );

test("config: exact blockers instead of a fake ready state", async () => {
  const saved = process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
  delete process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
  try {
    const cfg = await ctx.runWithWorkspace(SARA, () => wa.getEmbeddedSignupConfig("u1"));
    assert.equal(cfg.ready, false);
    assert.equal(cfg.state, null);
    assert.match(cfg.blockers.join(" "), /WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID/);
  } finally {
    process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID = saved;
  }
  const cfg = await ctx.runWithWorkspace(SARA, () => wa.getEmbeddedSignupConfig("u1"));
  assert.equal(cfg.ready, true);
  assert.equal(JSON.stringify(cfg).includes(process.env.META_APP_SECRET), false);
});

test("state is bound to workspace + user and is tamper-proof", async () => {
  const state = await ctx.runWithWorkspace(SARA, () => wa.createSignupState("u1"));
  await ctx.runWithWorkspace(SARA, () => assert.equal(wa.verifySignupState(state, "u1"), true));
  await ctx.runWithWorkspace(SARA, () => assert.equal(wa.verifySignupState(state, "u2"), false));
  await ctx.runWithWorkspace(BOB, () => assert.equal(wa.verifySignupState(state, "u1"), false));
  const [body, sig] = state.split(".");
  await ctx.runWithWorkspace(SARA, () => assert.equal(wa.verifySignupState(`${body}x.${sig}`, "u1"), false));
});

test("connect: code exchanged server-side, number verified, webhook subscribed, number registered", async () => {
  const docs = fakeDocs();
  const calls = fakeGraph();

  await signup(SARA, "u1");

  const doc = docs[SARA].whatsapp;
  assert.equal(doc.connected, true);
  assert.equal(doc.phoneNumberId, "111");
  assert.equal(doc.wabaId, "222");
  assert.equal(doc.onboardingType, "embedded");
  assert.equal(doc.health, "healthy");
  assert.equal(decryptToken(doc.encryptedToken), "BIZ_TOKEN");
  assert.match(decryptToken(doc.encryptedPin), /^\d{6}$/);
  assert.deepEqual(calls.map((c) => c.path.split("/").slice(2).join("/")), [
    "oauth/access_token", "222/phone_numbers", "222/subscribed_apps", "111/register",
  ]);
  // The safe payload never exposes the token or PIN
  const safe = JSON.stringify(docs[SARA].toSafeJSON());
  assert.equal(safe.includes("BIZ_TOKEN") || safe.includes(doc.encryptedPin) || safe.includes(doc.encryptedToken), false);
});

test("coexistence: existing app number is not re-registered", async () => {
  const docs = fakeDocs();
  const calls = fakeGraph();
  await signup(SARA, "u1", { coexistence: true });
  assert.equal(calls.some((c) => c.path.endsWith("/register")), false);
  assert.equal(docs[SARA].whatsapp.onboardingType, "coexistence");
});

test("isolation: another workspace's number or signup session is rejected", async () => {
  const docs = fakeDocs();
  fakeGraph();
  await signup(SARA, "u1");

  await assert.rejects(signup(BOB, "u9"), { status: 409 });
  // Platform (.env) number of the default workspace is never claimable
  await assert.rejects(signup(BOB, "u9", { phoneNumberId: "999" }), { status: 409 });
  // Sara's signed state replayed from Bob's workspace
  const saraState = await ctx.runWithWorkspace(SARA, () => wa.createSignupState("u1"));
  await assert.rejects(
    ctx.runWithWorkspace(BOB, () => wa.completeEmbeddedSignup({ code: "c", state: saraState, phoneNumberId: "333", wabaId: "444" }, "u1")),
    { status: 403 }
  );
  assert.equal(docs[BOB]?.whatsapp?.connected ?? false, false);
  assert.equal(docs[SARA].whatsapp.phoneNumberId, "111");
});

test("change number: failed setup leaves the working number untouched", async () => {
  const docs = fakeDocs();
  fakeGraph();
  await signup(SARA, "u1");
  restore.pop()(); // drop fetch stub

  fakeGraph({ phones: [{ id: "555", display_phone_number: "+1 555", platform_type: "NOT_APPLICABLE" }], register: false });
  await assert.rejects(signup(SARA, "u1", { phoneNumberId: "555" }), /registration failed/i);
  assert.equal(docs[SARA].whatsapp.phoneNumberId, "111");
  assert.equal(decryptToken(docs[SARA].whatsapp.encryptedToken), "BIZ_TOKEN");

  restore.pop()();
  fakeGraph({ phones: [{ id: "555", display_phone_number: "+1 555", verified_name: "Sara New" }] });
  await signup(SARA, "u1", { phoneNumberId: "555" });
  assert.equal(docs[SARA].whatsapp.phoneNumberId, "555");
  assert.equal(docs[SARA].whatsapp.verifiedName, "Sara New");
});

test("connect: number not in the shared WABA / bad code → nothing stored", async () => {
  const docs = fakeDocs();
  fakeGraph({ phones: [{ id: "777" }] });
  await assert.rejects(signup(SARA, "u1"), /does not belong/);
  restore.pop()();
  fakeGraph({ tokenOk: false });
  await assert.rejects(signup(SARA, "u1"), { status: 400 });
  assert.equal(docs[SARA]?.whatsapp?.connected ?? false, false);
});

test("disconnect: clears secrets, unsubscribes WABA, frees the number", async () => {
  const docs = fakeDocs();
  const calls = fakeGraph();
  await signup(SARA, "u1");
  await ctx.runWithWorkspace(SARA, () => wa.disconnectWhatsAppAccount());

  const doc = docs[SARA].whatsapp;
  assert.equal(doc.connected, false);
  assert.equal(doc.encryptedToken, null);
  assert.equal(doc.encryptedPin, null);
  assert.equal(doc.phoneNumberId, null);
  assert.ok(calls.some((c) => c.method === "DELETE" && c.path.endsWith("/222/subscribed_apps")));
  // Another workspace may now connect it
  await signup(BOB, "u9");
  assert.equal(docs[BOB].whatsapp.phoneNumberId, "111");
});

test("test connection: failure is recorded, never shown as connected", async () => {
  const docs = fakeDocs();
  fakeGraph();
  await signup(SARA, "u1");
  restore.pop()();
  stub(globalThis, "fetch", async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Token expired", code: 190 } }) }));

  await assert.rejects(ctx.runWithWorkspace(SARA, () => wa.syncWhatsAppAccount()));
  assert.equal(docs[SARA].whatsapp.connected, false);
  assert.equal(docs[SARA].whatsapp.health, "error");
  assert.ok(docs[SARA].whatsapp.lastError);
});

test("webhook account_update offboarding marks only that WABA disconnected", async () => {
  let update;
  stub(MetaConnection, "updateMany", async (filter, change) => ((update = { filter, change }), { modifiedCount: 1 }));
  const payload = (event) => ({
    object: "whatsapp_business_account",
    entry: [{ id: "222", changes: [{ field: "account_update", value: { event } }] }],
  });

  const r = await wa.processWebhookPayload(payload("PARTNER_REMOVED"));
  assert.equal(r.ignored, 0);
  assert.equal(update.filter["whatsapp.wabaId"], "222");
  assert.equal(update.change.$set["whatsapp.connected"], false);

  update = null;
  const other = await wa.processWebhookPayload(payload("VERIFIED_ACCOUNT"));
  assert.equal(update, null);
  assert.equal(other.ignored, 1);
});

test("webhook signature: only a valid app-secret HMAC is accepted", async () => {
  const crypto = await import("crypto");
  const raw = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
  const sig = `sha256=${crypto.createHmac("sha256", process.env.META_APP_SECRET).update(raw).digest("hex")}`;
  assert.equal(wa.verifyWebhookSignature(raw, sig), true);
  assert.equal(wa.verifyWebhookSignature(raw, sig.replace(/.$/, "0")), false);
  assert.equal(wa.verifyWebhookSignature(raw, undefined), false);
});
