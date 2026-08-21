import express from "express";

import {
  getPerformanceReviews,
  getPerformanceById,
  createPerformance,
  updatePerformance,
  submitPerformance,
  reviewPerformance,
  finalizePerformance,
  deletePerformance,
} from "../../controllers/hr/performance.controller.js";

const router = express.Router();

router.get("/", getPerformanceReviews);

router.get("/:id", getPerformanceById);

router.post("/", createPerformance);

router.put("/:id", updatePerformance);

router.patch(
  "/:id/submit",
  submitPerformance
);

router.patch(
  "/:id/review",
  reviewPerformance
);

router.patch(
  "/:id/finalize",
  finalizePerformance
);

router.delete(
  "/:id",
  deletePerformance
);

export default router;