// GET /api/shopify/status through the real app.js (mount + auth + workspace).
// Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
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
    const ok = await fetch(url, { headers: auth });
    const text = await ok.text();
    assert.equal(ok.status, 200);
    assert.match(text, /https:\/\/acme\.myshopify\.com\/admin\/oauth\/authorize/);
    assert.doesNotMatch(text, /super-secret-value/);
    assert.doesNotMatch(text, new RegExp(env.SHOPIFY_TOKEN_ENCRYPTION_KEY.replace(/[+/=]/g, "\\$&")));

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
