import mongoose from "mongoose";

import Shift from "../../models/hr/Shift.js";
import Employee from "../../models/hr/Employee.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const allowedStatuses = [
  "Active",
  "Inactive",
];

const allowedWorkingDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];


// ======================================================
// GET ALL SHIFTS
// GET /api/hr/shifts
// ======================================================

export const getShifts = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      isNightShift,
      organization,
    } = req.query;

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const query = {};

    // ==================================================
    // ORGANIZATION
    // ==================================================

    const organizationId =
      organization ||
      req.user?.organization ||
      null;

    if (organizationId) {
      if (
        !isValidObjectId(
          organizationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid organization ID",
        });
      }

      query.organization =
        organizationId;
    }

    // ==================================================
    // STATUS
    // ==================================================

    if (status) {
      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift status",
        });
      }

      query.status = status;
    }

    // ==================================================
    // NIGHT SHIFT
    // ==================================================

    if (
      isNightShift !== undefined
    ) {
      query.isNightShift =
        isNightShift === "true";
    }

    // ==================================================
    // SEARCH
    // ==================================================

    if (search.trim()) {
      query.$or = [
        {
          name: {
            $regex:
              search.trim(),
            $options: "i",
          },
        },
        {
          code: {
            $regex:
              search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ==================================================
    // DATABASE
    // ==================================================

    const [
      shifts,
      total,
    ] = await Promise.all([
      Shift.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Shift.countDocuments(
        query
      ),
    ]);

    // ==================================================
    // EMPLOYEE COUNTS
    // ==================================================

    const shiftIds =
      shifts.map(
        (shift) => shift._id
      );

    const employeeCounts =
      await Employee.aggregate([
        {
          $match: {
            shift: {
              $in: shiftIds,
            },
            status: "Active",
          },
        },

        {
          $group: {
            _id: "$shift",
            count: {
              $sum: 1,
            },
          },
        },
      ]);

    const countMap = {};

    employeeCounts.forEach(
      (item) => {
        countMap[
          item._id.toString()
        ] = item.count;
      }
    );

    const data = shifts.map(
      (shift) => ({
        ...shift,

        activeEmployeeCount:
          countMap[
            shift._id.toString()
          ] || 0,
      })
    );

    return res.status(200).json({
      success: true,

      data,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET SHIFTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch shifts",
    });
  }
};


// ======================================================
// GET SHIFT BY ID
// GET /api/hr/shifts/:id
// ======================================================

export const getShiftById =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift ID",
        });
      }

      const shift =
        await Shift.findById(id)
          .lean();

      if (!shift) {
        return res.status(404).json({
          success: false,
          message:
            "Shift not found",
        });
      }

      const activeEmployeeCount =
        await Employee.countDocuments(
          {
            shift: id,
            status: "Active",
          }
        );

      return res.status(200).json({
        success: true,

        data: {
          ...shift,
          activeEmployeeCount,
        },
      });
    } catch (error) {
      console.error(
        "GET SHIFT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch shift",
      });
    }
  };


// ======================================================
// CREATE SHIFT
// POST /api/hr/shifts
// ======================================================

export const createShift =
  async (req, res) => {
    try {
      const {
        name,
        code,
        startTime,
        endTime,
        breakMinutes = 60,
        gracePeriodMinutes = 15,
        workingDays = [],
        isNightShift = false,
        status = "Active",
        organization,
      } = req.body;

      // ==================================================
      // REQUIRED FIELDS
      // ==================================================

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Shift name is required",
        });
      }

      if (!code?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Shift code is required",
        });
      }

      if (!startTime) {
        return res.status(400).json({
          success: false,
          message:
            "Start time is required",
        });
      }

      if (!endTime) {
        return res.status(400).json({
          success: false,
          message:
            "End time is required",
        });
      }

      // ==================================================
      // STATUS
      // ==================================================

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift status",
        });
      }

      // ==================================================
      // WORKING DAYS
      // ==================================================

      if (
        !Array.isArray(
          workingDays
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Working days must be an array",
        });
      }

      const invalidDays =
        workingDays.filter(
          (day) =>
            !allowedWorkingDays.includes(
              day
            )
        );

      if (
        invalidDays.length > 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid working day",
          invalidDays,
        });
      }

      // ==================================================
      // NUMERIC VALIDATION
      // ==================================================

      const parsedBreak =
        Number(breakMinutes);

      const parsedGrace =
        Number(
          gracePeriodMinutes
        );

      if (
        Number.isNaN(
          parsedBreak
        ) ||
        parsedBreak < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid break minutes",
        });
      }

      if (
        Number.isNaN(
          parsedGrace
        ) ||
        parsedGrace < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid grace period",
        });
      }

      // ==================================================
      // ORGANIZATION
      // ==================================================

      const organizationId =
        organization ||
        req.user?.organization ||
        null;

      if (
        organizationId &&
        !isValidObjectId(
          organizationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid organization ID",
        });
      }

      // ==================================================
      // DUPLICATE CHECK
      // ==================================================

      const existing =
        await Shift.findOne({
          organization:
            organizationId,

          $or: [
            {
              name: {
                $regex:
                  `^${name.trim()}$`,
                $options: "i",
              },
            },

            {
              code: {
                $regex:
                  `^${code.trim()}$`,
                $options: "i",
              },
            },
          ],
        });

      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "Shift name or code already exists",
        });
      }

      // ==================================================
      // CREATE
      // ==================================================

      const shift =
        await Shift.create({
          name: name.trim(),

          code:
            code.trim().toUpperCase(),

          startTime:
            startTime.trim(),

          endTime:
            endTime.trim(),

          breakMinutes:
            parsedBreak,

          gracePeriodMinutes:
            parsedGrace,

          workingDays,

          isNightShift:
            Boolean(isNightShift),

          status,

          organization:
            organizationId,
        });

      return res.status(201).json({
        success: true,
        message:
          "Shift created successfully",
        data: shift,
      });
    } catch (error) {
      console.error(
        "CREATE SHIFT ERROR:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Shift code already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to create shift",
      });
    }
  };


// ======================================================
// UPDATE SHIFT
// PUT /api/hr/shifts/:id
// ======================================================

export const updateShift =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift ID",
        });
      }

      const existingShift =
        await Shift.findById(id);

      if (!existingShift) {
        return res.status(404).json({
          success: false,
          message:
            "Shift not found",
        });
      }

      const {
        name,
        code,
        startTime,
        endTime,
        breakMinutes,
        gracePeriodMinutes,
        workingDays,
        isNightShift,
        status,
      } = req.body;

      const updateData = {};

      // ==================================================
      // NAME
      // ==================================================

      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({
            success: false,
            message:
              "Shift name cannot be empty",
          });
        }

        updateData.name =
          name.trim();
      }

      // ==================================================
      // CODE
      // ==================================================

      if (code !== undefined) {
        if (!code.trim()) {
          return res.status(400).json({
            success: false,
            message:
              "Shift code cannot be empty",
          });
        }

        updateData.code =
          code.trim().toUpperCase();
      }

      // ==================================================
      // TIME
      // ==================================================

      if (
        startTime !== undefined
      ) {
        updateData.startTime =
          startTime.trim();
      }

      if (
        endTime !== undefined
      ) {
        updateData.endTime =
          endTime.trim();
      }

      // ==================================================
      // BREAK
      // ==================================================

      if (
        breakMinutes !== undefined
      ) {
        const value =
          Number(
            breakMinutes
          );

        if (
          Number.isNaN(value) ||
          value < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid break minutes",
          });
        }

        updateData.breakMinutes =
          value;
      }

      // ==================================================
      // GRACE PERIOD
      // ==================================================

      if (
        gracePeriodMinutes !==
        undefined
      ) {
        const value =
          Number(
            gracePeriodMinutes
          );

        if (
          Number.isNaN(value) ||
          value < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid grace period",
          });
        }

        updateData.gracePeriodMinutes =
          value;
      }

      // ==================================================
      // WORKING DAYS
      // ==================================================

      if (
        workingDays !== undefined
      ) {
        if (
          !Array.isArray(
            workingDays
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Working days must be an array",
          });
        }

        const invalidDays =
          workingDays.filter(
            (day) =>
              !allowedWorkingDays.includes(
                day
              )
          );

        if (
          invalidDays.length > 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid working day",
            invalidDays,
          });
        }

        updateData.workingDays =
          workingDays;
      }

      // ==================================================
      // NIGHT SHIFT
      // ==================================================

      if (
        isNightShift !==
        undefined
      ) {
        updateData.isNightShift =
          Boolean(
            isNightShift
          );
      }

      // ==================================================
      // STATUS
      // ==================================================

      if (status !== undefined) {
        if (
          !allowedStatuses.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid shift status",
          });
        }

        updateData.status =
          status;
      }

      // ==================================================
      // DUPLICATE NAME / CODE
      // ==================================================

      if (
        updateData.name ||
        updateData.code
      ) {
        const duplicateQuery =
          {
            _id: {
              $ne: id,
            },

            organization:
              existingShift.organization,

            $or: [],
          };

        if (updateData.name) {
          duplicateQuery.$or.push({
            name: {
              $regex:
                `^${updateData.name}$`,
              $options: "i",
            },
          });
        }

        if (updateData.code) {
          duplicateQuery.$or.push({
            code: {
              $regex:
                `^${updateData.code}$`,
              $options: "i",
            },
          });
        }

        const duplicate =
          await Shift.findOne(
            duplicateQuery
          );

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "Shift name or code already exists",
          });
        }
      }

      // ==================================================
      // UPDATE
      // ==================================================

      const shift =
        await Shift.findByIdAndUpdate(
          id,
          {
            $set: updateData,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Shift updated successfully",
        data: shift,
      });
    } catch (error) {
      console.error(
        "UPDATE SHIFT ERROR:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Shift code already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update shift",
      });
    }
  };


// ======================================================
// TOGGLE SHIFT STATUS
// PATCH /api/hr/shifts/:id/status
// ======================================================

export const toggleShiftStatus =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift ID",
        });
      }

      const shift =
        await Shift.findById(id);

      if (!shift) {
        return res.status(404).json({
          success: false,
          message:
            "Shift not found",
        });
      }

      shift.status =
        shift.status ===
        "Active"
          ? "Inactive"
          : "Active";

      await shift.save();

      return res.status(200).json({
        success: true,
        message:
          shift.status ===
          "Active"
            ? "Shift activated successfully"
            : "Shift deactivated successfully",
        data: shift,
      });
    } catch (error) {
      console.error(
        "TOGGLE SHIFT STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update shift status",
      });
    }
  };


// ======================================================
// GET EMPLOYEES ASSIGNED TO SHIFT
// GET /api/hr/shifts/:id/employees
// ======================================================

export const getShiftEmployees =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift ID",
        });
      }

      const shift =
        await Shift.findById(id)
          .select(
            "name code status"
          )
          .lean();

      if (!shift) {
        return res.status(404).json({
          success: false,
          message:
            "Shift not found",
        });
      }

      const employees =
        await Employee.find({
          shift: id,
        })
          .select(
            "employeeCode firstName lastName email department designation status"
          )
          .sort({
            firstName: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,

        shift,

        data: employees,

        count: employees.length,
      });
    } catch (error) {
      console.error(
        "GET SHIFT EMPLOYEES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch shift employees",
      });
    }
  };


// ======================================================
// DELETE SHIFT
// DELETE /api/hr/shifts/:id
// ======================================================

export const deleteShift =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !isValidObjectId(id)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid shift ID",
        });
      }

      // ==================================================
      // CHECK EMPLOYEES
      // ==================================================

      const employeeCount =
        await Employee.countDocuments(
          {
            shift: id,
            status: "Active",
          }
        );

      if (
        employeeCount > 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete shift because active employees are assigned to it",
          activeEmployeeCount:
            employeeCount,
        });
      }

      // ==================================================
      // DELETE
      // ==================================================

      const shift =
        await Shift.findByIdAndDelete(
          id
        );

      if (!shift) {
        return res.status(404).json({
          success: false,
          message:
            "Shift not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Shift deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE SHIFT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete shift",
      });
    }
  };