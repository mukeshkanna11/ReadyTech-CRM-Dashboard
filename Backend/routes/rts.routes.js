import express from "express";
import rateLimit from "express-rate-limit";
import { rtsCommand } from "../controllers/rtsCommand.controller.js";

// Mounted behind `auth` in app.js. Deliberately NOT behind requireClaudeAi:
// structured read-only commands work without Claude credits.
const router = express.Router();

const rtsCommandLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `rtscmd:${req.user?._id || req.workspace}`,
  message: { success: false, message: "Too many RTS commands. Please wait a minute and try again." },
});

/* POST /api/rts/command  { text, tzOffset? } — read-only */
router.post("/command", rtsCommandLimiter, rtsCommand);

export default router;
