// Shopify-started install through the real app.js:
// GET /install (signed) → authorize → callback (browser-bound) → unbound
// installation → POST /oauth/link by an authenticated admin.
// Real HMAC/state/cookie/encryption code; only MongoDB models and Shopify's HTTP
// API are in-memory fakes. Run: node --test tests/
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
  SHOPIFY_STATE_SECRET: "install-test-state-secret-0123456789abcdef",
};
Object.assign(process.env, ENV);

const app = (await import("../app.js")).default;
const svc = await import("../services/shopify/shopify.service.js");
const { decrypt } = await import("../services/shopify/crypto.js");
const User = (await import("../models/User.js")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;
const M = {
  Connection: (await import("../models/ShopifyConnection.js")).default,
  OAuthState: (await import("../models/ShopifyOAuthState.js")).default,
  InstallState: (await import("../models/ShopifyInstallState.js")).default,
  Installation: (await import("../models/ShopifyInstallation.js")).default,
  Event: (await import("../models/ShopifyWebhookEvent.js")).default,
  OrderLink: (await import("../models/ShopifyOrderLink.js")).default,
  InvLink: (await import("../models/ShopifyInventoryLink.js")).default,
  CustLink: (await import("../models/ShopifyCustomerLink.js")).default,
};

const WS_A = new mongoose.Types.ObjectId(); // admin A (workspace id = owner id)
const WS_B = new mongoose.Types.ObjectId(); // admin B
const EMPLOYEE = new mongoose.Types.ObjectId(); // non-admin member of WS_A
const SHOP = "acme.myshopify.com";

/* ---------------- in-memory tables ---------------- */
const get = (doc, path) => path.split(".").reduce((o, k) => o?.[k], doc);
const eq = (a, b) => String(a ?? null) === String(b ?? null);
const cond = (v, c) => {
  if (c && typeof c === "object" && !(c instanceof Date) && !mongoose.isValidObjectId(c)) {
    if ("$ne" in c) return !eq(v, c.$ne);
    if ("$in" in c) return c.$in.some((x) => eq(v, x));
    if ("$nin" in c) return !c.$nin.some((x) => eq(v, x));
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
const setPaths = (doc, set = {}) => {
  for (const [k, v] of Object.entries(set)) {
    const keys = k.split(".");
    let o = doc;
    keys.slice(0, -1).forEach((p) => (o = o[p] ??= {}));
    o[keys.at(-1)] = v;
  }
};
const clone = (d) => (d == null ? d : JSON.parse(JSON.stringify(d))); // plain copy (also of Mongoose arrays)
const equalityFields = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => !k.startsWith("$") && (v === null || typeof v !== "object" || mongoose.isValidObjectId(v))));

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};

/* Generic fake: updateOne / findOneAndUpdate (upsert), findOne, exists, deleteOne, deleteMany */
const fakeTable = (Model, rows, { hydrate = (d) => d, unique = [] } = {}) => {
  const upsertRow = (f, u) => {
    for (const k of unique) if (f[k] !== undefined && rows.some((r) => eq(r[k], f[k]))) throw Object.assign(new Error("E11000"), { code: 11000, keyPattern: { [k]: 1 } });
    const doc = { _id: new mongoose.Types.ObjectId(), ...equalityFields(f), ...(u.$setOnInsert || {}) };
    setPaths(doc, u.$set);
    rows.push(doc);
    return doc;
  };
  stub(Model, "updateOne", async (f, u, o) => {
    const doc = rows.find((r) => matches(r, f));
    if (doc) {
      setPaths(doc, u.$set);
      return { modifiedCount: 1 };
    }
    if (o?.upsert) upsertRow(f, u);
    return { modifiedCount: 0, upsertedCount: o?.upsert ? 1 : 0 };
  });
  stub(Model, "findOneAndUpdate", (f, u, o) => {
    // match + update happen synchronously: atomic, like MongoDB
    let doc = rows.find((r) => matches(r, f));
    const beforeCopy = doc && clone(doc);
    let result = null;
    try {
      if (doc) setPaths(doc, u.$set);
      else if (o?.upsert) doc = upsertRow(f, u);
      result = doc ? hydrate(clone(o?.returnDocument === "before" && beforeCopy ? beforeCopy : doc)) : null;
    } catch (err) {
      return Object.assign(Promise.reject(err), { select: () => Promise.reject(err) });
    }
    return chain(result);
  });
  stub(Model, "findOne", (f) => chain(hydrate(clone(rows.find((r) => matches(r, f)) || null))));
  stub(Model, "exists", async (f) => (rows.some((r) => matches(r, f)) ? { _id: 1 } : null));
  stub(Model, "deleteOne", async (f) => {
    const i = rows.findIndex((r) => matches(r, f));
    if (i >= 0) rows.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  });
  stub(Model, "deleteMany", async (f) => {
    const before = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], f)) rows.splice(i, 1);
    return { deletedCount: before - rows.length };
  });
};

let conns, oauthStates, installStates, installations, shopifyCalls;
const origFetch = globalThis.fetch;
let tokenSeq;

beforeEach(() => {
  conns = [];
  oauthStates = [];
  installStates = [];
  installations = [];
  shopifyCalls = [];
  tokenSeq = 0;
  stub(AuditLog, "create", async (d) => d);
  stub(User, "findById", (id) =>
    chain(
      [WS_A, WS_B].some((w) => eq(w, id)) ? { _id: id, role: "admin", isActive: true, workspace: null }
      : eq(EMPLOYEE, id) ? { _id: id, role: "employee", isActive: true, workspace: WS_A }
      : null
    )
  );
  fakeTable(M.InstallState, installStates);
  fakeTable(M.Installation, installations, { hydrate: (d) => (d ? M.Installation.hydrate(d) : null) });
  fakeTable(M.Connection, conns, { hydrate: (d) => (d ? M.Connection.hydrate(d) : null), unique: ["shopDomain"] });
  // ShopifyConnection upsert: one active store per workspace
  const fau = M.Connection.findOneAndUpdate;
  stub(M.Connection, "findOneAndUpdate", (f, u, o) => {
    if (u.$set?.status === "active" && conns.some((c) => c.status === "active" && eq(c.workspace, u.$set.workspace) && c.shopDomain !== f.shopDomain)) {
      const err = Object.assign(new Error("E11000"), { code: 11000, keyPattern: { workspace: 1 } });
      return Object.assign(Promise.reject(err), { select: () => Promise.reject(err) });
    }
    return fau(f, u, o);
  });
  // Existing Connect flow's state
  stub(M.OAuthState, "create", async (d) => (oauthStates.push({ status: "pending", ...d }), d));
  fakeTable(M.OAuthState, oauthStates);
  stub(M.OAuthState, "create", async (d) => (oauthStates.push({ status: "pending", ...d }), d));

  for (const Mdl of [M.Event, M.OrderLink, M.InvLink, M.CustLink]) {
    stub(Mdl, "find", () => chain([]));
    stub(Mdl, "countDocuments", async () => 0);
    stub(Mdl, "deleteMany", async () => ({ deletedCount: 0 }));
  }
  stub(M.Event, "aggregate", async () => []);

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes(".myshopify.com")) return origFetch(url, init);
    shopifyCalls.push({ url: u, body: init?.body });
    const json = (body) => ({ ok: true, status: 200, statusText: "", json: async () => body });
    if (u.endsWith("/admin/oauth/access_token")) {
      const n = ++tokenSeq;
      return json({ access_token: `shpat_${n}`, refresh_token: `shprt_${n}`, expires_in: 3600, refresh_token_expires_in: 86400, scope: "read_products,read_orders,write_inventory" });
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

/* ---------------- helpers (what Shopify and the browser do) ---------------- */
const now = () => String(Math.floor(Date.now() / 1000));
const sign = (params) => {
  const q = new URLSearchParams(params);
  const msg = [...q.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
  q.set("hmac", crypto.createHmac("sha256", ENV.SHOPIFY_API_SECRET).update(msg).digest("hex"));
  return q;
};
const auth = (id) => ({ authorization: `Bearer ${jwt.sign({ id: String(id) }, ENV.JWT_SECRET)}`, "content-type": "application/json" });
const get302 = async (url, headers = {}) => {
  const res = await origFetch(url, { redirect: "manual", headers });
  assert.equal(res.status, 302, url);
  return { res, location: new URL(res.headers.get("location")) };
};
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0]; // "shopify_install=<binder>"

/* Shopify opens the App URL → our /install → Shopify authorize */
const install = async (shop = SHOP, extra = {}) => {
  const { res, location } = await get302(`${api}/install?${sign({ shop, timestamp: now(), host: "YWRtaW4", ...extra })}`);
  return { res, location, cookie: cookieOf(res) };
};
/* Merchant approves: Shopify redirects to the callback with code + state + HMAC */
const approve = (authorizeUrl, code = "code-1", { timestamp = now() } = {}) =>
  `${api}/oauth/callback?${sign({ code, shop: authorizeUrl.host, state: authorizeUrl.searchParams.get("state"), timestamp })}`;
const linkCodeOf = (location) => new URLSearchParams(location.hash.slice(1)).get("installed");
const link = (code, as) => origFetch(`${api}/oauth/link`, { method: "POST", headers: as ? auth(as) : { "content-type": "application/json" }, body: JSON.stringify({ code }) });

const installAndApprove = async () => {
  const i = await install();
  const { location } = await get302(approve(i.location), { cookie: i.cookie });
  return { code: linkCodeOf(location), location };
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

/* ---------------- tests ---------------- */
test("install: invalid HMAC and stale timestamp are rejected (no OAuth, no cookie, no state)", async () => {
  await quiet(async () => {
    const tampered = sign({ shop: SHOP, timestamp: now() });
    tampered.set("shop", "evil.myshopify.com");
    const bad = await get302(`${api}/install?${tampered}`);
    assert.equal(bad.location.origin, "https://crm.test");
    assert.equal(bad.location.searchParams.get("connected"), "0");
    assert.equal(bad.res.headers.get("set-cookie"), null);

    const stale = await get302(`${api}/install?${sign({ shop: SHOP, timestamp: String(Math.floor(Date.now() / 1000) - 3600) })}`);
    assert.equal(stale.location.searchParams.get("connected"), "0");
    assert.equal(stale.res.headers.get("set-cookie"), null);
    assert.equal(installStates.length, 0);
  });
});

test("install: a valid request redirects straight to Shopify authorization — no ReadyTech login", async () => {
  const { location, res } = await install();
  assert.equal(`${location.origin}${location.pathname}`, `https://${SHOP}/admin/oauth/authorize`);
  assert.equal(location.searchParams.get("client_id"), "client-id");
  assert.equal(location.searchParams.get("redirect_uri"), ENV.SHOPIFY_OAUTH_REDIRECT_URI);
  assert.equal(location.searchParams.get("scope"), ENV.SHOPIFY_SCOPES);
  const setCookie = res.headers.get("set-cookie");
  assert.match(setCookie, /^shopify_install=[\w-]{40,};/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api\/shopify/);
  assert.equal(installStates.length, 1);
  assert.equal(JSON.stringify(installStates).includes(cookieOf(res).split("=")[1]), false); // only the hash is stored
  assert.equal(installStates[0].workspace, null);
});

test("callback: browser binding is enforced (no cookie / another browser's cookie)", async () => {
  await quiet(async () => {
    const i = await install();
    const url = approve(i.location);
    const none = await get302(url);
    assert.equal(none.location.searchParams.get("connected"), "0");
    const other = await get302(url, { cookie: "shopify_install=someone-elses-browser" });
    assert.equal(other.location.searchParams.get("connected"), "0");
    assert.equal(installations.length, 0);
    assert.equal(shopifyCalls.length, 0); // code never exchanged
  });
});

test("callback: creates only an unbound installation (encrypted tokens, no workspace connection); single use; stale timestamp refused", async () => {
  await quiet(async () => {
    const i = await install();
    const stale = await get302(approve(i.location, "code-1", { timestamp: String(Math.floor(Date.now() / 1000) - 3600) }), { cookie: i.cookie });
    assert.equal(stale.location.searchParams.get("connected"), "0");

    const i2 = await install();
    const ok = await get302(approve(i2.location), { cookie: i2.cookie });
    assert.equal(`${ok.location.origin}${ok.location.pathname}`, "https://crm.test/shopify/return");
    assert.equal(ok.location.searchParams.get("shop"), SHOP);
    assert.equal(ok.location.searchParams.has("installed"), false); // code only in the fragment
    assert.match(linkCodeOf(ok.location), /^[a-f0-9]{48}$/);
    assert.match(ok.res.headers.get("set-cookie"), /shopify_install=;/); // cookie cleared

    assert.equal(conns.length, 0);
    assert.equal(installations.length, 1);
    const inst = installations[0];
    assert.equal(inst.workspace, null);
    assert.equal(decrypt(inst.accessToken), "shpat_1");
    assert.notEqual(inst.accessToken, "shpat_1");
    assert.equal(JSON.stringify(inst).includes(linkCodeOf(ok.location)), false); // only the hash

    const replay = await get302(approve(i2.location), { cookie: i2.cookie });
    assert.equal(replay.location.searchParams.get("connected"), "0");
  });
});

test("link: requires an authenticated admin; links to THAT workspace once; code can't be reused", async () => {
  await quiet(async () => {
    const { code } = await installAndApprove();
    assert.equal((await link(code)).status, 401);
    assert.equal((await link(code, EMPLOYEE)).status, 403);
    assert.equal(installations.length, 1); // refused attempts consume nothing

    const ok = await link(code, WS_A);
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).data, { shopDomain: SHOP, shopName: "Acme Store" });
    assert.equal(conns.length, 1);
    assert.equal(String(conns[0].workspace), String(WS_A));
    assert.equal(conns[0].status, "active");
    assert.equal(decrypt(conns[0].accessToken), "shpat_1");
    assert.equal(installations.length, 0); // tokens moved, installation gone

    assert.equal((await link(code, WS_A)).status, 410);
    assert.equal((await link(code, WS_B)).status, 410);
  });
});

test("link: concurrent requests with the same code — exactly one succeeds", async () => {
  await quiet(async () => {
    const { code } = await installAndApprove();
    const statuses = (await Promise.all([link(code, WS_A), link(code, WS_B), link(code, WS_A)])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 410, 410]);
    assert.equal(conns.length, 1);
  });
});

test("link: an expired code is refused", async () => {
  await quiet(async () => {
    const { code } = await installAndApprove();
    installations[0].expiresAt = new Date(Date.now() - 1000);
    assert.equal((await link(code, WS_A)).status, 410);
    assert.equal(conns.length, 0);
  });
});

test("another workspace can't claim an actively connected store; that store's install just opens ReadyTech", async () => {
  await quiet(async () => {
    const first = await installAndApprove(); // installed, not linked yet
    const { code } = first;
    // Meanwhile workspace A connects the store through the existing ReadyTech Connect flow
    const start = await (await origFetch(`${api}/oauth/url?shop=acme`, { headers: auth(WS_A) })).json();
    const cb = await get302(approve(new URL(start.data.url), "connect-code"));
    const done = await origFetch(`${api}/oauth/complete`, { method: "POST", headers: auth(WS_A), body: JSON.stringify({ id: cb.location.searchParams.get("complete") }) });
    assert.equal(done.status, 200);
    const tokenA = conns[0].accessToken;

    const stolen = await link(code, WS_B);
    assert.equal(stolen.status, 409);
    assert.match((await stolen.json()).message, /already connected to another ReadyTech workspace/);
    assert.equal(String(conns[0].workspace), String(WS_A));
    assert.equal(conns[0].accessToken, tokenA);
    assert.equal(installations.length, 0); // refused installation's tokens discarded

    // Opening the app from Shopify for an already-connected store: no OAuth, just ReadyTech
    const again = await get302(`${api}/install?${sign({ shop: SHOP, timestamp: now() })}`);
    assert.equal(`${again.location.origin}${again.location.pathname}`, "https://crm.test/shopify/return");
    assert.equal(again.res.headers.get("set-cookie"), null);
  });
});

test("existing Connect flow and existing connections are unaffected", async () => {
  await quiet(async () => {
    const existing = { _id: new mongoose.Types.ObjectId(), shopDomain: "old.myshopify.com", workspace: WS_B, status: "active", accessToken: "v1.keep", inventory: {}, webhooks: {} };
    conns.push(existing);
    const start = await (await origFetch(`${api}/oauth/url?shop=acme`, { headers: auth(WS_A) })).json();
    const cb = await get302(approve(new URL(start.data.url), "connect-code"));
    assert.ok(cb.location.searchParams.get("complete")); // unchanged: query param, not the install fragment
    assert.equal(cb.location.hash, "");
    const done = await origFetch(`${api}/oauth/complete`, { method: "POST", headers: auth(WS_A), body: JSON.stringify({ id: cb.location.searchParams.get("complete") }) });
    assert.equal(done.status, 200);
    assert.equal(installations.length, 0);
    assert.equal(installStates.length, 0);
    assert.equal(conns.find((c) => c.shopDomain === "old.myshopify.com").accessToken, "v1.keep");
  });
});

test("app/uninstalled and shop/redact delete the store's unbound installation (only that store)", async () => {
  await quiet(async () => {
    await installAndApprove();
    installations.push({ _id: new mongoose.Types.ObjectId(), shopDomain: "other.myshopify.com", workspace: null, expiresAt: new Date(Date.now() + 60_000) });
    assert.deepEqual(await svc.handleWebhook({ topic: "app/uninstalled", shop: SHOP, payload: { id: 7, myshopify_domain: SHOP } }), { ignored: "unknown shop" });
    assert.deepEqual(installations.map((i) => i.shopDomain), ["other.myshopify.com"]);

    await svc.handleWebhook({ topic: "shop/redact", shop: "other.myshopify.com", payload: { shop_domain: "other.myshopify.com" } });
    assert.equal(installations.length, 0);

    // A body naming another shop never deletes
    installations.push({ _id: new mongoose.Types.ObjectId(), shopDomain: SHOP, workspace: null, expiresAt: new Date(Date.now() + 60_000) });
    await svc.handleWebhook({ topic: "shop/redact", shop: SHOP, payload: { shop_domain: "evil.myshopify.com" } });
    assert.equal(installations.length, 1);
  });
});
