// WhatsApp Business App Coexistence webhooks (DB-free, mocked models).
// Payload shapes follow Meta's webhook reference for history,
// smb_message_echoes, smb_app_state_sync and account_update.
// Run: node --test tests/whatsappCoexistence.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.META_APP_ID = "test-app";
process.env.META_APP_SECRET = "test-secret-test-secret-test-secret";
process.env.WHATSAPP_PHONE_NUMBER_ID = "SIVA_PN";
process.env.WHATSAPP_VERIFY_TOKEN = "verify";

await import("../utils/workspaceScope.js");
const ctx = await import("../utils/workspaceContext.js");
const { default: MetaConnection } = await import("../models/MetaConnection.js");
const { default: Conv } = await import("../models/WhatsAppConversation.js");
const { default: Msg } = await import("../models/WhatsAppMessage.js");
const { default: Lead } = await import("../models/Lead.js");
const { default: Client } = await import("../models/Client.js");
const { default: User } = await import("../models/User.js");
const wa = await import("../services/meta/whatsapp.service.js");

const SIVA = "64b000000000000000000001";
const SARA = "64b000000000000000000002";
ctx.setDefaultWorkspaceId(SIVA);

const chain = (v) => ({
  select() { return this; }, sort() { return this; },
  lean: async () => v, then: (ok, fail) => Promise.resolve(v).then(ok, fail),
});
const orig = [];
const stub = (o, n, fn) => { orig.push([o, n, o[n]]); o[n] = fn; };

/* In-memory, workspace-keyed stores */
let convs, msgs;
const ws = () => String(ctx.getWorkspaceId());
beforeEach(() => {
  while (orig.length) { const [o, n, f] = orig.pop(); o[n] = f; }
  convs = new Map();
  msgs = [];

  stub(MetaConnection, "findOne", (f) =>
    chain(f["whatsapp.phoneNumberId"] === "SARA_PN" ? { key: SARA } : null));
  stub(Client, "findOne", () => chain(null));
  stub(Lead, "findOne", () => chain(null));
  stub(User, "findOne", () => chain(null));
  stub(Lead, "updateOne", async () => ({}));

  stub(Conv, "findOne", async (f) => convs.get(`${ws()}|${f.phoneNumber}`) || null);
  stub(Conv, "create", async (d) => {
    const c = new Conv(d);
    c.save = async () => c;
    convs.set(`${ws()}|${d.phoneNumber}`, c);
    return c;
  });
  stub(Conv, "updateOne", async (f, u) => {
    const c = convs.get(`${ws()}|${f.phoneNumber}`);
    if (!c || c.profileName) return { modifiedCount: 0 };
    Object.assign(c, u.$set);
    return { modifiedCount: 1 };
  });

  stub(Msg, "exists", async (f) => msgs.some((m) => m.ws === ws() && m.messageId === f.messageId));
  stub(Msg, "create", async (d) => {
    // messageId is globally unique in Mongo
    if (msgs.some((m) => m.messageId === d.messageId)) throw Object.assign(new Error("dup"), { code: 11000 });
    msgs.push({ ...d, ws: ws() });
    return d;
  });
  stub(Msg, "updateOne", async (f, u) => {
    const m = msgs.find((x) => x.ws === ws() && x.messageId === f.messageId && x.type === f.type);
    if (!m) return { modifiedCount: 0 };
    Object.assign(m, u.$set);
    return { modifiedCount: 1 };
  });
});

const BIZ = "15550001111";
const CUST = "919800000001";
const envelope = (field, value, pn = "SARA_PN") => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA1", changes: [{ field, value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: BIZ, phone_number_id: pn },
    ...value,
  } }] }],
});

/* ---------------- smb_message_echoes ---------------- */
const echoes = (list, pn) => envelope("smb_message_echoes", {
  contacts: [{ wa_id: CUST, user_id: "US.1" }],
  message_echoes: list,
}, pn);
const echo = (id, extra = {}) => ({ from: BIZ, to: CUST, to_user_id: "US.1", id, timestamp: "1700000000", type: "text", text: { body: "Hi from app" }, ...extra });

test("echoes: saved as outbound in the owning workspace, no unread bump", async () => {
  const r = await wa.processWebhookPayload(echoes([echo("wamid.E1")]));
  assert.equal(r.echoes, 1);
  assert.equal(msgs.length, 1);
  const m = msgs[0];
  assert.equal(m.ws, SARA);
  assert.equal(m.direction, "outbound");
  assert.equal(m.status, "sent");
  assert.equal(m.from, `+${BIZ}`);
  assert.equal(m.to, `+${CUST}`);
  assert.equal(m.body, "Hi from app");
  const c = convs.get(`${SARA}|+${CUST}`);
  assert.equal(c.unreadCount, 0);
  assert.equal(c.lastMessageDirection, "outbound");
  assert.ok(c.lastOutboundAt);
  assert.equal(c.lastInboundAt, null, "24h window never opened by an echo");
});

test("echoes: duplicate delivery is de-duplicated by message ID", async () => {
  await wa.processWebhookPayload(echoes([echo("wamid.E2")]));
  const r = await wa.processWebhookPayload(echoes([echo("wamid.E2"), echo("wamid.E2")]));
  assert.equal(r.echoes, 0);
  assert.equal(r.ignored, 2);
  assert.equal(msgs.length, 1);
});

test("echoes: media kept, revoke/edit and malformed entries skipped", async () => {
  const r = await wa.processWebhookPayload(echoes([
    echo("wamid.M1", { type: "image", text: undefined, image: { id: "MEDIA9", mime_type: "image/jpeg", caption: "cap" } }),
    echo("wamid.R1", { type: "revoke", text: undefined, revoke: { original_message_id: "wamid.E1" } }),
    echo("wamid.ED", { type: "edit", text: undefined, edit: { original_message_id: "wamid.E1" } }),
    echo(undefined),
    null,
  ]));
  assert.equal(r.echoes, 1);
  assert.equal(r.ignored, 4);
  assert.equal(msgs[0].meta.mediaId, "MEDIA9");
  assert.equal(msgs[0].body, "cap");
});

test("echoes: missing `to` uses the contact only when unambiguous", async () => {
  const noTo = echo("wamid.N1", { to: undefined });
  let r = await wa.processWebhookPayload(echoes([noTo]));
  assert.equal(r.echoes, 1);
  assert.equal(msgs[0].to, `+${CUST}`);

  const p = echoes([echo("wamid.N2", { to: undefined })]);
  p.entry[0].changes[0].value.contacts.push({ wa_id: "919800000002" });
  r = await wa.processWebhookPayload(p);
  assert.equal(r.echoes, 0);
  assert.equal(r.ignored, 1);
});

/* ---------------- history ---------------- */
const history = (chunks, extra = {}, pn) => envelope("history", { history: chunks, ...extra }, pn);
const hmsg = (id, from, ts, status = "READ", extra = {}) => ({
  from, id, timestamp: String(ts), type: "text", text: { body: `msg ${id}` },
  history_context: { status }, ...extra,
});
const chunk = (messages, threadId = CUST) => ({
  metadata: { phase: 0, chunk_order: 1, progress: 100 },
  threads: [{ id: threadId, context: { wa_id: threadId }, messages }],
});

test("history: imports both directions with mapped status, no unread, newest preview kept", async () => {
  const r = await wa.processWebhookPayload(history([chunk([
    hmsg("wamid.H2", CUST, 1700000200, "READ"),
    hmsg("wamid.H1", BIZ, 1700000100, "DELIVERED"),
    hmsg("wamid.H3", CUST, 1700000050, "PLAYED"),
  ])]));
  assert.equal(r.history, 3);
  const byId = Object.fromEntries(msgs.map((m) => [m.messageId, m]));
  assert.equal(byId["wamid.H2"].direction, "inbound");
  assert.equal(byId["wamid.H2"].status, "read");
  assert.equal(byId["wamid.H1"].direction, "outbound");
  assert.equal(byId["wamid.H1"].status, "delivered");
  assert.equal(byId["wamid.H1"].from, `+${BIZ}`);
  assert.equal(byId["wamid.H3"].status, "read");
  assert.ok(msgs.every((m) => m.ws === SARA));

  const c = convs.get(`${SARA}|+${CUST}`);
  assert.equal(c.unreadCount, 0);
  assert.equal(c.lastMessagePreview, "msg wamid.H2", "older history never overwrites newer preview");
  assert.equal(c.lastInboundAt, null);
  assert.equal(c.lastOutboundAt, null);
});

test("history: re-sent chunks are de-duplicated", async () => {
  const p = history([chunk([hmsg("wamid.D1", CUST, 1700000000)])]);
  await wa.processWebhookPayload(p);
  const r = await wa.processWebhookPayload(p);
  assert.equal(r.history, 0);
  assert.equal(r.ignored, 1);
  assert.equal(msgs.length, 1);
});

test("history: declined share and malformed threads/messages are ignored safely", async () => {
  const r = await wa.processWebhookPayload(history([
    { errors: [{ code: 2593109, title: "History sync is turned off by the business from the WhatsApp Business App" }] },
    { threads: [{ messages: [hmsg("wamid.X1", CUST, 1)] }] },       // no thread id
    chunk([{ id: "wamid.X2", type: "text" }, hmsg(undefined, CUST, 1), "junk"]),
    { threads: "nope" },
    null,
  ]));
  assert.equal(r.history, 0);
  assert.equal(msgs.length, 0);
  assert.ok(r.ignored >= 4);
});

test("history: media placeholder is filled by the follow-up media webhook", async () => {
  await wa.processWebhookPayload(history([chunk([
    { from: CUST, id: "wamid.P1", timestamp: "1700000000", type: "media_placeholder", history_context: { status: "DELIVERED" } },
  ])]));
  assert.equal(msgs[0].type, "media_placeholder");
  assert.equal(msgs[0].body, "[media]");

  const r = await wa.processWebhookPayload(envelope("history", {
    messages: [
      { from: CUST, id: "wamid.P1", timestamp: "1700000000", type: "image", image: { id: "ASSET1", mime_type: "image/jpeg", caption: "photo" } },
      { from: CUST, id: "wamid.UNKNOWN", type: "image", image: { id: "ASSET2" } },
    ],
  }));
  assert.equal(r.history, 1);
  assert.equal(r.ignored, 1, "never creates a message from a bare media follow-up");
  assert.equal(msgs[0].type, "image");
  assert.equal(msgs[0].meta.mediaId, "ASSET1");
  assert.equal(msgs[0].body, "photo");
});

/* ---------------- smb_app_state_sync ---------------- */
const stateSync = (items, pn) => envelope("smb_app_state_sync", { state_sync: items }, pn);
const contactItem = (phone, action = "add", full_name = "Asha K") => ({
  type: "contact", action, metadata: { timestamp: 1700000000 },
  contact: { full_name, first_name: "Asha", phone_number: phone, user_id: "US.2" },
});

test("state sync: names an existing unnamed thread only; never creates or overwrites", async () => {
  await ctx.runWithWorkspace(SARA, () => Conv.create({ phoneNumber: `+${CUST}`, profileName: null }));
  await ctx.runWithWorkspace(SARA, () => Conv.create({ phoneNumber: "+919800000005", profileName: "Real Profile" }));

  const r = await wa.processWebhookPayload(stateSync([
    contactItem(CUST),
    contactItem("919800000005"),
    contactItem("919800000009"),                         // no thread → not created
    contactItem(CUST, "remove", undefined),
    { type: "contact", action: "add", contact: { user_id: "US.3", full_name: "Username only" } },
    null,
  ]));
  assert.equal(r.contacts, 1);
  assert.equal(convs.get(`${SARA}|+${CUST}`).profileName, "Asha K");
  assert.equal(convs.get(`${SARA}|+919800000005`).profileName, "Real Profile");
  assert.equal(convs.has(`${SARA}|+919800000009`), false);
  assert.equal(convs.size, 2);
  assert.equal(r.ignored, 5);
});

/* ---------------- tenant isolation ---------------- */
test("isolation: unknown phone_number_id is dropped for every coexistence field", async () => {
  for (const p of [
    echoes([echo("wamid.U1")], "UNKNOWN_PN"),
    history([chunk([hmsg("wamid.U2", CUST, 1)])], {}, "UNKNOWN_PN"),
    stateSync([contactItem(CUST)], "UNKNOWN_PN"),
  ]) {
    const r = await wa.processWebhookPayload(p);
    assert.equal(r.ignored, 1);
  }
  assert.equal(msgs.length, 0);
  assert.equal(convs.size, 0, "never falls into the default workspace");
});

test("isolation: same customer in two workspaces stays separate", async () => {
  await wa.processWebhookPayload(echoes([echo("wamid.S1")], "SARA_PN"));
  await wa.processWebhookPayload(echoes([echo("wamid.V1")], "SIVA_PN"));
  assert.ok(convs.has(`${SARA}|+${CUST}`));
  assert.ok(convs.has(`${SIVA}|+${CUST}`));
  assert.notEqual(convs.get(`${SARA}|+${CUST}`), convs.get(`${SIVA}|+${CUST}`));
  assert.deepEqual(msgs.map((m) => [m.messageId, m.ws]), [["wamid.S1", SARA], ["wamid.V1", SIVA]]);

  // A wamid already stored for Sara is never re-attached to Siva's thread
  const r = await wa.processWebhookPayload(echoes([echo("wamid.S1")], "SIVA_PN"));
  assert.equal(r.echoes, 0);
  assert.equal(msgs.length, 2);
});

test("malformed coexistence payloads never throw", async () => {
  for (const value of [null, {}, { metadata: null }, { metadata: { phone_number_id: "SARA_PN" }, message_echoes: "x", history: {}, state_sync: 5 }]) {
    for (const field of ["history", "smb_message_echoes", "smb_app_state_sync"]) {
      await wa.processWebhookPayload({ object: "whatsapp_business_account", entry: [{ changes: [{ field, value }] }] });
    }
  }
  assert.equal(msgs.length, 0);
});

/* ---------------- account_update ---------------- */
const account = (value, entryId = "PARTNER_BIZ") => ({
  object: "whatsapp_business_account",
  entry: [{ id: entryId, time: 1700000000, changes: [{ field: "account_update", value }] }],
});
const captureUpdates = () => {
  const calls = [];
  stub(MetaConnection, "updateMany", async (filter, change) => (calls.push({ filter, change }), { modifiedCount: 1 }));
  return calls;
};

test("account_update: PARTNER_REMOVED uses waba_info.waba_id and records the reason", async () => {
  const calls = captureUpdates();
  const r = await wa.processWebhookPayload(account({
    event: "PARTNER_REMOVED",
    waba_info: { waba_id: "WABA1", owner_business_id: "OB1" },
    disconnection_info: { reason: "PRIMARY_INACTIVITY", initiated_by: "SYSTEM" },
  }));
  assert.equal(r.ignored, 0);
  assert.equal(calls[0].filter["whatsapp.wabaId"], "WABA1", "never the partner business id");
  assert.equal(calls[0].change.$set["whatsapp.connected"], false);
  assert.match(calls[0].change.$set["whatsapp.lastError"], /PRIMARY_INACTIVITY/);
});

test("account_update: ACCOUNT_OFFBOARDED falls back to entry.id", async () => {
  const calls = captureUpdates();
  await wa.processWebhookPayload(account({ event: "ACCOUNT_OFFBOARDED" }, "WABA7"));
  assert.equal(calls[0].filter["whatsapp.wabaId"], "WABA7");
});

test("account_update: PARTNER_APP_UNINSTALLED disconnects only for this app", async () => {
  const calls = captureUpdates();
  await wa.processWebhookPayload(account({ event: "PARTNER_APP_UNINSTALLED", waba_info: { waba_id: "WABA1", partner_app_id: "other-app" } }));
  await wa.processWebhookPayload(account({ event: "PARTNER_APP_UNINSTALLED", waba_info: { waba_id: "WABA1" } }));
  assert.equal(calls.length, 0);

  await wa.processWebhookPayload(account({ event: "PARTNER_APP_UNINSTALLED", waba_info: { waba_id: "WABA1", partner_app_id: "test-app" } }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].change.$set["whatsapp.connected"], false);
});

test("account_update: install/added events never change connection; RECONNECTED never auto-connects", async () => {
  const calls = captureUpdates();
  for (const event of ["PARTNER_ADDED", "PARTNER_APP_INSTALLED"]) {
    const r = await wa.processWebhookPayload(account({ event, waba_info: { waba_id: "WABA1", partner_app_id: "test-app" } }));
    assert.equal(r.ignored, 1);
  }
  assert.equal(calls.length, 0);

  await wa.processWebhookPayload(account({ event: "ACCOUNT_RECONNECTED" }, "WABA1"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filter["whatsapp.connected"], false);
  assert.equal(calls[0].change.$set["whatsapp.connected"], undefined);
});

test("account_update: unknown disconnect reasons are not echoed", async () => {
  const calls = captureUpdates();
  await wa.processWebhookPayload(account({ event: "PARTNER_REMOVED", waba_info: { waba_id: "WABA1" }, disconnection_info: { reason: "<script>" } }));
  assert.doesNotMatch(calls[0].change.$set["whatsapp.lastError"], /script/);
});
