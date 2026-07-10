import express from "express";
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import Lead from "../models/Lead.js";
import AuditLog from "../models/AuditLog.js";
import auth from "../middlewares/auth.js";

const router = express.Router();

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

    if (stage) {
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
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Fetch opportunities error:", error);

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
      .populate("assignedTo", "name email role");

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
    console.error("Get opportunity error:", error);

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
      stage: stage || "Prospecting",
      assignedTo,
      notes,
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
    value,
    stage,
  },
});

    const populatedOpportunity =
      await Opportunity.findById(opportunity._id)
        .populate("lead")
        .populate("assignedTo", "name email");

    return res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      data: populatedOpportunity,
    });
  } catch (error) {
    console.error("Opportunity creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create opportunity",
    });
  }
});

/* =====================================================
   UPDATE OPPORTUNITY
===================================================== */
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    const opportunity = await Opportunity.findByIdAndUpdate(
      id,
      {
        ...req.body,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
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
      message: "Opportunity updated successfully",
      data: opportunity,
    });
  } catch (error) {
    console.error("Opportunity update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update opportunity",
    });
  }
});

/* =====================================================
   DELETE OPPORTUNITY
===================================================== */
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid opportunity ID",
      });
    }

    const opportunity = await Opportunity.findByIdAndDelete(id);

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
      message: "Opportunity deleted successfully",
    });
  } catch (error) {
    console.error("Opportunity delete error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete opportunity",
    });
  }
});

/* =====================================================
   OPPORTUNITY STATS
===================================================== */
router.get("/dashboard/stats", auth, async (req, res) => {
  try {
    const total = await Opportunity.countDocuments();

    const prospecting =
      await Opportunity.countDocuments({
        stage: "Prospecting",
      });

    const proposal =
      await Opportunity.countDocuments({
        stage: "Proposal",
      });

    const won =
      await Opportunity.countDocuments({
        stage: "Closed Won",
      });

    const lost =
      await Opportunity.countDocuments({
        stage: "Closed Lost",
      });

    const revenue = await Opportunity.aggregate([
      {
        $match: {
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
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
});

export default router;