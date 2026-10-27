// Focused, DB-free tests for the Shopify webhook inbox + worker (Phase 2).
// HTTP tests go through the real app.js (raw-body capture + route + HMAC).
// Model calls are replaced by an in-memory store whose claim is atomic
// (pick + update in one synchronous step, like findOneAndUpdate).
// Run: node --test tests/
import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

Object.assign(process.env, {
  JWT_SECRET: "test-jwt",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "test",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "test@test.dev",
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || "company@test.dev",
  SHOPIFY_API_KEY: "client-id",
  SHOPIFY_API_SECRET: "client-secret",
  SHOPIFY_SCOPES: "read_orders",
  SHOPIFY_API_VERSION: "2026-07",
  SHOPIFY_OAUTH_REDIRECT_URI: "https://api.test/api/shopify/oauth/callback",
  SHOPIFY_WEBHOOK_URL: "https://api.test/api/shopify/webhooks",
  SHOPIFY_TOKEN_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
});

const app = (await import("../app.js")).default;
const ctx = await import("../utils/workspaceContext.js");
const ShopifyConnection = (await import("../models/ShopifyConnection.js")).default;
const ShopifyWebhookEvent = (await import("../models/ShopifyWebhookEvent.js")).default;
const AuditLog = (await import("../models/AuditLog.js")).default;
const inbox = await import("../services/shopify/inbox.service.js");
const worker = await import("../services/shopify/webhookWorker.js");

const DEFAULT_WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
const WS_A = "bbbbbbbbbbbbbbbbbbbbbbbb";
const WS_B = "cccccccccccccccccccccccc";

/* ---------------- in-memory models ---------------- */
let conns;
let events;
let seq;
const restore = [];
const stub = (obj, name, fn) => {
  const orig = obj[name];
  restore.push(() => (obj[name] = orig));
  obj[name] = fn;
};

const cmp = (v, cond) => {
  if (cond && typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof RegExp)) {
    if ("$ne" in cond) return String(v ?? null) !== String(cond.$ne);
    if ("$in" in cond) return cond.$in.map(String).includes(String(v));
  }
  if (cond instanceof RegExp) return cond.test(v);
  return String(v) === String(cond);
};
const matches = (doc, filter) =>
  Object.entries(filter).every(([k, cond]) => {
    if (k === "$or") return cond.some((f) => matches(doc, f));
    if (cond && typeof cond === "object" && "$lte" in cond) return doc[k] != null && doc[k] <= cond.$lte;
    return cmp(k.split(".").reduce((o, p) => o?.[p], doc), cond);
  });

const conn = (shopDomain, workspace, status = "active") => ({ _id: `conn-${shopDomain}`, shopDomain, workspace, status, connectedBy: "u1" });

beforeEach(() => {
  ctx.setDefaultWorkspaceId(DEFAULT_WS);
  seq = 0;
  events = [];
  conns = [conn("a.myshopify.com", WS_A), conn("b.myshopify.com", WS_B), conn("gone.myshopify.com", WS_A, "uninstalled")];

  stub(AuditLog, "create", async (d) => d);
  stub(ShopifyConnection, "findOne", async (f) => conns.find((c) => matches(c, f)) || null);
  stub(ShopifyWebhookEvent, "create", async (d) => {
    if (events.some((e) => e.shopDomain === d.shopDomain && e.webhookId === d.webhookId)) {
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    }
    const e = { _id: `ev${++seq}`, status: "pending", attempts: 0, nextAttemptAt: new Date(), leaseUntil: null, lockedBy: null, lastError: null, ...d };
    events.push(e);
    return e;
  });
  stub(ShopifyWebhookEvent, "findOneAndUpdate", async (f, u) => {
    const e = events.filter((x) => matches(x, f)).sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)[0];
    if (!e) return null;
    Object.assign(e, u.$set);
    e.attempts += u.$inc.attempts;
    return { ...e };
  });
  stub(ShopifyWebhookEvent, "updateOne", async (f, u) => {
    const e = events.find((x) => matches(x, f));
    if (e) Object.assign(e, u.$set);
    return { modifiedCount: e ? 1 : 0 };
  });
});
afterEach(() => {
  while (restore.length) restore.pop()();
  for (const t of inbox.INBOX_TOPICS) worker.unregisterHandler(t);
});

/* ---------------- HTTP ---------------- */
let server;
let base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/shopify/webhooks`;
});
after(() => server.close());

const deliver = (shop, topic, payload, { webhookId = crypto.randomUUID(), secret = "client-secret" } = {}) => {
  const body = JSON.stringify(payload);
  return fetch(base, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": topic,
      "x-shopify-shop-domain": shop,
      "x-shopify-webhook-id": webhookId,
      "x-shopify-hmac-sha256": crypto.createHmac("sha256", secret).update(body).digest("base64"),
    },
    body,
  });
};

const ORDER = { id: 101, admin_graphql_api_id: "gid://shopify/Order/101", updated_at: "2026-10-01T10:00:00Z", customer: { id: 9 } };

test("invalid HMAC is rejected with 401 and nothing is recorded", async () => {
  const res = await deliver("a.myshopify.com", "orders/create", ORDER, { secret: "wrong" });
  assert.equal(res.status, 401);
  assert.equal(events.length, 0);
});

test("unknown store is acknowledged but never recorded (no default-workspace fallback)", async () => {
  const res = await deliver("ghost.myshopify.com", "orders/create", ORDER);
  assert.equal(res.status, 200);
  assert.equal(events.length, 0);
});

test("uninstalled store's events are not recorded", async () => {
  const res = await deliver("gone.myshopify.com", "orders/create", ORDER);
  assert.equal(res.status, 200);
  assert.equal(events.length, 0);
});

test("duplicate delivery (same webhook id) is recorded once", async () => {
  const r1 = await deliver("a.myshopify.com", "orders/create", ORDER, { webhookId: "w-1" });
  const r2 = await deliver("a.myshopify.com", "orders/create", ORDER, { webhookId: "w-1" });
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(events.length, 1);
  assert.equal(events[0].resource.gid, "gid://shopify/Order/101");
  assert.equal(events[0].payload.id, 101);
});

test("each store's events carry only its own workspace", async () => {
  await deliver("a.myshopify.com", "orders/create", ORDER);
  await deliver("b.myshopify.com", "products/update", { id: 5, admin_graphql_api_id: "gid://shopify/Product/5" });
  await deliver("a.myshopify.com", "inventory_levels/update", { inventory_item_id: 7, location_id: 3, available: 4 });
  assert.deepEqual(events.map((e) => [e.shopDomain, String(e.workspace)]), [
    ["a.myshopify.com", WS_A],
    ["b.myshopify.com", WS_B],
    ["a.myshopify.com", WS_A],
  ]);
  assert.equal(events[2].resource.gid, "inventory_level:7@3");
  assert.equal(events.some((e) => String(e.workspace) === DEFAULT_WS), false);
});

/* ---------------- worker ---------------- */
const seed = (n, { shop = "a.myshopify.com", workspace = WS_A, topic = "orders/create" } = {}) =>
  Array.from({ length: n }, (_, i) =>
    events.push({
      _id: `seed${i}-${shop}`, connection: `conn-${shop}`, shopDomain: shop, workspace, topic, webhookId: `s${i}`,
      status: "pending", attempts: 0, nextAttemptAt: new Date(Date.now() - 1000), leaseUntil: null, lockedBy: null, lastError: null,
    })
  );

test("Phase 2 records only: with no handlers the worker claims nothing", async () => {
  seed(3);
  assert.deepEqual(await worker.runWorkerOnce(), []);
  assert.equal(events.every((e) => e.status === "pending" && e.attempts === 0), true);
});

test("concurrent workers process every event exactly once, in its own workspace", async () => {
  seed(15);
  seed(15, { shop: "b.myshopify.com", workspace: WS_B });
  const seen = new Map();
  worker.registerHandler("orders/create", async (event) => {
    seen.set(event._id, (seen.get(event._id) || 0) + 1);
    assert.equal(ctx.getWorkspaceId(), String(event.workspace));
    await new Promise((r) => setTimeout(r, Math.random() * 5));
  });

  const runs = await Promise.all([worker.runWorkerOnce({ max: 100 }), worker.runWorkerOnce({ max: 100 }), worker.runWorkerOnce({ max: 100 })]);
  assert.equal(runs.flat().length, 30);
  assert.equal(seen.size, 30);
  assert.equal([...seen.values()].every((n) => n === 1), true);
  assert.equal(events.every((e) => e.status === "processed" && e.lockedBy === null), true);
});

test("failures retry with backoff, then dead-letter after MAX_ATTEMPTS", async () => {
  seed(1);
  let calls = 0;
  worker.registerHandler("orders/create", async () => {
    calls++;
    throw new Error("temporary outage");
  });

  assert.deepEqual(await worker.runWorkerOnce(), ["retry"]);
  const e = events[0];
  assert.equal(e.status, "pending");
  assert.equal(e.attempts, 1);
  assert.equal(e.lastError, "temporary outage");
  assert.ok(e.nextAttemptAt > new Date(Date.now() + 20_000)); // ≥ 30s − jitter
  assert.deepEqual(await worker.runWorkerOnce(), []); // not due yet

  for (let i = 2; i <= worker.MAX_ATTEMPTS; i++) {
    e.nextAttemptAt = new Date(Date.now() - 1);
    await worker.runWorkerOnce();
  }
  assert.equal(e.status, "dead");
  assert.equal(calls, worker.MAX_ATTEMPTS);
  assert.ok(e.deadAt);
});

test("permanent errors dead-letter immediately", async () => {
  seed(1);
  worker.registerHandler("orders/create", async () => {
    throw Object.assign(new Error("malformed payload"), { permanent: true });
  });
  assert.deepEqual(await worker.runWorkerOnce(), ["dead"]);
});

test("expired lease is reclaimed; an event that never settles is eventually dead-lettered", async () => {
  seed(1);
  const e = events[0];
  Object.assign(e, { status: "processing", leaseUntil: new Date(Date.now() - 1), lockedBy: "crashed-worker", attempts: worker.MAX_ATTEMPTS });
  let calls = 0;
  worker.registerHandler("orders/create", async () => calls++);
  assert.deepEqual(await worker.runWorkerOnce(), ["dead"]);
  assert.equal(calls, 0);
  assert.equal(e.status, "dead");
});

test("event is ignored if its store moved to another workspace", async () => {
  seed(1);
  conns[0].workspace = WS_B; // reconnected elsewhere after the event was recorded
  let calls = 0;
  worker.registerHandler("orders/create", async () => calls++);
  assert.deepEqual(await worker.runWorkerOnce(), ["ignored"]);
  assert.equal(calls, 0);
  assert.equal(events[0].status, "ignored");
});

test("dead-letter retry only reaches the caller's own workspace", async () => {
  seed(1, { shop: "b.myshopify.com", workspace: WS_B });
  const id = "507f1f77bcf86cd799439011";
  Object.assign(events[0], { _id: id, status: "dead", attempts: 8 });
  assert.equal(await inbox.retryDeadEvent(WS_A, id), false);
  assert.equal(events[0].status, "dead");
  assert.equal(await inbox.retryDeadEvent(WS_B, id), true);
  assert.equal(events[0].status, "pending");
  assert.equal(events[0].attempts, 0);
});

test("customers/redact only touches the shop's own workspace", async () => {
  let filter;
  stub(ShopifyWebhookEvent, "updateMany", async (f) => ((filter = f), { modifiedCount: 2 }));
  const res = await deliver("a.myshopify.com", "customers/redact", { customer: { id: 9 }, orders_to_redact: [101] });
  assert.equal(res.status, 200);
  assert.equal(String(filter.workspace), WS_A);
  assert.equal(filter.shopDomain, "a.myshopify.com");
  assert.deepEqual(filter.$or[0], { "payload.customer.id": 9 });
});
