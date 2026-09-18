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

/* True when the active workspace is the default one, which also
   owns all pre-isolation records. */
export const isDefaultWorkspace = () => {
  const active = getWorkspaceId();

  return Boolean(active) && active === defaultWorkspaceId;
};
