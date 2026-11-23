// middlewares/hrAccess.js
/* =========================================================
   HR ACCESS GUARD (mounted once on /api/hr)
   - admin    → full HR / payroll access
   - employee → only the self-service routes below, always
                pinned to the caller's own Employee record
   - anyone else → 403
========================================================= */
import Employee from "../models/hr/Employee.js";
import Leave from "../models/hr/Leave.js";
import EmployeeExpense from "../models/hr/EmployeeExpense.js";
import Payslip from "../models/hr/Payslip.js";
import Attendance from "../models/hr/Attendance.js";

const ID = "([a-fA-F0-9]{24})";

/* mode:
   open   – company-wide, non-sensitive (holiday calendar)
   list   – force ?employee=<own>, drop ?search (it can widen the filter)
   param  – the :employeeId in the path must be the caller's
   create – force body.employee = <own>
   record – the :id record's `employee` must be the caller's
   self   – the :id must be the caller's own Employee id */
const SELF_SERVICE = [
  ["GET", /^\/holidays\/?$/, "open"],
  ["GET", /^\/holidays\/year\/[^/]+\/?$/, "open"],
  ["GET", new RegExp(`^/holidays/${ID}/?$`), "open"],

  ["GET", new RegExp(`^/employees/${ID}/?$`), "self"],

  ["GET", /^\/leaves\/?$/, "list"],
  ["GET", new RegExp(`^/leaves/summary/${ID}/?$`), "param"],
  ["GET", new RegExp(`^/leaves/${ID}/?$`), "record", Leave],
  ["POST", /^\/leaves\/?$/, "create"],
  ["PUT", new RegExp(`^/leaves/${ID}/cancel/?$`), "record", Leave],

  ["GET", /^\/expenses\/?$/, "list"],
  ["GET", new RegExp(`^/expenses/${ID}/?$`), "record", EmployeeExpense],
  ["POST", /^\/expenses\/?$/, "create"],
  ["PUT", new RegExp(`^/expenses/${ID}/?$`), "record", EmployeeExpense],
  ["PATCH", new RegExp(`^/expenses/${ID}/submit/?$`), "record", EmployeeExpense],

  ["GET", /^\/payslips\/?$/, "list"],
  ["GET", new RegExp(`^/payslips/employee/${ID}/?$`), "param"],
  ["GET", new RegExp(`^/payslips/${ID}/?$`), "record", Payslip],

  ["GET", /^\/attendance\/?$/, "list"],
  ["GET", new RegExp(`^/attendance/employee/${ID}/summary/?$`), "param"],
  ["GET", new RegExp(`^/attendance/${ID}/?$`), "record", Attendance],
];

const deny = (res, status = 403, message = "Access denied: HR administration is admin-only") =>
  res.status(status).json({ success: false, message });

const hrAccess = async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (role === "admin") return next();
    if (role !== "employee") return deny(res);

    const rule = SELF_SERVICE.find(([method, re]) => method === req.method && re.test(req.path));
    if (!rule) return deny(res);

    const [, re, mode, Model] = rule;
    if (mode === "open") return next();

    const me = await Employee.findOne({ user: req.user._id }).select("_id").lean();
    if (!me) return deny(res, 403, "No employee profile is linked to this account");
    const own = String(me._id);
    const pathId = req.path.match(re)?.[1];

    switch (mode) {
      case "list":
        req.query.employee = own;
        delete req.query.search;
        return next();
      case "param":
      case "self":
        return pathId === own ? next() : deny(res);
      case "create":
        if (req.body && typeof req.body === "object") req.body.employee = own;
        return next();
      case "record": {
        const doc = await Model.findById(pathId).select("employee").lean();
        if (!doc) return next(); // handler returns its own 404
        return String(doc.employee) === own ? next() : deny(res);
      }
      default:
        return deny(res);
    }
  } catch (error) {
    console.error("HR ACCESS ERROR:", error);
    return deny(res, 500, "Authorization error");
  }
};

export default hrAccess;
