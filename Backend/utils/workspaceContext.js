// utils/workspaceContext.js
import { AsyncLocalStorage } from "node:async_hooks";

/* =========================================================
   WORKSPACE CONTEXT
   Holds the workspace of the current request so the Mongoose
   scope plugin can isolate data without every controller
   having to pass it down.

   A workspace id IS the authenticated user's _id, so each
   login email automatically owns a separate workspace.
========================================================= */

const storage = new AsyncLocalStorage();

/* The workspace that owns:
   - every record created before isolation existed (they have no
     `workspace` field at all — see workspaceScope.js)
   - every unauthenticated write: website enquiry form, Instagram
     webhook, WhatsApp webhook
   Resolved once after the DB connects (config/db.js). */
let defaultWorkspaceId = null;

export const setDefaultWorkspaceId = (id) => {
  defaultWorkspaceId = id ? String(id) : null;
};

export const getDefaultWorkspaceId = () => defaultWorkspaceId;

/* Binds a workspace to this request and everything it awaits.
   `run` (not `enterWith`) so the binding cannot leak between
   concurrent requests. */
export const runWithWorkspace = (workspaceId, fn) =>
  storage.run(
    { workspaceId: workspaceId ? String(workspaceId) : null },
    fn
  );

/* Active workspace, falling back to the default one for
   unauthenticated traffic (webhooks, public enquiry form). */
export const getWorkspaceId = () =>
  storage.getStore()?.workspaceId || defaultWorkspaceId;

/* Mongo filter for User documents (excluded from the scope plugin)
   belonging to a workspace: its owner, users created into it, and —
   for the default workspace only — legacy non-admin users that have
   no workspace yet. */
export const userWorkspaceFilter = (workspaceId) => {
  // No workspace → match nothing, never all users
  if (!workspaceId) return { _id: null };

  const id = String(workspaceId);
  const or = [{ _id: id }, { workspace: id }];

  if (defaultWorkspaceId && id === defaultWorkspaceId) {
    or.push({ workspace: null, role: { $ne: "admin" } });
  }

  return { $or: or };
};

/* User filter for the active workspace (owner lookups). Fails closed
   when no workspace is resolved. */
export const activeUserScope = () => {
  const id = getWorkspaceId();

  return id ? userWorkspaceFilter(id) : { _id: null };
};

/* Platform (.env) integration credentials belong to the default
   workspace only. Fails closed: an authenticated request of another —
   or an unresolved — workspace never gets them. Unauthenticated
   traffic (webhooks) runs as the default workspace. */
export const usesPlatformCredentials = () => {
  const active = storage.getStore()?.workspaceId;
  if (!active) return true;

  return Boolean(defaultWorkspaceId) && active === defaultWorkspaceId;
};

/* True when the active workspace is the default one, which also
   owns all pre-isolation records. */
export const isDefaultWorkspace = () => {
  const active = getWorkspaceId();

  return Boolean(active) && active === defaultWorkspaceId;
};
