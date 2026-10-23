// routes/email.routes.js — Email Integration (per-workspace Gmail / Microsoft 365)
import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import Client from "../models/Client.js";
import { sendLeadEmail } from "../services/email.service.js";
import {
  PROVIDERS, missingConfig, buildAuthUrl, verifyState, completeConnection,
  verifyConnection, disconnect, sendViaConnectedAccount, detectProvider,
} from "../services/emailOAuth.service.js";

const router = express.Router();

const clientRedirect = (params) =>
  `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}/integrations/email?${new URLSearchParams(params)}`;

/* Client-safe provider list — env var names / setup steps stay server-side */
const providerList = (isAdmin) =>
  Object.entries(PROVIDERS).map(([id, p]) => {
    const available = missingConfig(id).length === 0;
    return {
      id, name: p.name, available, limitations: p.limitations, revokeUrl: p.revokeUrl,
      ...(isAdmin && { setupStatus: available ? "Ready" : "Awaiting one-time ReadyTech setup" }),
    };
  });

const NOT_AVAILABLE = (name) => `${name} connection isn't available yet. ReadyTech is finishing a one-time setup — please try again later or contact support.`;

/* Friendly callback errors (details are logged server-side) */
const friendlyError = (err) => {
  if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError" || err.message === "Invalid OAuth state") return "The connection link expired — please click Connect again.";
  if (/refresh token|Not allowed|no email address/.test(err.message)) return err.message;
  if (/admin|consent|AADSTS65001|AADSTS90094/i.test(err.message)) return "Your organisation requires an administrator to approve this app. Ask your IT admin to grant consent, then connect again.";
  return "We couldn't finish connecting your email account. Please try again.";
};

/* Status — any workspace member (no secrets) */
router.get("/status", auth, async (req, res) => {
  try {
    res.json({ success: true, data: { providers: providerList(req.user?.role === "admin"), connection: await verifyConnection(req.workspace) } });
  } catch (error) {
    console.error("Email integration status error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load email integration status" });
  }
});

/* Which provider hosts this address (so the UI can go straight to its sign-in) */
router.get("/detect", auth, role("admin"), async (req, res) => {
  const provider = await detectProvider(req.query.email);
  res.json({ success: true, data: { provider, available: provider ? missingConfig(provider).length === 0 : null } });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Start OAuth — admin only; state binds user + workspace */
router.get("/oauth/:provider/url", auth, role("admin"), (req, res) => {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) return res.status(404).json({ success: false, message: "Unknown provider" });

  const missing = missingConfig(provider);
  if (missing.length) {
    console.warn(`Email OAuth (${provider}) not configured — ReadyTech admin: set ${missing.join(", ")}. ${PROVIDERS[provider].setup}`);
    return res.status(400).json({ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED", message: NOT_AVAILABLE(PROVIDERS[provider].name) });
  }
  res.json({ success: true, data: { url: buildAuthUrl({
    provider, userId: req.user._id, workspaceId: req.workspace,
    loginHint: EMAIL_RE.test(String(req.query.email || "")) ? String(req.query.email).trim() : undefined,
  }) } });
});

/* OAuth callback — public (called by the provider), protected by signed state */
router.get("/oauth/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const { code, state, error, error_description: desc } = req.query;
  if (!PROVIDERS[provider]) return res.redirect(clientRedirect({ connected: "0", message: "Unknown provider" }));
  if (error || !code) {
    if (error) console.warn(`Email OAuth (${provider}) provider error: ${error} ${desc || ""}`);
    const message = error === "access_denied" ? "Sign-in was cancelled or permission wasn't granted." : friendlyError(new Error(String(desc || error || "")));
    return res.redirect(clientRedirect({ connected: "0", message }));
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
    return res.redirect(clientRedirect({ connected: "0", message: friendlyError(err).slice(0, 200) }));
  }
});

router.post("/disconnect", auth, role("admin"), async (req, res) => {
  try {
    const removed = await disconnect(req.workspace);
    if (!removed) return res.status(409).json({ success: false, message: "No email account is connected" });
    res.json({ success: true, message: "Email account disconnected", data: { revokeUrl: PROVIDERS[removed.provider]?.revokeUrl } });
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
    if (!sent) return res.status(409).json({ success: false, message: "No email account is connected" });
    res.json({ success: true, message: `Test email sent from ${sent.from} to ${req.user.email}` });
  } catch (error) {
    console.error("Email test send error:", error.message);
    res.status(error.status ? 409 : 500).json({ success: false, message: error.status ? error.message : "We couldn't send the test email. Please try again." });
  }
});

/* Email an ERP customer (Client) of this workspace: connected mailbox
   first, default ReadyTech sender (Resend) otherwise — same as Leads → Email */
router.post("/customers/:id", auth, async (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!subject || !message) return res.status(422).json({ success: false, message: "Subject and message are required" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(422).json({ success: false, message: "Customer not found" });

  try {
    const customer = await Client.findOne({ _id: req.params.id, workspace: req.workspace }).select("companyName contactPerson email").lean();
    if (!customer) return res.status(422).json({ success: false, message: "Customer not found" });
    if (!customer.email) return res.status(422).json({ success: false, message: "This customer has no email address" });

    const viaAccount = await sendViaConnectedAccount(req.workspace, { to: customer.email, subject, message });
    const data = viaAccount
      ? { to: customer.email, id: viaAccount.id, from: viaAccount.from, provider: viaAccount.provider }
      : { to: customer.email, ...(await sendLeadEmail({ to: customer.email, subject, message })), provider: "resend" };
    res.json({ success: true, message: `Email sent to ${customer.contactPerson || customer.companyName || customer.email}`, data });
  } catch (error) {
    console.error("Customer email error:", error.message);
    res.status(409).json({ success: false, message: error.status ? error.message : "The email couldn't be sent. Please try again or contact support." });
  }
});

export default router;
