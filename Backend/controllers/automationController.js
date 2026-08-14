import mongoose from "mongoose";
import Automation from "../models/Automation.js";
import AutomationExecution from "../models/AutomationExecution.js";
import { triggerAutomation } from "../utils/automationEvents.js";

export const createAutomation = async (req, res) => {
  try {
    const {
      name,
      description,
      module,
      trigger,
      conditionLogic,
      conditions,
      actions,
    } = req.body;

    if (!name || !module || !trigger) {
      return res.status(400).json({
        success: false,
        message: "Name, module and trigger are required",
      });
    }

    if (!trigger.event) {
      return res.status(400).json({
        success: false,
        message: "Trigger event is required",
      });
    }

    if (!actions?.length) {
      return res.status(400).json({
        success: false,
        message: "At least one action is required",
      });
    }

    const automation = await Automation.create({
      name,
      description,
      module,
      trigger,
      conditionLogic: conditionLogic || "AND",
      conditions: conditions || [],
      actions,
      status: "draft",
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Automation created successfully",
      automation,
    });
  } catch (error) {
    console.error("Create automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create automation",
      error: error.message,
    });
  }
};

export const getAutomations = async (req, res) => {
  try {
    const {
      status,
      module,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(Number(page), 1);
    const limitNumber = Math.min(Math.max(Number(limit), 1), 100);

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (module) {
      filter.module = module;
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [automations, total] = await Promise.all([
      Automation.find(filter)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Automation.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      automations,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get automations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch automations",
      error: error.message,
    });
  }
};

export const getAutomationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid automation ID",
      });
    }

    const automation = await Automation.findById(id)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    return res.json({
      success: true,
      automation,
    });
  } catch (error) {
    console.error("Get automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch automation",
      error: error.message,
    });
  }
};

export const updateAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid automation ID",
      });
    }

    const automation = await Automation.findById(id);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "module",
      "trigger",
      "conditionLogic",
      "conditions",
      "actions",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        automation[field] = req.body[field];
      }
    }

    automation.version += 1;
    automation.updatedBy = req.user._id;

    await automation.save();

    return res.json({
      success: true,
      message: "Automation updated successfully",
      automation,
    });
  } catch (error) {
    console.error("Update automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update automation",
      error: error.message,
    });
  }
};

export const activateAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    const automation = await Automation.findById(id);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    if (!automation.actions.length) {
      return res.status(400).json({
        success: false,
        message: "Automation must contain at least one action",
      });
    }

    automation.status = "active";
    automation.updatedBy = req.user._id;

    await automation.save();

    return res.json({
      success: true,
      message: "Automation activated successfully",
      automation,
    });
  } catch (error) {
    console.error("Activate automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to activate automation",
      error: error.message,
    });
  }
};

export const pauseAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    const automation = await Automation.findByIdAndUpdate(
      id,
      {
        status: "paused",
        updatedBy: req.user._id,
      },
      {
        new: true,
      }
    );

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    return res.json({
      success: true,
      message: "Automation paused successfully",
      automation,
    });
  } catch (error) {
    console.error("Pause automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to pause automation",
      error: error.message,
    });
  }
};

export const deleteAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    const automation = await Automation.findByIdAndDelete(id);

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    await AutomationExecution.deleteMany({
      automation: id,
    });

    return res.json({
      success: true,
      message: "Automation deleted successfully",
    });
  } catch (error) {
    console.error("Delete automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete automation",
      error: error.message,
    });
  }
};

export const duplicateAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    const original = await Automation.findById(id).lean();

    if (!original) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    const duplicated = await Automation.create({
      name: `${original.name} - Copy`,
      description: original.description,
      module: original.module,
      trigger: original.trigger,
      conditionLogic: original.conditionLogic,
      conditions: original.conditions,
      actions: original.actions,
      status: "draft",
      version: 1,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Automation duplicated successfully",
      automation: duplicated,
    });
  } catch (error) {
    console.error("Duplicate automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to duplicate automation",
      error: error.message,
    });
  }
};

export const getAutomationExecutions = async (req, res) => {
  try {
    const { id } = req.params;

    const executions = await AutomationExecution.find({
      automation: id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      executions,
    });
  } catch (error) {
    console.error("Get automation executions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch automation executions",
      error: error.message,
    });
  }
};

export const testAutomation = async (req, res) => {
  try {
    const { id } = req.params;

    const automation = await Automation.findById(id).lean();

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: "Automation not found",
      });
    }

    const {
      record = {},
      recordId = null,
    } = req.body;

    const result = await triggerAutomation({
      module: automation.module,
      event: automation.trigger.event,
      record,
      recordId,
      userId: req.user._id,
      metadata: {
        source: "manual-test",
      },
    });

    return res.json({
      success: true,
      message: "Automation test completed",
      result,
    });
  } catch (error) {
    console.error("Test automation error:", error);

    return res.status(500).json({
      success: false,
      message: "Automation test failed",
      error: error.message,
    });
  }
};