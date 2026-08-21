import Performance from "../../models/hr/Performance.js";
import Employee from "../../models/hr/Employee.js";

// ======================================================
// GET ALL PERFORMANCE REVIEWS
// ======================================================

export const getPerformanceReviews = async (req, res) => {
  try {
    const {
      employee,
      status,
      reviewer,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const query = {};

    if (employee) {
      query.employee = employee;
    }

    if (status) {
      query.status = status;
    }

    if (reviewer) {
      query.reviewer = reviewer;
    }

    if (startDate || endDate) {
      query.reviewStartDate = {};

      if (startDate) {
        query.reviewStartDate.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        query.reviewStartDate.$lte = end;
      }
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [reviews, total] = await Promise.all([
  Performance.find(query)
    .populate(
      "employee",
      "employeeCode firstName lastName email department designation"
    )
    .populate("reviewer", "name email")
    .sort({
      reviewStartDate: -1,
      createdAt: -1,
    })
    .skip(skip)
    .limit(limitNumber)
    .lean(),

  Performance.countDocuments(query),
]);
    return res.status(200).json({
      success: true,
      message: "Performance reviews fetched successfully",
      data: reviews,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error(
      "GET PERFORMANCE REVIEWS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch performance reviews",
    });
  }
};


// ======================================================
// GET PERFORMANCE BY ID
// ======================================================

export const getPerformanceById = async (req, res) => {
  try {
    const review = await Performance.findById(
  req.params.id
)
  .populate("employee")
  .populate("reviewer", "name email");;

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Performance review fetched successfully",
      data: review,
    });
  } catch (error) {
    console.error(
      "GET PERFORMANCE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch performance review",
    });
  }
};


// ======================================================
// CREATE PERFORMANCE
// ======================================================

export const createPerformance = async (req, res) => {
  try {
    const {
      employee,
      reviewPeriod,
      reviewStartDate,
      reviewEndDate,
      reviewer,
      overallRating,
      goals,
      strengths,
      areasForImprovement,
      achievements,
      feedback,
      employeeComments,
      promotionRecommended,
      incrementRecommended,
      recommendedIncrementPercentage,
    } = req.body;

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !employee ||
      !reviewPeriod ||
      !reviewStartDate ||
      !reviewEndDate ||
      !reviewer
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Employee, review period, dates and reviewer are required",
      });
    }

    const startDate = new Date(reviewStartDate);
    const endDate = new Date(reviewEndDate);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid review dates",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        message:
          "Review end date cannot be before start date",
      });
    }

    // --------------------------------------------------
    // EMPLOYEE CHECK
    // --------------------------------------------------

    const employeeExists =
      await Employee.findById(employee);

    if (!employeeExists) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // --------------------------------------------------
    // DUPLICATE REVIEW CHECK
    // --------------------------------------------------

    const existingReview =
      await Performance.findOne({
        employee,
        reviewStartDate: startDate,
        reviewEndDate: endDate,
      });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message:
          "Performance review already exists for this employee and review period",
        data: existingReview,
      });
    }

    // --------------------------------------------------
    // RATING VALIDATION
    // --------------------------------------------------

    const rating =
      overallRating !== undefined
        ? Number(overallRating)
        : 0;

    if (rating < 0 || rating > 5) {
      return res.status(400).json({
        success: false,
        message:
          "Overall rating must be between 0 and 5",
      });
    }

    const incrementPercentage =
      recommendedIncrementPercentage !== undefined
        ? Number(recommendedIncrementPercentage)
        : 0;

    if (incrementPercentage < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Increment percentage cannot be negative",
      });
    }

    // --------------------------------------------------
    // CREATE REVIEW
    // --------------------------------------------------

    const review = await Performance.create({
      employee,
      reviewPeriod,
      reviewStartDate: startDate,
      reviewEndDate: endDate,
      reviewer,

      overallRating: rating,

      goals: Array.isArray(goals)
        ? goals
        : [],

      strengths: Array.isArray(strengths)
        ? strengths
        : [],

      areasForImprovement:
        Array.isArray(areasForImprovement)
          ? areasForImprovement
          : [],

      achievements:
        Array.isArray(achievements)
          ? achievements
          : [],

      feedback,
      employeeComments,

      promotionRecommended:
        Boolean(promotionRecommended),

      incrementRecommended:
        Boolean(incrementRecommended),

      recommendedIncrementPercentage:
        incrementPercentage,

      status: "Draft",

      organization:
        employeeExists.organization ||
        req.user?.organization ||
        null,
    });

    const populatedReview =
      await Performance.findById(review._id)
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .populate("reviewer", "name email");

    return res.status(201).json({
      success: true,
      message:
        "Performance review created successfully",
      data: populatedReview,
    });
  } catch (error) {
    console.error(
      "CREATE PERFORMANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create performance review",
    });
  }
};


// ======================================================
// UPDATE PERFORMANCE
// ======================================================

export const updatePerformance = async (req, res) => {
  try {
    const review =
      await Performance.findById(
        req.params.id
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    // Finalized cannot be edited
    if (review.status === "Finalized") {
      return res.status(400).json({
        success: false,
        message:
          "Finalized performance review cannot be edited",
      });
    }

    const allowedFields = [
      "reviewPeriod",
      "reviewStartDate",
      "reviewEndDate",
      "overallRating",
      "goals",
      "strengths",
      "areasForImprovement",
      "achievements",
      "feedback",
      "employeeComments",
      "promotionRecommended",
      "incrementRecommended",
      "recommendedIncrementPercentage",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        review[field] = req.body[field];
      }
    }

    // --------------------------------------------------
    // DATE VALIDATION
    // --------------------------------------------------

    if (
      review.reviewStartDate &&
      review.reviewEndDate &&
      review.reviewEndDate <
        review.reviewStartDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Review end date cannot be before start date",
      });
    }

    // --------------------------------------------------
    // RATING VALIDATION
    // --------------------------------------------------

    if (
      review.overallRating < 0 ||
      review.overallRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Overall rating must be between 0 and 5",
      });
    }

    if (
      review.recommendedIncrementPercentage < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Increment percentage cannot be negative",
      });
    }

    await review.save();

    const updatedReview =
      await Performance.findById(review._id)
        .populate(
          "employee",
          "employeeCode firstName lastName email department designation"
        )
        .populate("reviewer", "name email");

    return res.status(200).json({
      success: true,
      message:
        "Performance review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error(
      "UPDATE PERFORMANCE ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to update performance review",
    });
  }
};


// ======================================================
// SUBMIT PERFORMANCE
// ======================================================

export const submitPerformance = async (
  req,
  res
) => {
  try {
    const review =
      await Performance.findById(
        req.params.id
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    if (review.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message:
          "Only draft reviews can be submitted",
      });
    }

    review.status = "Submitted";

    await review.save();

    return res.status(200).json({
      success: true,
      message:
        "Performance review submitted successfully",
      data: review,
    });
  } catch (error) {
    console.error(
      "SUBMIT PERFORMANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to submit performance review",
    });
  }
};


// ======================================================
// REVIEW PERFORMANCE
// ======================================================

export const reviewPerformance = async (
  req,
  res
) => {
  try {
    const review =
      await Performance.findById(
        req.params.id
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    if (review.status !== "Submitted") {
      return res.status(400).json({
        success: false,
        message:
          "Only submitted reviews can be reviewed",
      });
    }

    review.status = "Reviewed";
    review.reviewedAt = new Date();

    await review.save();

    return res.status(200).json({
      success: true,
      message:
        "Performance review marked as reviewed",
      data: review,
    });
  } catch (error) {
    console.error(
      "REVIEW PERFORMANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to review performance",
    });
  }
};


// ======================================================
// FINALIZE PERFORMANCE
// ======================================================

export const finalizePerformance = async (
  req,
  res
) => {
  try {
    const review =
      await Performance.findById(
        req.params.id
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    if (
      !["Submitted", "Reviewed"].includes(
        review.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Performance review is not ready for finalization",
      });
    }

    review.status = "Finalized";

    if (!review.reviewedAt) {
      review.reviewedAt = new Date();
    }

    review.finalizedAt = new Date();

    await review.save();

    return res.status(200).json({
      success: true,
      message:
        "Performance review finalized successfully",
      data: review,
    });
  } catch (error) {
    console.error(
      "FINALIZE PERFORMANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to finalize performance review",
    });
  }
};


// ======================================================
// DELETE PERFORMANCE
// ======================================================

export const deletePerformance = async (
  req,
  res
) => {
  try {
    const review =
      await Performance.findById(
        req.params.id
      );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Performance review not found",
      });
    }

    // Don't allow deleting finalized reviews
    if (review.status === "Finalized") {
      return res.status(400).json({
        success: false,
        message:
          "Finalized performance review cannot be deleted",
      });
    }

    await Performance.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message:
        "Performance review deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PERFORMANCE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to delete performance review",
    });
  }
};