import mongoose from "mongoose";

import SalaryStructure from "../../models/hr/SalaryStructure.js";
import Employee from "../../models/hr/Employee.js";

// ======================================================
// HELPERS
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const allowedStatuses = [
  "Active",
  "Inactive",
];

// ======================================================
// CALCULATE GROSS SALARY
// ======================================================

const calculateGross = (data) => {
  return (
    Number(data.basicSalary || 0) +
    Number(data.hra || 0) +
    Number(
      data.conveyanceAllowance || 0
    ) +
    Number(
      data.medicalAllowance || 0
    ) +
    Number(
      data.specialAllowance || 0
    ) +
    Number(
      data.otherAllowances || 0
    )
  );
};

// ======================================================
// CALCULATE TOTAL DEDUCTIONS
// ======================================================

const calculateDeductions = (
  data
) => {
  return (
    Number(
      data.providentFund || 0
    ) +
    Number(
      data.professionalTax || 0
    ) +
    Number(
      data.otherDeductions || 0
    )
  );
};

// ======================================================
// CALCULATE SALARY
// ======================================================

const calculateSalary = (
  data
) => {
  const grossSalary =
    calculateGross(data);

  const totalDeductions =
    calculateDeductions(data);

  const netSalary =
    grossSalary -
    totalDeductions;

  return {
    grossSalary,
    totalDeductions,
    netSalary,
  };
};

// ======================================================
// GET ALL SALARY STRUCTURES
// GET /api/hr/salary-structures
// ======================================================

export const getSalaryStructures =
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search = "",
        status,
        organization,
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
      // STATUS
      // ==================================================

      if (status) {
        if (
          !allowedStatuses.includes(
            status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid salary structure status",
          });
        }

        query.status = status;
      }

      // ==================================================
      // SEARCH
      // ==================================================

      if (search.trim()) {
        query.name = {
          $regex:
            search.trim(),
          $options: "i",
        };
      }

      // ==================================================
      // FETCH
      // ==================================================

      const [
        structures,
        total,
      ] = await Promise.all([
        SalaryStructure.find(query)
          .sort({
            effectiveFrom: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        SalaryStructure.countDocuments(
          query
        ),
      ]);

      // ==================================================
      // ADD CALCULATED VALUES
      // ==================================================

      const data =
        structures.map(
          (structure) => ({
            ...structure,
            ...calculateSalary(
              structure
            ),
          })
        );

      return res.status(200).json({
        success: true,

        data,

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
        "GET SALARY STRUCTURES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch salary structures",
      });
    }
  };

// ======================================================
// GET SALARY STRUCTURE BY ID
// GET /api/hr/salary-structures/:id
// ======================================================

export const getSalaryStructureById =
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
            "Invalid salary structure ID",
        });
      }

      const structure =
        await SalaryStructure.findById(
          id
        ).lean();

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      const salary =
        calculateSalary(
          structure
        );

      // ==================================================
      // ACTIVE EMPLOYEE COUNT
      // ==================================================

      const activeEmployeeCount =
        await Employee.countDocuments(
          {
            salaryStructure: id,
            status: "Active",
          }
        );

      return res.status(200).json({
        success: true,

        data: {
          ...structure,

          ...salary,

          activeEmployeeCount,
        },
      });
    } catch (error) {
      console.error(
        "GET SALARY STRUCTURE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch salary structure",
      });
    }
  };

// ======================================================
// CREATE SALARY STRUCTURE
// POST /api/hr/salary-structures
// ======================================================

export const createSalaryStructure =
  async (req, res) => {
    try {
      const {
        name,
        basicSalary,
        hra = 0,
        conveyanceAllowance = 0,
        medicalAllowance = 0,
        specialAllowance = 0,
        otherAllowances = 0,
        providentFund = 0,
        professionalTax = 0,
        otherDeductions = 0,
        effectiveFrom,
        status = "Active",
        organization,
      } = req.body;

      // ==================================================
      // REQUIRED
      // ==================================================

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Salary structure name is required",
        });
      }

      if (
        basicSalary ===
        undefined ||
        basicSalary ===
        null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Basic salary is required",
        });
      }

      if (!effectiveFrom) {
        return res.status(400).json({
          success: false,
          message:
            "Effective from date is required",
        });
      }

      // ==================================================
      // BASIC SALARY
      // ==================================================

      const parsedBasic =
        Number(basicSalary);

      if (
        Number.isNaN(
          parsedBasic
        ) ||
        parsedBasic < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid basic salary",
        });
      }

      // ==================================================
      // STATUS
      // ==================================================

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid salary structure status",
        });
      }

      // ==================================================
      // DATE VALIDATION
      // ==================================================

      const effectiveDate =
        new Date(
          effectiveFrom
        );

      if (
        Number.isNaN(
          effectiveDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid effective from date",
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
      // NORMALIZE NUMBERS
      // ==================================================

      const numberFields = {
        hra,
        conveyanceAllowance,
        medicalAllowance,
        specialAllowance,
        otherAllowances,
        providentFund,
        professionalTax,
        otherDeductions,
      };

      for (
        const [
          field,
          value,
        ] of Object.entries(
          numberFields
        )
      ) {
        const parsed =
          Number(value);

        if (
          Number.isNaN(parsed) ||
          parsed < 0
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${field}`,
          });
        }

        numberFields[field] =
          parsed;
      }

      // ==================================================
      // CREATE
      // ==================================================

      const structure =
        await SalaryStructure.create(
          {
            name: name.trim(),

            basicSalary:
              parsedBasic,

            hra:
              numberFields.hra,

            conveyanceAllowance:
              numberFields.conveyanceAllowance,

            medicalAllowance:
              numberFields.medicalAllowance,

            specialAllowance:
              numberFields.specialAllowance,

            otherAllowances:
              numberFields.otherAllowances,

            providentFund:
              numberFields.providentFund,

            professionalTax:
              numberFields.professionalTax,

            otherDeductions:
              numberFields.otherDeductions,

            effectiveFrom:
              effectiveDate,

            status,

            organization:
              organizationId,
          }
        );

      const data =
        structure.toObject();

      return res.status(201).json({
        success: true,

        message:
          "Salary structure created successfully",

        data: {
          ...data,
          ...calculateSalary(
            data
          ),
        },
      });
    } catch (error) {
      console.error(
        "CREATE SALARY STRUCTURE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to create salary structure",
      });
    }
  };

// ======================================================
// UPDATE SALARY STRUCTURE
// PUT /api/hr/salary-structures/:id
// ======================================================

export const updateSalaryStructure =
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
            "Invalid salary structure ID",
        });
      }

      const structure =
        await SalaryStructure.findById(
          id
        );

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      const allowedFields = [
        "name",
        "basicSalary",
        "hra",
        "conveyanceAllowance",
        "medicalAllowance",
        "specialAllowance",
        "otherAllowances",
        "providentFund",
        "professionalTax",
        "otherDeductions",
        "effectiveFrom",
        "status",
      ];

      const updateData = {};

      for (
        const field of allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          updateData[field] =
            req.body[field];
        }
      }

      // ==================================================
      // NAME
      // ==================================================

      if (
        updateData.name !==
        undefined
      ) {
        if (
          !String(
            updateData.name
          ).trim()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Salary structure name cannot be empty",
          });
        }

        updateData.name =
          String(
            updateData.name
          ).trim();
      }

      // ==================================================
      // NUMBERS
      // ==================================================

      const numberFields = [
        "basicSalary",
        "hra",
        "conveyanceAllowance",
        "medicalAllowance",
        "specialAllowance",
        "otherAllowances",
        "providentFund",
        "professionalTax",
        "otherDeductions",
      ];

      for (
        const field of numberFields
      ) {
        if (
          updateData[field] !==
          undefined
        ) {
          const value =
            Number(
              updateData[field]
            );

          if (
            Number.isNaN(
              value
            ) ||
            value < 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Invalid value for ${field}`,
            });
          }

          updateData[field] =
            value;
        }
      }

      // ==================================================
      // STATUS
      // ==================================================

      if (
        updateData.status !==
        undefined
      ) {
        if (
          !allowedStatuses.includes(
            updateData.status
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid salary structure status",
          });
        }
      }

      // ==================================================
      // EFFECTIVE DATE
      // ==================================================

      if (
        updateData.effectiveFrom !==
        undefined
      ) {
        const date =
          new Date(
            updateData.effectiveFrom
          );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid effective from date",
          });
        }

        updateData.effectiveFrom =
          date;
      }

      // ==================================================
      // UPDATE
      // ==================================================

      const updated =
        await SalaryStructure.findByIdAndUpdate(
          id,
          {
            $set: updateData,
          },
          {
            new: true,
            runValidators: true,
          }
        );

      const data =
        updated.toObject();

      return res.status(200).json({
        success: true,

        message:
          "Salary structure updated successfully",

        data: {
          ...data,
          ...calculateSalary(
            data
          ),
        },
      });
    } catch (error) {
      console.error(
        "UPDATE SALARY STRUCTURE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update salary structure",
      });
    }
  };

// ======================================================
// TOGGLE STATUS
// PATCH /api/hr/salary-structures/:id/status
// ======================================================

export const toggleSalaryStructureStatus =
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
            "Invalid salary structure ID",
        });
      }

      const structure =
        await SalaryStructure.findById(
          id
        );

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      structure.status =
        structure.status ===
        "Active"
          ? "Inactive"
          : "Active";

      await structure.save();

      return res.status(200).json({
        success: true,

        message:
          structure.status ===
          "Active"
            ? "Salary structure activated successfully"
            : "Salary structure deactivated successfully",

        data: structure,
      });
    } catch (error) {
      console.error(
        "TOGGLE SALARY STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to update salary structure status",
      });
    }
  };

// ======================================================
// GET ASSIGNED EMPLOYEES
// GET /api/hr/salary-structures/:id/employees
// ======================================================

export const getSalaryStructureEmployees =
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
            "Invalid salary structure ID",
        });
      }

      const structure =
        await SalaryStructure.findById(
          id
        )
          .select(
            "name basicSalary status effectiveFrom"
          )
          .lean();

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      const employees =
        await Employee.find({
          salaryStructure: id,
        })
          .select(
            "employeeCode firstName lastName email department designation employmentType status"
          )
          .sort({
            firstName: 1,
          })
          .lean();

      return res.status(200).json({
        success: true,

        structure,

        data: employees,

        count: employees.length,
      });
    } catch (error) {
      console.error(
        "GET SALARY EMPLOYEES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch assigned employees",
      });
    }
  };

// ======================================================
// DELETE SALARY STRUCTURE
// DELETE /api/hr/salary-structures/:id
// ======================================================

export const deleteSalaryStructure =
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
            "Invalid salary structure ID",
        });
      }

      // ==================================================
      // CHECK ACTIVE EMPLOYEES
      // ==================================================

      const employeeCount =
        await Employee.countDocuments(
          {
            salaryStructure: id,
            status: "Active",
          }
        );

      if (
        employeeCount > 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Cannot delete salary structure assigned to active employees",

          activeEmployeeCount:
            employeeCount,
        });
      }

      // ==================================================
      // DELETE
      // ==================================================

      const structure =
        await SalaryStructure.findByIdAndDelete(
          id
        );

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Salary structure not found",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Salary structure deleted successfully",
      });
    } catch (error) {
      console.error(
        "DELETE SALARY STRUCTURE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete salary structure",
      });
    }
  };