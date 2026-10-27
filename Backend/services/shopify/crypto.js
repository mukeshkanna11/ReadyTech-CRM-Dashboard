// services/shopify/crypto.js — AES-256-GCM for Shopify tokens at rest.
// Dedicated key, no fallback to other secrets (fails closed). Versioned
// payload ("v1.") so the key can be rotated later.
import crypto from "node:crypto";

const VERSION = "v1";

const key = () => {
  const raw = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY is not configured");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("SHOPIFY_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  return buf;
};

export const encrypt = (plain) => {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return [VERSION, ...[iv, c.getAuthTag(), enc].map((b) => b.toString("base64"))].join(".");
};

export const decrypt = (blob) => {
  if (!blob) return null;
  const [version, iv, tag, enc] = String(blob).split(".");
  if (version !== VERSION || !iv || !tag || !enc) throw new Error("Stored Shopify token is malformed");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
};
