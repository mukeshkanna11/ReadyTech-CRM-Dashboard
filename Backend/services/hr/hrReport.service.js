const Employee = require("../../models/Employee");
const Attendance = require("../../models/Attendance");
const Leave = require("../../models/Leave");
const Payroll = require("../../models/Payroll");
const EmployeeExpense = require("../../models/EmployeeExpense");
const Performance = require("../../models/Performance");

// ======================================================
// HR DASHBOARD
// ======================================================

const getHRDashboard = async () => {
  const today = new Date();

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    presentToday,
    absentToday,
    onLeaveToday,
    pendingLeaves,
    pendingExpenses,
  ] = await Promise.all([
    Employee.countDocuments(),

    Employee.countDocuments({
      status: "Active",
    }),

    Employee.countDocuments({
      status: "Inactive",
    }),

    Attendance.countDocuments({
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: "Present",
    }),

    Attendance.countDocuments({
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: "Absent",
    }),

    Leave.countDocuments({
      status: "Approved",
      startDate: {
        $lte: endOfDay,
      },
      endDate: {
        $gte: startOfDay,
      },
    }),

    Leave.countDocuments({
      status: "Pending",
    }),

    EmployeeExpense.countDocuments({
      status: "Pending",
    }),
  ]);

  return {
    employees: {
      total: totalEmployees,
      active: activeEmployees,
      inactive: inactiveEmployees,
    },

    attendance: {
      presentToday,
      absentToday,
      onLeaveToday,
    },

    leaves: {
      pending: pendingLeaves,
    },

    expenses: {
      pending: pendingExpenses,
    },
  };
};


// ======================================================
// ATTENDANCE REPORT
// ======================================================

const getAttendanceReport = async (
  startDate,
  endDate
) => {
  const filter = {};

  if (startDate || endDate) {
    filter.date = {};

    if (startDate) {
      filter.date.$gte =
        new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(
        23,
        59,
        59,
        999
      );

      filter.date.$lte = end;
    }
  }

  const records =
    await Attendance.find(
      filter
    ).populate(
      "employee",
      "firstName lastName employeeId department"
    );

  const summary = {
    total: records.length,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    leave: 0,
  };

  records.forEach(
    (record) => {
      const status =
        String(
          record.status || ""
        ).toLowerCase();

      if (status === "present")
        summary.present++;

      if (status === "absent")
        summary.absent++;

      if (status === "late")
        summary.late++;

      if (
        status === "halfday" ||
        status === "half-day"
      ) {
        summary.halfDay++;
      }

      if (status === "leave")
        summary.leave++;
    }
  );

  return {
    summary,
    records,
  };
};


// ======================================================
// LEAVE REPORT
// ======================================================

const getLeaveReport = async (
  startDate,
  endDate
) => {
  const filter = {};

  if (startDate || endDate) {
    filter.startDate = {};

    if (startDate) {
      filter.startDate.$gte =
        new Date(startDate);
    }

    if (endDate) {
      filter.startDate.$lte =
        new Date(endDate);
    }
  }

  const leaves =
    await Leave.find(
      filter
    ).populate(
      "employee",
      "firstName lastName employeeId department"
    );

  const summary = {
    total: leaves.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };

  leaves.forEach(
    (leave) => {
      const status =
        String(
          leave.status || ""
        ).toLowerCase();

      if (status === "pending")
        summary.pending++;

      if (status === "approved")
        summary.approved++;

      if (status === "rejected")
        summary.rejected++;

      if (status === "cancelled")
        summary.cancelled++;
    }
  );

  return {
    summary,
    leaves,
  };
};


// ======================================================
// PAYROLL REPORT
// ======================================================

const getPayrollReport = async (
  month,
  year
) => {
  const payrolls =
    await Payroll.find({
      month,
      year,
    }).populate(
      "employee",
      "firstName lastName employeeId department designation"
    );

  const summary = {
    employees:
      payrolls.length,

    grossSalary: 0,

    deductions: 0,

    netSalary: 0,
  };

  payrolls.forEach(
    (payroll) => {
      summary.grossSalary +=
        Number(
          payroll.grossSalary || 0
        );

      summary.deductions +=
        Number(
          payroll.deductions || 0
        );

      summary.netSalary +=
        Number(
          payroll.netSalary || 0
        );
    }
  );

  return {
    summary,
    payrolls,
  };
};


// ======================================================
// EXPENSE REPORT
// ======================================================

const getExpenseReport = async (
  startDate,
  endDate
) => {
  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      filter.createdAt.$gte =
        new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);

      end.setHours(
        23,
        59,
        59,
        999
      );

      filter.createdAt.$lte =
        end;
    }
  }

  const expenses =
    await EmployeeExpense.find(
      filter
    ).populate(
      "employee",
      "firstName lastName employeeId department"
    );

  const summary = {
    totalExpenses:
      expenses.length,

    pending: 0,

    approved: 0,

    rejected: 0,

    totalAmount: 0,

    approvedAmount: 0,
  };

  expenses.forEach(
    (expense) => {
      const status =
        String(
          expense.status || ""
        ).toLowerCase();

      const amount =
        Number(
          expense.amount || 0
        );

      summary.totalAmount += amount;

      if (status === "pending")
        summary.pending++;

      if (status === "approved") {
        summary.approved++;
        summary.approvedAmount +=
          amount;
      }

      if (status === "rejected")
        summary.rejected++;
    }
  );

  return {
    summary,
    expenses,
  };
};


// ======================================================
// DEPARTMENT REPORT
// ======================================================

const getDepartmentReport =
  async () => {
    const employees =
      await Employee.find({
        status: "Active",
      }).select(
        "department"
      );

    const departments = {};

    employees.forEach(
      (employee) => {
        const department =
          employee.department ||
          "Unassigned";

        if (
          !departments[department]
        ) {
          departments[department] = 0;
        }

        departments[department]++;
      }
    );

    return Object.entries(
      departments
    ).map(
      ([department, count]) => ({
        department,
        employees: count,
      })
    );
  };


// ======================================================
// PERFORMANCE REPORT
// ======================================================

const getPerformanceReport =
  async (year) => {
    const filter = {};

    if (year) {
      filter.year = year;
    }

    const performances =
      await Performance.find(
        filter
      ).populate(
        "employee",
        "firstName lastName employeeId department designation"
      );

    return performances;
  };


module.exports = {
  getHRDashboard,
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  getExpenseReport,
  getDepartmentReport,
  getPerformanceReport,
};