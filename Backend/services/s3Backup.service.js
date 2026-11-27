// services/s3Backup.service.js — off-site copies of workspace restore points.
// Reuses services/backup.service.js: a completed restore point (metadata +
// its "restorepointchunks") is uploaded as a gzipped stream of BSON documents
// to a PRIVATE bucket at backups/<workspaceId>/<restorePointId>.bson.gz.
// Restoring re-imports it as an "s3-import" restore point and hands it to the
// existing restoreFromPoint() (validation, pre-restore snapshot, rollback).
// S3 keys are always built server-side from the caller's workspace.
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
import mongoose from "mongoose";
import {
  S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import RestorePoint from "../models/RestorePoint.js";
import { validateRestorePoint, restoreFromPoint } from "./backup.service.js";
import { getDefaultWorkspaceId } from "../utils/workspaceContext.js";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const { BSON } = mongoose.mongo;

const FORMAT = "readytech-restore-point";
const CHUNKS = "restorepointchunks"; // same raw collection as backup.service.js
const MB = 1024 * 1024;
export const S3_BACKUP_MAX_BYTES = Number(process.env.S3_BACKUP_MAX_BYTES || 100 * MB); // compressed
export const S3_BACKUP_MAX_UNCOMPRESSED_BYTES = Number(process.env.S3_BACKUP_MAX_UNCOMPRESSED_BYTES || 150 * MB);

const ID_RE = /^[a-f0-9]{24}$/i;
const chunks = () => mongoose.connection.db.collection(CHUNKS);
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const hashDocs = (docs) => crypto.createHash("sha256").update(BSON.serialize({ docs })).digest("hex");

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { statusCode: status }, extra);

export const isS3Configured = () =>
  Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

let client = null;
const s3 = () => {
  if (!isS3Configured()) throw httpError(409, "S3 backup storage is not configured");
  // Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (SDK env provider)
  if (!client) client = new S3Client({ region: process.env.AWS_REGION });
  return client;
};
const bucket = () => process.env.AWS_S3_BUCKET;

const prefixFor = (ws) => `backups/${String(ws)}/`;
const keyFor = (ws, id) => {
  if (!ID_RE.test(String(ws)) || !ID_RE.test(String(id))) throw httpError(404, "Backup not found");
  return `${prefixFor(ws)}${String(id).toLowerCase()}.bson.gz`;
};

/* S3 failures never leak raw SDK details (bucket, request ids) to clients */
const s3Failure = (err, action) => {
  if (err?.statusCode) return err;
  console.error(`❌ S3 ${action} failed:`, err?.name, err?.message);
  return httpError(502, `S3 ${action} failed`);
};

const objectExists = async (Key) => {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return false;
    throw err;
  }
};

/* ---------- Upload ---------- */

const uploading = new Set(); // per process: one upload per key at a time

export const uploadRestorePoint = async (workspaceId, restorePointId) => {
  const ws = String(workspaceId);
  const Key = keyFor(ws, restorePointId);
  if (uploading.has(Key)) return { skipped: true, reason: "upload already running" };
  uploading.add(Key);
  try {
    if (await objectExists(Key)) return { skipped: true, reason: "already uploaded" };

    // Existing integrity check: completed, all chunks present, hashes match
    const check = await validateRestorePoint(ws, restorePointId);
    if (!check.restorePoint) throw httpError(404, "Restore point not found");
    if (!check.valid) throw httpError(422, `Restore point failed validation: ${check.problems.join("; ")}`);
    const rp = check.restorePoint;
    if (rp.trigger === "s3-import") return { skipped: true, reason: "imported from S3" };

    const parts = [];
    let chunkCount = 0;
    const header = {
      format: FORMAT,
      version: 1,
      workspace: oid(ws),
      restorePoint: {
        _id: rp._id, trigger: rp.trigger, collections: rp.collections, totalDocs: rp.totalDocs,
        sizeBytes: rp.sizeBytes, createdAt: rp.createdAt, completedAt: rp.completedAt,
      },
    };
    parts.push(null); // header goes first once the chunk count is known
    for (const c of rp.collections || []) {
      for await (const ch of chunks().find({ restorePoint: rp._id, workspace: oid(ws), collection: c.name }).sort({ index: 1 })) {
        parts.push(BSON.serialize({ collection: ch.collection, index: ch.index, count: ch.count, hash: ch.hash, docs: ch.docs }));
        chunkCount++;
      }
    }
    parts[0] = BSON.serialize({ ...header, chunkCount });

    const raw = Buffer.concat(parts);
    if (raw.length > S3_BACKUP_MAX_UNCOMPRESSED_BYTES) {
      throw httpError(413, `Backup is ${Math.ceil(raw.length / MB)} MB uncompressed, above the S3_BACKUP_MAX_UNCOMPRESSED_BYTES limit — it could not be restored, so it was not uploaded`);
    }
    const body = await gzip(raw);
    if (body.length > S3_BACKUP_MAX_BYTES) {
      throw httpError(413, `Backup is ${Math.ceil(body.length / MB)} MB, above the S3_BACKUP_MAX_BYTES limit — it could not be restored, so it was not uploaded`);
    }

    try {
      await s3().send(new PutObjectCommand({
        Bucket: bucket(),
        Key,
        Body: body,
        ContentType: "application/gzip",
        ServerSideEncryption: "AES256",
        IfNoneMatch: "*", // never overwrite an existing backup
        Metadata: { "restore-point": String(rp._id), "total-docs": String(rp.totalDocs || 0) },
      }));
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 412 || status === 409) return { skipped: true, reason: "already uploaded" };
      throw err;
    }
    return { uploaded: true, sizeBytes: body.length, totalDocs: rp.totalDocs };
  } catch (err) {
    throw s3Failure(err, "upload");
  } finally {
    uploading.delete(Key);
  }
};

/* ---------- List ---------- */

export const listS3Backups = async (workspaceId) => {
  const ws = String(workspaceId);
  if (!ID_RE.test(ws)) return [];
  const prefix = prefixFor(ws);
  const out = [];
  try {
    let ContinuationToken;
    do {
      const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken }));
      for (const o of page.Contents || []) {
        const m = o.Key.slice(prefix.length).match(/^([a-f0-9]{24})\.bson\.gz$/i);
        if (!m) continue;
        out.push({
          id: m[1],
          createdAt: oid(m[1]).getTimestamp(), // restore point creation time
          uploadedAt: o.LastModified,
          sizeBytes: o.Size,
        });
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  } catch (err) {
    throw s3Failure(err, "list");
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
};

/* ---------- Download + import + restore ---------- */

const download = async (Key) => {
  let res;
  try {
    res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key }));
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") throw httpError(404, "Backup not found");
    throw s3Failure(err, "download");
  }
  if (Number(res.ContentLength) > S3_BACKUP_MAX_BYTES) {
    res.Body?.destroy?.();
    throw httpError(413, "Backup exceeds the S3_BACKUP_MAX_BYTES download limit");
  }
  const parts = [];
  let total = 0;
  for await (const part of res.Body) {
    total += part.length;
    if (total > S3_BACKUP_MAX_BYTES) {
      res.Body.destroy?.();
      throw httpError(413, "Backup exceeds the S3_BACKUP_MAX_BYTES download limit");
    }
    parts.push(part);
  }
  try {
    return await gunzip(Buffer.concat(parts), { maxOutputLength: S3_BACKUP_MAX_UNCOMPRESSED_BYTES });
  } catch (err) {
    if (err?.code === "ERR_BUFFER_TOO_LARGE") throw httpError(413, "Backup exceeds the S3_BACKUP_MAX_UNCOMPRESSED_BYTES limit");
    throw httpError(422, "Backup file is corrupted (gzip)");
  }
};

/* Split a buffer of concatenated BSON documents */
const parseDocs = (buf) => {
  const docs = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 5) throw httpError(422, "Backup file is corrupted (truncated)");
    const len = buf.readInt32LE(offset);
    if (len < 5 || offset + len > buf.length) throw httpError(422, "Backup file is corrupted (truncated)");
    docs.push(BSON.deserialize(buf.subarray(offset, offset + len)));
    offset += len;
  }
  return docs;
};

const sameId = (a, b) => a != null && String(a) === String(b);

/* Every check that can be done before anything is written */
const checkBackup = (ws, id, docs) => {
  const [header, ...chunkDocs] = docs;
  if (header?.format !== FORMAT || header.version !== 1 || !header.restorePoint) throw httpError(422, "Not a ReadyTech restore-point backup");
  if (!sameId(header.workspace, ws)) throw httpError(403, "Backup belongs to a different workspace");
  if (!sameId(header.restorePoint._id, id)) throw httpError(422, "Backup does not match the requested restore point");
  if (header.chunkCount !== chunkDocs.length) throw httpError(422, "Backup file is incomplete");

  // Pre-isolation records (no workspace field) only belong to the default workspace
  const allowLegacy = sameId(getDefaultWorkspaceId(), ws);
  const expected = new Map((header.restorePoint.collections || []).map((c) => [c.name, c]));
  for (const ch of chunkDocs) {
    if (!expected.has(ch.collection)) throw httpError(422, `Backup contains an unexpected collection "${ch.collection}"`);
    if (!Array.isArray(ch.docs) || ch.docs.length !== ch.count || hashDocs(ch.docs) !== ch.hash) {
      throw httpError(422, `${ch.collection}: chunk ${ch.index} is corrupted`);
    }
    for (const d of ch.docs) {
      const owned = d.workspace == null ? allowLegacy : sameId(d.workspace, ws);
      if (!owned) throw httpError(403, `${ch.collection}: backup contains records from a different workspace`);
    }
  }
  return { header, chunkDocs };
};

const removeImport = async (ws, rpId) => {
  try {
    await chunks().deleteMany({ restorePoint: rpId, workspace: oid(ws) });
    await RestorePoint.deleteMany({ _id: rpId, workspace: ws });
  } catch (err) {
    console.error("⚠️ Failed to clean up S3 import", String(rpId), err.message);
  }
};

export const restoreFromS3 = async (workspaceId, backupId, { createdBy = null } = {}) => {
  const ws = String(workspaceId);
  const Key = keyFor(ws, backupId);
  const { header, chunkDocs } = checkBackup(ws, backupId, parseDocs(await download(Key)));
  const src = header.restorePoint;

  // Recreate as a completed "s3-import" restore point with fresh ids
  let rp;
  try {
    rp = await RestorePoint.create({
      workspace: ws, trigger: "s3-import", createdBy, status: "completed",
      collections: src.collections, totalDocs: src.totalDocs, sizeBytes: src.sizeBytes, completedAt: new Date(),
    });
    for (const ch of chunkDocs) {
      await chunks().insertOne({
        restorePoint: rp._id, workspace: oid(ws), collection: ch.collection,
        index: ch.index, count: ch.count, hash: ch.hash, docs: ch.docs,
      });
    }
  } catch (err) {
    if (rp) await removeImport(ws, rp._id);
    console.error("❌ S3 import failed:", err.message);
    throw httpError(500, "Failed to import backup from S3");
  }

  // Existing flow: validate → pre-restore snapshot → apply → rollback on failure
  try {
    const result = await restoreFromPoint(ws, rp._id, { createdBy });
    return { ...result, backup: { id: String(src._id), createdAt: src.createdAt, totalDocs: src.totalDocs } };
  } catch (err) {
    await removeImport(ws, rp._id); // still in S3; nothing is lost
    throw err;
  }
};
