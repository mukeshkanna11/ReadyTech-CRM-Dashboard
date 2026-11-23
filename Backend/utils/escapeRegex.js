// utils/escapeRegex.js — treat user search text as a literal (no regex injection / ReDoS)
export const escapeRegex = (value = "") => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
