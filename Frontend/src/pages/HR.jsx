import { useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  CalendarCheck,
  CalendarDays,
  Plane,
  Clock,
  Wallet,
  Receipt,
  FileText,
  TrendingUp,
  LayoutDashboard,
  AlertTriangle,
  Inbox,
  Check,
  X,
  Send,
  IndianRupee,
} from "lucide-react";
import toast from "react-hot-toast";

import HRSection, { Badge } from "../components/hr/HRSection";
import { statusTone, fmtDate, money } from "../components/hr/hrFormat";

import * as hr from "../services/hr";
import { HR_ENUMS } from "../services/hr";
import API from "../services/api";

/* ======================================================
   HR MODULE
   All data comes from /api/hr/* (Backend/routes/hr/index.js).
====================================================== */

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: UsersIcon },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "leaves", label: "Leaves", icon: Plane },
  { id: "holidays", label: "Holidays", icon: CalendarDays },
  { id: "shifts", label: "Shifts", icon: Clock },
  { id: "salary", label: "Salary Structures", icon: Wallet },
  { id: "payroll", label: "Payroll", icon: IndianRupee },
  { id: "payslips", label: "Payslips", icon: FileText },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "performance", label: "Performance", icon: TrendingUp },
];

/** Employee name helper — the API populates `employee` on most records. */
const empName = (e) =>
  !e
    ? "—"
    : typeof e === "string"
    ? e
    : [e.firstName, e.lastName].filter(Boolean).join(" ") ||
      e.employeeCode ||
      "—";

const dateInput = (d) =>
  d ? new Date(d).toISOString().split("T")[0] : "";

export default function HR() {
  const [tab, setTab] = useState("dashboard");

  /* Employee options for the reference selects (shared across tabs). */
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    hr.getEmployees({ limit: 200 })
      .then((d) => setEmployees(hr.readList(d).rows))
      .catch(() => setEmployees([]));

    API.get("/admin/users")
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => setUsers([]));
  }, []);

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e._id,
        label: `${empName(e)}${e.employeeCode ? ` (${e.employeeCode})` : ""}`,
      })),
    [employees]
  );

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u._id, label: `${u.name} — ${u.email}` })),
    [users]
  );

  /* ==================================================
     SECTION CONFIGS
  ================================================== */
  const configs = {
    employees: {
      title: "Employees",
      singular: "Employee",
      api: {
        list: hr.getEmployees,
        create: hr.createEmployee,
        update: hr.updateEmployee,
        remove: hr.deleteEmployee,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.employeeStatus },
      ],
      columns: [
        {
          key: "employeeCode",
          label: "Code",
          render: (r) => (
            <span className="font-semibold text-slate-800">
              {r.employeeCode || "—"}
            </span>
          ),
        },
        {
          key: "firstName",
          label: "Name",
          render: (r) => (
            <div>
              <p className="font-medium text-slate-800">{empName(r)}</p>
              <p className="text-xs text-slate-500">{r.email}</p>
            </div>
          ),
        },
        { key: "department", label: "Department" },
        { key: "designation", label: "Designation" },
        { key: "employmentType", label: "Type" },
        {
          key: "dateOfJoining",
          label: "Joined",
          render: (r) => fmtDate(r.dateOfJoining),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => (
            <Badge value={r.status} tone={statusTone(r.status)} />
          ),
        },
      ],
      initialForm: {
        user: "",
        employeeCode: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        gender: "",
        dateOfBirth: "",
        dateOfJoining: "",
        department: "",
        designation: "",
        employmentType: "Full Time",
        status: "Active",
        notes: "",
      },
      fields: [
        {
          name: "user",
          label: "Linked User Account",
          type: "select",
          options: userOptions,
          required: true,
          half: true,
        },
        { name: "employeeCode", label: "Employee Code", required: true, half: true },
        { name: "firstName", label: "First Name", required: true, half: true },
        { name: "lastName", label: "Last Name", half: true },
        { name: "email", label: "Email", type: "email", required: true, half: true },
        { name: "phone", label: "Phone", half: true },
        {
          name: "gender",
          label: "Gender",
          type: "select",
          options: HR_ENUMS.gender,
          half: true,
        },
        { name: "dateOfBirth", label: "Date of Birth", type: "date", half: true },
        {
          name: "dateOfJoining",
          label: "Date of Joining",
          type: "date",
          required: true,
          half: true,
        },
        { name: "department", label: "Department", half: true },
        { name: "designation", label: "Designation", half: true },
        {
          name: "employmentType",
          label: "Employment Type",
          type: "select",
          options: HR_ENUMS.employmentType,
          half: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.employeeStatus,
          half: true,
        },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      toForm: (r) => ({
        user: typeof r.user === "object" ? r.user?._id || "" : r.user || "",
        employeeCode: r.employeeCode || "",
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        email: r.email || "",
        phone: r.phone || "",
        gender: r.gender || "",
        dateOfBirth: dateInput(r.dateOfBirth),
        dateOfJoining: dateInput(r.dateOfJoining),
        department: r.department || "",
        designation: r.designation || "",
        employmentType: r.employmentType || "Full Time",
        status: r.status || "Active",
        notes: r.notes || "",
      }),
      // Drop empty optional keys so we never write "" into an enum field.
      toPayload: (f) =>
        Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
    },

    attendance: {
      title: "Attendance",
      singular: "Attendance",
      searchable: false,
      api: {
        list: hr.getAttendance,
        create: hr.createAttendance,
        update: hr.updateAttendance,
        remove: hr.deleteAttendance,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.attendanceStatus },
      ],
      columns: [
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        { key: "checkIn", label: "Check In", render: (r) => r.checkIn || "—" },
        { key: "checkOut", label: "Check Out", render: (r) => r.checkOut || "—" },
        { key: "workHours", label: "Hours", render: (r) => r.workHours ?? "—" },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
        { key: "source", label: "Source" },
      ],
      initialForm: {
        employee: "",
        date: "",
        status: "Present",
        checkIn: "",
        checkOut: "",
        source: "Web",
        remarks: "",
      },
      fields: [
        {
          name: "employee",
          label: "Employee",
          type: "select",
          options: employeeOptions,
          required: true,
          half: true,
        },
        { name: "date", label: "Date", type: "date", required: true, half: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.attendanceStatus,
          half: true,
        },
        {
          name: "source",
          label: "Source",
          type: "select",
          options: HR_ENUMS.attendanceSource,
          half: true,
        },
        { name: "checkIn", label: "Check In", type: "time", half: true },
        { name: "checkOut", label: "Check Out", type: "time", half: true },
        { name: "remarks", label: "Remarks", type: "textarea" },
      ],
      toForm: (r) => ({
        employee:
          typeof r.employee === "object" ? r.employee?._id || "" : r.employee || "",
        date: dateInput(r.date),
        status: r.status || "Present",
        checkIn: r.checkIn || "",
        checkOut: r.checkOut || "",
        source: r.source || "Web",
        remarks: r.remarks || "",
      }),
      toPayload: (f) =>
        Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
    },

    leaves: {
      title: "Leaves",
      singular: "Leave",
      searchable: false,
      api: {
        list: hr.getLeaves,
        create: hr.createLeave,
        update: hr.updateLeave,
        remove: hr.deleteLeave,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.leaveStatus },
        { name: "leaveType", label: "Type", options: HR_ENUMS.leaveType },
      ],
      columns: [
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "leaveType", label: "Type" },
        { key: "fromDate", label: "From", render: (r) => fmtDate(r.fromDate) },
        { key: "toDate", label: "To", render: (r) => fmtDate(r.toDate) },
        { key: "totalDays", label: "Days" },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: {
        employee: "",
        leaveType: "Casual Leave",
        fromDate: "",
        toDate: "",
        totalDays: "",
        reason: "",
      },
      fields: [
        {
          name: "employee",
          label: "Employee",
          type: "select",
          options: employeeOptions,
          required: true,
          half: true,
        },
        {
          name: "leaveType",
          label: "Leave Type",
          type: "select",
          options: HR_ENUMS.leaveType,
          required: true,
          half: true,
        },
        { name: "fromDate", label: "From Date", type: "date", required: true, half: true },
        { name: "toDate", label: "To Date", type: "date", required: true, half: true },
        {
          name: "totalDays",
          label: "Total Days",
          type: "number",
          required: true,
          half: true,
        },
        { name: "reason", label: "Reason", type: "textarea" },
      ],
      toForm: (r) => ({
        employee:
          typeof r.employee === "object" ? r.employee?._id || "" : r.employee || "",
        leaveType: r.leaveType || "Casual Leave",
        fromDate: dateInput(r.fromDate),
        toDate: dateInput(r.toDate),
        totalDays: r.totalDays ?? "",
        reason: r.reason || "",
      }),
      toPayload: (f) => ({
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
        totalDays: Number(f.totalDays) || 0,
      }),
      actions: (row, reload) =>
        row.status === "Pending" ? (
          <>
            <button
              title="Approve"
              onClick={async () => {
                try {
                  await hr.approveLeave(row._id);
                  toast.success("Leave approved");
                  reload();
                } catch (e) {
                  toast.error(e?.response?.data?.message || "Approve failed");
                }
              }}
              className="p-2 text-green-600 rounded-lg bg-green-50 hover:bg-green-100"
            >
              <Check size={15} />
            </button>
            <button
              title="Reject"
              onClick={async () => {
                try {
                  await hr.rejectLeave(row._id);
                  toast.success("Leave rejected");
                  reload();
                } catch (e) {
                  toast.error(e?.response?.data?.message || "Reject failed");
                }
              }}
              className="p-2 text-red-600 rounded-lg bg-red-50 hover:bg-red-100"
            >
              <X size={15} />
            </button>
          </>
        ) : null,
    },

    holidays: {
      title: "Holidays",
      singular: "Holiday",
      api: {
        list: hr.getHolidays,
        create: hr.createHoliday,
        update: hr.updateHoliday,
        remove: hr.deleteHoliday,
      },
      filters: [{ name: "type", label: "Type", options: HR_ENUMS.holidayType }],
      columns: [
        {
          key: "name",
          label: "Holiday",
          render: (r) => (
            <span className="font-medium text-slate-800">{r.name}</span>
          ),
        },
        { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
        {
          key: "type",
          label: "Type",
          render: (r) => <Badge value={r.type} tone="blue" />,
        },
        { key: "description", label: "Description" },
      ],
      initialForm: { name: "", date: "", type: "Public", description: "" },
      fields: [
        { name: "name", label: "Holiday Name", required: true, half: true },
        { name: "date", label: "Date", type: "date", required: true, half: true },
        {
          name: "type",
          label: "Type",
          type: "select",
          options: HR_ENUMS.holidayType,
          half: true,
        },
        { name: "description", label: "Description", type: "textarea" },
      ],
      toForm: (r) => ({
        name: r.name || "",
        date: dateInput(r.date),
        type: r.type || "Public",
        description: r.description || "",
      }),
    },

    shifts: {
      title: "Shifts",
      singular: "Shift",
      api: {
        list: hr.getShifts,
        create: hr.createShift,
        update: hr.updateShift,
        remove: hr.deleteShift,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.activeStatus },
      ],
      columns: [
        {
          key: "name",
          label: "Shift",
          render: (r) => (
            <span className="font-medium text-slate-800">{r.name}</span>
          ),
        },
        { key: "code", label: "Code" },
        { key: "startTime", label: "Start" },
        { key: "endTime", label: "End" },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: {
        name: "",
        code: "",
        startTime: "",
        endTime: "",
        status: "Active",
        description: "",
      },
      fields: [
        { name: "name", label: "Shift Name", required: true, half: true },
        { name: "code", label: "Code", required: true, half: true },
        { name: "startTime", label: "Start Time", type: "time", required: true, half: true },
        { name: "endTime", label: "End Time", type: "time", required: true, half: true },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.activeStatus,
          half: true,
        },
        { name: "description", label: "Description", type: "textarea" },
      ],
      toForm: (r) => ({
        name: r.name || "",
        code: r.code || "",
        startTime: r.startTime || "",
        endTime: r.endTime || "",
        status: r.status || "Active",
        description: r.description || "",
      }),
    },

    salary: {
      title: "Salary Structures",
      singular: "Salary Structure",
      api: {
        list: hr.getSalaryStructures,
        create: hr.createSalaryStructure,
        update: hr.updateSalaryStructure,
        remove: hr.deleteSalaryStructure,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.activeStatus },
      ],
      columns: [
        {
          key: "name",
          label: "Structure",
          render: (r) => (
            <span className="font-medium text-slate-800">{r.name}</span>
          ),
        },
        {
          key: "basicSalary",
          label: "Basic Salary",
          render: (r) => money(r.basicSalary),
        },
        {
          key: "effectiveFrom",
          label: "Effective From",
          render: (r) => fmtDate(r.effectiveFrom),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: {
        name: "",
        basicSalary: "",
        effectiveFrom: "",
        status: "Active",
        description: "",
      },
      fields: [
        { name: "name", label: "Structure Name", required: true, half: true },
        {
          name: "basicSalary",
          label: "Basic Salary",
          type: "number",
          required: true,
          half: true,
        },
        {
          name: "effectiveFrom",
          label: "Effective From",
          type: "date",
          required: true,
          half: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.activeStatus,
          half: true,
        },
        { name: "description", label: "Description", type: "textarea" },
      ],
      toForm: (r) => ({
        name: r.name || "",
        basicSalary: r.basicSalary ?? "",
        effectiveFrom: dateInput(r.effectiveFrom),
        status: r.status || "Active",
        description: r.description || "",
      }),
      toPayload: (f) => ({ ...f, basicSalary: Number(f.basicSalary) || 0 }),
    },

    payroll: {
      title: "Payroll",
      singular: "Payroll",
      searchable: false,
      // Backend exposes GET / , GET /:id and POST /process only.
      api: { list: hr.getPayrolls, create: hr.processPayroll },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.payrollStatus },
      ],
      columns: [
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "month", label: "Month" },
        { key: "year", label: "Year" },
        {
          key: "grossSalary",
          label: "Gross",
          render: (r) => money(r.grossSalary),
        },
        {
          key: "netSalary",
          label: "Net Pay",
          render: (r) => (
            <span className="font-semibold text-slate-800">
              {money(r.netSalary)}
            </span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: { month: "", year: String(new Date().getFullYear()) },
      fields: [
        {
          name: "month",
          label: "Month",
          type: "select",
          required: true,
          half: true,
          options: Array.from({ length: 12 }, (_, i) => ({
            value: String(i + 1),
            label: new Date(2000, i, 1).toLocaleString("en-IN", {
              month: "long",
            }),
          })),
        },
        { name: "year", label: "Year", type: "number", required: true, half: true },
      ],
      toPayload: (f) => ({
        month: Number(f.month),
        year: Number(f.year),
      }),
    },

    payslips: {
      title: "Payslips",
      singular: "Payslip",
      searchable: false,
      // Backend exposes GET / , GET /:id , POST and PUT /:id (no delete).
      api: { list: hr.getPayslips, update: hr.updatePayslip },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.payslipStatus },
      ],
      columns: [
        { key: "payslipNumber", label: "Payslip #" },
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "month", label: "Month" },
        { key: "year", label: "Year" },
        { key: "netPay", label: "Net Pay", render: (r) => money(r.netPay ?? r.netSalary) },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: { status: "Draft", paymentMethod: "Bank Transfer", remarks: "" },
      fields: [
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.payslipStatus,
          half: true,
        },
        {
          name: "paymentMethod",
          label: "Payment Method",
          type: "select",
          options: HR_ENUMS.paymentMethod,
          half: true,
        },
        { name: "remarks", label: "Remarks", type: "textarea" },
      ],
      toForm: (r) => ({
        status: r.status || "Draft",
        paymentMethod: r.paymentMethod || "Bank Transfer",
        remarks: r.remarks || "",
      }),
    },

    expenses: {
      title: "Expenses",
      singular: "Expense",
      api: {
        list: hr.getExpenses,
        create: hr.createExpense,
        update: hr.updateExpense,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.expenseStatus },
        { name: "category", label: "Category", options: HR_ENUMS.expenseCategory },
      ],
      columns: [
        { key: "expenseNumber", label: "Expense #" },
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        {
          key: "expenseDate",
          label: "Date",
          render: (r) => fmtDate(r.expenseDate),
        },
        {
          key: "amount",
          label: "Amount",
          render: (r) => (
            <span className="font-semibold text-slate-800">
              {money(r.amount)}
            </span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: {
        employee: "",
        expenseNumber: "",
        title: "",
        category: "Travel",
        expenseDate: "",
        amount: "",
        paymentMethod: "Cash",
        description: "",
      },
      fields: [
        {
          name: "employee",
          label: "Employee",
          type: "select",
          options: employeeOptions,
          required: true,
          half: true,
        },
        { name: "expenseNumber", label: "Expense Number", required: true, half: true },
        { name: "title", label: "Title", required: true, half: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: HR_ENUMS.expenseCategory,
          required: true,
          half: true,
        },
        {
          name: "expenseDate",
          label: "Expense Date",
          type: "date",
          required: true,
          half: true,
        },
        { name: "amount", label: "Amount", type: "number", required: true, half: true },
        {
          name: "paymentMethod",
          label: "Payment Method",
          type: "select",
          options: HR_ENUMS.expensePaymentMethod,
          half: true,
        },
        { name: "description", label: "Description", type: "textarea" },
      ],
      toForm: (r) => ({
        employee:
          typeof r.employee === "object" ? r.employee?._id || "" : r.employee || "",
        expenseNumber: r.expenseNumber || "",
        title: r.title || "",
        category: r.category || "Travel",
        expenseDate: dateInput(r.expenseDate),
        amount: r.amount ?? "",
        paymentMethod: r.paymentMethod || "Cash",
        description: r.description || "",
      }),
      toPayload: (f) => ({
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
        amount: Number(f.amount) || 0,
      }),
      actions: (row, reload) => {
        const run = async (fn, msg) => {
          try {
            await fn(row._id);
            toast.success(msg);
            reload();
          } catch (e) {
            toast.error(e?.response?.data?.message || "Action failed");
          }
        };

        if (row.status === "Draft")
          return (
            <button
              title="Submit"
              onClick={() => run(hr.submitExpense, "Expense submitted")}
              className="p-2 text-indigo-600 rounded-lg bg-indigo-50 hover:bg-indigo-100"
            >
              <Send size={15} />
            </button>
          );

        if (row.status === "Submitted")
          return (
            <>
              <button
                title="Approve"
                onClick={() => run(hr.approveExpense, "Expense approved")}
                className="p-2 text-green-600 rounded-lg bg-green-50 hover:bg-green-100"
              >
                <Check size={15} />
              </button>
              <button
                title="Reject"
                onClick={() => run(hr.rejectExpense, "Expense rejected")}
                className="p-2 text-red-600 rounded-lg bg-red-50 hover:bg-red-100"
              >
                <X size={15} />
              </button>
            </>
          );

        if (row.status === "Approved")
          return (
            <button
              title="Mark reimbursed"
              onClick={() => run(hr.reimburseExpense, "Expense reimbursed")}
              className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
            >
              <IndianRupee size={15} />
            </button>
          );

        return null;
      },
    },

    performance: {
      title: "Performance Reviews",
      singular: "Review",
      api: {
        list: hr.getPerformances,
        create: hr.createPerformance,
        update: hr.updatePerformance,
      },
      filters: [
        { name: "status", label: "Status", options: HR_ENUMS.performanceStatus },
      ],
      columns: [
        {
          key: "employee",
          label: "Employee",
          render: (r) => empName(r.employee),
        },
        { key: "title", label: "Title" },
        { key: "reviewPeriod", label: "Period" },
        {
          key: "reviewStartDate",
          label: "From",
          render: (r) => fmtDate(r.reviewStartDate),
        },
        {
          key: "reviewEndDate",
          label: "To",
          render: (r) => fmtDate(r.reviewEndDate),
        },
        {
          key: "reviewer",
          label: "Reviewer",
          render: (r) => empName(r.reviewer),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge value={r.status} tone={statusTone(r.status)} />,
        },
      ],
      initialForm: {
        employee: "",
        reviewer: "",
        title: "",
        reviewPeriod: "",
        reviewStartDate: "",
        reviewEndDate: "",
        status: "Draft",
      },
      fields: [
        {
          name: "employee",
          label: "Employee",
          type: "select",
          options: employeeOptions,
          required: true,
          half: true,
        },
        {
          name: "reviewer",
          label: "Reviewer",
          type: "select",
          options: employeeOptions,
          required: true,
          half: true,
        },
        { name: "title", label: "Title", required: true, half: true },
        {
          name: "reviewPeriod",
          label: "Review Period",
          required: true,
          half: true,
          placeholder: "e.g. Q1 2026",
        },
        {
          name: "reviewStartDate",
          label: "Start Date",
          type: "date",
          required: true,
          half: true,
        },
        {
          name: "reviewEndDate",
          label: "End Date",
          type: "date",
          required: true,
          half: true,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: HR_ENUMS.performanceStatus,
          half: true,
        },
      ],
      toForm: (r) => ({
        employee:
          typeof r.employee === "object" ? r.employee?._id || "" : r.employee || "",
        reviewer:
          typeof r.reviewer === "object" ? r.reviewer?._id || "" : r.reviewer || "",
        title: r.title || "",
        reviewPeriod: r.reviewPeriod || "",
        reviewStartDate: dateInput(r.reviewStartDate),
        reviewEndDate: dateInput(r.reviewEndDate),
        status: r.status || "Draft",
      }),
      toPayload: (f) =>
        Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")),
    },
  };

  return (
    <div className="min-h-screen p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100">

      {/* ============ HEADER ============ */}
      <div className="relative p-8 overflow-hidden shadow-2xl rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900">
        <div className="absolute rounded-full -top-24 -right-24 w-80 h-80 bg-blue-500/20 blur-3xl" />
        <div className="absolute rounded-full -bottom-24 -left-24 w-80 h-80 bg-indigo-500/20 blur-3xl" />

        <div className="relative flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 border shadow-lg rounded-2xl bg-white/10 backdrop-blur-xl border-white/20">
            <UsersIcon size={32} className="text-white" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Human Resources
              </h1>
              <span className="px-3 py-1 text-xs font-semibold text-blue-200 border rounded-full bg-blue-500/20 border-blue-400/30">
                ReadyTech Solutions
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Employees, attendance, leave, payroll, expenses and performance —
              managed from one HR workspace.
            </p>
          </div>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="p-2 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ CONTENT ============ */}
      {tab === "dashboard" ? (
        <HRDashboard />
      ) : (
        <HRSection key={tab} config={configs[tab]} />
      )}
    </div>
  );
}

/* ======================================================
   HR DASHBOARD  (GET /api/hr/reports/dashboard)
====================================================== */
function HRDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    hr.getHRDashboard()
      .then((res) => setData(res?.data ?? res))
      .catch((err) =>
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load HR dashboard"
        )
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="h-28 bg-white border shadow-sm rounded-2xl border-slate-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
        <AlertTriangle className="mx-auto mb-3 text-rose-500" size={28} />
        <p className="font-semibold text-slate-800">Couldn't load HR dashboard</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          onClick={load}
          className="px-4 py-2 mt-4 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  /**
   * The report returns nested groups, e.g.
   *   { employees: { total, active, inactive }, attendance: {...}, ... }
   * so render one card per group with its metrics inside.
   */
  const groups = Object.entries(data || {}).filter(
    ([, v]) => v && typeof v === "object" && !Array.isArray(v)
  );

  if (!groups.length) {
    return (
      <div className="p-12 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
        <Inbox className="mx-auto mb-3 text-slate-300" size={32} />
        <p className="font-semibold text-slate-700">No HR metrics yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Add employees and attendance to populate the dashboard.
        </p>
      </div>
    );
  }

  const label = (k) =>
    k
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(([group, metrics]) => {
        const rows = Object.entries(metrics).filter(
          ([, v]) => typeof v === "number" || typeof v === "string"
        );

        const headline = rows.find(([k]) => k === "total") || rows[0];

        return (
          <div
            key={group}
            className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold tracking-wide uppercase text-slate-500">
                {label(group)}
              </p>
              {headline && (
                <h3 className="text-3xl font-bold leading-none text-slate-900">
                  {headline[1]}
                </h3>
              )}
            </div>

            <div className="pt-4 mt-4 space-y-2 border-t border-slate-100">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label(k)}</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
