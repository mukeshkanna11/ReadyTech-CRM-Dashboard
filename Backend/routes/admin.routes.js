// routes/admin.routes.js

import express from "express";
import auth, { requireAdmin } from "../middlewares/auth.js";

import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/admin.controller.js";

const router = express.Router();

/* =========================================================
   AUTH + ADMIN PROTECTION
========================================================= */

router.use(auth, requireAdmin);

/* =========================================================
   USERS
========================================================= */

router.get("/users", listUsers);

router.get("/users/:id", getUserById);

router.post("/users", createUser);

router.put("/users/:id", updateUser);

router.delete("/users/:id", deleteUser);

export default router;