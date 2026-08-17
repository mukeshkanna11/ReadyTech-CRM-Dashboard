import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import AuditLog from "../models/AuditLog.js";

/* =========================================================
   GET ALL ACTIVITIES
========================================================= */

export const getActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      lead,
      opportunity,
      assignedTo,
      type,
      done,
      priority,
      search = "",
      fromDate,
      toDate,
    } = req.query;

    const query = {};

    // Lead filter
    if (lead) {
      if (!mongoose.Types.ObjectId.isValid(lead)) {
        return res.status(400).json({
          success: false,
          message: "Invalid lead ID",
        });
      }

      query.lead = lead;
    }

    // Opportunity filter
    if (opportunity) {
      if (!mongoose.Types.ObjectId.isValid(opportunity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      query.opportunity = opportunity;
    }

    // Assigned user
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assigned user ID",
        });
      }

      query.assignedTo = assignedTo;
    }

    // Activity type
    if (type) {
      query.type = type;
    }

    // Completed / Pending
    if (done !== undefined) {
      query.done = done === "true";
    }

    // Priority
    if (priority) {
      query.priority = priority;
    }

    // Search
    if (search.trim()) {
      query.$or = [
        {
          notes: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          outcome: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // Date range
    if (fromDate || toDate) {
      query.createdAt = {};

      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }

      if (toDate) {
        const endDate = new Date(toDate);

        // Include complete selected day
        endDate.setHours(23, 59, 59, 999);

        query.createdAt.$lte = endDate;
      }
    }

    const pageNumber = Math.max(Number(page), 1);
    const pageLimit = Math.min(Math.max(Number(limit), 1), 100);

    const skip = (pageNumber - 1) * pageLimit;

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .populate("lead", "name email phone company status")
        .populate("opportunity", "title stage value")
        .populate("assignedTo", "name email")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit),

      Activity.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: activities.length,
      data: activities,
      pagination: {
        total,
        page: pageNumber,
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit),
      },
    });
  } catch (error) {
    console.error("GET ACTIVITIES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch activities",
    });
  }
};

/* =========================================================
   GET SINGLE ACTIVITY
========================================================= */

export const getActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findById(id)
      .populate("lead", "name email phone company status")
      .populate("opportunity", "title stage value")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("GET ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity",
    });
  }
};

/* =========================================================
   CREATE ACTIVITY
========================================================= */

export const createActivity = async (req, res) => {
  try {
    const {
      type,
      lead,
      opportunity,
      assignedTo,
      dueDate,
      priority,
      notes,
      outcome,
      contactedAt,
    } = req.body;

    // -----------------------------------------------------
    // Validation
    // -----------------------------------------------------

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Activity type is required",
      });
    }

    if (!lead && !opportunity) {
      return res.status(400).json({
        success: false,
        message: "Lead or Opportunity is required",
      });
    }

    if (lead && !mongoose.Types.ObjectId.isValid(lead)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    if (
      opportunity &&
      !mongoose.Types.ObjectId.isValid(opportunity)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    if (
      assignedTo &&
      !mongoose.Types.ObjectId.isValid(assignedTo)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid assigned user ID",
      });
    }

    // -----------------------------------------------------
    // Create
    // -----------------------------------------------------

    const activity = await Activity.create({
      type,
      lead: lead || null,
      opportunity: opportunity || null,
      assignedTo: assignedTo || req.user._id,
      createdBy: req.user._id,

      dueDate: dueDate ? new Date(dueDate) : null,

      priority: priority || "Medium",

      notes: notes?.trim() || "",

      outcome: outcome?.trim() || "",

      contactedAt: contactedAt
        ? new Date(contactedAt)
        : null,

      done: false,

      completedAt: null,
    });

    // -----------------------------------------------------
    // Audit
    // -----------------------------------------------------

    await AuditLog.create({
      user: req.user._id,
      action: "CREATE",
      entity: "Activity",
      entityId: activity._id,
      description: `Created ${activity.type} activity`,
      target: activity.type,
      meta: {
        lead: activity.lead,
        opportunity: activity.opportunity,
      },
    });

    // -----------------------------------------------------
    // Populate
    // -----------------------------------------------------

    const populatedActivity = await Activity.findById(
      activity._id
    )
      .populate("lead", "name email phone company status")
      .populate("opportunity", "title stage value")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: populatedActivity,
    });
  } catch (error) {
    console.error("CREATE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create activity",
    });
  }
};

/* =========================================================
   UPDATE ACTIVITY
========================================================= */

export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    const oldValue = activity.toObject();

    const allowedFields = [
      "type",
      "lead",
      "opportunity",
      "assignedTo",
      "dueDate",
      "priority",
      "notes",
      "outcome",
      "contactedAt",
      "done",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        activity[field] = req.body[field];
      }
    });

    // Normalize
    if (activity.notes) {
      activity.notes = activity.notes.trim();
    }

    if (activity.outcome) {
      activity.outcome = activity.outcome.trim();
    }

    // Date conversion
    if (req.body.dueDate !== undefined) {
      activity.dueDate = req.body.dueDate
        ? new Date(req.body.dueDate)
        : null;
    }

    if (req.body.contactedAt !== undefined) {
      activity.contactedAt = req.body.contactedAt
        ? new Date(req.body.contactedAt)
        : null;
    }

    // If marked complete
    if (activity.done === true && !activity.completedAt) {
      activity.completedAt = new Date();

      if (!activity.contactedAt) {
        activity.contactedAt = activity.completedAt;
      }
    }

    // If reopened
    if (activity.done === false) {
      activity.completedAt = null;
    }

    await activity.save();

    await AuditLog.create({
      user: req.user._id,
      action: "UPDATE",
      entity: "Activity",
      entityId: activity._id,
      description: `Updated ${activity.type} activity`,
      target: activity.type,
      oldValue,
      newValue: activity.toObject(),
    });

    const populatedActivity = await Activity.findById(
      activity._id
    )
      .populate("lead", "name email phone company status")
      .populate("opportunity", "title stage value")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Activity updated successfully",
      data: populatedActivity,
    });
  } catch (error) {
    console.error("UPDATE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update activity",
    });
  }
};

/* =========================================================
   MARK ACTIVITY COMPLETE
========================================================= */

export const completeActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    if (activity.done) {
      return res.status(400).json({
        success: false,
        message: "Activity is already completed",
      });
    }

    const completedTime = new Date();

    activity.done = true;
    activity.completedAt = completedTime;

    // Communication activity
    if (
      ["Call", "Email", "Meeting"].includes(
        activity.type
      )
    ) {
      activity.contactedAt = completedTime;
    }

    await activity.save();

    await AuditLog.create({
      user: req.user._id,
      action: "COMPLETE_ACTIVITY",
      entity: "Activity",
      entityId: activity._id,
      description: `Completed ${activity.type} activity`,
      target: activity.type,
      meta: {
        completedAt: completedTime,
        lead: activity.lead,
        opportunity: activity.opportunity,
      },
    });

    const populatedActivity = await Activity.findById(
      activity._id
    )
      .populate("lead", "name email phone company status")
      .populate("opportunity", "title stage value")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Activity marked as completed",
      data: populatedActivity,
    });
  } catch (error) {
    console.error("COMPLETE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete activity",
    });
  }
};

/* =========================================================
   DELETE ACTIVITY
========================================================= */

export const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID",
      });
    }

    const activity = await Activity.findById(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    await Activity.findByIdAndDelete(id);

    await AuditLog.create({
      user: req.user._id,
      action: "DELETE",
      entity: "Activity",
      entityId: activity._id,
      description: `Deleted ${activity.type} activity`,
      target: activity.type,
      meta: {
        lead: activity.lead,
        opportunity: activity.opportunity,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ACTIVITY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete activity",
    });
  }
};

/* =========================================================
   ACTIVITY DASHBOARD STATS
========================================================= */

export const getActivityStats = async (req, res) => {
  try {
    const [
      total,
      completed,
      pending,
      calls,
      emails,
      meetings,
      tasks,
    ] = await Promise.all([
      Activity.countDocuments(),

      Activity.countDocuments({
        done: true,
      }),

      Activity.countDocuments({
        done: false,
      }),

      Activity.countDocuments({
        type: "Call",
      }),

      Activity.countDocuments({
        type: "Email",
      }),

      Activity.countDocuments({
        type: "Meeting",
      }),

      Activity.countDocuments({
        type: "Task",
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        completed,
        pending,
        calls,
        emails,
        meetings,
        tasks,
      },
    });
  } catch (error) {
    console.error("ACTIVITY STATS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity stats",
    });
  }
};

/* =========================================================
   LEAD TIMELINE
========================================================= */

export const getLeadTimeline = async (req, res) => {
  try {
    const { leadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const activities = await Activity.find({
      lead: leadId,
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const timeline = activities.map((activity) => ({
      id: activity._id,

      type: "activity",

      activityType: activity.type,

      title: `${activity.type} Activity`,

      notes: activity.notes,

      outcome: activity.outcome,

      priority: activity.priority,

      done: activity.done,

      dueDate: activity.dueDate,

      contactedAt: activity.contactedAt,

      completedAt: activity.completedAt,

      createdAt: activity.createdAt,

      updatedAt: activity.updatedAt,

      assignedTo: activity.assignedTo,

      createdBy: activity.createdBy,
    }));

    return res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline,
    });
  } catch (error) {
    console.error("GET LEAD TIMELINE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch lead timeline",
    });
  }
};