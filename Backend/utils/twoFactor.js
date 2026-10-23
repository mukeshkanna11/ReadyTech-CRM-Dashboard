// utils/twoFactor.js — 2FA login challenge + atomic code verification
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { decryptSecret, verifyTotp, hashRecoveryCode } from "./totp.js";

const AUDIENCE = "2fa-challenge";

/* Short-lived token proving the password step passed. Has no `id`
   claim, so the auth middleware can never accept it as a session. */
export const createChallenge = (user, panel) =>
  jwt.sign({ sub: String(user._id), panel }, process.env.JWT_SECRET, { audience: AUDIENCE, expiresIn: "5m" });

export const readChallenge = (token) => {
  try {
    return jwt.verify(String(token || ""), process.env.JWT_SECRET, { audience: AUDIENCE });
  } catch {
    return null;
  }
};

/* Accepts a TOTP code (each time step usable once) or an unused
   recovery code (consumed). Returns "totp" | "recovery" | null. */
export const verifySecondFactor = async (userId, { code, recoveryCode }) => {
  const user = await User.findById(userId).select("+twoFactor.secret").lean();
  if (!user?.twoFactor?.enabled || !user.twoFactor.secret) return null;

  if (recoveryCode) {
    const hash = hashRecoveryCode(recoveryCode);
    const r = await User.updateOne(
      { _id: userId, "twoFactor.recoveryCodes": hash },
      { $pull: { "twoFactor.recoveryCodes": hash } }
    );
    return r.modifiedCount ? "recovery" : null;
  }

  const step = verifyTotp(decryptSecret(user.twoFactor.secret), code);
  if (step === null) return null;

  // Replay protection: the step must be newer than the last one used
  const r = await User.updateOne(
    { _id: userId, $or: [{ "twoFactor.lastUsedStep": null }, { "twoFactor.lastUsedStep": { $lt: step } }] },
    { $set: { "twoFactor.lastUsedStep": step } }
  );
  return r.modifiedCount ? "totp" : null;
};
