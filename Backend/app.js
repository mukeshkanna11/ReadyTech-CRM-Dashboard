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

/* ===================== Middlewares ===================== */
import auth from "./middlewares/auth.js";
import role from "./middlewares/role.js";

const app = express();

/* ===================== Global Middlewares ===================== */
app.use(helmet());

app.use(
  cors({
    origin: true, // allow frontend (Netlify / localhost)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

/* ===================== Public Routes ===================== */
app.use("/api/auth", authRoutes);

/* ===================== Protected Routes ===================== */
app.use("/api/admin", auth, role("admin"), adminRoutes);
app.use("/api/products", auth, productsRoutes);
app.use("/api/clients", auth, clientsRoutes);

/* 🔥 Salesforce CRM MODULE 🔥 */
app.use("/api/leads", auth, leadsRoutes);
app.use("/api/opportunities", auth, opportunityRoutes);
app.use("/api/activities", auth, activityRoutes);

app.use("/api/audit", auth, role("admin"), auditRoutes);
app.use("/api/user", auth, userRoutes);

/* ===================== Health Check ===================== */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date(),
  });
});

/* ===================== 404 Handler ===================== */
app.use((req, res) => {
  console.error("❌ Route not found:", req.method, req.originalUrl);
  res.status(404).json({ message: "Route not found" });
});

/* ===================== Global Error Handler ===================== */
app.use((err, req, res, next) => {
  console.error("❌ ERROR STACK:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    timestamp: new Date(),
  });
});

export default app;
