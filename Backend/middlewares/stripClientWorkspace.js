// middlewares/stripClientWorkspace.js
/* =========================================================
   Never trust a client-supplied workspace id.
   The workspace of a request is derived ONLY from the verified
   user (middlewares/auth.js → runWithWorkspace). The scope plugin
   keeps a `workspace` already present on a document / filter, so a
   `workspace` key in the body or query string would let a caller
   create, move or read records in another tenant. Remove every
   such key (at any depth) before any route handler runs.
========================================================= */
const MAX_DEPTH = 20;

export const stripWorkspaceKeys = (value, depth = 0) => {
  if (!value || typeof value !== "object" || depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    value.forEach((item) => stripWorkspaceKeys(item, depth + 1));
    return value;
  }

  for (const key of Object.keys(value)) {
    // "workspace" and dotted paths such as "workspace" inside $set / "x.workspace";
    // "$..." keys are Mongo operators (e.g. ?status[$ne]=x) — never valid client input
    if (key === "workspace" || key.split(".").includes("workspace") || key.startsWith("$")) {
      delete value[key];
    } else {
      stripWorkspaceKeys(value[key], depth + 1);
    }
  }
  return value;
};

const stripClientWorkspace = (req, res, next) => {
  stripWorkspaceKeys(req.body);
  stripWorkspaceKeys(req.query);
  next();
};

export default stripClientWorkspace;
