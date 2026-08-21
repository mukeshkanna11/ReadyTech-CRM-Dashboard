import mongoose from "mongoose";
import Holiday from "../../models/hr/Holiday.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const normalizeDate = (date) => {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};


// ======================================================
// GET ALL HOLIDAYS
// GET /api/hr/holidays
// ======================================================

export const getHolidays = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      year,
      type,
      isActive,
      organization,
      fromDate,
      toDate,
      sortOrder = "asc",
    } = req.query;

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      200
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
          description: {
            $regex:
              search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ==================================================
    // TYPE
    // ==================================================

    if (type) {
      const allowedTypes = [
        "Public",
        "Optional",
        "Company",
      ];

      if (
        !allowedTypes.includes(
          type
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid holiday type",
        });
      }

      query.type = type;
    }

    // ==================================================
    // ACTIVE STATUS
    // ==================================================

    if (
      isActive !== undefined
    ) {
      query.isActive =
        isActive === "true";
    }

    // ==================================================
    // YEAR FILTER
    // ==================================================

    if (year) {
      const selectedYear =
        Number(year);

      if (
        !Number.isInteger(
          selectedYear
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid year",
        });
      }

      const start =
        new Date(
          selectedYear,
          0,
          1
        );

      const end =
        new Date(
          selectedYear + 1,
          0,
          1
        );

      query.date = {
        $gte: start,
        $lt: end,
      };
    }

    // ==================================================
    // CUSTOM DATE RANGE
    // ==================================================

    if (fromDate || toDate) {
      query.date = {};

      if (fromDate) {
        const start =
          normalizeDate(
            fromDate
          );

        if (!start) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid fromDate",
          });
        }

        start.setHours(
          0,
          0,
          0,
          0
        );

        query.date.$gte =
          start;
      }

      if (toDate) {
        const end =
          normalizeDate(
            toDate
          );

        if (!end) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid toDate",
          });
        }

        end.setHours(
          23,
          59,
          59,
          999
        );

        query.date.$lte =
          end;
      }
    }

    // ==================================================
    // SORT
    // ==================================================

    const sortDirection =
      sortOrder === "desc"
        ? -1
        : 1;

    // ==================================================
    // DATABASE
    // ==================================================

    const [
      holidays,
      total,
    ] = await Promise.all([
      Holiday.find(query)
        .sort({
          date: sortDirection,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Holiday.countDocuments(
        query
      ),
    ]);

    return res.status(200).json({
      success: true,

      data: holidays,

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
      "GET HOLIDAYS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch holidays",
    });
  }
};


// ======================================================
// GET HOLIDAY BY ID
// GET /api/hr/holidays/:id
// ======================================================

export const getHolidayById =
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
            "Invalid holiday ID",
        });
      }

      const holiday =
        await Holiday.findById(
          id
        ).lean();

      if (!holiday) {
        return res.status(404).json({
          success: false,
          message:
            "Holiday not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: holiday,
      });
    } catch (error) {
      console.error(
        "GET HOLIDAY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch holiday",
      });
    }
  };


// ======================================================
// GET HOLIDAYS BY YEAR
// GET /api/hr/holidays/year/:year
// ======================================================

export const getHolidaysByYear =
  async (req, res) => {
    try {
      const selectedYear =
        Number(
          req.params.year
        );

      if (
        !Number.isInteger(
          selectedYear
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid year",
        });
      }

      const query = {};

      const organizationId =
        req.user?.organization;

      if (organizationId) {
        query.organization =
          organizationId;
      }

      const start =
        new Date(
          selectedYear,
          0,
          1
        );

      const end =
        new Date(
          selectedYear + 1,
          0,
          1
        );

      query.date = {
        $gte: start,
        $lt: end,
      };

      query.isActive = true;

      const holidays =
        await Holiday.find(query)
          .sort({
            date: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,
        year: selectedYear,
        data: holidays,
      });
    } catch (error) {
      console.error(
        "GET HOLIDAYS BY YEAR ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch holidays",
      });
    }
  };


// ======================================================
// CREATE HOLIDAY
// POST /api/hr/holidays
// ======================================================

export const createHoliday =
  async (req, res) => {
    try {
      const {
        name,
        date,
        type = "Company",
        description,
        isActive = true,
        organization,
      } = req.body;

      // ==================================================
      // VALIDATION
      // ==================================================

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Holiday name is required",
        });
      }

      if (!date) {
        return res.status(400).json({
          success: false,
          message:
            "Holiday date is required",
        });
      }

      const parsedDate =
        normalizeDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid holiday date",
        });
      }

      const allowedTypes = [
        "Public",
        "Optional",
        "Company",
      ];

      if (
        !allowedTypes.includes(
          type
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid holiday type",
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

      const startOfDay =
        new Date(parsedDate);

      startOfDay.setHours(
        0,
        0,
        0,
        0
      );

      const endOfDay =
        new Date(parsedDate);

      endOfDay.setHours(
        23,
        59,
        59,
        999
      );

      const duplicate =
        await Holiday.findOne({
          organization:
            organizationId,

          name: {
            $regex:
              `^${name.trim()}$`,
            $options: "i",
          },

          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "A holiday with the same name already exists on this date",
        });
      }

      // ==================================================
      // CREATE
      // ==================================================

      const holiday =
        await Holiday.create({
          name: name.trim(),

          date: parsedDate,

          type,

          description:
            description?.trim() ||
            "",

          isActive:
            Boolean(isActive),

          organization:
            organizationId,
        });

      return res.status(201).json({
        success: true,
        message:
          "Holiday created successfully",
        data: holiday,
      });
    } catch (error) {
      console.error(
        "CREATE HOLIDAY ERROR:",
        error
      );

      // Duplicate key
      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Holiday already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to create holiday",
      });
    }
  };


// ======================================================
// UPDATE HOLIDAY
// PUT /api/hr/holidays/:id
// ======================================================

export const updateHoliday =
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
            "Invalid holiday ID",
        });
      }

      const holiday =
        await Holiday.findById(id);

      if (!holiday) {
        return res.status(404).json({
          success: false,
          message:
            "Holiday not found",
        });
      }

      const {
        name,
        date,
        type,
        description,
        isActive,
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
              "Holiday name cannot be empty",
          });
        }

        updateData.name =
          name.trim();
      }

      // ==================================================
      // DATE
      // ==================================================

      if (date !== undefined) {
        const parsedDate =
          normalizeDate(date);

        if (!parsedDate) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid holiday date",
          });
        }

        updateData.date =
          parsedDate;
      }

      // ==================================================
      // TYPE
      // ==================================================

      if (type !== undefined) {
        const allowedTypes = [
          "Public",
          "Optional",
          "Company",
        ];

        if (
          !allowedTypes.includes(
            type
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid holiday type",
          });
        }

        updateData.type =
          type;
      }

      // ==================================================
      // DESCRIPTION
      // ==================================================

      if (
        description !== undefined
      ) {
        updateData.description =
          description?.trim() ||
          "";
      }

      // ==================================================
      // ACTIVE
      // ==================================================

      if (
        isActive !== undefined
      ) {
        updateData.isActive =
          Boolean(isActive);
      }

      // ==================================================
      // UPDATE
      // ==================================================

      const updatedHoliday =
        await Holiday.findByIdAndUpdate(
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
          "Holiday updated successfully",
        data: updatedHoliday,
      });
    } catch (error) {
      console.error(
        "UPDATE HOLIDAY ERROR:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Holiday with the same name and date already exists",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update holiday",
      });
    }
  };


// ======================================================
// TOGGLE HOLIDAY STATUS
// PATCH /api/hr/holidays/:id/status
// ======================================================

export const toggleHolidayStatus =
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
            "Invalid holiday ID",
        });
      }

      const holiday =
        await Holiday.findById(id);

      if (!holiday) {
        return res.status(404).json({
          success: false,
          message:
            "Holiday not found",
        });
      }

      holiday.isActive =
        !holiday.isActive;

      await holiday.save();

      return res.status(200).json({
        success: true,
        message:
          holiday.isActive
            ? "Holiday activated successfully"
            : "Holiday deactivated successfully",
        data: holiday,
      });
    } catch (error) {
      console.error(
        "TOGGLE HOLIDAY STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update holiday status",
      });
    }
  };


// ======================================================
// DELETE HOLIDAY
// DELETE /api/hr/holidays/:id
// ======================================================

export const deleteHoliday =
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
            "Invalid holiday ID",
        });
      }

      const holiday =
        await Holiday.findById(id);

      if (!holiday) {
        return res.status(404).json({
          success: false,
          message:
            "Holiday not found",
        });
      }

      await Holiday.findByIdAndDelete(
        id
      );

      return res.status(200).json({
        success: true,
        message:
          "Holiday deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE HOLIDAY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete holiday",
      });
    }
  };