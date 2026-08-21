import mongoose from "mongoose";
import Leave from "../../models/hr/Leave.js";
import Employee from "../../models/hr/Employee.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const calculateLeaveDays = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Normalize time to avoid timezone/day calculation issues
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  const difference =
    to.getTime() - from.getTime();

  return Math.floor(
    difference / (1000 * 60 * 60 * 24)
  ) + 1;
};

const validateDates = (
  fromDate,
  toDate
) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime())
  ) {
    return {
      valid: false,
      message: "Invalid leave dates",
    };
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);

  if (to < from) {
    return {
      valid: false,
      message:
        "To date cannot be before from date",
    };
  }

  return {
    valid: true,
    from,
    to,
  };
};


// ======================================================
// GET ALL LEAVES
// GET /api/hr/leaves
// ======================================================

export const getLeaves = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      employee,
      status,
      leaveType,
      fromDate,
      toDate,
      organization,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const filter = {};

    // --------------------------------------------------
    // Employee filter
    // --------------------------------------------------

    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      filter.employee = employee;
    }

    // --------------------------------------------------
    // Status filter
    // --------------------------------------------------

    if (status) {
      filter.status = status;
    }

    // --------------------------------------------------
    // Leave type filter
    // --------------------------------------------------

    if (leaveType) {
      filter.leaveType = leaveType;
    }

    // --------------------------------------------------
    // Organization filter
    // --------------------------------------------------

    if (organization) {
      if (!isValidObjectId(organization)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid organization ID",
        });
      }

      filter.organization =
        organization;
    }

    // --------------------------------------------------
    // Date filter
    // --------------------------------------------------

    if (fromDate || toDate) {
      filter.fromDate = {};

      if (fromDate) {
        const date = new Date(fromDate);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid fromDate filter",
          });
        }

        date.setHours(0, 0, 0, 0);

        filter.fromDate.$gte = date;
      }

      if (toDate) {
        const date = new Date(toDate);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid toDate filter",
          });
        }

        date.setHours(23, 59, 59, 999);

        filter.fromDate.$lte = date;
      }
    }

    // --------------------------------------------------
    // Search
    // --------------------------------------------------

    if (search.trim()) {
      const employees =
        await Employee.find({
          $or: [
            {
              firstName: {
                $regex: search.trim(),
                $options: "i",
              },
            },
            {
              lastName: {
                $regex: search.trim(),
                $options: "i",
              },
            },
            {
              employeeCode: {
                $regex: search.trim(),
                $options: "i",
              },
            },
            {
              email: {
                $regex: search.trim(),
                $options: "i",
              },
            },
          ],
        }).select("_id");

      const employeeIds =
        employees.map(
          (employee) => employee._id
        );

      filter.$or = [
        {
          reason: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          leaveType: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          employee: {
            $in: employeeIds,
          },
        },
      ];
    }

    // --------------------------------------------------
    // Sorting
    // --------------------------------------------------

    const allowedSortFields = [
      "createdAt",
      "fromDate",
      "toDate",
      "totalDays",
      "status",
      "leaveType",
    ];

    const safeSortBy =
      allowedSortFields.includes(
        sortBy
      )
        ? sortBy
        : "createdAt";

    const safeSortOrder =
      sortOrder === "asc" ? 1 : -1;

    const sort = {
      [safeSortBy]: safeSortOrder,
    };

    // --------------------------------------------------
    // Query
    // --------------------------------------------------

    const [leaves, total] =
      await Promise.all([
        Leave.find(filter)
          .populate(
            "employee",
            "employeeCode firstName lastName email phone department designation status"
          )
          .populate(
            "approvedBy",
            "name email"
          )
          .sort(sort)
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        Leave.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      data: leaves,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages:
          Math.ceil(
            total / limitNumber
          ),
      },
    });
  } catch (error) {
    console.error(
      "GET LEAVES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch leaves",
    });
  }
};


// ======================================================
// GET LEAVE BY ID
// GET /api/hr/leaves/:id
// ======================================================

export const getLeaveById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
    }

    const leave =
      await Leave.findById(id)
        .populate(
          "employee",
          "employeeCode firstName lastName email phone department designation status"
        )
        .populate(
          "approvedBy",
          "name email"
        )
        .lean();

    if (!leave) {
      return res.status(404).json({
        success: false,
        message:
          "Leave request not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    console.error(
      "GET LEAVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch leave",
    });
  }
};


// ======================================================
// GET EMPLOYEE LEAVE SUMMARY
// GET /api/hr/leaves/summary/:employeeId
// ======================================================

export const getLeaveSummary = async (
  req,
  res
) => {
  try {
    const { employeeId } =
      req.params;

    const {
      year = new Date().getFullYear(),
    } = req.query;

    if (
      !isValidObjectId(employeeId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid employee ID",
      });
    }

    const employeeExists =
      await Employee.exists({
        _id: employeeId,
      });

    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const selectedYear =
      Number(year);

    if (
      !Number.isInteger(
        selectedYear
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid year",
      });
    }

    const startOfYear =
      new Date(
        selectedYear,
        0,
        1
      );

    const endOfYear =
      new Date(
        selectedYear + 1,
        0,
        1
      );

    const leaves =
      await Leave.find({
        employee: employeeId,

        fromDate: {
          $gte: startOfYear,
          $lt: endOfYear,
        },
      }).lean();

    const summary = {
      year: selectedYear,

      totalRequests:
        leaves.length,

      approved: 0,

      pending: 0,

      rejected: 0,

      cancelled: 0,

      totalDays: 0,

      approvedDays: 0,

      pendingDays: 0,

      rejectedDays: 0,

      cancelledDays: 0,
    };

    for (const leave of leaves) {
      const status =
        String(
          leave.status || ""
        ).toLowerCase();

      const days =
        Number(
          leave.totalDays || 0
        );

      summary.totalDays += days;

      if (
        status === "approved"
      ) {
        summary.approved++;
        summary.approvedDays +=
          days;
      } else if (
        status === "pending"
      ) {
        summary.pending++;
        summary.pendingDays +=
          days;
      } else if (
        status === "rejected"
      ) {
        summary.rejected++;
        summary.rejectedDays +=
          days;
      } else if (
        status === "cancelled"
      ) {
        summary.cancelled++;
        summary.cancelledDays +=
          days;
      }
    }

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error(
      "LEAVE SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch leave summary",
    });
  }
};


// ======================================================
// APPLY LEAVE
// POST /api/hr/leaves
// ======================================================

export const applyLeave = async (
  req,
  res
) => {
  try {
    const {
      employee,
      fromDate,
      toDate,
      leaveType,
      reason,
      organization,
    } = req.body;

    // --------------------------------------------------
    // Required fields
    // --------------------------------------------------

    if (!employee) {
      return res.status(400).json({
        success: false,
        message:
          "Employee is required",
      });
    }

    if (!isValidObjectId(employee)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid employee ID",
      });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message:
          "From date and to date are required",
      });
    }

    if (!leaveType) {
      return res.status(400).json({
        success: false,
        message:
          "Leave type is required",
      });
    }

    // --------------------------------------------------
    // Employee validation
    // --------------------------------------------------

    const employeeExists =
      await Employee.exists({
        _id: employee,
      });

    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found",
      });
    }

    // --------------------------------------------------
    // Date validation
    // --------------------------------------------------

    const dateValidation =
      validateDates(
        fromDate,
        toDate
      );

    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        message:
          dateValidation.message,
      });
    }

    const totalDays =
      calculateLeaveDays(
        fromDate,
        toDate
      );

    if (totalDays <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid leave duration",
      });
    }

    // --------------------------------------------------
    // Check overlapping leave
    // --------------------------------------------------

    const overlappingLeave =
      await Leave.findOne({
        employee,

        status: {
          $in: [
            "Pending",
            "Approved",
          ],
        },

        fromDate: {
          $lte: new Date(toDate),
        },

        toDate: {
          $gte: new Date(fromDate),
        },
      });

    if (overlappingLeave) {
      return res.status(409).json({
        success: false,
        message:
          "Employee already has a pending or approved leave for this period",
        data: {
          leaveId:
            overlappingLeave._id,
          fromDate:
            overlappingLeave.fromDate,
          toDate:
            overlappingLeave.toDate,
          status:
            overlappingLeave.status,
        },
      });
    }

    // --------------------------------------------------
    // Organization
    // --------------------------------------------------

    if (
      organization &&
      !isValidObjectId(
        organization
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid organization ID",
      });
    }

    // --------------------------------------------------
    // Create leave
    // --------------------------------------------------

    const leave =
      await Leave.create({
        employee,

        leaveType,

        fromDate,

        toDate,

        totalDays,

        reason:
          reason?.trim() || "",

        status: "Pending",

        organization:
          organization || null,
      });

    const populatedLeave =
      await Leave.findById(
        leave._id
      )
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .lean();

    return res.status(201).json({
      success: true,
      message:
        "Leave applied successfully",
      data: populatedLeave,
    });
  } catch (error) {
    console.error(
      "APPLY LEAVE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to apply leave",
    });
  }
};


// ======================================================
// UPDATE LEAVE
// PUT /api/hr/leaves/:id
// ======================================================

export const updateLeave = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
    }

    const existingLeave =
      await Leave.findById(id);

    if (!existingLeave) {
      return res.status(404).json({
        success: false,
        message:
          "Leave request not found",
      });
    }

    // Do not allow editing completed leave
    if (
      ["Approved", "Rejected", "Cancelled"].includes(
        existingLeave.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Completed leave request cannot be edited",
      });
    }

    const {
      employee,
      fromDate,
      toDate,
      leaveType,
      reason,
    } = req.body;

    const updateData = {};

    if (employee !== undefined) {
      if (
        !isValidObjectId(
          employee
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid employee ID",
        });
      }

      const employeeExists =
        await Employee.exists({
          _id: employee,
        });

      if (!employeeExists) {
        return res.status(404).json({
          success: false,
          message:
            "Employee not found",
        });
      }

      updateData.employee =
        employee;
    }

    if (leaveType !== undefined) {
      updateData.leaveType =
        leaveType;
    }

    if (reason !== undefined) {
      updateData.reason =
        reason?.trim() || "";
    }

    const finalFromDate =
      fromDate ||
      existingLeave.fromDate;

    const finalToDate =
      toDate ||
      existingLeave.toDate;

    if (
      fromDate ||
      toDate
    ) {
      const validation =
        validateDates(
          finalFromDate,
          finalToDate
        );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      updateData.fromDate =
        finalFromDate;

      updateData.toDate =
        finalToDate;

      updateData.totalDays =
        calculateLeaveDays(
          finalFromDate,
          finalToDate
        );
    }

    // --------------------------------------------------
    // Overlap check
    // --------------------------------------------------

    const finalEmployee =
      employee ||
      existingLeave.employee;

    const overlap =
      await Leave.findOne({
        _id: {
          $ne: id,
        },

        employee:
          finalEmployee,

        status: {
          $in: [
            "Pending",
            "Approved",
          ],
        },

        fromDate: {
          $lte: new Date(
            finalToDate
          ),
        },

        toDate: {
          $gte: new Date(
            finalFromDate
          ),
        },
      });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message:
          "Another leave already exists for this period",
      });
    }

    const leave =
      await Leave.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        );

    return res.status(200).json({
      success: true,
      message:
        "Leave updated successfully",
      data: leave,
    });
  } catch (error) {
    console.error(
      "UPDATE LEAVE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to update leave",
    });
  }
};


// ======================================================
// UPDATE LEAVE STATUS
// PUT /api/hr/leaves/:id/status
// ======================================================

export const updateLeaveStatus =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const {
        status,
        rejectionReason,
      } = req.body;

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid leave ID",
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message:
            "Status is required",
        });
      }

      const allowedStatuses = [
        "Pending",
        "Approved",
        "Rejected",
        "Cancelled",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid leave status",
        });
      }

      const leave =
        await Leave.findById(id);

      if (!leave) {
        return res.status(404).json({
          success: false,
          message:
            "Leave request not found",
        });
      }

      // --------------------------------------------------
      // Reject
      // --------------------------------------------------

      if (
        status === "Rejected" &&
        !rejectionReason?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rejection reason is required",
        });
      }

      const updateData = {
        status,
      };

      // --------------------------------------------------
      // Approve
      // --------------------------------------------------

      if (
        status === "Approved"
      ) {
        updateData.approvedAt =
          new Date();

        // logged-in user
        if (req.user?._id) {
          updateData.approvedBy =
            req.user._id;
        } else if (req.user?.id) {
          updateData.approvedBy =
            req.user.id;
        }
      }

      // --------------------------------------------------
      // Reject
      // --------------------------------------------------

      if (
        status === "Rejected"
      ) {
        updateData.rejectionReason =
          rejectionReason.trim();
      }

      // --------------------------------------------------
      // Pending
      // --------------------------------------------------

      if (
        status === "Pending"
      ) {
        updateData.approvedBy =
          null;

        updateData.approvedAt =
          null;

        updateData.rejectionReason =
          undefined;
      }

      // --------------------------------------------------
      // Cancel
      // --------------------------------------------------

      if (
        status === "Cancelled"
      ) {
        updateData.approvedBy =
          null;

        updateData.approvedAt =
          null;
      }

      const updatedLeave =
        await Leave.findByIdAndUpdate(
          id,
          updateData,
          {
            new: true,
            runValidators: true,
          }
        )
          .populate(
            "employee",
            "employeeCode firstName lastName email department designation"
          )
          .populate(
            "approvedBy",
            "name email"
          );

      return res.status(200).json({
        success: true,
        message:
          `Leave ${status.toLowerCase()} successfully`,
        data: updatedLeave,
      });
    } catch (error) {
      console.error(
        "UPDATE LEAVE STATUS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update leave status",
      });
    }
  };


// ======================================================
// APPROVE LEAVE
// PUT /api/hr/leaves/:id/approve
// ======================================================

export const approveLeave = async (
  req,
  res
) => {
  req.body.status =
    "Approved";

  return updateLeaveStatus(
    req,
    res
  );
};


// ======================================================
// REJECT LEAVE
// PUT /api/hr/leaves/:id/reject
// ======================================================

export const rejectLeave = async (
  req,
  res
) => {
  req.body.status =
    "Rejected";

  return updateLeaveStatus(
    req,
    res
  );
};


// ======================================================
// CANCEL LEAVE
// PUT /api/hr/leaves/:id/cancel
// ======================================================

export const cancelLeave = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid leave ID",
      });
    }

    const leave =
      await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message:
          "Leave request not found",
      });
    }

    if (
      ["Rejected", "Cancelled"].includes(
        leave.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Leave is already ${leave.status.toLowerCase()}`,
      });
    }

    const updatedLeave =
      await Leave.findByIdAndUpdate(
        id,
        {
          status: "Cancelled",
        },
        {
          new: true,
          runValidators: true,
        }
      )
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        );

    return res.status(200).json({
      success: true,
      message:
        "Leave cancelled successfully",
      data: updatedLeave,
    });
  } catch (error) {
    console.error(
      "CANCEL LEAVE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to cancel leave",
    });
  }
};


// ======================================================
// DELETE LEAVE
// DELETE /api/hr/leaves/:id
// ======================================================

export const deleteLeave = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid leave ID",
      });
    }

    const leave =
      await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message:
          "Leave request not found",
      });
    }

    if (
      leave.status ===
      "Approved"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Approved leave cannot be deleted. Cancel it instead.",
      });
    }

    await Leave.findByIdAndDelete(
      id
    );

    return res.status(200).json({
      success: true,
      message:
        "Leave deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE LEAVE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete leave",
    });
  }
};