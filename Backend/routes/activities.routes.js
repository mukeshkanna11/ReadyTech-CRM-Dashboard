import express from "express";
import auth from "../middlewares/auth.js";

import {
  getActivities,
  getActivity,
  createActivity,
  updateActivity,
  completeActivity,
  deleteActivity,
  getActivityStats,
  getLeadTimeline,
} from "../controllers/activity.controller.js";

const router = express.Router();

/* =========================================================
   DASHBOARD STATS

   IMPORTANT:
   This MUST come before /:id
========================================================= */

router.get(
  "/dashboard/stats/summary",
  auth,
  getActivityStats
);

/* =========================================================
   LEAD TIMELINE

   Example:
   GET /api/activities/lead/64abc.../timeline
========================================================= */

router.get(
  "/lead/:leadId/timeline",
  auth,
  getLeadTimeline
);

/* =========================================================
   GET ALL ACTIVITIES

   Filters:
   ?lead=
   ?opportunity=
   ?assignedTo=
   ?type=
   ?done=
   ?priority=
   ?search=
   ?fromDate=
   ?toDate=
   ?page=
   ?limit=
========================================================= */

router.get(
  "/",
  auth,
  getActivities
);

/* =========================================================
   GET SINGLE ACTIVITY
========================================================= */

router.get(
  "/:id",
  auth,
  getActivity
);

/* =========================================================
   CREATE ACTIVITY
========================================================= */

router.post(
  "/",
  auth,
  createActivity
);

/* =========================================================
   UPDATE ACTIVITY
========================================================= */

router.put(
  "/:id",
  auth,
  updateActivity
);

/* =========================================================
   COMPLETE ACTIVITY
========================================================= */

router.patch(
  "/:id/complete",
  auth,
  completeActivity
);

/* =========================================================
   DELETE ACTIVITY
========================================================= */

router.delete(
  "/:id",
  auth,
  deleteActivity
);

export default router;