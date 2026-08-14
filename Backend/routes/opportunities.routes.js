import express from "express";
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import Lead from "../models/Lead.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

/* =====================================================
   OPPORTUNITY STATS
   IMPORTANT: Keep before /:id routes
===================================================== */
router.get("/dashboard/stats", auth, async (req, res) => {
  try {
    const total = await Opportunity.countDocuments({
      department: "Salesforce",
    });

    const prospecting = await Opportunity.countDocuments({
      department: "Salesforce",
      stage: "Prospecting",
    });

    const proposal = await Opportunity.countDocuments({
      department: "Salesforce",
      stage: "Proposal",
    });

    const won = await Opportunity.countDocuments({
      department: "Salesforce",
      stage: "Closed Won",
    });

    const lost = await Opportunity.countDocuments({
      department: "Salesforce",
      stage: "Closed Lost",
    });

    const revenue = await Opportunity.aggregate([
      {
        $match: {
          department: "Salesforce",
          stage: "Closed Won",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$value",
          },
        },
      },
    ]);

    return res.json({
      success: true,
      stats: {
        total,
        prospecting,
        proposal,
        won,
        lost,
        revenue:
          revenue.length > 0
            ? revenue[0].totalRevenue
            : 0,
      },
    });
  } catch (error) {
    console.error("Opportunity stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
});


/* =====================================================
   GET ALL OPPORTUNITIES
===================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      stage,
    } = req.query;

    const query = {
      department: "Salesforce",
    };

    if (stage && stage !== "All") {
      query.stage = stage;
    }

    if (search) {
      query.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          notes: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const opportunities = await Opportunity.find(query)
      .populate("lead", "name source status")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email")
      .populate("followUps.createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Opportunity.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: opportunities,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(
          total / Number(limit)
        ),
      },
    });
  } catch (error) {
    console.error(
      "Fetch opportunities error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch opportunities",
    });
  }
});


/* =====================================================
   GET SINGLE OPPORTUNITY
===================================================== */
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    const opportunity = await Opportunity.findById(id)
      .populate("lead")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name email")
      .populate(
        "followUps.createdBy",
        "name email"
      );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    return res.json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    console.error(
      "Get opportunity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch opportunity",
    });
  }
});


/* =====================================================
   CREATE OPPORTUNITY
===================================================== */
router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      lead,
      value,
      probability,
      expectedCloseDate,
      stage,
      assignedTo,
      notes,
    } = req.body;

    if (!title || !lead) {
      return res.status(400).json({
        success: false,
        message: "Title and Lead are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(lead)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Lead ID",
      });
    }

    const leadExists = await Lead.findById(lead);

    if (!leadExists) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const opportunity = await Opportunity.create({
      title,
      lead,
      value: value || 0,
      probability: probability || 0,
      expectedCloseDate,
      stage: stage || "Prospecting",
      assignedTo,
      notes: notes || "",
      department: "Salesforce",
      createdBy: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: "CREATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      description: `Created opportunity: ${title}`,
      target: title,
      meta: {
        opportunityId: opportunity._id,
        leadId: lead,
        value: value || 0,
        stage: stage || "Prospecting",
      },
    });

    const populatedOpportunity =
      await Opportunity.findById(opportunity._id)
        .populate("lead")
        .populate(
          "assignedTo",
          "name email role"
        )
        .populate(
          "createdBy",
          "name email"
        );

    return res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      data: populatedOpportunity,
    });
  } catch (error) {
    console.error(
      "Opportunity creation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create opportunity",
    });
  }
});


/* =====================================================
   ADD FOLLOW-UP
===================================================== */
router.post(
  "/:id/followups",
  auth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { type, date, note } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "Follow-up date is required",
        });
      }

      const opportunity =
        await Opportunity.findById(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      opportunity.followUps.push({
        type: type || "Call",
        date,
        note: note || "",
        status: "Pending",
        createdBy: req.user._id,
      });

      opportunity.lastActivityDate =
        new Date();

      await opportunity.save();

      const newFollowUp =
        opportunity.followUps[
          opportunity.followUps.length - 1
        ];

      await AuditLog.create({
        user: req.user._id,
        action: "CREATE",
        entity: "Opportunity Follow-up",
        entityId: opportunity._id,
        description: `Added follow-up to opportunity: ${opportunity.title}`,
        target: opportunity.title,
        meta: {
          opportunityId: opportunity._id,
          followUpId: newFollowUp._id,
          type: newFollowUp.type,
          date: newFollowUp.date,
        },
      });

      const populatedOpportunity =
        await Opportunity.findById(id)
          .populate("lead")
          .populate(
            "assignedTo",
            "name email role"
          )
          .populate(
            "followUps.createdBy",
            "name email"
          );

      return res.status(201).json({
        success: true,
        message:
          "Follow-up added successfully",
        data: populatedOpportunity,
      });
    } catch (error) {
      console.error(
        "Add follow-up error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to add follow-up",
      });
    }
  }
);


/* =====================================================
   GET FOLLOW-UPS
===================================================== */
router.get(
  "/:id/followups",
  auth,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid opportunity ID",
        });
      }

      const opportunity =
        await Opportunity.findById(id)
          .populate(
            "followUps.createdBy",
            "name email"
          );

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: "Opportunity not found",
        });
      }

      return res.json({
        success: true,
        data: opportunity.followUps || [],
      });
    } catch (error) {
      console.error(
        "Get follow-ups error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch follow-ups",
      });
    }
  }
);


/* =====================================================
   UPDATE OPPORTUNITY
===================================================== */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    // Don't allow changing protected fields
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    delete updateData.department;
    delete updateData.createdBy;
    delete updateData.followUps;

    const opportunity =
      await Opportunity.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("lead")
        .populate(
          "assignedTo",
          "name email role"
        )
        .populate(
          "followUps.createdBy",
          "name email"
        );

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "UPDATE",
      entity: "Opportunity",
      entityId: opportunity._id,
      description: `Updated opportunity: ${opportunity.title}`,
      target: opportunity.title,
      meta: {
        opportunityId: opportunity._id,
      },
    });

    return res.json({
      success: true,
      message:
        "Opportunity updated successfully",
      data: opportunity,
    });
  } catch (error) {
    console.error(
      "Opportunity update error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update opportunity",
    });
  }
});


/* =====================================================
   UPDATE FOLLOW-UP
===================================================== */
router.put(
  "/:id/followups/:followUpId",
  auth,
  async (req, res) => {
    try {
      const {
        id,
        followUpId,
      } = req.params;

      const {
        status,
        type,
        date,
        note,
      } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(id) ||
        !mongoose.Types.ObjectId.isValid(
          followUpId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ID",
        });
      }

      const opportunity =
        await Opportunity.findById(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message:
            "Opportunity not found",
        });
      }

      const followUp =
        opportunity.followUps.id(
          followUpId
        );

      if (!followUp) {
        return res.status(404).json({
          success: false,
          message:
            "Follow-up not found",
        });
      }

      if (status) {
        followUp.status = status;

        if (status === "Completed") {
          followUp.completedAt =
            new Date();
        } else {
          followUp.completedAt =
            undefined;
        }
      }

      if (type) {
        followUp.type = type;
      }

      if (date) {
        followUp.date = date;
      }

      if (note !== undefined) {
        followUp.note = note;
      }

      opportunity.lastActivityDate =
        new Date();

      await opportunity.save();

      await AuditLog.create({
        user: req.user._id,
        action: "UPDATE",
        entity: "Opportunity Follow-up",
        entityId: opportunity._id,
        description: `Updated follow-up for opportunity: ${opportunity.title}`,
        target: opportunity.title,
        meta: {
          opportunityId: opportunity._id,
          followUpId,
          status:
            followUp.status,
        },
      });

      const populatedOpportunity =
        await Opportunity.findById(id)
          .populate(
            "followUps.createdBy",
            "name email"
          );

      return res.json({
        success: true,
        message:
          "Follow-up updated successfully",
        data: populatedOpportunity,
      });
    } catch (error) {
      console.error(
        "Update follow-up error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update follow-up",
      });
    }
  }
);


/* =====================================================
   DELETE FOLLOW-UP
===================================================== */
router.delete(
  "/:id/followups/:followUpId",
  auth,
  async (req, res) => {
    try {
      const {
        id,
        followUpId,
      } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id) ||
        !mongoose.Types.ObjectId.isValid(
          followUpId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ID",
        });
      }

      const opportunity =
        await Opportunity.findById(id);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message:
            "Opportunity not found",
        });
      }

      const followUp =
        opportunity.followUps.id(
          followUpId
        );

      if (!followUp) {
        return res.status(404).json({
          success: false,
          message:
            "Follow-up not found",
        });
      }

      followUp.deleteOne();

      opportunity.lastActivityDate =
        new Date();

      await opportunity.save();

      await AuditLog.create({
        user: req.user._id,
        action: "DELETE",
        entity: "Opportunity Follow-up",
        entityId: opportunity._id,
        description: `Deleted follow-up from opportunity: ${opportunity.title}`,
        target: opportunity.title,
        meta: {
          opportunityId: opportunity._id,
          followUpId,
        },
      });

      return res.json({
        success: true,
        message:
          "Follow-up deleted successfully",
        data: opportunity,
      });
    } catch (error) {
      console.error(
        "Delete follow-up error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete follow-up",
      });
    }
  }
);


/* =====================================================
   DELETE OPPORTUNITY
===================================================== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    const opportunity =
      await Opportunity.findByIdAndDelete(id);

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: "Opportunity not found",
      });
    }

    await AuditLog.create({
      user: req.user._id,
      action: "DELETE",
      entity: "Opportunity",
      entityId: opportunity._id,
      description: `Deleted opportunity: ${opportunity.title}`,
      target: opportunity.title,
      meta: {
        opportunityId: opportunity._id,
      },
    });

    return res.json({
      success: true,
      message:
        "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error(
      "Opportunity delete error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete opportunity",
    });
  }
});


export default router;