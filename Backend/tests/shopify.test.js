// Focused, DB-free tests for the Shopify connection (Phase 1).
// Run: node --test tests/
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.JWT_SECRET = "test-jwt";
process.env.SHOPIFY_API_KEY = "client-id";
process.env.SHOPIFY_API_SECRET = "client-secret";
process.env.SHOPIFY_SCOPES = "read_orders,read_inventory,write_inventory";
process.env.SHOPIFY_API_VERSION = "2026-07";
process.env.SHOPIFY_OAUTH_REDIRECT_URI = "https://api.test/api/shopify/oauth/callback";
process.env.SHOPIFY_WEBHOOK_URL = "https://api.test/api/shopify/webhooks";
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
process.env.SHOPIFY_STATE_SECRET = "state-secret-for-tests-0123456789abcdef";

await import("../utils/workspaceScope.js");
const mongoose = (await import("mongoose")).default;
const ctx = await import("../utils/workspaceContext.js");
const { encrypt, decrypt } = await import("../services/shopify/crypto.js");
const svc = await import("../services/shopify/shopify.service.js");
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const ShopifyOAuthState = (await import("../models/ShopifyOAuthState.js")).default;
const ShopifyWebhookEvent = (await import("../models/ShopifyWebhookEvent.js")).default;
const jwt = (await import("jsonwebtoken")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;
const Product = (await import("../models/Product.model.js")).default;

const DEFAULT_WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
const WS_A = "bbbbbbbbbbbbbbbbbbbbbbbb";
const WS_B = "cccccccccccccccccccccccc";
const SHOP = "acme.myshopify.com";

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const origFetch = globalThis.fetch;
const audits = [];

beforeEach(() => {
  ctx.setDefaultWorkspaceId(DEFAULT_WS);
  audits.length = 0;
  stub(AuditLog, "create", async (d) => (audits.push(d), d));
});
afterEach(() => {
  while (restore.length) restore.pop()();
  globalThis.fetch = origFetch;
});

const json = (status, body) => ({ ok: status < 400, status, statusText: "", json: async () => body });

/* ---------------- shop domain ---------------- */
test("normalizeShop accepts only myshopify.com domains", () => {
  assert.equal(svc.normalizeShop("Acme"), SHOP);
  assert.equal(svc.normalizeShop("https://acme.myshopify.com/admin"), SHOP);
  assert.equal(svc.normalizeShop("evil.com"), null);
  assert.equal(svc.normalizeShop("acme.myshopify.com.evil.com"), null);
  assert.equal(svc.normalizeShop("-x.myshopify.com"), null);
  assert.equal(svc.normalizeShop(""), null);
});

/* ---------------- token crypto ---------------- */
test("token encryption round-trips, detects tampering and fails closed without a key", () => {
  const blob = encrypt("shpat_secret");
  assert.ok(blob.startsWith("v1.") && !blob.includes("shpat_secret"));
  assert.equal(decrypt(blob), "shpat_secret");

  const parts = blob.split(".");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decrypt(parts.join(".")));

  const key = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
  try {
    delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => encrypt("x"), /not configured/);
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "too-short";
    assert.throws(() => encrypt("x"), /32 bytes/);
  } finally {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = key;
  }
});

/* ---------------- HMAC ---------------- */
const signQuery = (params) => {
  const msg = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return new URLSearchParams({ ...params, hmac: crypto.createHmac("sha256", "client-secret").update(msg).digest("hex") });
};

test("OAuth callback HMAC: valid passes, tampered or missing fails", () => {
  const q = signQuery({ code: "abc", shop: SHOP, state: "s", timestamp: "1700000000" });
  assert.equal(svc.verifyCallbackHmac(q), true);
  q.set("shop", "other.myshopify.com");
  assert.equal(svc.verifyCallbackHmac(q), false);
  assert.equal(svc.verifyCallbackHmac(new URLSearchParams({ shop: SHOP })), false);
});

test("webhook HMAC: valid passes, modified body or bad header fails", () => {
  const body = Buffer.from(JSON.stringify({ id: 1 }));
  const sig = crypto.createHmac("sha256", "client-secret").update(body).digest("base64");
  assert.equal(svc.verifyWebhookHmac(body, sig), true);
  assert.equal(svc.verifyWebhookHmac(Buffer.from('{"id":2}'), sig), false);
  assert.equal(svc.verifyWebhookHmac(body, "nope"), false);
  assert.equal(svc.verifyWebhookHmac(undefined, sig), false);
});

/* ---------------- OAuth state ---------------- */
test("OAuth state is bound to the shop and purpose", () => {
  const url = new URL(svc.buildAuthUrl({ shop: SHOP, userId: WS_A, workspaceId: WS_A, nonce: "n1" }));
  assert.equal(url.host, SHOP);
  assert.equal(url.searchParams.get("client_id"), "client-id");
  const state = url.searchParams.get("state");
  assert.equal(svc.verifyState(state, SHOP).ws, WS_A);
  assert.throws(() => svc.verifyState(state, "other.myshopify.com"), /Invalid OAuth state/);
});

test("OAuth state uses the dedicated SHOPIFY_STATE_SECRET, never JWT_SECRET", () => {
  // A state signed with the login secret is rejected
  const forged = jwt.sign({ purpose: "shopify-oauth", shop: SHOP, uid: WS_A, ws: WS_A, nonce: "n" }, process.env.JWT_SECRET);
  assert.throws(() => svc.verifyState(forged, SHOP), /invalid signature/);
  const nonceless = jwt.sign({ purpose: "shopify-oauth", shop: SHOP, uid: WS_A, ws: WS_A }, process.env.SHOPIFY_STATE_SECRET);
  assert.throws(() => svc.verifyState(nonceless, SHOP), /Invalid OAuth state/);

  const saved = process.env.SHOPIFY_STATE_SECRET;
  try {
    for (const bad of [undefined, "too-short", process.env.JWT_SECRET.padEnd(40, "x")]) {
      if (bad === undefined) delete process.env.SHOPIFY_STATE_SECRET;
      else process.env.SHOPIFY_STATE_SECRET = bad;
      if (bad?.startsWith("test-jwt")) process.env.JWT_SECRET = bad; // same as the login secret
      assert.deepEqual(svc.missingOAuthConfig(), ["SHOPIFY_STATE_SECRET"]);
      assert.deepEqual(svc.missingConfig(), []); // webhooks / worker unaffected
      assert.throws(() => svc.buildAuthUrl({ shop: SHOP, userId: WS_A, workspaceId: WS_A, nonce: "n" }), /SHOPIFY_STATE_SECRET/);
    }
  } finally {
    process.env.SHOPIFY_STATE_SECRET = saved;
    process.env.JWT_SECRET = "test-jwt";
  }
});

/* ---------------- single-use state + authenticated finish ---------------- */
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");

test("startOAuth records a single-use attempt with only the nonce hash", async () => {
  let doc;
  stub(ShopifyOAuthState, "create", async (d) => ((doc = d), d));
  const url = new URL(await svc.startOAuth({ shop: SHOP, userId: "u1", workspaceId: WS_A }));
  const { nonce, ws, uid } = svc.verifyState(url.searchParams.get("state"), SHOP);
  assert.equal(doc.nonceHash, sha(nonce));
  assert.equal(JSON.stringify(doc).includes(nonce), false);
  assert.deepEqual([String(doc.workspace), String(doc.user), doc.shop], [WS_A, "u1", SHOP]);
  assert.deepEqual([ws, uid], [WS_A, "u1"]);
  assert.ok(doc.expiresAt > new Date() && doc.expiresAt <= new Date(Date.now() + 10 * 60_000));
});

test("claimCallback consumes the state once, scoped to its workspace, user and shop", async () => {
  let filter, update;
  let used = false;
  stub(ShopifyOAuthState, "findOneAndUpdate", async (f, u) => {
    filter = f;
    update = u;
    if (used) return null; // already moved out of "pending"
    used = true;
    return { _id: "st1" };
  });
  const s = { nonce: "abc", ws: WS_A, uid: "u1" };
  const id = await svc.claimCallback(s, SHOP, "auth-code");
  assert.match(id, /^[a-f0-9]{48}$/);
  assert.deepEqual(
    [filter.nonceHash, filter.workspace, filter.user, filter.shop, filter.status],
    [sha("abc"), WS_A, "u1", SHOP, "pending"]
  );
  assert.ok(filter.expiresAt.$gt instanceof Date);
  assert.equal(update.$set.status, "callback");
  assert.equal(update.$set.completeHash, sha(id));
  assert.notEqual(update.$set.code, "auth-code");
  assert.equal(decrypt(update.$set.code), "auth-code");
  // Replay of the same state (and code) is refused
  await assert.rejects(svc.claimCallback(s, SHOP, "auth-code"), /Invalid OAuth state/);
});

const finishStub = (st) => {
  const seen = [];
  stub(ShopifyOAuthState, "findOneAndUpdate", (f, u) => {
    seen.push({ f, u });
    const match = st && f.completeHash === st.completeHash && String(f.workspace) === String(st.workspace) && String(f.user) === String(st.user);
    const result = match ? { ...st } : null;
    return { select: () => Promise.resolve(result) };
  });
  return seen;
};

test("finishOAuth: only the initiating admin in the same workspace can redeem, once", async () => {
  const id = "a".repeat(48);
  const st = { completeHash: sha(id), workspace: WS_A, user: "u1", shop: SHOP, code: encrypt("auth-code") };

  // Another workspace's admin, or another admin of the same workspace → refused (403), nothing connected
  let tokenCalls = 0;
  globalThis.fetch = async () => (tokenCalls++, json(500, {}));
  finishStub(st);
  let pending = true;
  stub(ShopifyOAuthState, "findOne", async (f) => (pending && f.completeHash === st.completeHash && f.status === "callback" ? { _id: "st" } : null));
  await assert.rejects(svc.finishOAuth({ completeId: id, workspaceId: WS_B, userId: "u1" }), (e) => e.status === 403 && /different ReadyTech admin/.test(e.message));
  await assert.rejects(svc.finishOAuth({ completeId: id, workspaceId: WS_A, userId: "u2" }), (e) => e.status === 403);
  // Expired / already used / unknown → 410
  pending = false;
  await assert.rejects(svc.finishOAuth({ completeId: id, workspaceId: WS_B, userId: "u1" }), (e) => e.status === 410);
  await assert.rejects(svc.finishOAuth({ completeId: "not-an-id", workspaceId: WS_A, userId: "u1" }), (e) => e.status === 422);
  assert.equal(tokenCalls, 0);

  // The initiator: code exchanged for THIS workspace; the state is marked used and the code cleared
  const calls = [];
  globalThis.fetch = shopifyApi(calls);
  const seen = finishStub(st);
  let upsert;
  stub(ShopifyConnection, "findOne", async () => null);
  stub(ShopifyConnection, "findOneAndUpdate", async (f, u) => ((upsert = u), { _id: "c1", shopDomain: SHOP, workspace: WS_A, connectedBy: "u1" }));
  const conn = await svc.finishOAuth({ completeId: id, workspaceId: WS_A, userId: "u1" });
  assert.equal(conn.shopDomain, SHOP);
  assert.equal(JSON.parse(calls[0].body).code, "auth-code");
  assert.equal(upsert.$set.workspace, WS_A);
  assert.deepEqual(seen[0].u.$set, { status: "used", code: null });
  assert.equal(seen[0].f.status, "callback");
});

test("assertScopes accepts implied read scopes and rejects missing ones", () => {
  assert.deepEqual(svc.assertScopes("read_orders,write_inventory").sort(), ["read_orders", "write_inventory"]);
  assert.throws(() => svc.assertScopes("read_orders"), /write_inventory/);
});

/* ---------------- tenant isolation in the scope plugin ---------------- */
test("connection lookups bypass default-workspace scoping; ordinary models stay scoped", async () => {
  mongoose.set("bufferCommands", false);
  try {
    const q = ShopifyConnection.findByShop(SHOP);
    await q.exec().catch(() => {}); // no DB: fails after the pre hooks ran
    assert.equal(JSON.stringify(q.getFilter()).includes(DEFAULT_WS), false);

    // Control: an unauthenticated query on a scoped model gets the default workspace
    const control = Product.find({ sku: "X" });
    await control.exec().catch(() => {});
    assert.equal(JSON.stringify(control.getFilter()).includes(DEFAULT_WS), true);
  } finally {
    mongoose.set("bufferCommands", true);
  }
});

test("toSafeJSON never exposes tokens", () => {
  const doc = new ShopifyConnection({ shopDomain: SHOP, workspace: WS_A, accessToken: "enc-a", refreshToken: "enc-r" });
  const out = JSON.stringify(doc.toSafeJSON());
  assert.equal(out.includes("enc-a") || out.includes("enc-r"), false);
});

/* ---------------- webhooks ---------------- */
const connDoc = (over = {}) => ({ _id: "c1", shopDomain: SHOP, workspace: WS_A, status: "active", connectedBy: "u1", ...over });

test("webhook for an unknown shop is dropped, never written to the default workspace", async () => {
  let writes = 0;
  stub(ShopifyConnection, "findOne", async () => null);
  stub(ShopifyConnection, "updateOne", async () => (writes++, {}));
  const r = await svc.handleWebhook({ topic: "app/uninstalled", shop: "ghost.myshopify.com" });
  assert.deepEqual(r, { ignored: "unknown shop" });
  assert.equal(writes, 0);
});

test("app/uninstalled runs in the owning workspace and clears tokens", async () => {
  let filter, update, wsDuring;
  stub(ShopifyConnection, "findOne", async (f) => (f.shopDomain === SHOP ? connDoc() : null));
  stub(ShopifyConnection, "updateOne", async (f, u) => {
    filter = f;
    update = u;
    wsDuring = ctx.getWorkspaceId();
    return { modifiedCount: 1 };
  });
  await svc.handleWebhook({ topic: "app/uninstalled", shop: SHOP, webhookId: "w1" });
  assert.equal(wsDuring, WS_A);
  assert.equal(filter.workspace, WS_A);
  assert.equal(update.$set.status, "uninstalled");
  assert.equal(update.$set.accessToken, null);
  assert.equal(update.$set.refreshToken, null);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].workspace, WS_A);
});

test("duplicate app/uninstalled delivery is a no-op (no second audit entry)", async () => {
  stub(ShopifyConnection, "findOne", async () => connDoc({ status: "uninstalled" }));
  stub(ShopifyConnection, "updateOne", async () => ({ modifiedCount: 0 }));
  await svc.handleWebhook({ topic: "app/uninstalled", shop: SHOP });
  assert.equal(audits.length, 0);
});

test("shop/redact never deletes an active (reinstalled) connection; erases former workspaces' events", async () => {
  let deleted = 0;
  let eventFilter;
  stub(ShopifyConnection, "findOne", async () => connDoc());
  stub(ShopifyConnection, "deleteOne", async () => (deleted++, {}));
  stub(ShopifyWebhookEvent, "deleteMany", async (f) => ((eventFilter = f), { deletedCount: 3 }));
  assert.deepEqual(await svc.handleWebhook({ topic: "shop/redact", shop: SHOP }), { ignored: "store reinstalled" });
  assert.equal(deleted, 0);
  assert.equal(eventFilter.shopDomain, SHOP);
  assert.deepEqual(eventFilter.workspace, { $nin: [WS_A, null] }); // the current workspace keeps its live data
  assert.equal(audits.length, 1);
  assert.equal(audits[0].workspace, WS_A);
});

test("shop/redact after uninstall erases the shop's events in every workspace (store moved)", async () => {
  let eventFilter, connFilter;
  stub(ShopifyConnection, "findOne", async () => connDoc({ status: "uninstalled", workspace: WS_B }));
  stub(ShopifyConnection, "deleteOne", async (f) => ((connFilter = f), {}));
  stub(ShopifyWebhookEvent, "deleteMany", async (f) => ((eventFilter = f), { deletedCount: 5 }));
  await svc.handleWebhook({ topic: "shop/redact", shop: SHOP, payload: { shop_domain: SHOP } });
  assert.deepEqual(eventFilter, { workspace: { $ne: null }, shopDomain: SHOP });
  assert.equal(connFilter.workspace, WS_B);
});

/* ---------------- webhook body ↔ stored connection ---------------- */
test("webhook whose body names a different shop is ignored (no writes)", async () => {
  let writes = 0;
  stub(ShopifyConnection, "findOne", async () => connDoc({ shop: { id: "gid://shopify/Shop/42" } }));
  stub(ShopifyConnection, "updateOne", async () => (writes++, { modifiedCount: 1 }));
  stub(ShopifyWebhookEvent, "updateMany", async () => (writes++, { modifiedCount: 1 }));
  const warn = console.warn;
  console.warn = () => {};
  try {
    const other = await svc.handleWebhook({ topic: "app/uninstalled", shop: SHOP, payload: { id: 42, myshopify_domain: "other.myshopify.com" } });
    assert.deepEqual(other, { ignored: "shop mismatch" });
    const wrongId = await svc.handleWebhook({ topic: "customers/redact", shop: SHOP, payload: { shop_id: 7, shop_domain: SHOP, customer: { id: 1 } } });
    assert.deepEqual(wrongId, { ignored: "shop mismatch" });
  } finally {
    console.warn = warn;
  }
  assert.equal(writes, 0);

  // Matching body (and bodies without shop fields) proceed as before
  assert.deepEqual(await svc.handleWebhook({ topic: "app/uninstalled", shop: SHOP, payload: { id: 42, myshopify_domain: SHOP } }), { handled: "app/uninstalled" });
  assert.equal(writes, 1);
});

test("payloadMatchesShop: legacy connections without a stored shop id still match by domain", () => {
  const conn = connDoc();
  assert.equal(svc.payloadMatchesShop("shop/redact", { shop_id: 9, shop_domain: SHOP }, conn), true);
  assert.equal(svc.payloadMatchesShop("shop/redact", { shop_id: 9, shop_domain: "x.myshopify.com" }, conn), false);
  assert.equal(svc.payloadMatchesShop("orders/create", { id: 123, line_items: [] }, conn), true);
  assert.equal(svc.payloadMatchesShop("orders/create", null, conn), true);
});

/* ---------------- connect ---------------- */
const shopifyApi = (calls) => async (url, init) => {
  calls.push({ url: String(url), method: init?.method, body: init?.body });
  if (String(url).endsWith("/admin/oauth/access_token")) return json(200, { access_token: "shpat_new", scope: "read_orders,write_inventory" });
  const { query } = JSON.parse(init.body);
  if (query.includes("shop {")) return json(200, { data: { shop: { id: "gid://shopify/Shop/1", name: "Acme", email: "a@acme.test", myshopifyDomain: SHOP, currencyCode: "INR" } } });
  return json(200, { data: { webhookSubscriptionCreate: { webhookSubscription: { id: "gid://w/1" }, userErrors: [] } } });
};

test("connecting a store active in another workspace is refused and nothing is revoked", async () => {
  const calls = [];
  globalThis.fetch = shopifyApi(calls);
  stub(ShopifyConnection, "findOne", async () => null);
  stub(ShopifyConnection, "findOneAndUpdate", async () => {
    throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { shopDomain: 1 } });
  });
  await assert.rejects(
    svc.completeConnection({ shop: SHOP, code: "c", workspaceId: WS_B, userId: "u2" }),
    (err) => err.status === 409 && /another ReadyTech workspace/.test(err.message)
  );
  assert.equal(calls.some((c) => c.method === "DELETE"), false);
  assert.equal(audits.length, 0);
});

test("successful connect stores encrypted tokens for the caller's workspace only", async () => {
  const calls = [];
  let filter, update;
  globalThis.fetch = shopifyApi(calls);
  stub(ShopifyConnection, "findOne", async () => null);
  stub(ShopifyConnection, "findOneAndUpdate", async (f, u) => {
    filter = f;
    update = u;
    return { _id: "c1", shopDomain: SHOP, workspace: WS_A, connectedBy: "u1" };
  });
  await svc.completeConnection({ shop: SHOP, code: "c", workspaceId: WS_A, userId: "u1" });

  assert.equal(filter.shopDomain, SHOP);
  assert.deepEqual(filter.$or[1], { workspace: WS_A });
  assert.equal(update.$set.workspace, WS_A);
  assert.notEqual(update.$set.accessToken, "shpat_new");
  assert.equal(decrypt(update.$set.accessToken), "shpat_new");
  assert.deepEqual(update.$set.webhooks.registered, svc.WEBHOOK_TOPICS);
  assert.ok(svc.WEBHOOK_TOPICS.includes("ORDERS_CREATE") && svc.WEBHOOK_TOPICS.includes("INVENTORY_LEVELS_UPDATE"));
  const tokenReq = JSON.parse(calls[0].body);
  assert.equal(tokenReq.expiring, 1);
  assert.equal(audits[0].action, "CREATE");
});

test("connect rejects a workspace that already has a different active store", async () => {
  globalThis.fetch = shopifyApi([]);
  stub(ShopifyConnection, "findOne", async (f) => (f.workspace === WS_A ? { shopDomain: "old.myshopify.com" } : null));
  await assert.rejects(
    svc.completeConnection({ shop: SHOP, code: "c", workspaceId: WS_A, userId: "u1" }),
    (err) => err.status === 409 && /old\.myshopify\.com/.test(err.message)
  );
});

/* ---------------- token refresh ---------------- */
test("expired token is refreshed with compare-and-set on the old token", async () => {
  const conn = connDoc({
    accessToken: encrypt("old"),
    accessTokenExpiresAt: new Date(Date.now() - 1000),
    refreshToken: encrypt("refresh-1"),
  });
  let filter, update, body;
  globalThis.fetch = async (url, init) => {
    body = JSON.parse(init.body);
    return json(200, { access_token: "new", expires_in: 3600, refresh_token: "refresh-2" });
  };
  stub(ShopifyConnection, "updateOne", async (f, u) => ((filter = f), (update = u), { modifiedCount: 1 }));

  assert.equal(await svc.getAccessToken(conn), "new");
  assert.equal(body.grant_type, "refresh_token");
  assert.equal(body.refresh_token, "refresh-1");
  assert.equal(filter.accessToken, conn.accessToken);
  assert.equal(filter.workspace, WS_A);
  assert.equal(decrypt(update.$set.refreshToken), "refresh-2");
});

test("revoked refresh token flags the connection and throws unauthorized", async () => {
  const conn = connDoc({ accessToken: encrypt("old"), accessTokenExpiresAt: new Date(0), refreshToken: encrypt("r") });
  const sets = [];
  globalThis.fetch = async () => json(401, { error: "invalid_grant" });
  stub(ShopifyConnection, "findOne", async () => ({ accessToken: conn.accessToken, accessTokenExpiresAt: new Date(0) }));
  stub(ShopifyConnection, "updateOne", async (f, u) => (sets.push(u.$set), {}));
  await assert.rejects(svc.getAccessToken(conn), (err) => err.unauthorized === true);
  assert.equal(sets[0].status, "error");
});

/* ---------------- GraphQL client ---------------- */
test("GraphQL client retries THROTTLED responses", async () => {
  let n = 0;
  globalThis.fetch = async () =>
    ++n === 1 ? json(200, { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] }) : json(200, { data: { ok: true } });
  assert.deepEqual(await svc.graphql(SHOP, "t", "query { ok }"), { ok: true });
  assert.equal(n, 2);
});

test("reconnecting the same store in the same workspace refreshes its token (no conflict)", async () => {
  const calls = [];
  let preFilter, filter;
  globalThis.fetch = shopifyApi(calls);
  stub(ShopifyConnection, "findOne", async (f) => ((preFilter = f), null));
  stub(ShopifyConnection, "findOneAndUpdate", async (f, u) => ((filter = f), { _id: "c1", shopDomain: SHOP, workspace: WS_A, connectedBy: "u1", ...u.$set }));
  const conn = await svc.completeConnection({ shop: SHOP, code: "c", workspaceId: WS_A, userId: "u1" });
  assert.deepEqual(preFilter.shopDomain, { $ne: SHOP }); // only a DIFFERENT active store blocks
  assert.deepEqual(filter.$or[1], { workspace: WS_A });
  assert.equal(conn.status, "active");
  assert.equal(calls.some((c) => c.method === "DELETE"), false);
});
