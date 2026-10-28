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
