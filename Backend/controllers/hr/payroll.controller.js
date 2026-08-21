import Payroll from "../../models/hr/Payroll.js";
import Employee from "../../models/hr/Employee.js";
import Attendance from "../../models/hr/Attendance.js";
import Leave from "../../models/hr/Leave.js";

// ======================================================
// HELPERS
// ======================================================

const getMonthRange = (month, year) => {
  const start = new Date(
    Number(year),
    Number(month) - 1,
    1,
    0,
    0,
    0,
    0
  );

  const end = new Date(
    Number(year),
    Number(month),
    0,
    23,
    59,
    59,
    999
  );

  return { start, end };
};

const calculateSalary = (salary) => {
  const grossSalary =
    Number(salary.basicSalary || 0) +
    Number(salary.hra || 0) +
    Number(salary.conveyanceAllowance || 0) +
    Number(salary.medicalAllowance || 0) +
    Number(salary.specialAllowance || 0) +
    Number(salary.otherAllowances || 0);

  const totalDeductions =
    Number(salary.providentFund || 0) +
    Number(salary.professionalTax || 0) +
    Number(salary.otherDeductions || 0);

  const netSalary =
    grossSalary - totalDeductions;

  return {
    grossSalary,
    totalDeductions,
    netSalary: Math.max(netSalary, 0),
  };
};

// ======================================================
// GET ALL PAYROLLS
// GET /api/hr/payroll
// ======================================================

export const getPayrolls = async (req, res) => {
  try {
    const {
      month,
      year,
      employee,
      status,
      page = 1,
      limit = 20,
    } = req.query;

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

    const query = {};

    if (month) {
      query.month = Number(month);
    }

    if (year) {
      query.year = Number(year);
    }

    if (employee) {
      query.employee = employee;
    }

    if (status) {
      query.status = status;
    }

    if (req.user?.organization) {
      query.organization =
        req.user.organization;
    }

    const [payrolls, total] =
      await Promise.all([
        Payroll.find(query)
          .populate(
            "employee",
            "employeeCode firstName lastName email department designation"
          )
          .populate(
            "approvedBy",
            "name email"
          )
          .sort({
            year: -1,
            month: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        Payroll.countDocuments(query),
      ]);

    return res.status(200).json({
      success: true,
      data: payrolls,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch payroll",
    });
  }
};

// ======================================================
// GET PAYROLL BY ID
// GET /api/hr/payroll/:id
// ======================================================

export const getPayrollById = async (
  req,
  res
) => {
  try {
    const query = {
      _id: req.params.id,
    };

    if (req.user?.organization) {
      query.organization =
        req.user.organization;
    }

    const payroll =
      await Payroll.findOne(query)
        .populate("employee")
        .populate(
          "approvedBy",
          "name email"
        )
        .lean();

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error(
      "GET PAYROLL BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch payroll",
    });
  }
};

// ======================================================
// PROCESS PAYROLL
// POST /api/hr/payroll/process
// ======================================================

export const processPayroll = async (
  req,
  res
) => {
  try {
    const {
      month,
      year,
      employeeId,
    } = req.body;

    const monthNumber = Number(month);
    const yearNumber = Number(year);

    if (
      !monthNumber ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid month is required",
      });
    }

    if (
      !yearNumber ||
      yearNumber < 2000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid year is required",
      });
    }

    const {
      start,
      end,
    } = getMonthRange(
      monthNumber,
      yearNumber
    );

    const employeeQuery = {
      status: "Active",
    };

    if (employeeId) {
      employeeQuery._id = employeeId;
    }

    if (req.user?.organization) {
      employeeQuery.organization =
        req.user.organization;
    }

    const employees =
      await Employee.find(
        employeeQuery
      ).populate("salaryStructure");

    if (!employees.length) {
      return res.status(404).json({
        success: false,
        message:
          "No active employees found",
      });
    }

    const results = [];

    for (const employee of employees) {
      try {
        const salary =
          employee.salaryStructure;

        if (!salary) {
          results.push({
            employee:
              employee._id,
            employeeCode:
              employee.employeeCode,
            status: "Skipped",
            reason:
              "Salary structure not assigned",
          });

          continue;
        }

        // ------------------------------------------
        // ATTENDANCE
        // ------------------------------------------

        const attendance =
          await Attendance.find({
            employee:
              employee._id,

            date: {
              $gte: start,
              $lte: end,
            },
          }).lean();

        const presentDays =
          attendance.filter((item) =>
            [
              "Present",
              "Late",
              "Work From Home",
            ].includes(item.status)
          ).length;

        const absentDays =
          attendance.filter(
            (item) =>
              item.status ===
              "Absent"
          ).length;

        const overtimeMinutes =
          attendance.reduce(
            (total, item) =>
              total +
              Number(
                item.overtimeMinutes ||
                  0
              ),
            0
          );

        // ------------------------------------------
        // APPROVED LEAVES
        // ------------------------------------------

        const leaves =
          await Leave.find({
            employee:
              employee._id,

            status: "Approved",

            fromDate: {
              $lte: end,
            },

            toDate: {
              $gte: start,
            },
          }).lean();

        let leaveDays = 0;

        for (const leave of leaves) {
          leaveDays += Number(
            leave.totalDays || 0
          );
        }

        // ------------------------------------------
        // WORKING DAYS
        // ------------------------------------------

        const totalWorkingDays =
          presentDays +
          absentDays;

        // ------------------------------------------
        // SALARY
        // ------------------------------------------

        const {
          grossSalary,
          totalDeductions,
          netSalary,
        } = calculateSalary(salary);

        // ------------------------------------------
        // UPSERT PAYROLL
        // ------------------------------------------

        const payroll =
          await Payroll.findOneAndUpdate(
            {
              employee:
                employee._id,

              month:
                monthNumber,

              year:
                yearNumber,
            },

            {
              employee:
                employee._id,

              month:
                monthNumber,

              year:
                yearNumber,

              totalWorkingDays,

              presentDays,

              absentDays,

              leaveDays,

              overtimeMinutes,

              grossSalary,

              totalDeductions,

              netSalary,

              status:
                "Processed",

              processedAt:
                new Date(),

              organization:
                employee.organization ||
                req.user?.organization ||
                null,
            },

            {
              upsert: true,
              new: true,
              setDefaultsOnInsert:
                true,
              runValidators: true,
            }
          );

        results.push({
          employee:
            employee._id,

          employeeCode:
            employee.employeeCode,

          status:
            "Processed",

          payrollId:
            payroll._id,

          grossSalary,

          totalDeductions,

          netSalary,

          presentDays,

          absentDays,

          leaveDays,

          overtimeMinutes,
        });
      } catch (employeeError) {
        console.error(
          `Payroll error for ${employee.employeeCode}:`,
          employeeError
        );

        results.push({
          employee:
            employee._id,

          employeeCode:
            employee.employeeCode,

          status: "Failed",

          reason:
            employeeError.message,
        });
      }
    }

    return res.status(200).json({
      success: true,

      message:
        "Payroll processed successfully",

      data: results,
    });
  } catch (error) {
    console.error(
      "PROCESS PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to process payroll",
    });
  }
};

// ======================================================
// APPROVE PAYROLL
// PATCH /api/hr/payroll/:id/approve
// ======================================================

export const approvePayroll = async (
  req,
  res
) => {
  try {
    const payroll =
      await Payroll.findById(
        req.params.id
      );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    if (
      payroll.status !==
      "Processed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only processed payroll can be approved",
      });
    }

    payroll.status =
      "Approved";

    payroll.approvedBy =
      req.user?._id || null;

    payroll.approvedAt =
      new Date();

    await payroll.save();

    return res.status(200).json({
      success: true,
      message:
        "Payroll approved successfully",
      data: payroll,
    });
  } catch (error) {
    console.error(
      "APPROVE PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to approve payroll",
    });
  }
};

// ======================================================
// MARK PAYROLL AS PAID
// PATCH /api/hr/payroll/:id/mark-paid
// ======================================================

export const markPayrollPaid = async (
  req,
  res
) => {
  try {
    const payroll =
      await Payroll.findById(
        req.params.id
      );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message:
          "Payroll not found",
      });
    }

    if (
      ![
        "Processed",
        "Approved",
      ].includes(payroll.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payroll must be processed or approved before payment",
      });
    }

    payroll.status = "Paid";
    payroll.paidAt = new Date();

    await payroll.save();

    return res.status(200).json({
      success: true,
      message:
        "Payroll marked as paid",
      data: payroll,
    });
  } catch (error) {
    console.error(
      "MARK PAYROLL PAID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to mark payroll as paid",
    });
  }
};

// ======================================================
// RESET PAYROLL TO DRAFT
// PATCH /api/hr/payroll/:id/reset
// ======================================================

export const resetPayroll = async (
  req,
  res
) => {
  try {
    const payroll =
      await Payroll.findById(
        req.params.id
      );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message:
          "Payroll not found",
      });
    }

    if (
      payroll.status === "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Paid payroll cannot be reset",
      });
    }

    payroll.status = "Draft";
    payroll.processedAt = null;
    payroll.approvedBy = null;
    payroll.approvedAt = null;
    payroll.paidAt = null;

    await payroll.save();

    return res.status(200).json({
      success: true,
      message:
        "Payroll reset to draft",
      data: payroll,
    });
  } catch (error) {
    console.error(
      "RESET PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to reset payroll",
    });
  }
};

// ======================================================
// DELETE PAYROLL
// DELETE /api/hr/payroll/:id
// ======================================================

export const deletePayroll = async (
  req,
  res
) => {
  try {
    const payroll =
      await Payroll.findById(
        req.params.id
      );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message:
          "Payroll not found",
      });
    }

    if (
      payroll.status === "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Paid payroll cannot be deleted",
      });
    }

    await Payroll.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message:
        "Payroll deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete payroll",
    });
  }
};