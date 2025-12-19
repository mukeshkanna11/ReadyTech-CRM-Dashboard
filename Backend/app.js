// app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Routes
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productsRoutes from "./routes/products.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import userRoutes from "./routes/user.routes.js";

// Middlewares
import auth from "./middlewares/auth.js";
import role from "./middlewares/role.js";

const app = express();

// ===================== Global Middlewares =====================
app.use(helmet());
app.use(
  cors({
    origin: true,        // ✅ allow ALL origins
    credentials: true,   // ✅ allow cookies / auth headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Handle preflight requests
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ===================== Routes =====================
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/admin", auth, role("admin"), adminRoutes);
app.use("/api/products", auth, productsRoutes);
app.use("/api/clients", auth, clientsRoutes);
app.use("/api/leads", auth, leadsRoutes);
app.use("/api/auditlogs", auth, role("admin"), auditRoutes);
app.use("/api/user", auth, userRoutes);

// ===================== Health Check =====================
app.get("/api/health", (req, res) =>
  res.json({ ok: true, timestamp: new Date() })
);

// ===================== 404 Handler =====================
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ===================== Global Error Handler =====================
app.use((err, req, res, next) => {
  console.error("❌ ERROR STACK:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    timestamp: new Date(),
  });
});

export default app;
