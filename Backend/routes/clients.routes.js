import express from "express";
import auth from "../middlewares/auth.js";
import role from "../middlewares/role.js";
import {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
} from "../controllers/clients.controller.js";

const router = express.Router();

/**
 * CLIENT ROUTES
 * All routes are protected by:
 * 1. auth → checks token
 * 2. role("admin") → only admin can access
 */

router.post("/", auth, role("admin"), createClient);      // Create new client
router.get("/", auth, role("admin"), getClients);         // Get all clients
router.get("/:id", auth, role("admin"), getClientById);   // Get single client
router.put("/:id", auth, role("admin"), updateClient);    // Update client
router.delete("/:id", auth, role("admin"), deleteClient); // Delete client

export default router;
