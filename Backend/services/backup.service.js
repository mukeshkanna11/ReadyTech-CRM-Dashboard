// services/backup.service.js — workspace restore points (in-database).
// NOTE: snapshots live in the same MongoDB as the live data, so they
// protect against bad edits/deletes, NOT against losing the database.
import crypto from "node:crypto";
import mongoose from "mongoose";
import RestorePoint from "../models/RestorePoint.js";
import { runWithWorkspace } from "../utils/workspaceContext.js";
import { EXCLUDED_MODELS } from "../utils/workspaceScope.js";

const { BSON } = mongoose.mongo;
const CHUNKS = "restorepointchunks";
const MAX_CHUNK_DOCS = 500;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024; // well under the 16 MB document limit
export const RESTORE_POINT_RETENTION = Number(process.env.RESTORE_POINT_RETENTION || 7);

const chunks = () => mongoose.connection.db.collection(CHUNKS);
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const hashDocs = (docs) => crypto.createHash("sha256").update(BSON.serialize({ docs })).digest("hex");

/* One workspace-scoped model per collection (User, AuditLog, … excluded) */
const scopedModels = () => {
  const byCollection = new Map();
  for (const name of mongoose.modelNames()) {
    const M = mongoose.model(name);
    // EmailConnection holds OAuth tokens → never copied into snapshots
    if (EXCLUDED_MODELS.has(name) || ["RestorePoint", "EmailConnection"].includes(name) || !M.schema.path("workspace")) continue;
    if (!byCollection.has(M.collection.collectionName)) byCollection.set(M.collection.collectionName, M);
  }
  return byCollection;
};

/* One backup/restore at a time per workspace (per process) */
const busy = new Set();
const exclusive = async (ws, fn) => {
  if (busy.has(ws)) {
    const err = new Error("A backup or restore is already running for this workspace");
    err.statusCode = 409;
    throw err;
  }
  busy.add(ws);
  try {
    return await fn();
  } finally {
    busy.delete(ws);
  }
};

const snapshot = async (ws, { trigger, createdBy }) => {
  const rp = await RestorePoint.create({ workspace: ws, trigger, createdBy });
  try {
    const collections = [];
    let totalDocs = 0;
    let sizeBytes = 0;

    for (const [name, M] of scopedModels()) {
      let count = 0;
      let index = 0;
      let batch = [];
      let batchBytes = 0;

      const flush = async () => {
        if (!batch.length) return;
        const doc = { restorePoint: rp._id, workspace: oid(ws), collection: name, index: index++, count: batch.length, hash: hashDocs(batch), docs: batch };
        sizeBytes += BSON.calculateObjectSize(doc);
        await chunks().insertOne(doc);
        batch = [];
        batchBytes = 0;
      };

      // Read through the scope plugin → only this workspace's records.
      // Paged find() (not .cursor(): its filter is cast before the scope hook runs)
      let lastId = null;
      for (;;) {
        const page = await runWithWorkspace(ws, () =>
          M.find(lastId ? { _id: { $gt: lastId } } : {}).sort({ _id: 1 }).limit(MAX_CHUNK_DOCS).lean().exec()
        ); // exec() inside the context: a bare Query would run outside it
        for (const d of page) {
          const size = BSON.calculateObjectSize(d);
          if (batch.length && (batch.length >= MAX_CHUNK_DOCS || batchBytes + size > MAX_CHUNK_BYTES)) await flush();
          batch.push(d);
          batchBytes += size;
          count++;
        }
        if (page.length < MAX_CHUNK_DOCS) break;
        lastId = page[page.length - 1]._id;
      }
      await flush();

      collections.push({ name, model: M.modelName, count, chunks: index });
      totalDocs += count;
    }

    await RestorePoint.updateOne(
      { _id: rp._id, workspace: ws },
      { $set: { status: "completed", collections, totalDocs, sizeBytes, completedAt: new Date() } }
    );
    return RestorePoint.findOne({ _id: rp._id, workspace: ws }).lean();
  } catch (err) {
    await RestorePoint.updateOne(
      { _id: rp._id, workspace: ws },
      { $set: { status: "failed", error: err.message, completedAt: new Date() } }
    );
    await chunks().deleteMany({ restorePoint: rp._id });
    throw err;
  }
};

/* Keep the newest RESTORE_POINT_RETENTION points; delete older ones + data */
export const pruneRestorePoints = async (workspaceId) => {
  const ws = String(workspaceId);
  const old = await RestorePoint.find({ workspace: ws }).sort({ createdAt: -1 }).skip(RESTORE_POINT_RETENTION).select("_id").lean();
  if (!old.length) return 0;
  const ids = old.map((r) => r._id);
  await chunks().deleteMany({ restorePoint: { $in: ids }, workspace: oid(ws) });
  await RestorePoint.deleteMany({ _id: { $in: ids }, workspace: ws });
  return ids.length;
};

export const createRestorePoint = (workspaceId, { trigger = "manual", createdBy = null } = {}) => {
  const ws = String(workspaceId);
  return exclusive(ws, async () => {
    const rp = await snapshot(ws, { trigger, createdBy });
    await pruneRestorePoints(ws);
    return rp;
  });
};

export const listRestorePoints = (workspaceId) =>
  RestorePoint.find({ workspace: String(workspaceId) }).sort({ createdAt: -1 }).lean();

/* Integrity check: completed, every chunk present, hashes + counts match,
   every collection still known to the app */
export const validateRestorePoint = async (workspaceId, id) => {
  const ws = String(workspaceId);
  if (!mongoose.isValidObjectId(id)) return { valid: false, problems: ["Restore point not found"] };

  const rp = await RestorePoint.findOne({ _id: id, workspace: ws }).lean();
  if (!rp) return { valid: false, problems: ["Restore point not found"] };

  const problems = [];
  if (rp.status !== "completed") problems.push(`Restore point status is "${rp.status}"`);

  const models = scopedModels();
  for (const c of rp.collections || []) {
    if (!models.has(c.name)) problems.push(`${c.name}: collection is no longer used by the app`);
    let docs = 0;
    let seen = 0;
    for await (const ch of chunks().find({ restorePoint: rp._id, workspace: oid(ws), collection: c.name }).sort({ index: 1 })) {
      if (ch.index !== seen) problems.push(`${c.name}: chunk ${seen} missing`);
      if (hashDocs(ch.docs) !== ch.hash || ch.docs.length !== ch.count) problems.push(`${c.name}: chunk ${ch.index} is corrupted`);
      docs += ch.docs.length;
      seen = ch.index + 1;
    }
    if (seen !== c.chunks || docs !== c.count) problems.push(`${c.name}: expected ${c.count} records, found ${docs}`);
  }

  return { valid: problems.length === 0, problems, restorePoint: rp };
};

/* Replace this workspace's records with the snapshot, collection by collection */
const apply = async (ws, rp) => {
  const models = scopedModels();
  for (const c of rp.collections) {
    const M = models.get(c.name);
    await runWithWorkspace(ws, () => M.deleteMany({}).exec()); // scoped → this workspace only
    for await (const ch of chunks().find({ restorePoint: rp._id, workspace: oid(ws), collection: c.name }).sort({ index: 1 })) {
      if (ch.docs.length) await M.collection.insertMany(ch.docs, { ordered: true });
    }
  }
};

/* Validates first, snapshots current data ("pre-restore"), then restores.
   On failure the pre-restore snapshot is applied back automatically. */
export const restoreFromPoint = (workspaceId, id, { createdBy = null } = {}) => {
  const ws = String(workspaceId);
  return exclusive(ws, async () => {
    const check = await validateRestorePoint(ws, id);
    if (!check.valid) {
      const err = new Error(`Restore point failed validation: ${check.problems.join("; ")}`);
      err.statusCode = 422;
      err.problems = check.problems;
      throw err;
    }

    const safety = await snapshot(ws, { trigger: "pre-restore", createdBy });

    try {
      await apply(ws, check.restorePoint);
    } catch (err) {
      let rolledBack = false;
      try {
        await apply(ws, safety);
        rolledBack = true;
      } catch (rollbackErr) {
        console.error("❌ Restore rollback failed:", rollbackErr.message);
      }
      const e = new Error(
        `Restore failed: ${err.message}. ${rolledBack ? "Data was rolled back to the pre-restore snapshot." : `Rollback ALSO failed — restore manually from restore point ${safety._id}.`}`
      );
      e.statusCode = 500;
      throw e;
    }

    await RestorePoint.updateOne({ _id: check.restorePoint._id, workspace: ws }, { $set: { lastRestoredAt: new Date() } });
    await pruneRestorePoints(ws);
    return { restored: check.restorePoint, safetyPoint: safety };
  });
};
