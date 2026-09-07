import crypto from "crypto";

/* =========================================================
   🔐 META TOKEN VAULT
   AES-256-GCM encryption for Meta access tokens at rest.
   Key is derived from META_APP_SECRET (never stored, never
   sent to the frontend).
========================================================= */
const ALGO = "aes-256-gcm";
const SALT = "readytech-meta-token-vault";

let cachedKey = null;

const getKey = () => {
  const secret = process.env.META_APP_SECRET;

  if (!secret) {
    throw new Error("META_APP_SECRET is not configured");
  }

  if (!cachedKey) {
    cachedKey = crypto.scryptSync(secret, SALT, 32);
  }

  return cachedKey;
};

/* ================= ENCRYPT ================= */
export const encryptToken = (plainText) => {
  if (!plainText) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
};

/* ================= DECRYPT ================= */
export const decryptToken = (payload) => {
  if (!payload) return null;

  const [ivHex, tagHex, dataHex] = String(payload).split(":");

  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Stored Meta token is malformed");
  }

  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
};
