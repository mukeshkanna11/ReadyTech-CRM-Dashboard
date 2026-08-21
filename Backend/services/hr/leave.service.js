const Leave = require("../../models/Leave");
const Employee = require("../../models/Employee");

// ======================================================
// APPLY LEAVE
// ======================================================

const applyLeave = async (data) => {
  const {
    employee,
    startDate,
    endDate,
  } = data;

  const employeeExists = await Employee.findById(employee);

  if (!employeeExists) {
    throw new Error("Employee not found");
  }

  if (
    new Date(startDate) >
    new Date(endDate)
  ) {
    throw new Error(
      "Start date cannot be after end date"
    );
  }

  const overlappingLeave = await Leave.findOne({
    employee,
    status: {
      $in: ["Pending", "Approved"],
    },
    startDate: {
      $lte: new Date(endDate),
    },
    endDate: {
      $gte: new Date(startDate),
    },
  });

  if (overlappingLeave) {
    throw new Error(
      "Employee already has leave for the selected dates"
    );
  }

  return await Leave.create(data);
};


// ======================================================
// GET LEAVES
// ======================================================

const getLeaves = async (query = {}) => {
  const {
    employee,
    status,
    leaveType,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = query;

  const filter = {};

  if (employee) filter.employee = employee;
  if (status) filter.status = status;
  if (leaveType) filter.leaveType = leaveType;

  if (startDate || endDate) {
    filter.startDate = {};

    if (startDate) {
      filter.startDate.$gte = new Date(startDate);
    }

    if (endDate) {
      filter.startDate.$lte = new Date(endDate);
    }
  }

  const skip =
    (Number(page) - 1) *
    Number(limit);

  const [leaves, total] =
    await Promise.all([
      Leave.find(filter)
        .populate(
          "employee",
          "firstName lastName employeeId department"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      Leave.countDocuments(filter),
    ]);

  return {
    leaves,
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
// GET LEAVE BY ID
// ======================================================

const getLeaveById = async (leaveId) => {
  const leave = await Leave.findById(
    leaveId
  ).populate(
    "employee",
    "firstName lastName employeeId department designation"
  );

  if (!leave) {
    throw new Error("Leave request not found");
  }

  return leave;
};


// ======================================================
// UPDATE LEAVE
// ======================================================

const updateLeave = async (
  leaveId,
  data
) => {
  const leave = await Leave.findByIdAndUpdate(
    leaveId,
    data,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!leave) {
    throw new Error("Leave request not found");
  }

  return leave;
};


// ======================================================
// APPROVE / REJECT LEAVE
// ======================================================

const updateLeaveStatus = async (
  leaveId,
  status,
  approvedBy = null,
  rejectionReason = null
) => {
  const leave = await Leave.findById(
    leaveId
  );

  if (!leave) {
    throw new Error("Leave request not found");
  }

  const allowedStatuses = [
    "Pending",
    "Approved",
    "Rejected",
    "Cancelled",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      "Invalid leave status"
    );
  }

  leave.status = status;

  if (approvedBy) {
    leave.approvedBy = approvedBy;
  }

  if (
    rejectionReason &&
    status === "Rejected"
  ) {
    leave.rejectionReason =
      rejectionReason;
  }

  await leave.save();

  return leave;
};


// ======================================================
// CANCEL LEAVE
// ======================================================

const cancelLeave = async (leaveId) => {
  const leave = await Leave.findById(
    leaveId
  );

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (leave.status === "Rejected") {
    throw new Error(
      "Rejected leave cannot be cancelled"
    );
  }

  leave.status = "Cancelled";

  await leave.save();

  return leave;
};


// ======================================================
// DELETE LEAVE
// ======================================================

const deleteLeave = async (leaveId) => {
  const leave =
    await Leave.findByIdAndDelete(
      leaveId
    );

  if (!leave) {
    throw new Error(
      "Leave request not found"
    );
  }

  return leave;
};


// ======================================================
// LEAVE SUMMARY
// ======================================================

const getLeaveSummary = async (
  employeeId,
  year
) => {
  const start = new Date(
    `${year}-01-01`
  );

  const end = new Date(
    `${Number(year) + 1}-01-01`
  );

  const leaves = await Leave.find({
    employee: employeeId,
    startDate: {
      $gte: start,
      $lt: end,
    },
    status: "Approved",
  });

  const summary = {
    totalRequests: leaves.length,
    totalDays: 0,
    approved: leaves.length,
  };

  leaves.forEach((leave) => {
    const startDate =
      new Date(leave.startDate);

    const endDate =
      new Date(leave.endDate);

      .
    const days =
      Math.floor(
        (
          endDate -
          startDate
        ) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    summary.totalDays += days;
  });

  return summary;
};

  

module.exports = {
  applyLeave,
  getLeaves,
  getLeaveById,
  updateLeave,
  updateLeaveStatus,
  cancelLeave,
  deleteLeave,
  getLeaveSummary,
};             