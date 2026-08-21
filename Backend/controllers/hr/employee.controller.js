
import mongoose from "mongoose";
import Employee from "../../models/hr/Employee.js";
// ======================================================
// GET ALL EMPLOYEES
// ======================================================

export const getEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      department,
      status,
    } = req.query;

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const filter = {};

    if (search) {
      filter.$or = [
        {
          firstName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          employeeId: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (department) {
      filter.department = department;
    }

    if (status) {
      filter.status = status;
    }

    const [employees, total] =
      await Promise.all([
        Employee.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        Employee.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      data: employees,
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
      "GET EMPLOYEES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch employees",
    });
  }
};


// ======================================================
// GET EMPLOYEE BY ID
// ======================================================

export const getEmployeeById = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.findById(
        req.params.id
      ).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error(
      "GET EMPLOYEE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch employee",
    });
  }
};


// ======================================================
// CREATE EMPLOYEE
// ======================================================

export const createEmployee = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.create(req.body);

    return res.status(201).json({
      success: true,
      message:
        "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    console.error(
      "CREATE EMPLOYEE ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Employee ID or email already exists",
        error: error.keyValue,
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create employee",
    });
  }
};


// ======================================================
// UPDATE EMPLOYEE
// ======================================================



export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const allowedFields = [
      "user",
      "employeeCode",
      "firstName",
      "lastName",
      "email",
      "phone",
      "dateOfBirth",
      "gender",
      "dateOfJoining",
      "dateOfLeaving",
      "department",
      "designation",
      "employmentType",
      "status",
      "reportingManager",
      "shift",
      "salaryStructure",
      "address",
      "emergencyContact",
      "bankDetails",
      "documents",
      "notes",
      "organization",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    }

    await employee.save();

    const updatedEmployee = await Employee.findById(id)
      .populate("user", "name email")
      .populate("salaryStructure")
      .populate("reportingManager", "employeeCode firstName lastName")
      .populate("shift");

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error("UPDATE EMPLOYEE ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to update employee",
    });
  }
};


// ======================================================
// DELETE EMPLOYEE
// ======================================================

export const deleteEmployee = async (
  req,
  res
) => {
  try {
    const employee =
      await Employee.findByIdAndDelete(
        req.params.id
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Employee deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE EMPLOYEE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete employee",
    });
  }
};