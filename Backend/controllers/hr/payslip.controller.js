import mongoose from "mongoose";

import Payslip from "../../models/hr/Payslip.js";
import Payroll from "../../models/hr/Payroll.js";
import Employee from "../../models/hr/Employee.js";
import SalaryStructure from "../../models/hr/SalaryStructure.js";

/* ======================================================
   ORGANIZATION FILTER
====================================================== */

const getOrganizationFilter = (user) => {
  if (user?.organization) {
    return {
      organization: user.organization,
    };
  }

  return {};
};

/* ======================================================
   VALIDATE OBJECT ID
====================================================== */

const validateObjectId = (id, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
};

/* ======================================================
   GENERATE PAYSLIP NUMBER
====================================================== */

const generatePayslipNumber = async (
  employeeCode,
  month,
  year
) => {
  const monthString = String(month).padStart(2, "0");

  const prefix = `PS-${year}-${monthString}-${employeeCode}`;

  const existing = await Payslip.findOne({
    payslipNumber: prefix,
  }).lean();

  if (!existing) {
    return prefix;
  }

  let counter = 2;

  while (
    await Payslip.exists({
      payslipNumber: `${prefix}-${counter}`,
    })
  ) {
    counter++;
  }

  return `${prefix}-${counter}`;
};

/* ======================================================
   GET ALL PAYSLIPS
   GET /api/hr/payslips
====================================================== */

export const getPayslips = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      employee,
      payroll,
      month,
      year,
      status,
      search,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const filter = {
      ...getOrganizationFilter(req.user),
    };

    if (employee) {
      validateObjectId(employee, "employee ID");
      filter.employee = employee;
    }

    if (payroll) {
      validateObjectId(payroll, "payroll ID");
      filter.payroll = payroll;
    }

    if (month) {
      filter.month = Number(month);
    }

    if (year) {
      filter.year = Number(year);
    }

    if (status) {
      filter.status = status;
    }

    if (search?.trim()) {
      filter.payslipNumber = {
        $regex: search.trim(),
        $options: "i",
      };
    }

    const [data, total] =
      await Promise.all([
        Payslip.find(filter)
          .populate(
            "employee",
            "employeeCode firstName lastName email department designation"
          )
          .populate(
            "payroll"
          )
          .populate(
            "salaryStructure"
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

        Payslip.countDocuments(filter),
      ]);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages:
          Math.ceil(total / limitNumber) || 0,
      },
    });
  } catch (error) {
    console.error(
      "GET PAYSLIPS ERROR:",
      error
    );

    res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch payslips",
    });
  }
};

/* ======================================================
   GET PAYSLIP BY ID
   GET /api/hr/payslips/:id
====================================================== */

export const getPayslipById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    validateObjectId(
      id,
      "payslip ID"
    );

    const payslip =
      await Payslip.findOne({
        _id: id,
        ...getOrganizationFilter(req.user),
      })
        .populate(
          "employee",
          "employeeCode firstName lastName email phone department designation"
        )
        .populate("payroll")
        .populate("salaryStructure")
        .populate(
          "approvedBy",
          "name email"
        )
        .lean();

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payslip,
    });
  } catch (error) {
    console.error(
      "GET PAYSLIP BY ID ERROR:",
      error
    );

    res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch payslip",
    });
  }
};

/* ======================================================
   CREATE PAYSLIP
   POST /api/hr/payslips
====================================================== */

export const createPayslip = async (
  req,
  res
) => {
  try {
    const data = req.body;

    if (!data.payslipNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Payslip number is required",
      });
    }

    if (!data.employee) {
      return res.status(400).json({
        success: false,
        message:
          "Employee is required",
      });
    }

    if (!data.payroll) {
      return res.status(400).json({
        success: false,
        message:
          "Payroll is required",
      });
    }

    if (!data.month || !data.year) {
      return res.status(400).json({
        success: false,
        message:
          "Month and year are required",
      });
    }

    validateObjectId(
      data.employee,
      "employee ID"
    );

    validateObjectId(
      data.payroll,
      "payroll ID"
    );

    if (data.salaryStructure) {
      validateObjectId(
        data.salaryStructure,
        "salary structure ID"
      );
    }

    const organizationFilter =
      getOrganizationFilter(req.user);

    const employee =
      await Employee.findOne({
        _id: data.employee,
        ...organizationFilter,
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const payroll =
      await Payroll.findOne({
        _id: data.payroll,
        ...organizationFilter,
      });

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    const existing =
      await Payslip.findOne({
        employee: data.employee,
        month: Number(data.month),
        year: Number(data.year),
        ...organizationFilter,
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "Payslip already exists for this employee and month",
        data: existing,
      });
    }

    const payslip =
      await Payslip.create({
        ...data,
        organization:
          employee.organization ||
          req.user?.organization ||
          null,
      });

    const populated =
      await Payslip.findById(
        payslip._id
      )
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .populate("payroll")
        .populate("salaryStructure");

    res.status(201).json({
      success: true,
      message:
        "Payslip created successfully",
      data: populated,
    });
  } catch (error) {
    console.error(
      "CREATE PAYSLIP ERROR:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Payslip already exists for this employee and month",
      });
    }

    res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to create payslip",
    });
  }
};

/* ======================================================
   CREATE PAYSLIP FROM PAYROLL
   POST /api/hr/payslips/from-payroll/:payrollId
====================================================== */

export const createPayslipFromPayroll =
  async (req, res) => {
    try {
      const { payrollId } =
        req.params;

      validateObjectId(
        payrollId,
        "payroll ID"
      );

      const organizationFilter =
        getOrganizationFilter(req.user);

      const payroll =
        await Payroll.findOne({
          _id: payrollId,
          ...organizationFilter,
        })
          .populate(
            "employee"
          )
          .populate(
            "salaryStructure"
          )
          .lean();

      if (!payroll) {
        return res.status(404).json({
          success: false,
          message: "Payroll not found",
        });
      }

      if (!payroll.employee) {
        return res.status(400).json({
          success: false,
          message:
            "Employee is not assigned to this payroll",
        });
      }

      const employee =
        await Employee.findById(
          payroll.employee._id
        ).lean();

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }

      let salaryStructure =
        payroll.salaryStructure;

      if (
        !salaryStructure &&
        employee.salaryStructure
      ) {
        salaryStructure =
          await SalaryStructure.findById(
            employee.salaryStructure
          ).lean();
      }

      const month =
        Number(payroll.month);

      const year =
        Number(payroll.year);

      if (
        !month ||
        month < 1 ||
        month > 12 ||
        !year
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid payroll month and year are required",
        });
      }

      const existing =
        await Payslip.findOne({
          employee:
            employee._id,
          month,
          year,
          ...organizationFilter,
        });

      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            "Payslip already exists for this employee and payroll period",
          data: existing,
        });
      }

      const startDate =
        new Date(
          year,
          month - 1,
          1
        );

      const endDate =
        new Date(
          year,
          month,
          0
        );

      const employeeCode =
        employee.employeeCode ||
        "EMP";

      const payslipNumber =
        await generatePayslipNumber(
          employeeCode,
          month,
          year
        );

      /*
       * Payroll field names can vary.
       * We support the common fields used
       * in your current Payroll module.
       */

      const grossSalary =
        Number(
          payroll.grossSalary ??
            salaryStructure?.grossSalary ??
            0
        );

      const totalDeductions =
        Number(
          payroll.totalDeductions ??
            salaryStructure?.totalDeductions ??
            0
        );

      const netSalary =
        Number(
          payroll.netSalary ??
            salaryStructure?.netSalary ??
            grossSalary -
              totalDeductions
        );

      const earnings = {
        basicSalary: Number(
          payroll.basicSalary ??
            payroll.earnings?.basicSalary ??
            salaryStructure?.basicSalary ??
            0
        ),

        hra: Number(
          payroll.hra ??
            payroll.earnings?.hra ??
            salaryStructure?.hra ??
            0
        ),

        conveyanceAllowance:
          Number(
            payroll.conveyanceAllowance ??
              payroll.earnings
                ?.conveyanceAllowance ??
              salaryStructure?.conveyanceAllowance ??
              0
          ),

        medicalAllowance:
          Number(
            payroll.medicalAllowance ??
              payroll.earnings
                ?.medicalAllowance ??
              salaryStructure?.medicalAllowance ??
              0
          ),

        specialAllowance:
          Number(
            payroll.specialAllowance ??
              payroll.earnings
                ?.specialAllowance ??
              salaryStructure?.specialAllowance ??
              0
          ),

        otherAllowances:
          Number(
            payroll.otherAllowances ??
              payroll.earnings
                ?.otherAllowances ??
              salaryStructure?.otherAllowances ??
              0
          ),

        overtimeAmount: Number(
          payroll.overtimeAmount ??
            0
        ),

        bonus: Number(
          payroll.bonus ?? 0
        ),

        incentives: Number(
          payroll.incentives ?? 0
        ),

        otherEarnings: Number(
          payroll.otherEarnings ?? 0
        ),

        grossSalary,
      };

      const deductions = {
        providentFund: Number(
          payroll.providentFund ??
            payroll.deductions
              ?.providentFund ??
            salaryStructure?.providentFund ??
            0
        ),

        professionalTax:
          Number(
            payroll.professionalTax ??
              payroll.deductions
                ?.professionalTax ??
              salaryStructure?.professionalTax ??
              0
          ),

        incomeTax: Number(
          payroll.incomeTax ??
            payroll.deductions
              ?.incomeTax ??
            0
        ),

        loanDeduction:
          Number(
            payroll.loanDeduction ??
              payroll.deductions
                ?.loanDeduction ??
              0
          ),

        leaveDeduction:
          Number(
            payroll.leaveDeduction ??
              payroll.deductions
                ?.leaveDeduction ??
              0
          ),

        otherDeductions:
          Number(
            payroll.otherDeductions ??
              payroll.deductions
                ?.otherDeductions ??
              salaryStructure?.otherDeductions ??
              0
          ),

        totalDeductions,
      };

      const attendance = {
        workingDays: Number(
          payroll.workingDays ??
            payroll.attendance
              ?.workingDays ??
            0
        ),

        presentDays: Number(
          payroll.presentDays ??
            payroll.attendance
              ?.presentDays ??
            0
        ),

        absentDays: Number(
          payroll.absentDays ??
            payroll.attendance
              ?.absentDays ??
            0
        ),

        leaveDays: Number(
          payroll.leaveDays ??
            payroll.attendance
              ?.leaveDays ??
            0
        ),

        paidLeaveDays: Number(
          payroll.paidLeaveDays ??
            payroll.attendance
              ?.paidLeaveDays ??
            0
        ),

        unpaidLeaveDays: Number(
          payroll.unpaidLeaveDays ??
            payroll.attendance
              ?.unpaidLeaveDays ??
            0
        ),

        overtimeMinutes: Number(
          payroll.overtimeMinutes ??
            payroll.attendance
              ?.overtimeMinutes ??
            0
        ),
      };

      const payslip =
        await Payslip.create({
          payslipNumber,

          employee:
            employee._id,

          payroll:
            payroll._id,

          salaryStructure:
            salaryStructure?._id ||
            employee.salaryStructure ||
            null,

          month,

          year,

          payPeriod: {
            startDate,
            endDate,
          },

          attendance,

          earnings,

          deductions,

          netSalary,

          paymentDetails: {
            paymentMethod:
              "Bank Transfer",
          },

          status: "Generated",

          generatedAt: new Date(),

          notes:
            `${startDate.toLocaleString(
              "en-US",
              { month: "long" }
            )} ${year} salary`,

          organization:
            employee.organization ||
            req.user?.organization ||
            null,
        });

      const populated =
        await Payslip.findById(
          payslip._id
        )
          .populate(
            "employee",
            "employeeCode firstName lastName email department designation"
          )
          .populate("payroll")
          .populate(
            "salaryStructure"
          );

      res.status(201).json({
        success: true,
        message:
          "Payslip created from payroll successfully",
        data: populated,
      });
    } catch (error) {
      console.error(
        "CREATE PAYSLIP FROM PAYROLL ERROR:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Payslip already exists for this employee and payroll period",
        });
      }

      res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to create payslip from payroll",
      });
    }
  };

/* ======================================================
   UPDATE PAYSLIP
   PUT /api/hr/payslips/:id
====================================================== */

export const updatePayslip = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    validateObjectId(
      id,
      "payslip ID"
    );

    const existing =
      await Payslip.findOne({
        _id: id,
        ...getOrganizationFilter(req.user),
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    if (
      existing.status === "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Paid payslip cannot be modified",
      });
    }

    const allowedFields = [
      "attendance",
      "earnings",
      "deductions",
      "netSalary",
      "paymentDetails",
      "notes",
      "pdfUrl",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (
        req.body[field] !==
        undefined
      ) {
        updateData[field] =
          req.body[field];
      }
    }

    const updated =
      await Payslip.findByIdAndUpdate(
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
          "employeeCode firstName lastName email department designation"
        )
        .populate("payroll")
        .populate(
          "salaryStructure"
        );

    res.status(200).json({
      success: true,
      message:
        "Payslip updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYSLIP ERROR:",
      error
    );

    res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to update payslip",
    });
  }
};

/* ======================================================
   UPDATE PAYSLIP STATUS
   PATCH /api/hr/payslips/:id/status
====================================================== */

export const updatePayslipStatus =
  async (req, res) => {
    try {
      const { id } =
        req.params;

      const { status } =
        req.body;

      validateObjectId(
        id,
        "payslip ID"
      );

      const allowedStatuses = [
        "Draft",
        "Generated",
        "Approved",
        "Paid",
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
            "Invalid payslip status",
        });
      }

      const payslip =
        await Payslip.findOne({
          _id: id,
          ...getOrganizationFilter(
            req.user
          ),
        });

      if (!payslip) {
        return res.status(404).json({
          success: false,
          message:
            "Payslip not found",
        });
      }

      if (
        payslip.status ===
          "Paid" &&
        status !== "Cancelled"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Paid payslip status cannot be changed",
        });
      }

      const update = {
        status,
      };

      if (status === "Generated") {
        update.generatedAt =
          payslip.generatedAt ||
          new Date();
      }

      if (status === "Approved") {
        update.approvedBy =
          req.user?._id ||
          req.user?.id ||
          null;

        update.approvedAt =
          new Date();
      }

      if (status === "Paid") {
        update["paymentDetails.paymentDate"] =
          req.body.paymentDate
            ? new Date(
                req.body.paymentDate
              )
            : new Date();

        if (
          req.body.paymentMethod
        ) {
          update[
            "paymentDetails.paymentMethod"
          ] =
            req.body.paymentMethod;
        }

        if (
          req.body.transactionReference
        ) {
          update[
            "paymentDetails.transactionReference"
          ] =
            req.body.transactionReference;
        }

        if (req.body.bankName) {
          update[
            "paymentDetails.bankName"
          ] =
            req.body.bankName;
        }

        if (
          req.body.accountLastFourDigits
        ) {
          update[
            "paymentDetails.accountLastFourDigits"
          ] =
            req.body.accountLastFourDigits;
        }
      }

      const updated =
        await Payslip.findByIdAndUpdate(
          id,
          {
            $set: update,
          },
          {
            new: true,
            runValidators: true,
          }
        )
          .populate(
            "employee",
            "employeeCode firstName lastName email department designation"
          )
          .populate("payroll")
          .populate(
            "salaryStructure"
          )
          .populate(
            "approvedBy",
            "name email"
          );

      res.status(200).json({
        success: true,
        message:
          `Payslip ${status.toLowerCase()} successfully`,
        data: updated,
      });
    } catch (error) {
      console.error(
        "UPDATE PAYSLIP STATUS ERROR:",
        error
      );

      res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to update payslip status",
      });
    }
  };

/* ======================================================
   DELETE PAYSLIP
   DELETE /api/hr/payslips/:id
====================================================== */

export const deletePayslip = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    validateObjectId(
      id,
      "payslip ID"
    );

    const payslip =
      await Payslip.findOne({
        _id: id,
        ...getOrganizationFilter(req.user),
      });

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    if (
      payslip.status === "Paid"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Paid payslip cannot be deleted",
      });
    }

    await Payslip.deleteOne({
      _id: id,
    });

    res.status(200).json({
      success: true,
      message:
        "Payslip deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PAYSLIP ERROR:",
      error
    );

    res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to delete payslip",
    });
  }
};

/* ======================================================
   GET EMPLOYEE PAYSLIPS
   GET /api/hr/payslips/employee/:employeeId
====================================================== */

export const getEmployeePayslips =
  async (req, res) => {
    try {
      const {
        employeeId,
      } = req.params;

      validateObjectId(
        employeeId,
        "employee ID"
      );

      const {
        page = 1,
        limit = 20,
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

      const filter = {
        employee: employeeId,
        ...getOrganizationFilter(
          req.user
        ),
      };

      const [data, total] =
        await Promise.all([
          Payslip.find(filter)
            .populate(
              "employee",
              "employeeCode firstName lastName email department designation"
            )
            .populate(
              "salaryStructure"
            )
            .sort({
              year: -1,
              month: -1,
            })
            .skip(skip)
            .limit(limitNumber)
            .lean(),

          Payslip.countDocuments(
            filter
          ),
        ]);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages:
            Math.ceil(
              total /
                limitNumber
            ) || 0,
        },
      });
    } catch (error) {
      console.error(
        "GET EMPLOYEE PAYSLIPS ERROR:",
        error
      );

      res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch employee payslips",
      });
    }
  };