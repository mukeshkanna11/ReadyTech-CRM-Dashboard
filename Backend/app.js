// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

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

/* ===================== Middlewares ===================== */
import auth from "./middlewares/auth.js";
import role from "./middlewares/role.js";

const app = express();

/* ======================================================
   TRUST PROXY (FOR RENDER/NETLIFY/PROXY)
====================================================== */
app.set("trust proxy", 1);

/* ======================================================
   SECURITY HEADERS
====================================================== */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

/* ======================================================
   CORS SETUP
   ✅ Fully supports dev & production
====================================================== */
const allowedOrigins = [
  "http://localhost:5173", // Vite dev
  "http://localhost:3000", // React dev fallback
  "https://readytechcrm.netlify.app", // Production front
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests like Postman (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS policy: This origin is not allowed")
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight for all routes
app.options("*", cors());

/* ======================================================
   BODY PARSERS
====================================================== */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ======================================================
   LOGGER
====================================================== */
app.use(morgan("dev"));

/* ======================================================
   PUBLIC ROUTES
====================================================== */
app.use("/api/auth", authRoutes);

/* ======================================================
   PROTECTED ROUTES
====================================================== */
// Admin routes
app.use("/api/admin", auth, role("admin"), adminRoutes);
app.use("/api/audit", auth, role("admin"), auditRoutes);

// CRM & ERP routes
app.use("/api/products", auth, productsRoutes);
app.use("/api/clients", auth, clientsRoutes);
app.use("/api/inventory", auth, inventoryRoutes);
app.use("/api/vendors", auth, vendorRoutes);
app.use("/api/purchase", auth, purchaseRoutes);
app.use("/api/sales", auth, salesRoutes);
app.use("/api/warehouses", auth, warehouseRoutes);

// CRM Modules
app.use("/api/leads", auth, leadsRoutes);
app.use("/api/opportunities", auth, opportunityRoutes);
app.use("/api/activities", auth, activityRoutes);

// User profile
app.use("/api/user", auth, userRoutes);

/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "ReadyTech CRM API",
    time: new Date().toISOString(),
  });
});

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

  // If it's a CORS error, return 403
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
