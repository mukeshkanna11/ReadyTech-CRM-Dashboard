/* Formatting helpers for the Shopify Integration page */

export const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

export const ago = (d) => {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

export const errorText = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.message || fallback;

/* One status per SKU row; same precedence as the backend preview totals */
export const rowStatus = (i) =>
  i.ambiguous ? ["amber", "Duplicate SKU"] : i.lastError ? ["red", "Failing"] : i.willPush ? ["blue", "Will update"] : ["green", "Up to date"];

/* Saved Shopify location vs. the store's active locations (matched by id, never by name) */
export const locationState = (savedGid, savedName, locations) => {
  if (!savedGid) return { status: "unset", name: null };
  const current = (locations || []).find((l) => l.id === savedGid);
  if (!current) return { status: "inactive", name: savedName || "Saved location" };
  return { status: current.name === savedName ? "ok" : "renamed", name: current.name };
};
