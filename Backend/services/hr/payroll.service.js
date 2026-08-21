const Payroll = require("../../models/Payroll");
const Employee = require("../../models/Employee");
const Attendance = require("../../models/Attendance");

// ======================================================
// CREATE PAYROLL
// ======================================================

const createPayroll = async (data) => {
  const {
    employee,
    month,
    year,
  } = data;

  const employeeExists =
    await Employee.findById(employee);

  if (!employeeExists) {
    throw new Error("Employee not found");
  }

  const existing = await Payroll.findOne({
    employee,
    month,
    year,
  });

  if (existing) {
    throw new Error(
      "Payroll already exists for this employee and period"
    );
  }

  const payroll =
    await Payroll.create(data);

  return payroll;
};


// ======================================================
// GET PAYROLLS
// ======================================================

const getPayrolls = async (
  query = {}
) => {
  const {
    employee,
    month,
    year,
    status,
    department,
    page = 1,
    limit = 10,
  } = query;

  const filter = {};

  if (employee)
    filter.employee = employee;

  if (month)
    filter.month = month;

  if (year)
    filter.year = year;

  if (status)
    filter.status = status;

  if (department) {
    const employees =
      await Employee.find({
        department,
      }).select("_id");

    filter.employee = {
      $in: employees.map(
        (emp) => emp._id
      ),
    };
  }

  const skip =
    (Number(page) - 1) *
    Number(limit);

  const [
    payrolls,
    total,
  ] = await Promise.all([
    Payroll.find(filter)
      .populate(
        "employee",
        "firstName lastName employeeId department designation"
      )
      .sort({
        year: -1,
        month: -1,
      })
      .skip(skip)
      .limit(Number(limit)),

    Payroll.countDocuments(filter),
  ]);

  return {
    payrolls,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(
        total / Number(limit)
      ),
    },
  };
};


// ======================================================
// GET PAYROLL BY ID
// ======================================================

const getPayrollById = async (
  payrollId
) => {
  const payroll =
    await Payroll.findById(
      payrollId
    ).populate(
      "employee",
      "firstName lastName employeeId email department designation"
    );

  if (!payroll) {
    throw new Error(
      "Payroll not found"
    );
  }

  return payroll;
};


// ======================================================
// UPDATE PAYROLL
// ======================================================

const updatePayroll = async (
  payrollId,
  data
) => {
  const payroll =
    await Payroll.findByIdAndUpdate(
      payrollId,
      data,
      {
        new: true,
        runValidators: true,
      }
    );

  if (!payroll) {
    throw new Error(
      "Payroll not found"
    );
  }

  return payroll;
};


// ======================================================
// DELETE PAYROLL
// ======================================================

const deletePayroll = async (
  payrollId
) => {
  const payroll =
    await Payroll.findByIdAndDelete(
      payrollId
    );

  if (!payroll) {
    throw new Error(
      "Payroll not found"
    );
  }

  return payroll;
};


// ======================================================
// CALCULATE PAYROLL
// ======================================================

const calculatePayroll = async ({
  employeeId,
  month,
  year,
  basicSalary,
  allowances = 0,
  bonuses = 0,
  deductions = 0,
}) => {
  const employee =
    await Employee.findById(
      employeeId
    );

  if (!employee) {
    throw new Error(
      "Employee not found"
    );
  }

  const startDate = new Date(
    year,
    Number(month) - 1,
    1
  );

  const endDate = new Date(
    year,
    Number(month),
    0
  );

  const attendance =
    await Attendance.find({
      employee: employeeId,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;

  attendance.forEach(
    (record) => {
      const status = String(
        record.status || ""
      ).toLowerCase();

      if (status === "present")
        presentDays++;

      if (status === "absent")
        absentDays++;

      if (status === "leave")
        leaveDays++;
    }
  );

  const grossSalary =
    Number(basicSalary) +
    Number(allowances) +
    Number(bonuses);

  const netSalary =
    grossSalary -
    Number(deductions);

  return {
    employee: employeeId,
    month,
    year,

    basicSalary:
      Number(basicSalary),

    allowances:
      Number(allowances),

    bonuses:
      Number(bonuses),

    grossSalary,

    deductions:
      Number(deductions),

    netSalary,

    attendance: {
      presentDays,
      absentDays,
      leaveDays,
    },
  };
};


// ======================================================
// PAYROLL SUMMARY
// ======================================================

const getPayrollSummary = async (
  month,
  year
) => {
  const payrolls =
    await Payroll.find({
      month,
      year,
    });

  const summary = {
    totalEmployees:
      payrolls.length,

    grossSalary: 0,

    totalDeductions: 0,

    netSalary: 0,
  };

  payrolls.forEach(
    (payroll) => {
      summary.grossSalary +=
        Number(
          payroll.grossSalary || 0
        );

      summary.totalDeductions +=
        Number(
          payroll.deductions || 0
        );

      summary.netSalary +=
        Number(
          payroll.netSalary || 0
        );
    }
  );

  return summary;
};


module.exports = {
  createPayroll,
  getPayrolls,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  calculatePayroll,
  getPayrollSummary,
};