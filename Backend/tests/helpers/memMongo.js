// Tiny in-memory stand-in for the Mongoose model methods the mail services use
// (DB-free tests). Supports the operators those services need, unique indexes
// (E11000) and upsert with $setOnInsert.
import mongoose from "mongoose";

const isOid = (v) => v instanceof mongoose.Types.ObjectId;
const str = (v) => (v == null ? v : isOid(v) ? String(v) : v);
export const clone = (d) => {
  if (d == null || typeof d !== "object" || isOid(d) || d instanceof Date || Buffer.isBuffer(d) || d instanceof RegExp) return d;
  if (Array.isArray(d)) return d.map(clone);
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, clone(v)]));
};
const get = (doc, path) =>
  path.split(".").reduce((vals, key) => vals.flatMap((v) => {
    if (v == null) return [undefined];
    if (Array.isArray(v)) return /^\d+$/.test(key) ? [v[key]] : v.map((x) => x?.[key]);
    return [v[key]];
  }), [doc]);
const eq = (a, b) => {
  if (Array.isArray(a)) return a.some((x) => eq(x, b));
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  return String(str(a)) === String(str(b));
};
const cmp = (a, b) => (a instanceof Date || b instanceof Date ? new Date(a).getTime() - new Date(b).getTime() : a < b ? -1 : a > b ? 1 : 0);
const isOps = (c) => c && typeof c === "object" && !isOid(c) && !(c instanceof Date) && !Array.isArray(c) && Object.keys(c).some((k) => k.startsWith("$"));
const cond = (vals, c) => {
  if (c instanceof RegExp) return vals.some((v) => [].concat(v).some((x) => c.test(String(x ?? ""))));
  if (!isOps(c)) return vals.some((v) => eq(v, c));
  return Object.entries(c).every(([op, arg]) => {
    switch (op) {
      case "$in": return arg.some((x) => vals.some((v) => eq(v, x)));
      case "$nin": return !arg.some((x) => vals.some((v) => eq(v, x)));
      case "$ne": return !vals.some((v) => eq(v, arg));
      case "$exists": return vals.some((v) => v !== undefined) === arg;
      case "$type": return vals.some((v) => (arg === "string" ? typeof v === "string" : typeof v === arg));
      case "$regex": return vals.some((v) => [].concat(v).some((x) => new RegExp(arg, c.$options || "").test(String(x ?? ""))));
      case "$options": return true;
      case "$lt": return vals.some((v) => v != null && cmp(v, arg) < 0);
      case "$lte": return vals.some((v) => v != null && cmp(v, arg) <= 0);
      case "$gt": return vals.some((v) => v != null && cmp(v, arg) > 0);
      case "$gte": return vals.some((v) => v != null && cmp(v, arg) >= 0);
      case "$elemMatch": return vals.some((v) => Array.isArray(v) && v.some((el) => match(el, arg)));
      default: throw new Error(`memMongo: unsupported ${op}`);
    }
  });
};
export const match = (doc, f = {}) =>
  Object.entries(f).every(([k, c]) => {
    if (k === "$or") return c.some((x) => match(doc, x));
    if (k === "$and") return c.every((x) => match(doc, x));
    return cond(get(doc, k), c);
  });

const chain = (fn) => {
  const p = { select: () => p, sort: () => p, skip: () => p, limit: () => p, lean: () => p, then: (a, b) => Promise.resolve().then(fn).then(a, b) };
  return p;
};

let seq = 0;
/* Replaces Model's static methods; returns the backing array.
   unique: list of key arrays, e.g. [["workspace", "account"]] */
export const memModel = (Model, { unique = [], defaults = {} } = {}) => {
  const rows = [];
  const norm = (d) => {
    const o = { ...d };
    for (const [k, v] of Object.entries(o)) if (isOid(v)) o[k] = String(v);
    return o;
  };
  const dupe = (doc, self) =>
    unique.some((keys) => keys.every((k) => doc[k] != null && typeof doc[k] !== "object") &&
      rows.some((r) => r !== self && keys.every((k) => eq(r[k], doc[k]))));
  const fail11000 = () => Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
  const apply = (r, u = {}) => {
    const next = { ...r, ...norm(u.$set || {}) };
    for (const [k, v] of Object.entries(u.$inc || {})) next[k] = (next[k] || 0) + v;
    next.updatedAt = new Date();
    return next;
  };
  const view = (r) => {
    const out = clone(r);
    Object.defineProperty(out, "toObject", { value: () => clone(r), enumerable: false });
    return out;
  };

  Model.find = (f) => chain(() => rows.filter((r) => match(r, f)).map(view));
  Model.findOne = (f) => chain(() => { const r = rows.find((x) => match(x, f)); return r ? view(r) : null; });
  Model.countDocuments = async (f) => rows.filter((r) => match(r, f)).length;
  Model.distinct = async (path, f) => [...new Set(rows.filter((r) => match(r, f)).flatMap((r) => get(r, path)).filter(Boolean).map(String))];
  Model.create = async (d) => {
    const r = norm({ ...clone(defaults), ...d, _id: d._id || new mongoose.Types.ObjectId(), createdAt: new Date(), updatedAt: new Date() });
    if (dupe(r)) throw fail11000();
    rows.push(r);
    return view(r);
  };
  Model.updateOne = async (f, u) => {
    const i = rows.findIndex((x) => match(x, f));
    if (i >= 0) {
      const next = apply(rows[i], u);
      if (dupe(next, rows[i])) throw fail11000();
      rows[i] = next;
    }
    return { matchedCount: i >= 0 ? 1 : 0 };
  };
  Model.findOneAndUpdate = (f, u, o = {}) => chain(() => {
    const i = rows.findIndex((x) => match(x, f));
    if (i >= 0) {
      rows[i] = apply(rows[i], u);
      return view(rows[i]);
    }
    if (!o.upsert) return null;
    const base = Object.fromEntries(Object.entries(f).filter(([k, v]) => !k.startsWith("$") && !isOps(v)));
    const r = norm({ ...clone(defaults), ...base, ...(u.$setOnInsert || {}), ...(u.$set || {}), _id: new mongoose.Types.ObjectId(), createdAt: new Date(), updatedAt: new Date() });
    if (dupe(r)) throw fail11000();
    rows.push(r);
    return view(r);
  });
  Model.deleteOne = async (f) => { const i = rows.findIndex((x) => match(x, f)); if (i >= 0) rows.splice(i, 1); };
  Model.deleteMany = async (f) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], f)) rows.splice(i, 1); };
  rows.seq = () => ++seq;
  return rows;
};
