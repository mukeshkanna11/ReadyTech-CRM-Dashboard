// GET /api/shopify/status through the real app.js (mount + auth + workspace).
// Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import mongoose from "mongoose";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "test@test.dev",
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || "company@test.dev",
});

const app = (await import("../app.js")).default;
const User = (await import("../models/User.js")).default;
const models = {
  ShopifyConnection: (await import("../models/ShopifyConnection.js")).default,
  ShopifyWebhookEvent: (await import("../models/ShopifyWebhookEvent.js")).default,
  ShopifyOrderLink: (await import("../models/ShopifyOrderLink.js")).default,
  ShopifyInventoryLink: (await import("../models/ShopifyInventoryLink.js")).default,
  ShopifyOAuthState: (await import("../models/ShopifyOAuthState.js")).default,
};

const WS = new mongoose.Types.ObjectId();
const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const chain = (value) => {
  const q = { then: (res, rej) => Promise.resolve(value).then(res, rej) };
  for (const m of ["select", "lean", "sort", "limit", "populate"]) q[m] = () => q;
  return q;
};

let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/shopify/status`;
});
after(() => server.close());
afterEach(() => {
  while (restore.length) restore.pop()();
});

test("route is mounted: unauthenticated request gets 401, not 404", async () => {
  const res = await fetch(base);
  assert.equal(res.status, 401);
});

test("authenticated request gets the caller's workspace-scoped status without secrets", async () => {
  stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
  const filters = [];
  const capture = (value) => (f) => (filters.push(f?.[0]?.$match ?? f), chain(value));
  stub(models.ShopifyConnection, "findOne", capture(null));
  stub(models.ShopifyWebhookEvent, "aggregate", async (p) => (filters.push(p[0].$match), [{ _id: "pending", n: 2 }]));
  stub(models.ShopifyWebhookEvent, "find", capture([]));
  stub(models.ShopifyOrderLink, "find", capture([]));
  stub(models.ShopifyOrderLink, "countDocuments", async (f) => (filters.push(f), 0));
  stub(models.ShopifyInventoryLink, "find", capture([]));
  stub(models.ShopifyInventoryLink, "countDocuments", async (f) => (filters.push(f), 0));

  const token = jwt.sign({ id: String(WS) }, "test-jwt");
  const res = await fetch(base, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.connection, null);
  assert.equal(body.data.inbox.counts.pending, 2);
  assert.ok(filters.length >= 7);
  assert.ok(filters.every((f) => String(f.workspace) === String(WS)), "every query is scoped to the caller's workspace");
  assert.doesNotMatch(JSON.stringify(body), /accessToken|refreshToken/);
});

test("connect URL: clear setup error when platform credentials are missing; never leaks secrets", async () => {
  stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
  const auth = { authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` };
  const url = base.replace("/status", "/oauth/url?shop=acme");
  const warn = console.warn;
  console.warn = () => {};
  try {
    const missing = await fetch(url, { headers: auth });
    const body = await missing.json();
    assert.equal(missing.status, 400);
    assert.equal(body.code, "SHOPIFY_NOT_CONFIGURED");
    assert.doesNotMatch(body.message, /SHOPIFY_|secret|key/i);

    const env = {
      SHOPIFY_API_KEY: "public-client-id", SHOPIFY_API_SECRET: "super-secret-value", SHOPIFY_SCOPES: "read_orders",
      SHOPIFY_API_VERSION: "2026-07", SHOPIFY_OAUTH_REDIRECT_URI: "https://api.test/cb", SHOPIFY_WEBHOOK_URL: "https://api.test/wh",
      SHOPIFY_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    };
    Object.assign(process.env, env);
    // Platform credentials alone are not enough: the dedicated state secret is required too
    const noState = await fetch(url, { headers: auth });
    assert.equal(noState.status, 400);
    assert.equal((await noState.json()).code, "SHOPIFY_NOT_CONFIGURED");

    env.SHOPIFY_STATE_SECRET = "route-test-state-secret-0123456789abcdef";
    Object.assign(process.env, env);
    const created = [];
    stub(models.ShopifyOAuthState, "create", async (d) => (created.push(d), d));
    const ok = await fetch(url, { headers: auth });
    const text = await ok.text();
    assert.equal(ok.status, 200);
    assert.match(text, /https:\/\/acme\.myshopify\.com\/admin\/oauth\/authorize/);
    assert.doesNotMatch(text, /super-secret-value/);
    assert.doesNotMatch(text, new RegExp(env.SHOPIFY_TOKEN_ENCRYPTION_KEY.replace(/[+/=]/g, "\\$&")));
    assert.doesNotMatch(text, /route-test-state-secret/);
    assert.equal(created.length, 1);
    assert.equal(String(created[0].workspace), String(WS));

    const bad = await fetch(base.replace("/status", "/oauth/url?shop=evil.com"), { headers: auth });
    assert.equal(bad.status, 422);
    Object.keys(env).forEach((k) => delete process.env[k]);
  } finally {
    console.warn = warn;
  }
});

test("non-admin members cannot start a connection", async () => {
  stub(User, "findById", () => chain({ _id: new mongoose.Types.ObjectId(), role: "employee", isActive: true, workspace: WS }));
  const res = await fetch(base.replace("/status", "/oauth/url?shop=acme"), {
    headers: { authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` },
  });
  assert.equal(res.status, 403);
});

/* ---------------- OAuth callback + authenticated finish ---------------- */
const OAUTH_ENV = {
  SHOPIFY_API_KEY: "public-client-id", SHOPIFY_API_SECRET: "super-secret-value", SHOPIFY_SCOPES: "read_orders",
  SHOPIFY_API_VERSION: "2026-07", SHOPIFY_OAUTH_REDIRECT_URI: "https://api.test/cb", SHOPIFY_WEBHOOK_URL: "https://api.test/wh",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"), SHOPIFY_STATE_SECRET: "route-test-state-secret-0123456789abcdef",
};
const withOAuthEnv = async (fn) => {
  Object.assign(process.env, OAUTH_ENV);
  try {
    return await fn();
  } finally {
    Object.keys(OAUTH_ENV).forEach((k) => delete process.env[k]);
  }
};
const signedCallback = (params) => {
  const q = new URLSearchParams(params);
  const msg = [...q.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
  q.set("hmac", crypto.createHmac("sha256", OAUTH_ENV.SHOPIFY_API_SECRET).update(msg).digest("hex"));
  return `${base.replace("/status", "/oauth/callback")}?${q}`;
};

test("callback consumes the state and hands back a one-time id — it does not connect the store", async () => {
  await withOAuthEnv(async () => {
    const svc = await import("../services/shopify/shopify.service.js");
    stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
    let claims = 0;
    stub(models.ShopifyOAuthState, "findOneAndUpdate", async () => (++claims === 1 ? { _id: "st" } : null));
    let connected = 0;
    stub(models.ShopifyConnection, "findOneAndUpdate", async () => (connected++, null));
    const state = svc.buildAuthUrl({ shop: "acme.myshopify.com", userId: WS, workspaceId: WS, nonce: "n1" });
    const url = signedCallback({ code: "c1", shop: "acme.myshopify.com", state: new URL(state).searchParams.get("state"), timestamp: "1" });
    const err = console.error;
    console.error = () => {};
    try {
      const first = await fetch(url, { redirect: "manual" });
      const loc = new URL(first.headers.get("location"));
      assert.equal(first.status, 302);
      assert.equal(loc.pathname, "/shopify/return"); // public landing page that survives a login
      assert.match(loc.searchParams.get("complete"), /^[a-f0-9]{48}$/);
      assert.equal(loc.searchParams.has("connected"), false);
      assert.equal(connected, 0);

      // Replaying the same callback is refused
      const replay = new URL((await fetch(url, { redirect: "manual" })).headers.get("location"));
      assert.equal(replay.searchParams.get("connected"), "0");
      assert.match(replay.searchParams.get("message"), /expired/);
    } finally {
      console.error = err;
    }
  });
});

test("complete: requires a signed-in admin and is scoped to the caller's workspace and user", async () => {
  await withOAuthEnv(async () => {
    const completeUrl = base.replace("/status", "/oauth/complete");
    const post = (headers) => fetch(completeUrl, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ id: "a".repeat(48) }) });
    assert.equal((await post({})).status, 401);

    stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
    let filter;
    stub(models.ShopifyOAuthState, "findOneAndUpdate", (f) => ((filter = f), { select: async () => null }));
    stub(models.ShopifyOAuthState, "findOne", async () => null); // not pending for anyone else either
    const err = console.error;
    console.error = () => {};
    try {
      const res = await post({ authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` });
      assert.equal(res.status, 410);
      assert.match((await res.json()).message, /expired or was already used/);
    } finally {
      console.error = err;
    }
    assert.equal(String(filter.workspace), String(WS));
    assert.equal(String(filter.user), String(WS));
    assert.equal(filter.status, "callback");
  });
});

test("callback: a cancelled / declined approval returns a friendly message and stores nothing", async () => {
  await withOAuthEnv(async () => {
    let claims = 0;
    stub(models.ShopifyOAuthState, "findOneAndUpdate", async () => (claims++, null));
    const err = console.error;
    console.error = () => {};
    try {
      const res = await fetch(`${base.replace("/status", "/oauth/callback")}?error=access_denied&shop=acme.myshopify.com`, { redirect: "manual" });
      const loc = new URL(res.headers.get("location"));
      assert.equal(loc.pathname, "/shopify/return");
      assert.equal(loc.searchParams.get("connected"), "0");
      assert.match(loc.searchParams.get("message"), /cancelled/);
      assert.equal(claims, 0);
    } finally {
      console.error = err;
    }
  });
});

test("status: 'available' is false until the OAuth state secret is configured (Connect hidden)", async () => {
  stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
  stub(models.ShopifyConnection, "findOne", () => chain(null));
  stub(models.ShopifyWebhookEvent, "aggregate", async () => []);
  stub(models.ShopifyWebhookEvent, "find", () => chain([]));
  stub(models.ShopifyOrderLink, "find", () => chain([]));
  stub(models.ShopifyOrderLink, "countDocuments", async () => 0);
  const auth = { authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` };
  await withOAuthEnv(async () => {
    assert.equal((await (await fetch(base, { headers: auth })).json()).data.available, true);
    delete process.env.SHOPIFY_STATE_SECRET;
    assert.equal((await (await fetch(base, { headers: auth })).json()).data.available, false);
  });
});

test("complete: success returns only the store name and domain (never tokens)", async () => {
  await withOAuthEnv(async () => {
    stub(User, "findById", () => chain({ _id: WS, role: "admin", isActive: true, workspace: null }));
    const { encrypt } = await import("../services/shopify/crypto.js");
    stub(models.ShopifyOAuthState, "findOneAndUpdate", () => ({ select: async () => ({ shop: "acme.myshopify.com", code: encrypt("c1") }) }));
    stub(models.ShopifyConnection, "findOne", async () => null);
    stub(models.ShopifyConnection, "findOneAndUpdate", async (f, u) => ({ _id: "c1", shopDomain: f.shopDomain, workspace: WS, connectedBy: WS, ...u.$set }));
    const AuditLog = (await import("../models/AuditLog.js")).default;
    stub(AuditLog, "create", async (d) => d);
    const origFetch = globalThis.fetch;
    const shopify = async (url, init) => {
      if (!String(url).includes("myshopify.com")) return origFetch(url, init);
      if (String(url).endsWith("/admin/oauth/access_token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "shpat_SECRET_TOKEN", refresh_token: "shprt_SECRET", scope: "read_orders" }) };
      }
      const { query } = JSON.parse(init.body);
      const data = query.includes("shop {")
        ? { shop: { id: "gid://shopify/Shop/1", name: "Acme", email: "a@acme.test", myshopifyDomain: "acme.myshopify.com", currencyCode: "INR" } }
        : { webhookSubscriptionCreate: { webhookSubscription: { id: "w" }, userErrors: [] } };
      return { ok: true, status: 200, json: async () => ({ data }) };
    };
    globalThis.fetch = shopify;
    try {
      const res = await origFetch(base.replace("/status", "/oauth/complete"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jwt.sign({ id: String(WS) }, "test-jwt")}` },
        body: JSON.stringify({ id: "b".repeat(48) }),
      });
      const text = await res.text();
      assert.equal(res.status, 200);
      assert.deepEqual(JSON.parse(text).data, { shopDomain: "acme.myshopify.com", shopName: "Acme" });
      assert.doesNotMatch(text, /SECRET|shpat|shprt|accessToken|refreshToken/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
