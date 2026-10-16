// Unified inbox + per-workspace Meta routing (DB-free, mocked models).
// Run: node --test tests/*.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.META_APP_ID = "test-app";
process.env.META_APP_SECRET = "test-secret-test-secret-test-secret";
process.env.META_REDIRECT_URI = "http://localhost/cb";
process.env.JWT_SECRET = "test-jwt";
process.env.WHATSAPP_PHONE_NUMBER_ID = "SIVA_PN";
process.env.WHATSAPP_ACCESS_TOKEN = "SIVA_TOKEN";
process.env.WHATSAPP_VERIFY_TOKEN = "verify";

await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const { default: MetaConnection } = await import("../models/MetaConnection.js");
const { default: Conv } = await import("../models/WhatsAppConversation.js");
const { default: Msg } = await import("../models/WhatsAppMessage.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: User } = await import("../models/User.js");
const { encryptToken } = await import("../services/meta/tokenVault.js");
const wa = await import("../services/meta/whatsapp.service.js");
const ig = await import("../services/meta/instagram.service.js");
const inbox = await import("../services/meta/inbox.service.js");
const ctl = await import("../controllers/whatsapp.controller.js");
const meta = await import("../services/meta/meta.service.js");

const SIVA = "64b000000000000000000001";
const SARA = "64b000000000000000000002";
ctx.setDefaultWorkspaceId(SIVA);

const chain = (v) => ({
  select() { return this; }, sort() { return this; }, populate() { return this; },
  lean: async () => v, then: (ok, fail) => Promise.resolve(v).then(ok, fail),
});
const orig = [];
const stub = (o, n, fn) => { orig.push([o, n, o[n]]); o[n] = fn; };
const realFetch = globalThis.fetch;
beforeEach(() => {
  while (orig.length) { const [o, n, f] = orig.pop(); o[n] = f; }
  globalThis.fetch = realFetch;
});
const res = () => {
  const r = { statusCode: 200 };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  r.set = () => r; r.send = (b) => ((r.body = b), r);
  return r;
};
const fakeConv = (over = {}) => {
  const c = new Conv({ phoneNumber: "+919800000001", lastInboundAt: new Date(), ...over });
  c.save = async () => c;
  return c;
};
const graphMock = (calls, reply = () => ({})) => (globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), opts });
  return { ok: true, status: 200, json: async () => reply(String(url), opts), arrayBuffer: async () => new ArrayBuffer(3), headers: new Map() };
});

/* -------- WhatsApp webhook routing -------- */
const waPayload = (pn, from = "919800000001") => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: {
    metadata: { phone_number_id: pn, display_phone_number: "1" },
    contacts: [{ profile: { name: "Cust" } }],
    messages: [{ id: `wamid.${pn}`, from, type: "image", timestamp: "1700000000", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "pic" } }],
  } }] }],
});

test("WA webhook routes each number to its own workspace; unknown numbers dropped", async () => {
  stub(MetaConnection, "findOne", (f) => chain(f["whatsapp.phoneNumberId"] === "SARA_PN" ? { key: SARA } : null));
  stub(MetaConnection, "updateOne", async () => ({}));
  stub(Msg, "exists", async () => null);
  const seen = [];
  stub(Conv, "findOne", async () => (seen.push(["conv", ctx.getWorkspaceId()]), fakeConv()));
  stub(Msg, "create", async (d) => (seen.push(["msg", ctx.getWorkspaceId(), d.meta]), d));
  stub(Lead, "updateOne", async () => ({}));

  assert.equal(await wa.workspaceForPhoneNumberId("SIVA_PN"), SIVA);
  let r = await wa.processWebhookPayload(waPayload("SARA_PN"));
  assert.equal(r.messages, 1);
  assert.deepEqual(seen.map((s) => s[1]), [SARA, SARA], "written in Sara's workspace only");
  assert.equal(seen[1][2].mediaId, "MEDIA1", "media id kept for preview");

  seen.length = 0;
  r = await wa.processWebhookPayload(waPayload("UNKNOWN_PN"));
  assert.equal(r.messages, 0);
  assert.equal(seen.length, 0, "never falls into Siva's workspace");
});

test("Tenant WhatsApp uses its own DB token/number, never Siva's env", async () => {
  const doc = { key: SARA, whatsapp: { phoneNumberId: "SARA_PN", encryptedToken: encryptToken("SARA_TOKEN") } };
  stub(MetaConnection, "findOne", async () => doc);
  await ctx.runWithWorkspace(SARA, async () => {
    const acc = await wa.resolveWhatsAppAccount();
    assert.equal(acc.phoneNumberId, "SARA_PN");
    assert.equal(acc.accessToken, "SARA_TOKEN");
    assert.equal(acc.source, "workspace");
  });
  stub(MetaConnection, "findOne", async () => ({ key: SARA, whatsapp: {} }));
  await ctx.runWithWorkspace(SARA, async () => {
    const acc = await wa.resolveWhatsAppAccount();
    assert.equal(acc.accessToken, null);
    assert.equal(acc.phoneNumberId, null);
  });
  await ctx.runWithWorkspace(SIVA, async () => {
    const acc = await wa.resolveWhatsAppAccount();
    assert.equal(acc.accessToken, "SIVA_TOKEN");
    assert.equal(acc.source, "platform");
  });
});

test("Tenant cannot claim Siva's env number; valid connect stores encrypted token", async () => {
  stub(MetaConnection, "findOne", () => chain(null));
  // Number already owned by another workspace's doc → 409, nothing stored
  stub(MetaConnection, "findOne", (f) => chain(f["whatsapp.phoneNumberId"] ? { _id: "other" } : null));
  await ctx.runWithWorkspace(SARA, async () => {
    await assert.rejects(wa.connectWhatsAppAccount({ phoneNumberId: "123", accessToken: "x" }), { status: 409 });
  });

  const calls = [];
  graphMock(calls, (u) => (u.includes("subscribed_apps") ? { success: true } : { id: "555", display_phone_number: "+1 555", verified_name: "Sara Co" }));
  const doc = { key: SARA, whatsapp: {}, save: async () => doc, toSafeJSON() { return { whatsapp: this.whatsapp }; } };
  stub(MetaConnection, "findOne", (f) => (f.key === SARA ? Promise.resolve(doc) : chain(null)));
  await ctx.runWithWorkspace(SARA, async () => {
    await wa.connectWhatsAppAccount({ phoneNumberId: "555", wabaId: "777", accessToken: "SARA_TOKEN" });
  });
  assert.equal(doc.whatsapp.phoneNumberId, "555");
  assert.notEqual(doc.whatsapp.encryptedToken, "SARA_TOKEN", "stored encrypted");
  assert.equal(doc.whatsapp.webhookSubscribed, true);
  assert.ok(calls.every((c) => c.opts.headers.Authorization === "Bearer SARA_TOKEN"));
});

test("WA reply + media send go to the workspace's number with its token", async () => {
  const conv = fakeConv();
  stub(Conv, "findById", async () => conv);
  stub(MetaConnection, "findOne", async () => ({ key: "default", whatsapp: {} }));
  stub(Msg, "create", async (d) => ({ ...d, save: async () => {} }));
  stub(Lead, "updateOne", async () => ({}));
  const calls = [];
  graphMock(calls, (u) => (u.endsWith("/media") ? { id: "UP1" } : { messages: [{ id: "wamid.out" }] }));

  await ctx.runWithWorkspace(SIVA, async () => {
    const m = await wa.sendTextMessage({ conversationId: "x", text: "hello" });
    assert.equal(m.status, "sent");
    const md = await wa.sendTextMessage({ conversationId: "x", text: "cap", media: { data: Buffer.from("abc").toString("base64"), mimeType: "image/png", filename: "a.png" } });
    assert.equal(md.meta.mediaId, "UP1");
  });
  assert.ok(calls[0].url.endsWith("/SIVA_PN/messages"));
  assert.ok(calls[1].url.endsWith("/SIVA_PN/media"));
  const sent = JSON.parse(calls[2].opts.body);
  assert.deepEqual(sent.image, { id: "UP1", caption: "cap" });
});

test("Expired 24h window blocks replies on every channel", async () => {
  const old = new Date(Date.now() - 25 * 3600e3);
  stub(Conv, "findById", async () => fakeConv({ lastInboundAt: old }));
  await assert.rejects(wa.sendTextMessage({ conversationId: "x", text: "hi" }), { code: "WINDOW_EXPIRED" });
  await assert.rejects(inbox.sendSocialMessage({ conversation: fakeConv({ channel: "messenger", phoneNumber: "fb:1", lastInboundAt: old }), text: "hi" }), { code: "WINDOW_EXPIRED" });
});

/* -------- Instagram / Messenger -------- */
const sign = (body) => "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex");

test("Signed Messenger webhook lands in the Page owner's workspace", async () => {
  stub(MetaConnection, "findOne", (f) => chain(JSON.stringify(f).includes("SARA_PAGE") ? { key: SARA } : null));
  const health = [];
  stub(MetaConnection, "updateOne", async (f, u) => (health.push([f.key, Object.keys(u.$set)[0]]), {}));
  stub(Msg, "exists", async () => null);
  const seen = [];
  stub(Conv, "findOne", async () => null);
  stub(Conv, "create", async (d) => (seen.push(ctx.getWorkspaceId()), fakeConv(d)));
  stub(Msg, "create", async (d) => (seen.push(d.meta), d));
  const payload = { object: "page", entry: [{ id: "SARA_PAGE", messaging: [{ sender: { id: "PSID9" }, timestamp: 1700000000000, message: { mid: "m.1", attachments: [{ type: "image", payload: { url: "https://cdn/x.jpg" } }] } }] }] };

  assert.equal(wa.verifyWebhookSignature(Buffer.from(JSON.stringify(payload)), sign(JSON.stringify(payload))), true);
  let r = await ig.processWebhookPayload(payload, { trusted: false });
  assert.equal(r.messages, 0, "unsigned Messenger payload ignored");
  r = await ig.processWebhookPayload(payload, { trusted: true });
  assert.equal(r.messages, 1);
  assert.equal(seen[0], SARA);
  assert.equal(seen[1].attachments[0].url, "https://cdn/x.jpg");
  assert.deepEqual(health, [[SARA, "facebookPage.lastInboundAt"]], "webhook health on Sara's doc only");
});

test("Tenant's released IG account never falls back to Siva's workspace", async () => {
  stub(MetaConnection, "findOne", (f) =>
    chain(f.releasedAssetIds === "OLD_IG" ? { _id: "x" } : null));
  assert.equal(await inbox.workspaceForMetaAsset("instagram.id", "OLD_IG", { legacyDefault: true }), null);
  assert.equal(await inbox.workspaceForMetaAsset("instagram.id", "LEGACY_IG", { legacyDefault: true }), SIVA);
});

test("Connecting a Page/IG already owned by another workspace is rejected", async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    access_token: "t", expires_in: 1, data: [{ id: "SIVA_PAGE", name: "P", access_token: "pt" }] }) });
  stub(User, "findById", () => chain({ _id: SARA }));
  let saved = false;
  stub(MetaConnection, "findOne", (f) => typeof f.key === "string"
    ? Promise.resolve({ key: f.key, save: async () => (saved = true) })
    : chain({ _id: "siva-doc" }));
  await assert.rejects(meta.completeConnection({ code: "c", userId: SARA }), { status: 409 });
  assert.equal(saved, false);
});

test("Graph permission / token errors are explained, not hidden", () => {
  assert.match(meta.explainMetaError({ code: 10, message: "x" }), /permission/i);
  assert.match(meta.explainMetaError({ code: 230, message: "x" }), /App Review/);
  assert.match(meta.explainMetaError({ code: 190, message: "x" }), /expired or revoked/);
});

test("Convert to Lead links an existing lead with the same phone instead of duplicating", async () => {
  stub(Lead, "findOne", (f) => (assert.ok(f.phone instanceof RegExp), chain({ _id: "64b0000000000000000000bb" })));
  let created = 0;
  stub(Lead, "create", async () => (created++, {}));
  const conv = fakeConv();
  const r = await inbox.convertConversationToLead({ conversation: conv, user: { _id: SIVA } });
  assert.equal(r.created, false);
  assert.equal(created, 0);
  assert.equal(String(conv.lead), "64b0000000000000000000bb");
});

test("Messenger reply uses the workspace's own Page token", async () => {
  stub(MetaConnection, "findOne", async () => ({ key: SARA, facebookPage: { id: "SARA_PAGE", encryptedToken: encryptToken("SARA_PAGE_TOKEN") } }));
  stub(Msg, "create", async (d) => ({ ...d, save: async () => {} }));
  const calls = [];
  graphMock(calls, () => ({ message_id: "mid.out" }));
  await ctx.runWithWorkspace(SARA, async () => {
    const m = await inbox.sendSocialMessage({ conversation: fakeConv({ channel: "messenger", phoneNumber: "fb:PSID9", externalId: "PSID9" }), text: "hey" });
    assert.equal(m.messageId, "mid.out");
  });
  assert.ok(calls[0].url.endsWith("/SARA_PAGE/messages"));
  assert.equal(calls[0].opts.headers.Authorization, "Bearer SARA_PAGE_TOKEN");
  assert.equal(JSON.parse(calls[0].opts.body).recipient.id, "PSID9");
});

/* -------- Inbox actions -------- */
test("Convert to Lead creates once with channel source, then is idempotent", async () => {
  stub(User, "findOne", () => chain({ _id: SARA, name: "Sara" }));
  stub(Lead, "findOne", () => chain(null));
  let created = 0;
  stub(Lead, "create", async (d) => (created++, assert.equal(d.source, "Facebook"), { _id: "64b0000000000000000000aa", ...d }));
  const conv = fakeConv({ channel: "messenger", phoneNumber: "fb:1", externalId: "1", profileName: "Ann" });
  await ctx.runWithWorkspace(SARA, async () => {
    assert.equal((await inbox.convertConversationToLead({ conversation: conv, user: { _id: SARA } })).created, true);
    assert.equal((await inbox.convertConversationToLead({ conversation: conv, user: { _id: SARA } })).created, false);
  });
  assert.equal(created, 1);
  assert.equal(String(conv.lead), "64b0000000000000000000aa");
});

test("Assignment rejects users from another workspace", async () => {
  stub(Conv, "findById", async () => fakeConv());
  const filters = [];
  stub(User, "findOne", (f) => (filters.push(f), chain(null)));
  const r = await ctl.updateConversation({ params: { id: "c" }, body: { assignedTo: SIVA }, workspace: SARA }, res());
  assert.equal(r.statusCode, 400);
  assert.deepEqual(filters[0].$or, [{ _id: SARA }, { workspace: SARA }]);
});

test("toInboxJSON hides synthetic thread keys and exposes notes", () => {
  const j = fakeConv({ channel: "instagram", phoneNumber: "ig:5", notes: [{ body: "vip", authorName: "Sara" }] }).toInboxJSON();
  assert.equal(j.phoneNumber, null);
  assert.equal(j.channel, "instagram");
  assert.equal(j.notes[0].body, "vip");
});

test("Unsupported or oversized WhatsApp attachments are rejected before upload", async () => {
  await assert.rejects(wa.sendTextMessage({ conversationId: "x", media: { data: "AAAA", mimeType: "application/zip" } }), { code: "UNSUPPORTED_MEDIA" });
  const big = "A".repeat(Math.ceil((6 * 1024 * 1024 * 4) / 3));
  await assert.rejects(wa.sendTextMessage({ conversationId: "x", media: { data: big, mimeType: "image/png" } }), { code: "MEDIA_TOO_LARGE" });
});

/* -------- Instagram Inbox (Instagram Login) -------- */
const igl = await import("../services/meta/instagramLogin.service.js");

test("IG env token is offered to Siva only; tenants get only their own encrypted token", async () => {
  process.env.INSTAGRAM_ACCESS_TOKEN = "SIVA_IG_TOKEN";
  stub(MetaConnection, "findOne", async () => ({ key: SARA, instagramLogin: {} }));
  await ctx.runWithWorkspace(SARA, async () => assert.equal((await igl.resolveInstagramLogin()).token, null));
  stub(MetaConnection, "findOne", async () => ({ key: SARA, instagramLogin: { encryptedToken: encryptToken("SARA_IG") } }));
  await ctx.runWithWorkspace(SARA, async () => assert.equal((await igl.resolveInstagramLogin()).token, "SARA_IG"));
  stub(MetaConnection, "findOne", async () => ({ key: "default", instagramLogin: {} }));
  await ctx.runWithWorkspace(SIVA, async () => {
    const r = await igl.resolveInstagramLogin();
    assert.equal(r.token, "SIVA_IG_TOKEN");
    assert.equal(r.source, "platform");
  });
});

test("Instagram reply uses graph.instagram.com with the workspace token", async () => {
  stub(MetaConnection, "findOne", async () => ({ key: SARA, instagramLogin: { encryptedToken: encryptToken("SARA_IG") } }));
  stub(Msg, "create", async (d) => ({ ...d, save: async () => {} }));
  const calls = [];
  graphMock(calls, () => ({ message_id: "ig.mid" }));
  await ctx.runWithWorkspace(SARA, async () => {
    const m = await inbox.sendSocialMessage({ conversation: fakeConv({ channel: "instagram", phoneNumber: "ig:7", externalId: "7" }), text: "hi" });
    assert.equal(m.messageId, "ig.mid");
  });
  assert.match(calls[0].url, /^https:\/\/graph\.instagram\.com\/v[\d.]+\/me\/messages$/);
  assert.equal(calls[0].opts.headers.Authorization, "Bearer SARA_IG");
  assert.deepEqual(JSON.parse(calls[0].opts.body).recipient, { id: "7" });
});

test("Expired IG token on refresh is flagged, not reported as connected", async () => {
  const doc = { key: SARA, instagramLogin: { encryptedToken: encryptToken("bad"), connectedAt: new Date() }, save: async () => doc };
  stub(MetaConnection, "findOne", async () => doc);
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 190, message: "Session invalidated" } }) });
  await ctx.runWithWorkspace(SARA, async () => {
    await assert.rejects(igl.refreshInstagramConnection(), /expired or revoked/);
  });
  assert.equal(doc.instagramLogin.tokenInvalid, true);
});

test("IG OAuth: rejects an account owned by another workspace, never saves", async () => {
  process.env.INSTAGRAM_APP_ID = "ia"; process.env.INSTAGRAM_APP_SECRET = "is";
  globalThis.fetch = async (u) => ({ ok: true, status: 200, json: async () =>
    String(u).includes("api.instagram.com") ? { access_token: "s", user_id: "IG9", permissions: "instagram_business_basic" }
    : String(u).includes("/access_token") ? { access_token: "L", expires_in: 5184000 }
    : { user_id: "IG9", username: "sara" } });
  stub(User, "findById", () => chain({ _id: SARA }));
  let saved = false;
  stub(MetaConnection, "findOne", (f) => typeof f.key === "string"
    ? Promise.resolve({ key: f.key, save: async () => (saved = true) })
    : chain({ _id: "siva" }));
  await assert.rejects(igl.completeInstagramConnection({ code: "c#_", userId: SARA }), { status: 409 });
  assert.equal(saved, false);
});

test("Instagram-Login webhook entry routes by instagramLogin.id", async () => {
  const q = [];
  stub(MetaConnection, "findOne", (f) => (q.push(f), chain(JSON.stringify(f).includes("IGL_SARA") ? { key: SARA } : null)));
  assert.equal(await inbox.workspaceForMetaAsset(["instagram.id", "instagramLogin.id"], "IGL_SARA"), SARA);
  assert.deepEqual(q[0].$or, [{ "instagram.id": "IGL_SARA" }, { "instagramLogin.id": "IGL_SARA" }]);
});

test("Siva: working Facebook-Page IG link wins over a revoked Instagram-Login token", async () => {
  const doc = {
    key: "default", status: "connected", scopes: ["instagram_manage_messages"],
    facebookPage: { id: "PAGE1", encryptedToken: encryptToken("PAGE_TOKEN") },
    instagram: { id: "IG1" },
    instagramLogin: { tokenInvalid: true },
  };
  process.env.INSTAGRAM_ACCESS_TOKEN = "DEAD_ENV_TOKEN";
  stub(MetaConnection, "findOne", async () => doc);
  stub(Msg, "create", async (d) => ({ ...d, save: async () => {} }));
  const calls = [];
  graphMock(calls, () => ({ message_id: "m" }));
  await ctx.runWithWorkspace(SIVA, async () => {
    await inbox.sendSocialMessage({ conversation: fakeConv({ channel: "instagram", phoneNumber: "ig:5", externalId: "5" }), text: "hi" });
  });
  assert.match(calls[0].url, /graph\.facebook\.com\/v[\d.]+\/PAGE1\/messages$/);
  assert.equal(calls[0].opts.headers.Authorization, "Bearer PAGE_TOKEN");
});

test("Status: Page path reports connected; tenant without anything reports disconnected", async () => {
  const metaCtl = await import("../controllers/meta.controller.js");
  const { default: MC } = await import("../models/MetaConnection.js");
  const siva = new MC({ key: "default", status: "connected", scopes: ["instagram_manage_messages"],
    facebookPage: { id: "P", name: "RT", encryptedToken: "x" }, instagram: { id: "IG1", username: "readytechsolutions" },
    instagramLogin: { tokenInvalid: true, lastError: "revoked" } });
  stub(MetaConnection, "findOne", async () => siva);
  let r = res();
  await ctx.runWithWorkspace(SIVA, () => metaCtl.getMetaStatus({}, r));
  assert.equal(r.body.data.instagramInbox.connected, true);
  assert.equal(r.body.data.instagramInbox.method, "facebook_page");
  assert.equal(r.body.data.instagramInbox.username, "readytechsolutions");
  assert.equal(r.body.data.instagramInbox.expired, false);

  stub(MetaConnection, "findOne", async () => new MC({ key: SARA }));
  r = res();
  await ctx.runWithWorkspace(SARA, () => metaCtl.getMetaStatus({}, r));
  assert.equal(r.body.data.instagramInbox.connected, false);
  assert.equal(r.body.data.instagramInbox.source, null, "never Siva's env token");
});
