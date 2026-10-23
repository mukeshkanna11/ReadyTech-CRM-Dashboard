// routes/email.routes.js — Email Integration (per-workspace Gmail / Microsoft 365)
import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import User from "../models/User.js";
import {
  PROVIDERS, missingConfig, buildAuthUrl, verifyState, completeConnection,
  verifyConnection, disconnect, sendViaConnectedAccount,
} from "../services/emailOAuth.service.js";

const router = express.Router();

const clientRedirect = (params) =>
  `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/integrations/email?${new URLSearchParams(params)}`;

const providerList = () =>
  Object.entries(PROVIDERS).map(([id, p]) => {
    const missing = missingConfig(id);
    return { id, name: p.name, configured: missing.length === 0, missingEnv: missing, setup: p.setup, limitations: p.limitations };
  });

/* Status — any workspace member (no secrets) */
router.get("/status", auth, async (req, res) => {
  try {
    res.json({ success: true, data: { providers: providerList(), connection: await verifyConnection(req.workspace) } });
  } catch (error) {
    console.error("Email integration status error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load email integration status" });
  }
});

/* Start OAuth — admin only; state binds user + workspace */
router.get("/oauth/:provider/url", auth, role("admin"), (req, res) => {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) return res.status(404).json({ success: false, message: "Unknown provider" });

  const missing = missingConfig(provider);
  if (missing.length) {
    return res.status(400).json({
      success: false,
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      message: `${PROVIDERS[provider].name} is not configured on the server. Missing: ${missing.join(", ")}. ${PROVIDERS[provider].setup}`,
      missingEnv: missing,
    });
  }
  res.json({ success: true, data: { url: buildAuthUrl({ provider, userId: req.user._id, workspaceId: req.workspace }) } });
});

/* OAuth callback — public (called by the provider), protected by signed state */
router.get("/oauth/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const { code, state, error, error_description: desc } = req.query;
  if (!PROVIDERS[provider]) return res.redirect(clientRedirect({ connected: "0", message: "Unknown provider" }));
  if (error || !code) {
    return res.redirect(clientRedirect({ connected: "0", message: String(desc || error || "Authorization was cancelled").slice(0, 200) }));
  }

  try {
    const s = verifyState(state, provider);
    // The initiating admin must still belong to (and administer) that workspace
    const user = await User.findById(s.uid).select("role workspace isActive").lean();
    if (!user || user.role !== "admin" || user.isActive === false || String(user.workspace || user._id) !== s.ws) {
      throw new Error("Not allowed to connect an email account for this workspace");
    }
    const email = await completeConnection({ provider, code: String(code), workspaceId: s.ws, userId: s.uid });
    return res.redirect(clientRedirect({ connected: "1", email }));
  } catch (err) {
    console.error(`Email OAuth (${provider}) callback failed:`, err.message);
    const message = err.name === "TokenExpiredError" || err.name === "JsonWebTokenError" ? "Connection link expired or invalid — try again" : err.message;
    return res.redirect(clientRedirect({ connected: "0", message: String(message).slice(0, 200) }));
  }
});

router.post("/disconnect", auth, role("admin"), async (req, res) => {
  try {
    const removed = await disconnect(req.workspace);
    if (!removed) return res.status(404).json({ success: false, message: "No email account is connected" });
    res.json({ success: true, message: "Email account disconnected" });
  } catch (error) {
    console.error("Email disconnect error:", error.message);
    res.status(500).json({ success: false, message: "Failed to disconnect email account" });
  }
});

/* Real test send to the admin's own address through the connected mailbox */
router.post("/test", auth, role("admin"), async (req, res) => {
  try {
    const sent = await sendViaConnectedAccount(req.workspace, {
      to: req.user.email,
      subject: "ReadyTech CRM — email integration test",
      message: "This test email was sent through your connected email account from ReadyTech CRM.",
    });
    if (!sent) return res.status(404).json({ success: false, message: "No email account is connected" });
    res.json({ success: true, message: `Test email sent from ${sent.from} to ${req.user.email}` });
  } catch (error) {
    console.error("Email test send error:", error.message);
    res.status(error.status && error.status !== 401 ? error.status : 502).json({ success: false, message: error.message });
  }
});

export default router;
