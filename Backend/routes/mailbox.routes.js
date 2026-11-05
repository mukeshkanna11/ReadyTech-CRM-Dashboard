// routes/mailbox.routes.js — Mail workspace API (mounted at /api/email/mailbox).
// Any authenticated workspace member; admins see the whole workspace's mail,
// other members only what they created (see services/mail/mailbox.service.js).
import express from "express";
import rateLimit from "express-rate-limit";
import auth from "../middlewares/auth.js";
import {
  mailCtx, summary, listMessages, listConversations, getThread, getMessage, updateFlags,
  deleteMessage, setLinks, getAttachment, saveDraft, sendMessage, searchLinkTargets,
} from "../services/mail/mailbox.service.js";

const router = express.Router();
router.use(auth);

/* Expected errors carry a status and a user-safe message; anything else is logged */
const handle = (fn) => async (req, res) => {
  try {
    const out = await fn(mailCtx(req), req, res);
    if (out !== undefined) res.json({ success: true, ...out });
  } catch (err) {
    if (!err.status) console.error("Mailbox error:", err.message);
    // A provider 401 / 403 must never look like a session expiry to the client
    const status = err.status && ![401, 403].includes(err.status) ? err.status : err.status ? 502 : 500;
    res.status(status).json({
      success: false,
      message: err.status ? err.message : "Something went wrong. Please try again.",
      ...(err.code && typeof err.code === "string" && err.code.startsWith("MAIL_") && { code: err.code }),
      ...(err.messageId && { data: { id: err.messageId } }),
    });
  }
};

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `mailbox-send:${req.workspace}`,
  message: { success: false, message: "Too many emails sent in a short time. Please wait a few minutes and try again." },
});

router.get("/summary", handle(async (ctx) => ({ data: await summary(ctx) })));

router.get("/messages", handle(async (ctx, req) => ({ data: await listMessages(ctx, req.query) })));
router.get("/messages/:id", handle(async (ctx, req) => ({ data: await getMessage(ctx, req.params.id) })));
router.patch("/messages/:id", handle(async (ctx, req) => ({ data: await updateFlags(ctx, req.params.id, req.body) })));
router.delete("/messages/:id", handle(async (ctx, req) => ({ data: await deleteMessage(ctx, req.params.id) })));
router.put("/messages/:id/links", handle(async (ctx, req) => ({ data: await setLinks(ctx, req.params.id, req.body?.links) })));

router.get("/conversations", handle(async (ctx, req) => ({ data: await listConversations(ctx, req.query) })));
router.get("/conversations/:threadKey", handle(async (ctx, req) => ({ data: await getThread(ctx, req.params.threadKey) })));

router.post("/drafts", handle(async (ctx, req) => ({ message: "Draft saved", data: await saveDraft(ctx, req.body) })));
router.put("/drafts/:id", handle(async (ctx, req) => ({ message: "Draft saved", data: await saveDraft(ctx, req.body, req.params.id) })));

router.post("/send", sendLimiter, handle(async (ctx, req) => {
  const { duplicate, message } = await sendMessage(ctx, req.body);
  return { message: duplicate ? "This email was already sent" : `Email sent from ${message.from}`, data: message };
}));

router.get("/link-targets", handle(async (ctx, req) => ({ data: await searchLinkTargets(ctx, req.query.type, req.query.q) })));

/* Downloads are always served as attachments (never rendered inline) */
router.get("/attachments/:id", handle(async (ctx, req, res) => {
  const a = await getAttachment(ctx, req.params.id);
  res.set({
    "Content-Type": a.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${a.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "")}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,
    "Content-Length": String(a.data.length),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  });
  res.send(a.data);
  return undefined;
}));

export default router;
