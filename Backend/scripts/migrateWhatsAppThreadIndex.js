// scripts/migrateWhatsAppThreadIndex.js
/* =========================================================
   WhatsApp thread uniqueness: global phoneNumber_1 → per workspace
   (workspace_1_phoneNumber_1). Lets the same customer message two
   workspaces' numbers.

   STAGING FIRST. Uses MIGRATION_MONGO_URI only (never MONGO_URI), so
   it cannot hit the app database by accident. Raw driver — no models,
   no scope plugin, no implicit index builds.

     node scripts/migrateWhatsAppThreadIndex.js                 # dry run (read only)
     node scripts/migrateWhatsAppThreadIndex.js --apply         # build new index
     node scripts/migrateWhatsAppThreadIndex.js --apply --drop-legacy
                                                                # + drop phoneNumber_1

   Rollback (before any cross-workspace duplicate phone exists):
     db.whatsappconversations.createIndex({phoneNumber:1},{unique:true})
     db.whatsappconversations.dropIndex("workspace_1_phoneNumber_1")
========================================================= */
import "dotenv/config";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const DROP_LEGACY = process.argv.includes("--drop-legacy");
const NEW_INDEX = "workspace_1_phoneNumber_1";
const LEGACY_INDEX = "phoneNumber_1";

const uri = process.env.MIGRATION_MONGO_URI;
if (!uri) {
  console.error("Set MIGRATION_MONGO_URI (staging database) to run this script.");
  process.exit(1);
}

await mongoose.connect(uri, { autoIndex: false });
const col = mongoose.connection.db.collection("whatsappconversations");

const indexes = await col.indexes();
const names = indexes.map((i) => i.name);
const [total, noWorkspace, dups] = await Promise.all([
  col.estimatedDocumentCount(),
  col.countDocuments({ $or: [{ workspace: null }, { workspace: { $exists: false } }] }),
  col
    .aggregate([
      { $group: { _id: { w: "$workspace", p: "$phoneNumber" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "n" },
    ])
    .toArray(),
]);
const dupCount = dups[0]?.n || 0;

console.log(`DB: ${mongoose.connection.db.databaseName}`);
console.log(`Indexes: ${names.join(", ")}`);
console.log(`Conversations: ${total}, without workspace: ${noWorkspace}, (workspace, phoneNumber) duplicates: ${dupCount}`);

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to build the per-workspace index.");
  await mongoose.disconnect();
  process.exit(0);
}

if (dupCount) {
  console.error("Aborting: duplicates would make the unique index build fail. Resolve them first.");
  await mongoose.disconnect();
  process.exit(1);
}

if (!names.includes(NEW_INDEX)) {
  await col.createIndex({ workspace: 1, phoneNumber: 1 }, { unique: true, name: NEW_INDEX });
  console.log(`Created ${NEW_INDEX}`);
} else {
  console.log(`${NEW_INDEX} already exists`);
}

if (DROP_LEGACY && names.includes(LEGACY_INDEX)) {
  // Only after the replacement unique index is confirmed present
  const after = (await col.indexes()).map((i) => i.name);
  if (!after.includes(NEW_INDEX)) throw new Error(`${NEW_INDEX} missing — legacy index kept`);
  await col.dropIndex(LEGACY_INDEX);
  console.log(`Dropped ${LEGACY_INDEX}`);
} else if (names.includes(LEGACY_INDEX)) {
  console.log(`${LEGACY_INDEX} kept (add --drop-legacy to remove it).`);
}

await mongoose.disconnect();
