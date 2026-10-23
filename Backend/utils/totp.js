// utils/totp.js — RFC 6238 TOTP (SHA-1, 6 digits, 30 s) on node:crypto
import crypto from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export const generateSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = "", out = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};

const base32Decode = (s) => {
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error("Invalid base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

export const totpAt = (secret, step) => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
};

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

/* Returns the matched time step (±1 step drift) or null */
export const verifyTotp = (secret, code, now = Date.now()) => {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    if (crypto.timingSafeEqual(Buffer.from(totpAt(secret, s)), Buffer.from(c))) return s;
  }
  return null;
};

export const otpauthUrl = (secret, account, issuer = "ReadyTech CRM") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

/* Secrets at rest: AES-256-GCM. Key = TWO_FACTOR_ENCRYPTION_KEY or derived from JWT_SECRET */
const key = () =>
  crypto.createHash("sha256").update(process.env.TWO_FACTOR_ENCRYPTION_KEY || `2fa:${process.env.JWT_SECRET}`).digest();

export const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

export const decryptSecret = (blob) => {
  const [iv, tag, enc] = String(blob).split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
};

/* Recovery codes: shown once, stored as sha256 hashes */
export const hashRecoveryCode = (code) =>
  crypto.createHash("sha256").update(String(code).replace(/[\s-]/g, "").toLowerCase()).digest("hex");

export const generateRecoveryCodes = (n = 10) =>
  Array.from({ length: n }, () => {
    const h = crypto.randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });
