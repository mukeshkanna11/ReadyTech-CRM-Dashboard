// services/shopify/webhookWorker.js — processes the Shopify webhook inbox.
// In-process (no Redis), safe across several instances: each event is
// claimed with one atomic findOneAndUpdate lease; a crashed worker's lease
// expires and the event is reclaimed. Failures retry with exponential
// backoff and become "dead" (dead-letter) after MAX_ATTEMPTS.
//
// Every event runs inside runWithWorkspace(event.workspace) and only while
// its store is still actively connected to that same workspace.
import os from "node:os";
import crypto from "node:crypto";
import ShopifyWebhookEvent from "../../models/ShopifyWebhookEvent.js";
import ShopifyConnection from "../../models/ShopifyConnection.js";
import { runWithWorkspace } from "../../utils/workspaceContext.js";
import { missingConfig } from "./shopify.service.js";
import { ORDER_HANDLERS } from "./orderSync.service.js";
import { INVENTORY_HANDLERS, runInventorySyncAll } from "./inventorySync.service.js";

export const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString("hex")}`;
export const LEASE_MS = 2 * 60_000;
export const MAX_ATTEMPTS = 8;
const POLL_MS = 5_000;
const BATCH = 25;

/* 30s, 1m, 2m, 4m … capped at 6h, with ±20% jitter */
export const backoffMs = (attempts) => {
  const base = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60_000);
  return Math.round(base * (0.8 + Math.random() * 0.4));
};

/* topic → async (event, connection) => void. Must be idempotent.
   startShopifyWorker registers the order, fulfilment, product and
   inventory-level handlers. Topics without a handler are never claimed. */
const HANDLERS = new Map();
export const registerHandler = (topic, fn) => HANDLERS.set(topic, fn);
export const unregisterHandler = (topic) => HANDLERS.delete(topic);

/* Atomic claim: a due pending event, or one whose lease expired */
export const claimNext = (now = new Date()) =>
  ShopifyWebhookEvent.findOneAndUpdate(
    {
      workspace: { $ne: null },
      topic: { $in: [...HANDLERS.keys()] },
      $or: [
        { status: "pending", nextAttemptAt: { $lte: now } },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    { $set: { status: "processing", leaseUntil: new Date(now.getTime() + LEASE_MS), lockedBy: WORKER_ID }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" }
  );

/* Writes only while this worker still holds the lease */
const settle = (event, set) =>
  ShopifyWebhookEvent.updateOne(
    { _id: event._id, workspace: event.workspace, lockedBy: WORKER_ID, status: "processing" },
    { $set: { leaseUntil: null, lockedBy: null, ...set } }
  );

export const processEvent = (event) =>
  runWithWorkspace(event.workspace, async () => {
    try {
      // Reclaimed after lease expiries without ever settling (e.g. it crashed the process)
      if (event.attempts > MAX_ATTEMPTS) throw Object.assign(new Error(event.lastError || "Exceeded retry attempts"), { permanent: true });

      const conn = await ShopifyConnection.findOne(
        { _id: event.connection, workspace: event.workspace },
        "shopDomain status workspace connectedBy inventory",
        { lean: true }
      );
      if (!conn || conn.status !== "active" || conn.shopDomain !== event.shopDomain) {
        await settle(event, { status: "ignored", processedAt: new Date(), lastError: "Store is no longer connected to this workspace" });
        return "ignored";
      }

      const handler = HANDLERS.get(event.topic);
      if (!handler) {
        // Handler removed after the claim: hand it back untouched
        await settle(event, { status: "pending", attempts: Math.max(0, event.attempts - 1) });
        return "released";
      }

      await handler(event, conn);
      await settle(event, { status: "processed", processedAt: new Date(), lastError: null });
      return "processed";
    } catch (err) {
      const message = String(err?.message || err).slice(0, 500);
      const dead = err?.permanent === true || event.attempts >= MAX_ATTEMPTS;
      await settle(
        event,
        dead
          ? { status: "dead", deadAt: new Date(), lastError: message }
          : { status: "pending", nextAttemptAt: new Date(Date.now() + backoffMs(event.attempts)), lastError: message }
      );
      if (dead) console.error(`❌ Shopify event ${event._id} (${event.topic}) dead-lettered:`, message);
      return dead ? "dead" : "retry";
    }
  });

export const runWorkerOnce = async ({ max = BATCH } = {}) => {
  const results = [];
  while (results.length < max) {
    const event = await claimNext();
    if (!event) break;
    results.push(await processEvent(event));
  }
  return results;
};

export const workerState = { running: false, busy: false, lastRunAt: null, lastError: null };

export const startShopifyWorker = () => {
  if (workerState.running || process.env.SHOPIFY_WORKER_DISABLED === "true" || missingConfig().length) return;
  workerState.running = true;
  Object.entries({ ...ORDER_HANDLERS, ...INVENTORY_HANDLERS }).forEach(([topic, fn]) => registerHandler(topic, fn));

  // ERP → Shopify stock: every 5 minutes (one run per store at a time via lease)
  let syncing = false;
  setInterval(async () => {
    if (syncing) return;
    syncing = true;
    try {
      await runInventorySyncAll();
    } catch (err) {
      console.error("❌ Shopify inventory sync run failed:", err.message);
    } finally {
      syncing = false;
    }
  }, 5 * 60_000).unref();
  setInterval(async () => {
    if (workerState.busy) return;
    workerState.busy = true;
    try {
      await runWorkerOnce();
      workerState.lastRunAt = new Date();
      workerState.lastError = null;
    } catch (err) {
      workerState.lastError = err.message;
      console.error("❌ Shopify worker run failed:", err.message);
    } finally {
      workerState.busy = false;
    }
  }, POLL_MS).unref();
  console.log(`🛍️ Shopify webhook worker started (${WORKER_ID})`);
};
