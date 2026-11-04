// End-to-end Shopify connect flow through the real app.js:
// connect → Shopify approval (signed callback) → authenticated finish → status →
// reconnect → other workspace refused → disconnect → reconnect.
// Real OAuth/HMAC/state/encryption code; only MongoDB models and Shopify's HTTP
// API are replaced by in-memory fakes. Run: node --test tests/
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const ENV = {
  JWT_SECRET: "test-jwt",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "test@test.dev",
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || "company@test.dev",
  CLIENT_URL: "https://crm.test",
  SHOPIFY_API_KEY: "client-id",
  SHOPIFY_API_SECRET: "client-secret",
  SHOPIFY_SCOPES: "read_products,read_orders,write_inventory",
  SHOPIFY_API_VERSION: "2026-10",
  SHOPIFY_OAUTH_REDIRECT_URI: "https://api.test/api/shopify/oauth/callback",
  SHOPIFY_WEBHOOK_URL: "https://api.test/api/shopify/webhooks",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
  SHOPIFY_STATE_SECRET: "flow-test-state-secret-0123456789abcdef",
};
Object.assign(process.env, ENV);

const app = (await import("../app.js")).default;
const { decrypt } = await import("../services/shopify/crypto.js");
const User = (await import("../models/User.js")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;
const M = {
  Connection: (await import("../models/ShopifyConnection.js")).default,
  State: (await import("../models/ShopifyOAuthState.js")).default,
  Event: (await import("../models/ShopifyWebhookEvent.js")).default,
  OrderLink: (await import("../models/ShopifyOrderLink.js")).default,
  InvLink: (await import("../models/ShopifyInventoryLink.js")).default,
};

const WS_A = new mongoose.Types.ObjectId(); // admin A's own workspace (workspace id = owner id)
const WS_B = new mongoose.Types.ObjectId();
const SHOP = "acme.myshopify.com";

/* ---------------- in-memory models ---------------- */
const get = (doc, path) => path.split(".").reduce((o, k) => o?.[k], doc);
const eq = (a, b) => String(a ?? null) === String(b ?? null);
const cond = (v, c) => {
  if (c && typeof c === "object" && !(c instanceof Date) && !mongoose.isValidObjectId(c)) {
    if ("$ne" in c) return !eq(v, c.$ne);
    if ("$in" in c) return c.$in.some((x) => eq(v, x));
    if ("$exists" in c) return (v !== undefined) === c.$exists;
    if ("$gt" in c) return v != null && new Date(v) > new Date(c.$gt);
  }
  return eq(v, c);
};
const matches = (doc, f) => Object.entries(f).every(([k, c]) => (k === "$or" ? c.some((x) => matches(doc, x)) : cond(get(doc, k), c)));
const chain = (value) => {
  const q = { then: (res, rej) => Promise.resolve(value).then(res, rej) };
  for (const m of ["select", "lean", "sort", "limit", "populate", "skip"]) q[m] = () => q;
  return q;
};
const setPaths = (doc, set) => {
  for (const [k, v] of Object.entries(set)) {
    const keys = k.split(".");
    let o = doc;
    keys.slice(0, -1).forEach((p) => (o = o[p] ??= {}));
    o[keys.at(-1)] = v;
  }
};

let conns, states, shopifyCalls;
const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const origFetch = globalThis.fetch;

beforeEach(() => {
  conns = [];
  states = [];
  shopifyCalls = [];
  stub(AuditLog, "create", async (d) => d);
  stub(User, "findById", (id) => chain([WS_A, WS_B].some((w) => eq(w, id)) ? { _id: id, role: "admin", isActive: true, workspace: null } : null));

  // ShopifyOAuthState
  stub(M.State, "create", async (d) => (states.push({ status: "pending", ...d }), d));
  stub(M.State, "findOneAndUpdate", (f, u, o) => {
    const doc = states.find((s) => matches(s, f));
    const before = doc && { ...doc };
    if (doc) setPaths(doc, u.$set);
    return chain(doc ? (o?.returnDocument === "before" ? before : { ...doc }) : null);
  });
  stub(M.State, "findOne", (f) => chain(states.find((s) => matches(s, f)) || null));

  // ShopifyConnection (unique shopDomain; one active per workspace)
  const hydrate = (d) => (d ? M.Connection.hydrate(JSON.parse(JSON.stringify(d))) : null);
  stub(M.Connection, "findOne", (f) => chain(hydrate(conns.find((c) => matches(c, f)))));
  stub(M.Connection, "findOneAndUpdate", async (f, u, o) => {
    let doc = conns.find((c) => matches(c, f));
    if (!doc) {
      if (!o?.upsert) return null;
      if (conns.some((c) => c.shopDomain === f.shopDomain)) throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { shopDomain: 1 } });
      doc = { _id: new mongoose.Types.ObjectId(), shopDomain: f.shopDomain, inventory: {}, webhooks: {} };
      conns.push(doc);
    }
    const next = { ...doc };
    setPaths(next, u.$set);
    if (next.status === "active" && conns.some((c) => c !== doc && c.status === "active" && eq(c.workspace, next.workspace))) {
      throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { workspace: 1 } });
    }
    Object.assign(doc, next);
    return hydrate(doc);
  });
  stub(M.Connection, "updateOne", async (f, u) => {
    const doc = conns.find((c) => matches(c, f));
    if (doc) setPaths(doc, u.$set);
    return { modifiedCount: doc ? 1 : 0 };
  });

  // Status summaries (no data)
  stub(M.Event, "aggregate", async () => []);
  stub(M.Event, "find", () => chain([]));
  stub(M.OrderLink, "find", () => chain([]));
  stub(M.OrderLink, "countDocuments", async () => 0);
  stub(M.InvLink, "find", () => chain([]));
  stub(M.InvLink, "countDocuments", async () => 0);

  // Shopify's HTTP API
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes(".myshopify.com")) return origFetch(url, init);
    shopifyCalls.push({ url: u, method: init?.method || "GET", body: init?.body });
    const json = (body) => ({ ok: true, status: 200, statusText: "", json: async () => body });
    if (u.endsWith("/admin/oauth/access_token")) {
      const { code } = JSON.parse(init.body);
      return json({ access_token: `shpat_${code}`, refresh_token: `shprt_${code}`, expires_in: 3600, refresh_token_expires_in: 86400, scope: "read_products,read_orders,write_inventory" });
    }
    const { query } = JSON.parse(init.body);
    if (query.includes("shop {")) return json({ data: { shop: { id: "gid://shopify/Shop/7", name: "Acme Store", email: "a@acme.test", myshopifyDomain: SHOP, currencyCode: "INR" } } });
    return json({ data: { webhookSubscriptionCreate: { webhookSubscription: { id: "gid://w/1" }, userErrors: [] } } });
  };
});
afterEach(() => {
  while (restore.length) restore.pop()();
  globalThis.fetch = origFetch;
});

let server, api;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  api = `http://127.0.0.1:${server.address().port}/api/shopify`;
});
after(() => server.close());

/* ---------------- helpers: the browser's side of the flow ---------------- */
const authFor = (ws) => ({ authorization: `Bearer ${jwt.sign({ id: String(ws) }, ENV.JWT_SECRET)}`, "content-type": "application/json" });
const call = (path, ws, init = {}) => origFetch(`${api}${path}`, { ...init, headers: { ...(ws ? authFor(ws) : {}), ...init.headers } });

/* Shopify approves: it redirects to redirect_uri with code + state + an HMAC signed with the app secret */
const shopifyApproves = (authorizeUrl, code) => {
  const a = new URL(authorizeUrl);
  const q = new URLSearchParams({ code, shop: a.host, state: a.searchParams.get("state"), timestamp: String(Math.floor(Date.now() / 1000)) });
  const msg = [...q.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
  q.set("hmac", crypto.createHmac("sha256", ENV.SHOPIFY_API_SECRET).update(msg).digest("hex"));
  return `${a.searchParams.get("redirect_uri")}?${q}`.replace("https://api.test/api/shopify", api);
};

const connect = async (ws, code, shop = "acme") => {
  const start = await call(`/oauth/url?shop=${shop}`, ws);
  assert.equal(start.status, 200);
  const authorizeUrl = (await start.json()).data.url;
  const cb = await origFetch(shopifyApproves(authorizeUrl, code), { redirect: "manual" });
  assert.equal(cb.status, 302);
  const back = new URL(cb.headers.get("location"));
  const finish = await call("/oauth/complete", ws, { method: "POST", body: JSON.stringify({ id: back.searchParams.get("complete") }) });
  return { authorizeUrl, back, finish, body: await finish.json() };
};

const quiet = async (fn) => {
  const [e, w] = [console.error, console.warn];
  console.error = console.warn = () => {};
  try {
    return await fn();
  } finally {
    [console.error, console.warn] = [e, w];
  }
};

/* ---------------- the flow ---------------- */
test("connect → approve → callback → finish saves the store in the caller's workspace", async () => {
  await quiet(async () => {
    const { authorizeUrl, back, finish, body } = await connect(WS_A, "c1");

    // Official Shopify authorization page for the entered store
    const a = new URL(authorizeUrl);
    assert.equal(`${a.origin}${a.pathname}`, `https://${SHOP}/admin/oauth/authorize`);
    assert.equal(a.searchParams.get("client_id"), "client-id");
    assert.equal(a.searchParams.get("redirect_uri"), ENV.SHOPIFY_OAUTH_REDIRECT_URI);

    // Back to the same ReadyTech page; the callback itself connects nothing
    assert.equal(`${back.origin}${back.pathname}`, "https://crm.test/shopify/return");
    assert.equal(finish.status, 200);
    assert.deepEqual(body.data, { shopDomain: SHOP, shopName: "Acme Store" });

    assert.equal(conns.length, 1);
    const c = conns[0];
    assert.equal(String(c.workspace), String(WS_A));
    assert.equal(c.status, "active");
    assert.notEqual(c.accessToken, "shpat_c1");
    assert.equal(decrypt(c.accessToken), "shpat_c1");
    assert.equal(decrypt(c.refreshToken), "shprt_c1");
    assert.equal(JSON.stringify(body).includes("shpat"), false);

    // The same completion can't be redeemed twice
    const replay = await call("/oauth/complete", WS_A, { method: "POST", body: JSON.stringify({ id: back.searchParams.get("complete") }) });
    assert.equal(replay.status, 410);

    // Status shows the connected store, never tokens
    const status = await (await call("/status", WS_A)).text();
    assert.equal(JSON.parse(status).data.connection.connected, true);
    assert.equal(JSON.parse(status).data.connection.shopDomain, SHOP);
    assert.doesNotMatch(status, /shpat|shprt|accessToken|refreshToken/);
  });
});

test("tampered callback (bad HMAC) and replayed state are refused", async () => {
  await quiet(async () => {
    const start = await (await call("/oauth/url?shop=acme", WS_A)).json();
    const good = shopifyApproves(start.data.url, "c2");
    const tampered = good.replace("code=c2", "code=evil");
    const bad = new URL((await origFetch(tampered, { redirect: "manual" })).headers.get("location"));
    assert.equal(bad.searchParams.get("connected"), "0");

    const first = new URL((await origFetch(good, { redirect: "manual" })).headers.get("location"));
    assert.ok(first.searchParams.get("complete"));
    const again = new URL((await origFetch(good, { redirect: "manual" })).headers.get("location"));
    assert.equal(again.searchParams.get("connected"), "0");
    assert.equal(conns.length, 0); // nothing connected without the authenticated finish
  });
});

test("only the admin who started it can finish (another workspace's admin gets 403)", async () => {
  await quiet(async () => {
    const start = await (await call("/oauth/url?shop=acme", WS_A)).json();
    const back = new URL((await origFetch(shopifyApproves(start.data.url, "c3"), { redirect: "manual" })).headers.get("location"));
    const other = await call("/oauth/complete", WS_B, { method: "POST", body: JSON.stringify({ id: back.searchParams.get("complete") }) });
    assert.equal(other.status, 403);
    assert.equal(conns.length, 0);
  });
});

test("reconnect, other workspace refused, disconnect, reconnect again", async () => {
  await quiet(async () => {
    await connect(WS_A, "c1");
    const id = String(conns[0]._id);

    // Reconnect the same store: same connection, fresh token
    const re = await connect(WS_A, "c4");
    assert.equal(re.finish.status, 200);
    assert.equal(conns.length, 1);
    assert.equal(String(conns[0]._id), id);
    assert.equal(decrypt(conns[0].accessToken), "shpat_c4");

    // Another workspace can't take a store that's connected here
    const stolen = await connect(WS_B, "c5");
    assert.equal(stolen.finish.status, 409);
    assert.match(stolen.body.message, /already connected to another ReadyTech workspace/);
    assert.equal(String(conns[0].workspace), String(WS_A));
    assert.equal(decrypt(conns[0].accessToken), "shpat_c4");

    // Disconnect: no Shopify call, tokens erased locally
    const before = shopifyCalls.length;
    const off = await call("/disconnect", WS_A, { method: "POST" });
    assert.equal(off.status, 200);
    assert.equal(shopifyCalls.length, before);
    assert.equal(conns[0].status, "disconnected");
    assert.equal(conns[0].accessToken, null);
    assert.equal(conns[0].refreshToken, null);
    const status = (await (await call("/status", WS_A)).json()).data.connection;
    assert.deepEqual([status.connected, status.status], [false, "disconnected"]);

    // Reconnect after disconnect works and reuses the record
    const back = await connect(WS_A, "c6");
    assert.equal(back.finish.status, 200);
    assert.equal(conns.length, 1);
    assert.equal(conns[0].status, "active");
    assert.equal(decrypt(conns[0].accessToken), "shpat_c6");
  });
});

test("cancelled approval and invalid domain return clear errors", async () => {
  await quiet(async () => {
    const cancelled = await origFetch(`${api}/oauth/callback?error=access_denied&shop=${SHOP}`, { redirect: "manual" });
    const loc = new URL(cancelled.headers.get("location"));
    assert.equal(loc.searchParams.get("connected"), "0");
    assert.match(loc.searchParams.get("message"), /cancelled/);

    const invalid = await call("/oauth/url?shop=www.acme.com", WS_A);
    assert.equal(invalid.status, 422);
    assert.match((await invalid.json()).message, /myshopify\.com/);
  });
});
