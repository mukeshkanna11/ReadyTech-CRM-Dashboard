import API from "./api";

/* ======================================================
   HR API SERVICE
   Uses the existing axios instance (./api) and the exact
   backend routes mounted at /api/hr (see Backend/routes/hr/index.js).
====================================================== */

/* ---------- shared helpers ---------- */

/** Strips empty params so we never send `?status=` to the backend. */
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

/**
 * Employees/Leaves return `pagination.pages`, Attendance returns
 * `pagination.totalPages`. Normalise both, and tolerate list endpoints
 * that return a bare array.
 */
export const readList = (data) => {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const p = data?.pagination || {};

  return {
    rows,
    page: Number(p.page) || 1,
    limit: Number(p.limit) || rows.length,
    total: Number(p.total) || rows.length,
    pages: Number(p.pages ?? p.totalPages) || 1,
  };
};

/* ======================================================
   EMPLOYEES  /api/hr/employees
====================================================== */
export const getEmployees = (params) =>
  API.get("/hr/employees", { params: clean(params) }).then((r) => r.data);

export const getEmployee = (id) =>
  API.get(`/hr/employees/${id}`).then((r) => r.data);

export const createEmployee = (payload) =>
  API.post("/hr/employees", payload).then((r) => r.data);

export const updateEmployee = (id, payload) =>
  API.put(`/hr/employees/${id}`, payload).then((r) => r.data);

export const patchEmployee = (id, payload) =>
  API.patch(`/hr/employees/${id}`, payload).then((r) => r.data);

export const deleteEmployee = (id) =>
  API.delete(`/hr/employees/${id}`).then((r) => r.data);

/* ======================================================
   ATTENDANCE  /api/hr/attendance
====================================================== */
export const getAttendance = (params) =>
  API.get("/hr/attendance", { params: clean(params) }).then((r) => r.data);

export const getTodayAttendance = () =>
  API.get("/hr/attendance/today").then((r) => r.data);

export const getAttendanceSummary = (employeeId, params) =>
  API.get(`/hr/attendance/employee/${employeeId}/summary`, {
    params: clean(params),
  }).then((r) => r.data);

export const createAttendance = (payload) =>
  API.post("/hr/attendance", payload).then((r) => r.data);

export const createBulkAttendance = (payload) =>
  API.post("/hr/attendance/bulk", payload).then((r) => r.data);

export const updateAttendance = (id, payload) =>
  API.put(`/hr/attendance/${id}`, payload).then((r) => r.data);

export const deleteAttendance = (id) =>
  API.delete(`/hr/attendance/${id}`).then((r) => r.data);

/* ======================================================
   LEAVES  /api/hr/leaves
====================================================== */
export const getLeaves = (params) =>
  API.get("/hr/leaves", { params: clean(params) }).then((r) => r.data);

export const getLeaveSummary = (employeeId) =>
  API.get(`/hr/leaves/summary/${employeeId}`).then((r) => r.data);

export const createLeave = (payload) =>
  API.post("/hr/leaves", payload).then((r) => r.data);

export const updateLeave = (id, payload) =>
  API.put(`/hr/leaves/${id}`, payload).then((r) => r.data);

export const approveLeave = (id, payload = {}) =>
  API.put(`/hr/leaves/${id}/approve`, payload).then((r) => r.data);

export const rejectLeave = (id, payload = {}) =>
  API.put(`/hr/leaves/${id}/reject`, payload).then((r) => r.data);

export const cancelLeave = (id, payload = {}) =>
  API.put(`/hr/leaves/${id}/cancel`, payload).then((r) => r.data);

export const deleteLeave = (id) =>
  API.delete(`/hr/leaves/${id}`).then((r) => r.data);

/* ======================================================
   HOLIDAYS  /api/hr/holidays
====================================================== */
export const getHolidays = (params) =>
  API.get("/hr/holidays", { params: clean(params) }).then((r) => r.data);

export const getHolidaysByYear = (year) =>
  API.get(`/hr/holidays/year/${year}`).then((r) => r.data);

export const createHoliday = (payload) =>
  API.post("/hr/holidays", payload).then((r) => r.data);

export const updateHoliday = (id, payload) =>
  API.put(`/hr/holidays/${id}`, payload).then((r) => r.data);

export const setHolidayStatus = (id, payload) =>
  API.patch(`/hr/holidays/${id}/status`, payload).then((r) => r.data);

export const deleteHoliday = (id) =>
  API.delete(`/hr/holidays/${id}`).then((r) => r.data);

/* ======================================================
   SHIFTS  /api/hr/shifts
====================================================== */
export const getShifts = (params) =>
  API.get("/hr/shifts", { params: clean(params) }).then((r) => r.data);

export const getShiftEmployees = (id) =>
  API.get(`/hr/shifts/${id}/employees`).then((r) => r.data);

export const createShift = (payload) =>
  API.post("/hr/shifts", payload).then((r) => r.data);

export const updateShift = (id, payload) =>
  API.put(`/hr/shifts/${id}`, payload).then((r) => r.data);

export const setShiftStatus = (id, payload) =>
  API.patch(`/hr/shifts/${id}/status`, payload).then((r) => r.data);

export const deleteShift = (id) =>
  API.delete(`/hr/shifts/${id}`).then((r) => r.data);

/* ======================================================
   SALARY STRUCTURES  /api/hr/salary-structures
====================================================== */
export const getSalaryStructures = (params) =>
  API.get("/hr/salary-structures", { params: clean(params) }).then(
    (r) => r.data
  );

export const getSalaryStructureEmployees = (id) =>
  API.get(`/hr/salary-structures/${id}/employees`).then((r) => r.data);

export const createSalaryStructure = (payload) =>
  API.post("/hr/salary-structures", payload).then((r) => r.data);

export const updateSalaryStructure = (id, payload) =>
  API.put(`/hr/salary-structures/${id}`, payload).then((r) => r.data);

export const setSalaryStructureStatus = (id, payload) =>
  API.patch(`/hr/salary-structures/${id}/status`, payload).then((r) => r.data);

export const deleteSalaryStructure = (id) =>
  API.delete(`/hr/salary-structures/${id}`).then((r) => r.data);

/* ======================================================
   PAYROLL  /api/hr/payroll
====================================================== */
export const getPayrolls = (params) =>
  API.get("/hr/payroll", { params: clean(params) }).then((r) => r.data);

export const getPayroll = (id) =>
  API.get(`/hr/payroll/${id}`).then((r) => r.data);

export const processPayroll = (payload) =>
  API.post("/hr/payroll/process", payload).then((r) => r.data);

/* ======================================================
   PAYSLIPS  /api/hr/payslips
====================================================== */
export const getPayslips = (params) =>
  API.get("/hr/payslips", { params: clean(params) }).then((r) => r.data);

export const getPayslip = (id) =>
  API.get(`/hr/payslips/${id}`).then((r) => r.data);

export const createPayslip = (payload) =>
  API.post("/hr/payslips", payload).then((r) => r.data);

export const updatePayslip = (id, payload) =>
  API.put(`/hr/payslips/${id}`, payload).then((r) => r.data);

/* ======================================================
   EMPLOYEE EXPENSES  /api/hr/expenses
====================================================== */
export const getExpenses = (params) =>
  API.get("/hr/expenses", { params: clean(params) }).then((r) => r.data);

export const getExpense = (id) =>
  API.get(`/hr/expenses/${id}`).then((r) => r.data);

export const createExpense = (payload) =>
  API.post("/hr/expenses", payload).then((r) => r.data);

export const updateExpense = (id, payload) =>
  API.put(`/hr/expenses/${id}`, payload).then((r) => r.data);

export const submitExpense = (id, payload = {}) =>
  API.patch(`/hr/expenses/${id}/submit`, payload).then((r) => r.data);

export const approveExpense = (id, payload = {}) =>
  API.patch(`/hr/expenses/${id}/approve`, payload).then((r) => r.data);

export const rejectExpense = (id, payload = {}) =>
  API.patch(`/hr/expenses/${id}/reject`, payload).then((r) => r.data);

export const reimburseExpense = (id, payload = {}) =>
  API.patch(`/hr/expenses/${id}/reimburse`, payload).then((r) => r.data);

/* ======================================================
   PERFORMANCE  /api/hr/performance
====================================================== */
export const getPerformances = (params) =>
  API.get("/hr/performance", { params: clean(params) }).then((r) => r.data);

export const getPerformance = (id) =>
  API.get(`/hr/performance/${id}`).then((r) => r.data);

export const createPerformance = (payload) =>
  API.post("/hr/performance", payload).then((r) => r.data);

export const updatePerformance = (id, payload) =>
  API.put(`/hr/performance/${id}`, payload).then((r) => r.data);

/* ======================================================
   REPORTS  /api/hr/reports/dashboard
====================================================== */
export const getHRDashboard = (params) =>
  API.get("/hr/reports/dashboard", { params: clean(params) }).then(
    (r) => r.data
  );

/* ======================================================
   BACKEND ENUMS (mirrored from Backend/models/hr/*)
====================================================== */
export const HR_ENUMS = {
  gender: ["Male", "Female", "Other"],
  employmentType: ["Full Time", "Part Time", "Contract", "Intern", "Temporary"],
  employeeStatus: ["Active", "Inactive", "On Leave", "Resigned", "Terminated"],
  attendanceStatus: [
    "Present",
    "Absent",
    "Half Day",
    "Leave",
    "Holiday",
    "Week Off",
    "Late",
    "Work From Home",
  ],
  attendanceSource: ["Manual", "Web", "Mobile", "Import"],
  leaveType: [
    "Casual Leave",
    "Sick Leave",
    "Earned Leave",
    "Privilege Leave",
    "Maternity Leave",
    "Paternity Leave",
    "Unpaid Leave",
    "Other",
  ],
  leaveStatus: ["Pending", "Approved", "Rejected", "Cancelled"],
  holidayType: ["Public", "Optional", "Company"],
  activeStatus: ["Active", "Inactive"],
  payrollStatus: ["Draft", "Processed", "Approved", "Paid"],
  payslipStatus: ["Draft", "Generated", "Approved", "Paid", "Cancelled"],
  paymentMethod: ["Bank Transfer", "Cash", "Cheque", "UPI", "Other"],
  expenseCategory: [
    "Travel",
    "Food",
    "Accommodation",
    "Fuel",
    "Transport",
    "Office Supplies",
    "Communication",
    "Medical",
    "Training",
    "Client Meeting",
    "Other",
  ],
  expensePaymentMethod: [
    "Cash",
    "Credit Card",
    "Debit Card",
    "UPI",
    "Bank Transfer",
    "Other",
  ],
  expenseStatus: [
    "Draft",
    "Submitted",
    "Approved",
    "Rejected",
    "Reimbursed",
    "Cancelled",
  ],
  performanceStatus: ["Draft", "Submitted", "Reviewed", "Finalized"],
};
