// controllers/meta.controller.js
import MetaConnection from "../models/MetaConnection.js";
import {
  getMetaConfig,
  createOAuthState,
  verifyOAuthState,
  buildOAuthUrl,
  completeConnection,
  refreshConnection,
  disconnectConnection,
} from "../services/meta/meta.service.js";

/* =========================================================
   Frontend page that shows the connection result
========================================================= */
const clientRedirect = (params) => {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );

  const query = new URLSearchParams(params).toString();

  return `${base}/integrations/meta?${query}`;
};

/* ================= GET CONNECTION STATUS ================= */
export const getMetaStatus = async (req, res) => {
  try {
    const { configured, missing, portfolioId, apiVersion } = getMetaConfig();
    const connection = await MetaConnection.getSingleton();

    res.json({
      success: true,
      data: {
        ...connection.toSafeJSON(),
        config: {
          configured,
          missingEnv: missing,
          apiVersion,
          businessPortfolioId: portfolioId || null,
        },
      },
    });
  } catch (error) {
    console.error("Meta status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load Meta connection status",
    });
  }
};

/* ================= START OAUTH ================= */
export const getMetaOAuthUrl = async (req, res) => {
  try {
    const { configured, missing } = getMetaConfig();

    if (!configured) {
      return res.status(500).json({
        success: false,
        message: `Meta is not configured. Missing: ${missing.join(", ")}`,
      });
    }

    const state = createOAuthState(req.user._id);

    res.json({
      success: true,
      data: { url: buildOAuthUrl(state) },
    });
  } catch (error) {
    console.error("Meta OAuth URL error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to build Meta OAuth URL",
    });
  }
};

/* ================= OAUTH CALLBACK =================
   Called by Meta (public). Protected by the signed state
   token, then redirects back to the frontend.
=================================================== */
export const handleMetaOAuthCallback = async (req, res) => {
  const { code, state, error_description: errorDescription, error } = req.query;

  if (error || !code) {
    return res.redirect(
      clientRedirect({
        connected: "0",
        message: errorDescription || error || "Meta authorization was cancelled",
      })
    );
  }

  try {
    const { uid } = verifyOAuthState(state);

    await completeConnection({ code, userId: uid });

    return res.redirect(clientRedirect({ connected: "1" }));
  } catch (err) {
    console.error("Meta OAuth callback error:", err);

    return res.redirect(
      clientRedirect({
        connected: "0",
        message: err.message || "Meta connection failed",
      })
    );
  }
};

/* ================= REFRESH STATUS ================= */
export const refreshMetaConnection = async (req, res) => {
  try {
    const connection = await refreshConnection();

    res.json({
      success: true,
      message: "Meta connection refreshed",
      data: connection.toSafeJSON(),
    });
  } catch (error) {
    console.error("Meta refresh error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to refresh Meta connection",
    });
  }
};

/* ================= DISCONNECT ================= */
export const disconnectMeta = async (req, res) => {
  try {
    const connection = await disconnectConnection();

    res.json({
      success: true,
      message: "Meta disconnected",
      data: connection.toSafeJSON(),
    });
  } catch (error) {
    console.error("Meta disconnect error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to disconnect Meta",
    });
  }
};
