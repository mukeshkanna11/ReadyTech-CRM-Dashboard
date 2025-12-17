// routes/audit.routes.js
import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import { getAllAuditLogs, getAuditLogsByUser } from "../controllers/audit.controller.js";

const router = express.Router();

router.get("/", auth, role("admin"), getAllAuditLogs);
router.get("/:userId", auth, role("admin"), getAuditLogsByUser);

export default router;
