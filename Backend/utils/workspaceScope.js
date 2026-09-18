// utils/workspaceScope.js
import mongoose from "mongoose";

import {
  getWorkspaceId,
  isDefaultWorkspace,
} from "./workspaceContext.js";

/* =========================================================
   WORKSPACE SCOPE PLUGIN
   Registered globally (bottom of this file) so every schema
   is isolated at the database layer. Controllers, services
   and API routes are untouched.

   Import this module BEFORE any model is compiled —
   mongoose.plugin() only applies to schemas created after it.
========================================================= */

/* System collections that must NEVER be workspace-scoped.
   - User           : login must find users across all workspaces
   - MetaConnection : one shared Meta / Instagram / WhatsApp
                      connection; Siva's stays working and is not
                      copied into new workspaces
   - AuditLog       : global audit trail
   - Summary        : global metadata */
export const EXCLUDED_MODELS = new Set([
  "User",
  "MetaConnection",
  "AuditLog",
  "Summary",
]);

/* Every query form that carries a filter */
const FILTER_HOOKS = [
  "count",
  "countDocuments",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
];

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
};

/* Option A — existing records are never rewritten.
   Pre-isolation documents have no `workspace` field, so the default
   workspace matches its own id OR a missing/null field. Every other
   workspace matches its id only, and therefore sees nothing legacy. */
const workspaceMatch = (workspaceId) => {
  if (!isDefaultWorkspace()) return { workspace: workspaceId };

  return {
    $or: [
      { workspace: workspaceId },
      { workspace: { $exists: false } },
      { workspace: null },
    ],
  };
};

export default function workspaceScope(schema) {
  schema.add({
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  });

  /* ---------- READS / UPDATES / DELETES ---------- */
  schema.pre(FILTER_HOOKS, function () {
    if (EXCLUDED_MODELS.has(this.model?.modelName)) return;

    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    // An explicit workspace in the filter wins (internal callers)
    if (this.getFilter()?.workspace !== undefined) return;

    this.and([workspaceMatch(workspaceId)]);
  });

  /* ---------- AGGREGATIONS ---------- */
  schema.pre("aggregate", function () {
    if (EXCLUDED_MODELS.has(this._model?.modelName)) return;

    const workspaceId = getWorkspaceId();
    if (!workspaceId) return;

    const id = toObjectId(workspaceId);
    if (!id) return;

    this.pipeline().unshift({ $match: workspaceMatch(id) });
  });

  /* ---------- CREATES ---------- */
  schema.pre("save", function () {
    if (EXCLUDED_MODELS.has(this.constructor?.modelName)) return;
    if (!this.isNew || this.workspace) return;

    const workspaceId = getWorkspaceId();
    if (workspaceId) this.workspace = workspaceId;
  });

  schema.pre("insertMany", function (next, docs) {
    if (EXCLUDED_MODELS.has(this.modelName)) return next();

    const workspaceId = getWorkspaceId();
    if (!workspaceId || !Array.isArray(docs)) return next();

    docs.forEach((doc) => {
      if (doc && !doc.workspace) doc.workspace = workspaceId;
    });

    next();
  });
}

/* Applies to every schema compiled after this module is imported */
mongoose.plugin(workspaceScope);
