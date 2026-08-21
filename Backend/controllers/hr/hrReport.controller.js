import mongoose from "mongoose";

import Employee from "../../models/hr/Employee.js";
import Attendance from "../../models/hr/Attendance.js";
import Leave from "../../models/hr/Leave.js";
import Payroll from "../../models/hr/Payroll.js";
import EmployeeExpense from "../../models/hr/EmployeeExpense.js";
import Performance from "../../models/hr/Performance.js";

// ======================================================
// HELPER
// ======================================================

const getDateRange = (startDate, endDate) => {
  const range = {};

  if (startDate) {
    const start = new Date(startDate);

    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }

  if (endDate) {
    const end = new Date(endDate);

    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  return range;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ======================================================
// HR DASHBOARD
// GET /api/hr/reports/dashboard
// ======================================================

export const getHRDashboard = async (req, res) => {
  try {
    const today = new Date();

    const start = new Date(today);
    start.setHours(0, 0, 0, 0);

    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,

      todayAttendance,
      presentToday,
      absentToday,
      lateToday,
      wfhToday,
      leaveToday,

      pendingLeaves,
      approvedLeaves,
      rejectedLeaves,

      pendingExpenses,
      approvedExpenses,
      reimbursedExpenses,

      draftPerformance,
      submittedPerformance,
      reviewedPerformance,
      finalizedPerformance,

      payrollCount,
      paidPayroll,
    ] = await Promise.all([
      // EMPLOYEES
      Employee.countDocuments(),

      Employee.countDocuments({
        status: "Active",
      }),

      Employee.countDocuments({
        status: { $ne: "Active" },
      }),

      // ATTENDANCE
      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
      }),

      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
        status: "Present",
      }),

      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
        status: "Absent",
      }),

      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
        status: "Late",
      }),

      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
        status: "Work From Home",
      }),

      Attendance.countDocuments({
        date: {
          $gte: start,
          $lte: end,
        },
        status: "Leave",
      }),

      // LEAVE
      Leave.countDocuments({
        status: "Pending",
      }),

      Leave.countDocuments({
        status: "Approved",
      }),

      Leave.countDocuments({
        status: "Rejected",
      }),

      // EXPENSE
      EmployeeExpense.countDocuments({
        status: "Submitted",
      }),

      EmployeeExpense.countDocuments({
        status: "Approved",
      }),

      EmployeeExpense.countDocuments({
        status: "Reimbursed",
      }),

      // PERFORMANCE
      Performance.countDocuments({
        status: "Draft",
      }),

      Performance.countDocuments({
        status: "Submitted",
      }),

      Performance.countDocuments({
        status: "Reviewed",
      }),

      Performance.countDocuments({
        status: "Finalized",
      }),

      // PAYROLL
      Payroll.countDocuments(),

      Payroll.countDocuments({
        status: "Paid",
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "HR dashboard fetched successfully",

      data: {
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: inactiveEmployees,
        },

        attendance: {
          total: todayAttendance,
          present: presentToday,
          absent: absentToday,
          late: lateToday,
          workFromHome: wfhToday,
          leave: leaveToday,
        },

        leaves: {
          pending: pendingLeaves,
          approved: approvedLeaves,
          rejected: rejectedLeaves,
        },

        expenses: {
          pending: pendingExpenses,
          approved: approvedExpenses,
          reimbursed: reimbursedExpenses,
        },

        performance: {
          draft: draftPerformance,
          submitted: submittedPerformance,
          reviewed: reviewedPerformance,
          finalized: finalizedPerformance,
        },

        payroll: {
          total: payrollCount,
          paid: paidPayroll,
        },
      },
    });
  } catch (error) {
    console.error("HR DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message || "Failed to fetch HR dashboard",
    });
  }
};

// ======================================================
// ATTENDANCE REPORT
// GET /api/hr/reports/attendance
// ======================================================

export const getAttendanceReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employee,
      department,
      status,
    } = req.query;

    const match = {};

    // DATE
    if (startDate || endDate) {
      const dateRange = getDateRange(
        startDate,
        endDate
      );

      if (Object.keys(dateRange).length) {
        match.date = dateRange;
      }
    }

    // EMPLOYEE
    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      match.employee = new mongoose.Types.ObjectId(
        employee
      );
    }

    // STATUS
    if (status) {
      match.status = status;
    }

    const pipeline = [
      {
        $match: match,
      },

      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },

      {
        $unwind: "$employee",
      },
    ];

    // DEPARTMENT FILTER
    if (department) {
      pipeline.push({
        $match: {
          "employee.department": department,
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$employee._id",

          totalDays: {
            $sum: 1,
          },

          presentDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "Present"],
                },
                1,
                0,
              ],
            },
          },

          absentDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "Absent"],
                },
                1,
                0,
              ],
            },
          },

          lateDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "Late"],
                },
                1,
                0,
              ],
            },
          },

          workFromHomeDays: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Work From Home",
                  ],
                },
                1,
                0,
              ],
            },
          },

          leaveDays: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", "Leave"],
                },
                1,
                0,
              ],
            },
          },

          workingMinutes: {
            $sum: {
              $ifNull: [
                "$workingMinutes",
                0,
              ],
            },
          },

          overtimeMinutes: {
            $sum: {
              $ifNull: [
                "$overtimeMinutes",
                0,
              ],
            },
          },

          employee: {
            $first: "$employee",
          },
        },
      },

      {
        $project: {
          _id: 0,

          employee: {
            _id: "$employee._id",
            employeeCode:
              "$employee.employeeCode",

            name: {
              $trim: {
                input: {
                  $concat: [
                    "$employee.firstName",
                    " ",
                    {
                      $ifNull: [
                        "$employee.lastName",
                        "",
                      ],
                    },
                  ],
                },
              },
            },

            department:
              "$employee.department",

            designation:
              "$employee.designation",
          },

          totalDays: 1,
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          workFromHomeDays: 1,
          leaveDays: 1,
          workingMinutes: 1,
          overtimeMinutes: 1,
        },
      },

      {
        $sort: {
          "employee.name": 1,
        },
      }
    );

    const report =
      await Attendance.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      message:
        "Attendance report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "ATTENDANCE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate attendance report",
    });
  }
};

// ======================================================
// LEAVE REPORT
// GET /api/hr/reports/leave
// ======================================================

export const getLeaveReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employee,
      leaveType,
      status,
    } = req.query;

    const match = {};

    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      match.employee =
        new mongoose.Types.ObjectId(employee);
    }

    if (leaveType) {
      match.leaveType = leaveType;
    }

    if (status) {
      match.status = status;
    }

    if (startDate || endDate) {
      const dateRange = getDateRange(
        startDate,
        endDate
      );

      if (Object.keys(dateRange).length) {
        match.startDate = dateRange;
      }
    }

    const report = await Leave.aggregate([
      {
        $match: match,
      },

      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },

      {
        $unwind: "$employee",
      },

      {
        $group: {
          _id: {
            employee:
              "$employee._id",
            leaveType: "$leaveType",
          },

          totalDays: {
            $sum: {
              $ifNull: ["$totalDays", 0],
            },
          },

          requestCount: {
            $sum: 1,
          },

          employee: {
            $first: "$employee",
          },
        },
      },

      {
        $project: {
          _id: 0,

          employee: {
            _id: "$employee._id",
            employeeCode:
              "$employee.employeeCode",

            name: {
              $trim: {
                input: {
                  $concat: [
                    "$employee.firstName",
                    " ",
                    {
                      $ifNull: [
                        "$employee.lastName",
                        "",
                      ],
                    },
                  ],
                },
              },
            },

            department:
              "$employee.department",

            designation:
              "$employee.designation",
          },

          leaveType:
            "$_id.leaveType",

          totalDays: 1,
          requestCount: 1,
        },
      },

      {
        $sort: {
          "employee.name": 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Leave report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "LEAVE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate leave report",
    });
  }
};

// ======================================================
// PAYROLL REPORT
// GET /api/hr/reports/payroll
// ======================================================

export const getPayrollReport = async (req, res) => {
  try {
    const {
      month,
      year,
      status,
      employee,
    } = req.query;

    const match = {};

    if (month) {
      match.month = Number(month);
    }

    if (year) {
      match.year = Number(year);
    }

    if (status) {
      match.status = status;
    }

    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      match.employee =
        new mongoose.Types.ObjectId(employee);
    }

    const report = await Payroll.aggregate([
      {
        $match: match,
      },

      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },

      {
        $unwind: {
          path: "$employee",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
          },

          employeeCount: {
            $sum: 1,
          },

          grossSalary: {
            $sum: {
              $ifNull: [
                "$grossSalary",
                0,
              ],
            },
          },

          totalDeductions: {
            $sum: {
              $ifNull: [
                "$totalDeductions",
                0,
              ],
            },
          },

          netSalary: {
            $sum: {
              $ifNull: [
                "$netSalary",
                0,
              ],
            },
          },

          paidCount: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Paid",
                  ],
                },
                1,
                0,
              ],
            },
          },

          employees: {
            $push: {
              _id: "$employee._id",
              employeeCode:
                "$employee.employeeCode",

              name: {
                $trim: {
                  input: {
                    $concat: [
                      "$employee.firstName",
                      " ",
                      {
                        $ifNull: [
                          "$employee.lastName",
                          "",
                        ],
                      },
                    ],
                  },
                },
              },

              status: "$status",
              grossSalary:
                "$grossSalary",
              totalDeductions:
                "$totalDeductions",
              netSalary: "$netSalary",
            },
          },
        },
      },

      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Payroll report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "PAYROLL REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate payroll report",
    });
  }
};

// ======================================================
// EMPLOYEE REPORT
// GET /api/hr/reports/employees
// ======================================================

export const getEmployeeReport = async (
  req,
  res
) => {
  try {
    const {
      department,
      employmentType,
      status,
    } = req.query;

    const match = {};

    if (department) {
      match.department = department;
    }

    if (employmentType) {
      match.employmentType =
        employmentType;
    }

    if (status) {
      match.status = status;
    }

    const report = await Employee.aggregate([
      {
        $match: match,
      },

      {
        $group: {
          _id: {
            department: "$department",
            employmentType:
              "$employmentType",
          },

          totalEmployees: {
            $sum: 1,
          },

          activeEmployees: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Active",
                  ],
                },
                1,
                0,
              ],
            },
          },

          inactiveEmployees: {
            $sum: {
              $cond: [
                {
                  $ne: [
                    "$status",
                    "Active",
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      {
        $project: {
          _id: 0,

          department: {
            $ifNull: [
              "$_id.department",
              "Unassigned",
            ],
          },

          employmentType: {
            $ifNull: [
              "$_id.employmentType",
              "Unspecified",
            ],
          },

          totalEmployees: 1,
          activeEmployees: 1,
          inactiveEmployees: 1,
        },
      },

      {
        $sort: {
          totalEmployees: -1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Employee report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "EMPLOYEE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate employee report",
    });
  }
};

// ======================================================
// DEPARTMENT REPORT
// GET /api/hr/reports/departments
// ======================================================

export const getDepartmentReport = async (
  req,
  res
) => {
  try {
    const {
      department,
      status,
    } = req.query;

    const match = {};

    if (department) {
      match.department = department;
    }

    if (status) {
      match.status = status;
    }

    const report = await Employee.aggregate([
      {
        $match: match,
      },

      {
        $group: {
          _id: "$department",

          totalEmployees: {
            $sum: 1,
          },

          activeEmployees: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    "$status",
                    "Active",
                  ],
                },
                1,
                0,
              ],
            },
          },

          inactiveEmployees: {
            $sum: {
              $cond: [
                {
                  $ne: [
                    "$status",
                    "Active",
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      {
        $project: {
          _id: 0,

          department: {
            $ifNull: [
              "$_id",
              "Unassigned",
            ],
          },

          totalEmployees: 1,
          activeEmployees: 1,
          inactiveEmployees: 1,
        },
      },

      {
        $sort: {
          totalEmployees: -1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message:
        "Department report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "DEPARTMENT REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate department report",
    });
  }
};

// ======================================================
// EXPENSE REPORT
// GET /api/hr/reports/expenses
// ======================================================

export const getExpenseReport = async (
  req,
  res
) => {
  try {
    const {
      startDate,
      endDate,
      employee,
      category,
      status,
    } = req.query;

    const match = {};

    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      match.employee =
        new mongoose.Types.ObjectId(employee);
    }

    if (category) {
      match.category = category;
    }

    if (status) {
      match.status = status;
    }

    if (startDate || endDate) {
      const dateRange = getDateRange(
        startDate,
        endDate
      );

      if (Object.keys(dateRange).length) {
        match.expenseDate = dateRange;
      }
    }

    const report =
      await EmployeeExpense.aggregate([
        {
          $match: match,
        },

        {
          $lookup: {
            from: "employees",
            localField: "employee",
            foreignField: "_id",
            as: "employee",
          },
        },

        {
          $unwind: "$employee",
        },

        {
          $group: {
            _id: {
              employee:
                "$employee._id",
              category: "$category",
            },

            totalAmount: {
              $sum: {
                $ifNull: [
                  "$amount",
                  0,
                ],
              },
            },

            expenseCount: {
              $sum: 1,
            },

            employee: {
              $first: "$employee",
            },
          },
        },

        {
          $project: {
            _id: 0,

            employee: {
              _id: "$employee._id",

              employeeCode:
                "$employee.employeeCode",

              name: {
                $trim: {
                  input: {
                    $concat: [
                      "$employee.firstName",
                      " ",
                      {
                        $ifNull: [
                          "$employee.lastName",
                          "",
                        ],
                      },
                    ],
                  },
                },
              },

              department:
                "$employee.department",

              designation:
                "$employee.designation",
            },

            category:
              "$_id.category",

            totalAmount: 1,
            expenseCount: 1,
          },
        },

        {
          $sort: {
            totalAmount: -1,
          },
        },
      ]);

    return res.status(200).json({
      success: true,
      message:
        "Expense report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "EXPENSE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate expense report",
    });
  }
};

// ======================================================
// PERFORMANCE REPORT
// GET /api/hr/reports/performance
// ======================================================

export const getPerformanceReport = async (
  req,
  res
) => {
  try {
    const {
      employee,
      status,
      reviewer,
      startDate,
      endDate,
      minRating,
      maxRating,
    } = req.query;

    const match = {};

    if (employee) {
      if (!isValidObjectId(employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      match.employee =
        new mongoose.Types.ObjectId(employee);
    }

    if (reviewer) {
      if (!isValidObjectId(reviewer)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reviewer ID",
        });
      }

      match.reviewer =
        new mongoose.Types.ObjectId(reviewer);
    }

    if (status) {
      match.status = status;
    }

    if (startDate || endDate) {
      const dateRange = getDateRange(
        startDate,
        endDate
      );

      if (Object.keys(dateRange).length) {
        match.reviewStartDate =
          dateRange;
      }
    }

    if (
      minRating !== undefined ||
      maxRating !== undefined
    ) {
      match.overallRating = {};

      if (minRating !== undefined) {
        match.overallRating.$gte =
          Number(minRating);
      }

      if (maxRating !== undefined) {
        match.overallRating.$lte =
          Number(maxRating);
      }
    }

    const report =
      await Performance.aggregate([
        {
          $match: match,
        },

        {
          $lookup: {
            from: "employees",
            localField: "employee",
            foreignField: "_id",
            as: "employee",
          },
        },

        {
          $unwind: "$employee",
        },

        {
          $lookup: {
            from: "users",
            localField: "reviewer",
            foreignField: "_id",
            as: "reviewer",
          },
        },

        {
          $unwind: {
            path: "$reviewer",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $group: {
            _id: "$employee._id",

            reviewCount: {
              $sum: 1,
            },

            averageRating: {
              $avg: "$overallRating",
            },

            highestRating: {
              $max: "$overallRating",
            },

            lowestRating: {
              $min: "$overallRating",
            },

            finalizedCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Finalized",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            draftCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Draft",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            submittedCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Submitted",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            reviewedCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "Reviewed",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            promotionRecommendedCount: {
              $sum: {
                $cond: [
                  "$promotionRecommended",
                  1,
                  0,
                ],
              },
            },

            incrementRecommendedCount: {
              $sum: {
                $cond: [
                  "$incrementRecommended",
                  1,
                  0,
                ],
              },
            },

            averageIncrementPercentage: {
              $avg: {
                $cond: [
                  "$incrementRecommended",
                  "$recommendedIncrementPercentage",
                  null,
                ],
              },
            },

            employee: {
              $first: "$employee",
            },
          },
        },

        {
          $project: {
            _id: 0,

            employee: {
              _id: "$employee._id",

              employeeCode:
                "$employee.employeeCode",

              name: {
                $trim: {
                  input: {
                    $concat: [
                      "$employee.firstName",
                      " ",
                      {
                        $ifNull: [
                          "$employee.lastName",
                          "",
                        ],
                      },
                    ],
                  },
                },
              },

              department:
                "$employee.department",

              designation:
                "$employee.designation",
            },

            reviewCount: 1,

            averageRating: {
              $round: [
                "$averageRating",
                2,
              ],
            },

            highestRating: 1,
            lowestRating: 1,

            draftCount: 1,
            submittedCount: 1,
            reviewedCount: 1,
            finalizedCount: 1,

            promotionRecommendedCount: 1,
            incrementRecommendedCount: 1,

            averageIncrementPercentage: {
              $round: [
                {
                  $ifNull: [
                    "$averageIncrementPercentage",
                    0,
                  ],
                },
                2,
              ],
            },
          },
        },

        {
          $sort: {
            averageRating: -1,
          },
        },
      ]);

    return res.status(200).json({
      success: true,
      message:
        "Performance report fetched successfully",
      data: report,
    });
  } catch (error) {
    console.error(
      "PERFORMANCE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate performance report",
    });
  }
};