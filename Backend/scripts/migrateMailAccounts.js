// scripts/migrateMailAccounts.js
/* =========================================================
   Mail Integration: one mailbox per workspace → many.
   Existing Gmail / Microsoft rows stay in `emailconnections` untouched
   (tokens are NOT re-encrypted); this only:
     1. marks each workspace's existing account as its default sender
     2. builds the new unique index workspace_1_provider_1_email_1
     3. drops the legacy UNIQUE index workspace_1 and recreates it
        non-unique (as declared by the workspace scope plugin)

   STAGING FIRST. Uses MIGRATION_MONGO_URI only (never MONGO_URI). Raw
   driver — no models, no scope plugin, no implicit index builds.

     node scripts/migrateMailAccounts.js           # dry run (read only)
     node scripts/migrateMailAccounts.js --apply   # migrate (idempotent)

   Until it runs, existing connections keep working; only adding a SECOND
   account to a workspace is refused with a friendly message.

   Rollback (only while every workspace still has ≤ 1 account):
     db.emailconnections.dropIndex("workspace_1")
     db.emailconnections.createIndex({workspace:1},{unique:true})
     db.emailconnections.dropIndex("workspace_1_provider_1_email_1")
========================================================= */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const NEW_INDEX = "workspace_1_provider_1_email_1";
const LEGACY_INDEX = "workspace_1";

const uri = process.env.MIGRATION_MONGO_URI;
if (!uri) {
  console.error("Set MIGRATION_MONGO_URI (staging database first) to run this script.");
  process.exit(1);
}

await mongoose.connect(uri, { autoIndex: false });
const col = mongoose.connection.db.collection("emailconnections");

const exists = (await mongoose.connection.db.listCollections({ name: "emailconnections" }).toArray()).length > 0;
const indexes = exists ? await col.indexes() : [];
const legacy = indexes.find((i) => i.name === LEGACY_INDEX);
const [total, noDefault, noWorkspace] = exists
  ? await Promise.all([
      col.estimatedDocumentCount(),
      col.countDocuments({ isDefault: { $ne: true } }),
      col.countDocuments({ $or: [{ workspace: null }, { workspace: { $exists: false } }] }),
    ])
  : [0, 0, 0];

console.log(`DB: ${mongoose.connection.db.databaseName}`);
console.log(`Indexes: ${indexes.map((i) => `${i.name}${i.unique ? " (unique)" : ""}`).join(", ") || "none"}`);
console.log(`Accounts: ${total}, without default flag: ${noDefault}, without workspace: ${noWorkspace}`);
if (noWorkspace) console.warn("⚠ Rows without a workspace are never used by the app; review them manually.");

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to migrate.");
  await mongoose.disconnect();
  process.exit(0);
}

// 1. Default sender: the oldest account of each workspace without one
const perWorkspace = await col
  .aggregate([
    { $match: { workspace: { $ne: null } } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: "$workspace", first: { $first: "$_id" }, hasDefault: { $max: { $eq: ["$isDefault", true] } } } },
    { $match: { hasDefault: false } },
  ])
  .toArray();
for (const w of perWorkspace) await col.updateOne({ _id: w.first }, { $set: { isDefault: true } });
await col.updateMany({ isDefault: { $exists: false } }, { $set: { isDefault: false } });
console.log(`✔ default sender set for ${perWorkspace.length} workspace(s)`);

// 2. New per-mailbox unique index
if (!indexes.some((i) => i.name === NEW_INDEX)) {
  await col.createIndex({ workspace: 1, provider: 1, email: 1 }, { unique: true, name: NEW_INDEX });
  console.log(`✔ created ${NEW_INDEX}`);
}

// 3. Legacy unique workspace index → non-unique
if (legacy?.unique) {
  await col.dropIndex(LEGACY_INDEX);
  await col.createIndex({ workspace: 1 }, { name: LEGACY_INDEX });
  console.log(`✔ ${LEGACY_INDEX} is no longer unique`);
}

console.log("Done.");
await mongoose.disconnect();
