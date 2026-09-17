// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

/* ===================== Routes ===================== */
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productsRoutes from "./routes/products.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import opportunityRoutes from "./routes/opportunities.routes.js";
import activityRoutes from "./routes/activities.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import userRoutes from "./routes/user.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import vendorRoutes from "./routes/vendors.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import adminDashboardRoutes from "./routes/admin.dashboard.routes.js";
import employeeDashboardRoutes from "./routes/employee.dashboard.routes.js";
import clientDashboardRoutes from "./routes/client.dashboard.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import automationRoutes from "./routes/automationRoutes.js";
// Meta Integration Module (centralized for CRM / ERP / AI Content)
import metaRoutes from "./routes/meta.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
// Twilio Voice (browser calling from the CRM Lead page)
import voipRoutes from "./routes/voip.routes.js";
// HR Module
import hrRoutes from "./routes/hr/index.js";
import hrReportRoutes from "./routes/hr/hrReport.routes.js";
/* ===================== Middlewares ===================== */
import auth from "./middlewares/auth.js";
import role from "./middlewares/role.js";

const app = express();

/* ======================================================
   TRUST PROXY (important for Render / Heroku)
====================================================== */
app.set("trust proxy", 1);

/* ======================================================
   SECURITY HEADERS
====================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow images, fonts across origins
  })
);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://192.168.0.101:8081",

  "https://readytechcrm.netlify.app",
  "https://readytech-crm-site.netlify.app",

  "https://crmreadytechsolutions.in",
  "https://www.crmreadytechsolutions.in",

  ...(process.env.CLIENT_URL
    ? [process.env.CLIENT_URL.replace(/\/+$/, "")]
    : []),
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests (Postman, server-to-server)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS policy: ${origin} is not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(
  cors((req, callback) => {
    // Meta calls the Instagram webhook server-to-server. A stray Origin header
    // (proxy, API client, `null` from a sandboxed page) must not reject the
    // verification handshake with a 403 before the route runs — CORS is a
    // browser-side policy. Every other route keeps the strict allowlist.
    if (req.path === "/api/meta/instagram/webhook") {
      return callback(null, { ...corsOptions, origin: true });
    }
    return callback(null, corsOptions);
  })
);

// Preflight for all routes
app.options("*", cors());

/* ======================================================
   BODY PARSERS
====================================================== */
app.use(
  express.json({
    limit: "10mb",
    // Preserve the original bytes ONLY for the WhatsApp webhook, which needs
    // them for the X-Hub-Signature-256 HMAC check. All other routes unchanged.
    verify: (req, res, buf) => {
      if ((req.originalUrl || req.url || "").startsWith("/api/whatsapp/webhook")) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   LOGGER (dev mode)
====================================================== */
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* ======================================================
   PUBLIC ROUTES (no authentication required)
====================================================== */
app.use("/api/auth", authRoutes);

/* ======================================================
   PROTECTED ROUTES
====================================================== */

// Admin routes
app.use("/api/admin", auth, role("admin"), adminRoutes);
app.use("/api/admin/dashboard", auth, role("admin"), adminDashboardRoutes);
app.use("/api/audit", auth, role("admin"), auditRoutes);

// Employee routes
app.use("/api/employee/dashboard", auth, role("employee"), employeeDashboardRoutes);

// Client routes
app.use("/api/client/dashboard", auth, role("client"), clientDashboardRoutes);

// CRM & ERP modules
app.use("/api/products", auth, productsRoutes);
app.use("/api/clients", auth, clientsRoutes);
app.use("/api/inventory", auth, inventoryRoutes);
app.use("/api/vendors", auth, vendorRoutes);
app.use("/api/purchase", auth, purchaseRoutes);
app.use("/api/sales", auth, salesRoutes);
app.use("/api/warehouses", auth, warehouseRoutes);
// HR Module
app.use("/api/hr", auth, hrRoutes);
app.use("/api/hr/reports", auth, hrReportRoutes);
// CRM Modules
app.use("/api/leads", auth, leadsRoutes);
app.use("/api/opportunities", auth, opportunityRoutes);
app.use("/api/activities", auth, activityRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/automations", automationRoutes);
// Meta Integration (auth applied per-route; OAuth callback is public)
app.use("/api/meta", metaRoutes);
// WhatsApp Cloud API (auth applied per-route; webhook is public)
app.use("/api/whatsapp", whatsappRoutes);
// Twilio Voice (auth applied per-route; Twilio webhooks are public)
app.use("/api/voip", voipRoutes);
// User profile
app.use("/api/user", auth, userRoutes);
app.use("/api/ai", auth, aiRoutes);

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ReadyTech CRM API is running",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      products: "/api/products",
      clients: "/api/clients",
      leads: "/api/leads",
      invoices: "/api/invoices",
    },
  });
});
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ReadyTech CRM API is running",
    health: "/api/health",
  });
});
/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "ReadyTech CRM API",
    environment: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  });
});

/* ======================================================
   FRONTEND (SPA) STATIC HOSTING
   Serves the built Vite frontend so public pages such as
   /privacy-policy, /terms and /data-deletion resolve to
   index.html instead of the API 404 handler below.
   API behaviour is untouched: this runs AFTER every /api
   route, and never handles /api/* paths.
====================================================== */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST =
  process.env.FRONTEND_DIST_PATH ||
  path.join(__dirname, "..", "Frontend", "dist");

if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
  app.use(express.static(FRONTEND_DIST));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  console.warn(
    `⚠️  Frontend build not found at ${FRONTEND_DIST} — SPA routes will 404.`
  );
}

/* ======================================================
   404 HANDLER
====================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */
app.use((err, req, res, next) => {
  console.error("❌ GLOBAL ERROR:", err);

  // CORS errors
  if (err.message && err.message.startsWith("CORS")) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    time: new Date().toISOString(),
  });
});

export default app;
