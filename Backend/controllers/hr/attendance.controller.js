import * as attendanceService from "../../services/hr/attendance.service.js";

/* ======================================================
   GET ALL ATTENDANCE
====================================================== */

export const getAttendance = async (req, res) => {
  try {
    const result = await attendanceService.getAttendance({
      ...req.query,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      ...result,
    });
  } catch (error) {
    console.error("GET ATTENDANCE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to fetch attendance",
    });
  }
};


/* ======================================================
   GET ATTENDANCE BY ID
====================================================== */

export const getAttendanceById = async (req, res) => {
  try {
    const attendance =
      await attendanceService.getAttendanceById(
        req.params.id,
        req.user
      );

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: attendance,
    });
  } catch (error) {
    console.error(
      "GET ATTENDANCE BY ID ERROR:",
      error
    );

    return res.status(
      error.statusCode || 404
    ).json({
      success: false,
      message:
        error.message ||
        "Attendance record not found",
    });
  }
};


/* ======================================================
   GET TODAY ATTENDANCE
====================================================== */

export const getTodayAttendance = async (req, res) => {
  try {
    const attendance =
      await attendanceService.getTodayAttendance(
        req.user
      );

    return res.status(200).json({
      success: true,
      message:
        "Today's attendance fetched successfully",
      data: attendance,
    });
  } catch (error) {
    console.error(
      "GET TODAY ATTENDANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch today's attendance",
    });
  }
};


/* ======================================================
   EMPLOYEE ATTENDANCE SUMMARY
====================================================== */

export const getEmployeeAttendanceSummary =
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;

      const summary =
        await attendanceService.getEmployeeAttendanceSummary(
          employeeId,
          startDate,
          endDate,
          req.user
        );

      return res.status(200).json({
        success: true,
        message:
          "Attendance summary fetched successfully",
        data: summary,
      });
    } catch (error) {
      console.error(
        "ATTENDANCE SUMMARY ERROR:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch attendance summary",
      });
    }
  };


/* ======================================================
   CREATE ATTENDANCE
====================================================== */

export const createAttendance = async (req, res) => {
  try {
    const attendance =
      await attendanceService.createAttendance(
        req.body,
        req.user
      );

    return res.status(201).json({
      success: true,
      message:
        "Attendance created successfully",
      data: attendance,
    });
  } catch (error) {
    console.error(
      "CREATE ATTENDANCE ERROR:",
      error
    );

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to create attendance",
    });
  }
};


/* ======================================================
   CREATE BULK ATTENDANCE
====================================================== */

export const createBulkAttendance = async (
  req,
  res
) => {
  try {
    const records = Array.isArray(req.body)
      ? req.body
      : req.body.records;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Attendance records are required",
      });
    }

    const attendance =
      await attendanceService.createBulkAttendance(
        records,
        req.user
      );

    return res.status(201).json({
      success: true,
      message:
        "Bulk attendance created successfully",
      data: attendance,
      count: attendance.length,
    });
  } catch (error) {
    console.error(
      "CREATE BULK ATTENDANCE ERROR:",
      error
    );

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to create bulk attendance",
    });
  }
};


/* ======================================================
   UPDATE ATTENDANCE
====================================================== */

export const updateAttendance = async (
  req,
  res
) => {
  try {
    const attendance =
      await attendanceService.updateAttendance(
        req.params.id,
        req.body,
        req.user
      );

    return res.status(200).json({
      success: true,
      message:
        "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error(
      "UPDATE ATTENDANCE ERROR:",
      error
    );

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to update attendance",
    });
  }
};


/* ======================================================
   DELETE ATTENDANCE
====================================================== */

export const deleteAttendance = async (
  req,
  res
) => {
  try {
    await attendanceService.deleteAttendance(
      req.params.id,
      req.user
    );

    return res.status(200).json({
      success: true,
      message:
        "Attendance deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE ATTENDANCE ERROR:",
      error
    );

    return res.status(
      error.statusCode || 404
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to delete attendance",
    });
  }
};