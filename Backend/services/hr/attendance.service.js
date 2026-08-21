import mongoose from "mongoose";
import Attendance from "../../models/hr/Attendance.js";
import Employee from "../../models/hr/Employee.js";

const getOrganizationFilter = (user) => {
  if (user?.organization) {
    return { organization: user.organization };
  }

  return {};
};

const normalizeDate = (date) => {
  if (!date) {
    throw new Error("Date is required");
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid date");
  }

  // If date is YYYY-MM-DD, treat it as IST calendar date
  const dateString =
    typeof date === "string"
      ? date.substring(0, 10)
      : null;

  if (
    dateString &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return new Date(
      `${dateString}T00:00:00+05:30`
    );
  }

  return value;
};

const getDayRange = (date) => {
  const start = normalizeDate(date);

  const end = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  return {
    start,
    end,
  };
};


/* ======================================================
   GET ATTENDANCE
====================================================== */

export const getAttendance = async (params = {}) => {
  const {
    page = 1,
    limit = 20,
    employee,
    status,
    startDate,
    endDate,
    search,
    user,
  } = params;

  const pageNumber = Math.max(
    Number(page) || 1,
    1
  );

  const limitNumber = Math.min(
    Math.max(Number(limit) || 20, 1),
    100
  );

  const skip =
    (pageNumber - 1) * limitNumber;

  const filter = {
    ...getOrganizationFilter(user),
  };

  if (employee) {
    if (!mongoose.Types.ObjectId.isValid(employee)) {
      throw new Error("Invalid employee ID");
    }

    filter.employee = employee;
  }

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.date = {};

    if (startDate) {
      filter.date.$gte =
        normalizeDate(startDate);
    }

    if (endDate) {
      const end = normalizeDate(endDate);
      end.setDate(end.getDate() + 1);

      filter.date.$lt = end;
    }
  }

  if (search?.trim()) {
    const employees = await Employee.find({
      ...getOrganizationFilter(user),
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
      ],
    }).select("_id");

    filter.employee = {
      $in: employees.map(
        (employee) => employee._id
      ),
    };
  }

  const [data, total] =
    await Promise.all([
      Attendance.find(filter)
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .populate(
          "approvedBy",
          "name email"
        )
        .sort({
          date: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Attendance.countDocuments(filter),
    ]);

  return {
    data,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages:
        Math.ceil(
          total / limitNumber
        ) || 0,
    },
  };
};


/* ======================================================
   GET ATTENDANCE BY ID
====================================================== */

export const getAttendanceById = async (
  id,
  user
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(
      "Invalid attendance ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const attendance =
    await Attendance.findOne({
      _id: id,
      ...getOrganizationFilter(user),
    })
      .populate(
        "employee",
        "employeeCode firstName lastName email department designation"
      )
      .populate(
        "approvedBy",
        "name email"
      )
      .lean();

  if (!attendance) {
    const error = new Error(
      "Attendance record not found"
    );

    error.statusCode = 404;

    throw error;
  }

  return attendance;
};


/* ======================================================
   GET TODAY ATTENDANCE
====================================================== */

export const getTodayAttendance = async (
  user
) => {
  const today = new Date();

  const { start, end } =
    getDayRange(today);

  return Attendance.find({
    ...getOrganizationFilter(user),
    date: {
      $gte: start,
      $lt: end,
    },
  })
    .populate(
      "employee",
      "employeeCode firstName lastName department designation"
    )
    .sort({
      createdAt: -1,
    })
    .lean();
};


/* ======================================================
   EMPLOYEE ATTENDANCE SUMMARY
====================================================== */

/* ======================================================
   EMPLOYEE ATTENDANCE SUMMARY
====================================================== */

export const getEmployeeAttendanceSummary = async (
  employeeId,
  startDate,
  endDate,
  user
) => {
  if (
    !mongoose.Types.ObjectId.isValid(employeeId)
  ) {
    const error = new Error(
      "Invalid employee ID"
    );

    error.statusCode = 400;

    throw error;
  }

  // Make sure employee exists
  const employee = await Employee.findOne({
    _id: employeeId,
    ...getOrganizationFilter(user),
  });

  if (!employee) {
    const error = new Error(
      "Employee not found"
    );

    error.statusCode = 404;

    throw error;
  }

  const filter = {
    employee: employeeId,
    ...getOrganizationFilter(user),
  };

  // ====================================================
  // DATE FILTER
  // ====================================================

  if (startDate || endDate) {
    filter.date = {};

    if (startDate) {
      filter.date.$gte =
        normalizeDate(startDate);
    }

    if (endDate) {
      const end =
        normalizeDate(endDate);

      end.setTime(
        end.getTime() +
          24 * 60 * 60 * 1000
      );

      filter.date.$lt = end;
    }
  }

  console.log(
    "ATTENDANCE SUMMARY FILTER:",
    JSON.stringify(filter, null, 2)
  );

  const records =
    await Attendance.find(filter)
      .sort({ date: 1 })
      .lean();

  console.log(
    "ATTENDANCE SUMMARY RECORDS:",
    records.length
  );

  const summary = {
    totalDays: records.length,

    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    leaveDays: 0,
    holidayDays: 0,
    weekOffDays: 0,
    lateDays: 0,
    workFromHomeDays: 0,

    totalWorkingMinutes: 0,
    totalOvertimeMinutes: 0,
  };

  for (const record of records) {
    switch (record.status) {
      case "Present":
        summary.presentDays++;
        break;

      case "Absent":
        summary.absentDays++;
        break;

      case "Half Day":
        summary.halfDays++;
        break;

      case "Leave":
        summary.leaveDays++;
        break;

      case "Holiday":
        summary.holidayDays++;
        break;

      case "Week Off":
        summary.weekOffDays++;
        break;

      case "Late":
        summary.lateDays++;
        break;

      case "Work From Home":
        summary.workFromHomeDays++;
        break;

      default:
        break;
    }

    summary.totalWorkingMinutes +=
      Number(record.workingMinutes || 0);

    summary.totalOvertimeMinutes +=
      Number(record.overtimeMinutes || 0);
  }

  return summary;
};

/* ======================================================
   CREATE ATTENDANCE
====================================================== */

export const createAttendance = async (
  data,
  user
) => {
  const {
    employee,
    date,
    checkIn,
    checkOut,
    breakMinutes = 0,
    workingMinutes,
    overtimeMinutes = 0,
    status = "Absent",
    source = "Web",
    remarks,
  } = data;

  if (!employee) {
    throw new Error(
      "Employee is required"
    );
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      employee
    )
  ) {
    throw new Error(
      "Invalid employee ID"
    );
  }

  if (!date) {
    throw new Error(
      "Date is required"
    );
  }

  const employeeExists =
    await Employee.findOne({
      _id: employee,
      ...getOrganizationFilter(user),
    });

  if (!employeeExists) {
    const error = new Error(
      "Employee not found"
    );

    error.statusCode = 404;

    throw error;
  }

  const attendanceDate =
    normalizeDate(date);

  const existing =
    await Attendance.findOne({
      employee,
      date: attendanceDate,
    });

  if (existing) {
    const error = new Error(
      "Attendance already exists for this employee and date"
    );

    error.statusCode = 409;

    throw error;
  }

  let calculatedWorkingMinutes =
    Number(workingMinutes || 0);

  if (
    checkIn &&
    checkOut &&
    workingMinutes === undefined
  ) {
    const inTime =
      new Date(checkIn);

    const outTime =
      new Date(checkOut);

    if (
      !Number.isNaN(inTime.getTime()) &&
      !Number.isNaN(outTime.getTime()) &&
      outTime > inTime
    ) {
      calculatedWorkingMinutes =
        Math.max(
          0,
          Math.floor(
            (outTime - inTime) /
              60000
          ) -
            Number(
              breakMinutes || 0
            )
        );
    }
  }

  const attendance =
    await Attendance.create({
      employee,
      date: attendanceDate,
      checkIn:
        checkIn || null,
      checkOut:
        checkOut || null,
      breakMinutes:
        Number(breakMinutes) || 0,
      workingMinutes:
        calculatedWorkingMinutes,
      overtimeMinutes:
        Number(overtimeMinutes) || 0,
      status,
      source,
      remarks,
      organization:
        employeeExists.organization ||
        user?.organization ||
        null,
    });

  return attendance;
};


/* ======================================================
   BULK ATTENDANCE
====================================================== */

export const createBulkAttendance =
  async (
    records,
    user
  ) => {
    if (
      !Array.isArray(records) ||
      records.length === 0
    ) {
      throw new Error(
        "Attendance records are required"
      );
    }

    const prepared = [];

    for (const record of records) {
      if (
        !record.employee ||
        !record.date
      ) {
        continue;
      }

      const employee =
        await Employee.findOne({
          _id: record.employee,
          ...getOrganizationFilter(user),
        });

      if (!employee) {
        continue;
      }

      prepared.push({
        ...record,
        date: normalizeDate(
          record.date
        ),
        organization:
          employee.organization ||
          user?.organization ||
          null,
      });
    }

    if (!prepared.length) {
      throw new Error(
        "No valid attendance records found"
      );
    }

    const results = [];

    for (const record of prepared) {
      try {
        const attendance =
          await Attendance.findOneAndUpdate(
            {
              employee:
                record.employee,
              date: record.date,
            },
            {
              $set: record,
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
              runValidators: true,
            }
          );

        results.push(attendance);
      } catch (error) {
        console.error(
          "Bulk attendance record error:",
          error
        );
      }
    }

    return results;
  };


/* ======================================================
   UPDATE ATTENDANCE
====================================================== */

export const updateAttendance = async (
  id,
  data,
  user
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(
      "Invalid attendance ID"
    );
  }

  const existing =
    await Attendance.findOne({
      _id: id,
      ...getOrganizationFilter(user),
    });

  if (!existing) {
    const error = new Error(
      "Attendance record not found"
    );

    error.statusCode = 404;

    throw error;
  }

  const updateData = {
    ...data,
  };

  if (updateData.date) {
    updateData.date =
      normalizeDate(
        updateData.date
      );
  }

  if (
    updateData.checkIn &&
    updateData.checkOut &&
    updateData.workingMinutes ===
      undefined
  ) {
    const inTime =
      new Date(
        updateData.checkIn
      );

    const outTime =
      new Date(
        updateData.checkOut
      );

    if (outTime > inTime) {
      updateData.workingMinutes =
        Math.max(
          0,
          Math.floor(
            (outTime - inTime) /
              60000
          ) -
            Number(
              updateData.breakMinutes ??
                existing.breakMinutes ??
                0
            )
        );
    }
  }

  const attendance =
    await Attendance.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "employee",
        "employeeCode firstName lastName department designation"
      );

  return attendance;
};


/* ======================================================
   DELETE ATTENDANCE
====================================================== */

export const deleteAttendance = async (
  id,
  user
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(
      "Invalid attendance ID"
    );
  }

  const attendance =
    await Attendance.findOneAndDelete({
      _id: id,
      ...getOrganizationFilter(user),
    });

  if (!attendance) {
    const error = new Error(
      "Attendance record not found"
    );

    error.statusCode = 404;

    throw error;
  }

  return attendance;
};