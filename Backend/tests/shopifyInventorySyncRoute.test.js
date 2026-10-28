// POST /api/shopify/inventory/sync through the real router + auth + role.
// Regression: a Shopify-side GraphQL error was an opaque 500.
// DB-free. Run: node --test tests/
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  SHOPIFY_API_KEY: "k",
  SHOPIFY_API_SECRET: "s",
  SHOPIFY_API_VERSION: "2026-10",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
});
await import("../utils/workspaceScope.js");
const { encrypt } = await import("../services/shopify/crypto.js");
const User = (await import("../models/User.js")).default;
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const shopifyRoutes = (await import("../routes/shopify.routes.js")).default;

const WS = String(new mongoose.Types.ObjectId());
const TOKEN = "shpat_secret_value";

const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};
const origFetch = globalThis.fetch;
afterEach(() => {
  while (restore.length) restore.pop()();
  globalThis.fetch = origFetch;
});

let server, url;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/shopify", shopifyRoutes); // routes carry their own auth
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${server.address().port}/api/shopify/inventory/sync`;
});
after(() => server.close());

const asUser = (user) => {
  stub(User, "findById", () => ({ select: () => ({ lean: async () => user }) }));
  return { authorization: `Bearer ${jwt.sign({ id: user._id }, "test-jwt")}` };
};
const withConnection = () => {
  const filters = [];
  const conn = {
    _id: new mongoose.Types.ObjectId(), workspace: WS, shopDomain: "a.myshopify.com", status: "active",
    accessToken: encrypt(TOKEN), inventory: { enabled: true, warehouse: new mongoose.Types.ObjectId(), locationGid: "gid://shopify/Location/1" },
  };
  stub(ShopifyConnection, "findOne", (f) => (filters.push(f), { select: async () => conn }));
  return filters;
};

test("Shopify GraphQL error → 502 with Shopify's reason (not an opaque 500); token never logged or returned", async () => {
  const headers = asUser({ _id: WS, role: "admin", workspace: null, isActive: true });
  const filters = withConnection();
  const sent = [];
  globalThis.fetch = async (u, init) => {
    sent.push(init.headers["x-shopify-access-token"]);
    return { ok: true, status: 200, json: async () => ({ errors: [{ message: "Access denied for productVariants field." }] }) };
  };
  const logs = [];
  stub(console, "error", (...a) => logs.push(a.join(" ")));

  const res = await origFetch(url, { method: "POST", headers });
  const body = await res.json();

  assert.equal(res.status, 502);
  assert.match(body.message, /Access denied for productVariants/);
  assert.equal(String(filters[0].workspace), WS);
  assert.equal(sent[0], TOKEN);
  assert.doesNotMatch(JSON.stringify(body) + logs.join("\n"), new RegExp(TOKEN));
});

test("unexpected internal errors stay a generic 500", async () => {
  const headers = asUser({ _id: WS, role: "admin", workspace: null, isActive: true });
  stub(ShopifyConnection, "findOne", () => ({ select: async () => { throw new Error("db down"); } }));
  stub(console, "error", () => {});

  const res = await origFetch(url, { method: "POST", headers });

  assert.equal(res.status, 500);
  assert.equal((await res.json()).message, "Failed to sync inventory");
});

test("still admin-only", async () => {
  const headers = asUser({ _id: WS, role: "employee", workspace: WS, isActive: true });
  const res = await origFetch(url, { method: "POST", headers });
  assert.equal(res.status, 403);
});
