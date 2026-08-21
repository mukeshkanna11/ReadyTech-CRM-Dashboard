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

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await hr.getHRDashboard();

      const dashboardData =
        res?.data?.data ??
        res?.data ??
        res ??
        {};

      setData(dashboardData);
    } catch (err) {
      console.error("HR Dashboard Error:", err);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load HR dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ======================================================
     LOADING
  ====================================================== */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="bg-white border shadow-sm h-36 rounded-2xl border-slate-200 animate-pulse"
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="bg-white border shadow-sm h-80 rounded-2xl border-slate-200 animate-pulse xl:col-span-2" />
          <div className="bg-white border shadow-sm h-80 rounded-2xl border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  /* ======================================================
     ERROR
  ====================================================== */
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-full max-w-md p-8 text-center bg-white border shadow-sm rounded-3xl border-slate-200">
          <div className="flex items-center justify-center mx-auto mb-4 w-14 h-14 rounded-2xl bg-rose-50">
            <AlertTriangle
              className="text-rose-500"
              size={28}
            />
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            Couldn't load HR dashboard
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>

          <button
            onClick={load}
            className="px-5 py-2.5 mt-5 text-sm font-semibold text-white transition bg-indigo-600 rounded-xl hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================
     DATA
  ====================================================== */

  const dashboard = data || {};

  const employees = dashboard.employees || {};
  const attendance = dashboard.attendance || {};
  const leaves = dashboard.leaves || dashboard.leave || {};
  const payroll = dashboard.payroll || {};
  const expenses = dashboard.expenses || {};
  const performance = dashboard.performance || {};
  const holidays = dashboard.holidays || {};

  const totalEmployees =
    employees.total ??
    employees.totalEmployees ??
    dashboard.totalEmployees ??
    0;

  const activeEmployees =
    employees.active ??
    employees.activeEmployees ??
    dashboard.activeEmployees ??
    0;

  const inactiveEmployees =
    employees.inactive ??
    employees.inactiveEmployees ??
    dashboard.inactiveEmployees ??
    0;

  const presentToday =
    attendance.present ??
    attendance.presentToday ??
    dashboard.presentToday ??
    0;

  const absentToday =
    attendance.absent ??
    attendance.absentToday ??
    dashboard.absentToday ??
    0;

  const lateToday =
    attendance.late ??
    attendance.lateToday ??
    dashboard.lateToday ??
    0;

  const onLeaveToday =
    attendance.onLeave ??
    attendance.onLeaveToday ??
    dashboard.onLeaveToday ??
    0;

  const pendingLeaves =
    leaves.pending ??
    leaves.pendingLeaves ??
    dashboard.pendingLeaves ??
    0;

  const approvedLeaves =
    leaves.approved ??
    leaves.approvedLeaves ??
    dashboard.approvedLeaves ??
    0;

  const pendingPayroll =
    payroll.pending ??
    payroll.pendingPayroll ??
    0;

  const totalPayroll =
    payroll.total ??
    payroll.totalPayroll ??
    0;

  const pendingExpenses =
    expenses.pending ??
    expenses.pendingExpenses ??
    0;

  const totalExpenses =
    expenses.total ??
    expenses.totalExpenses ??
    0;

  const performanceReviews =
    performance.total ??
    performance.totalReviews ??
    0;

  const upcomingHolidays =
    holidays.upcoming ??
    holidays.upcomingHolidays ??
    0;

  /* ======================================================
     CALCULATIONS
  ====================================================== */

  const attendanceTotal =
    Number(presentToday) +
    Number(absentToday) +
    Number(onLeaveToday);

  const attendancePercentage =
    attendanceTotal > 0
      ? Math.round(
          (Number(presentToday) / attendanceTotal) * 100
        )
      : 0;

  const activePercentage =
    Number(totalEmployees) > 0
      ? Math.round(
          (Number(activeEmployees) /
            Number(totalEmployees)) *
            100
        )
      : 0;

  /* ======================================================
     EMPTY STATE
  ====================================================== */

  const hasData = Object.keys(dashboard).length > 0;

  if (!hasData) {
    return (
      <div className="p-12 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
        <Inbox
          className="mx-auto mb-3 text-slate-300"
          size={36}
        />

        <p className="font-semibold text-slate-700">
          No HR metrics yet
        </p>

        <p className="mt-1 text-sm text-slate-400">
          Add employees and HR data to populate the dashboard.
        </p>
      </div>
    );
  }

  /* ======================================================
     DASHBOARD UI
  ====================================================== */

  return (
    <div className="space-y-6">

      {/* ==================================================
          WELCOME / SUMMARY
      ================================================== */}
      <div className="relative p-6 overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 rounded-3xl">
        <div className="absolute w-64 h-64 rounded-full -top-32 -right-20 bg-white/10 blur-3xl" />
        <div className="absolute w-48 h-48 rounded-full -bottom-24 left-20 bg-blue-300/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-100 uppercase">
              HR Overview
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Workforce Dashboard
            </h2>

            <p className="max-w-2xl mt-2 text-sm leading-6 text-indigo-100">
              Monitor employees, attendance, leave, payroll,
              expenses and performance from one place.
            </p>
          </div>

          <button
            onClick={load}
            className="px-4 py-2.5 text-sm font-semibold text-indigo-700 transition bg-white rounded-xl hover:bg-indigo-50"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* ==================================================
          KPI CARDS
      ================================================== */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Employees */}
        <div className="relative p-5 overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="absolute w-20 h-20 rounded-full -top-8 -right-8 bg-indigo-50 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center text-indigo-600 w-11 h-11 bg-indigo-50 rounded-xl">
                <UsersIcon size={21} />
              </div>

              <span className="text-xs font-semibold text-indigo-600">
                Workforce
              </span>
            </div>

            <p className="mt-5 text-3xl font-bold text-slate-900">
              {totalEmployees}
            </p>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Total Employees
            </p>

            <div className="flex gap-4 mt-4 text-xs">
              <span className="text-emerald-600">
                ● {activeEmployees} Active
              </span>

              <span className="text-slate-400">
                ● {inactiveEmployees} Inactive
              </span>
            </div>
          </div>
        </div>

        {/* Attendance */}
        <div className="relative p-5 overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="absolute w-20 h-20 rounded-full -top-8 -right-8 bg-emerald-50 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-11 h-11 text-emerald-600 bg-emerald-50 rounded-xl">
                <CalendarCheck size={21} />
              </div>

              <span className="text-xs font-bold text-emerald-600">
                {attendancePercentage}%
              </span>
            </div>

            <p className="mt-5 text-3xl font-bold text-slate-900">
              {presentToday}
            </p>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Present Today
            </p>

            <div className="flex gap-4 mt-4 text-xs">
              <span className="text-rose-500">
                {absentToday} Absent
              </span>

              <span className="text-amber-500">
                {lateToday} Late
              </span>
            </div>
          </div>
        </div>

        {/* Leave */}
        <div className="relative p-5 overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="absolute w-20 h-20 rounded-full -top-8 -right-8 bg-amber-50 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-11 h-11 text-amber-600 bg-amber-50 rounded-xl">
                <Plane size={21} />
              </div>

              <span className="text-xs font-semibold text-amber-600">
                Leave
              </span>
            </div>

            <p className="mt-5 text-3xl font-bold text-slate-900">
              {onLeaveToday}
            </p>

            <p className="mt-1 text-sm font-medium text-slate-500">
              On Leave Today
            </p>

            <div className="flex gap-4 mt-4 text-xs">
              <span className="text-amber-600">
                {pendingLeaves} Pending
              </span>

              <span className="text-emerald-600">
                {approvedLeaves} Approved
              </span>
            </div>
          </div>
        </div>

        {/* Payroll */}
        <div className="relative p-5 overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="absolute w-20 h-20 rounded-full -top-8 -right-8 bg-violet-50 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center justify-center w-11 h-11 text-violet-600 bg-violet-50 rounded-xl">
                <Wallet size={21} />
              </div>

              <span className="text-xs font-semibold text-violet-600">
                Payroll
              </span>
            </div>

            <p className="mt-5 text-3xl font-bold text-slate-900">
              {totalPayroll}
            </p>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Payroll Records
            </p>

            <p className="mt-4 text-xs text-amber-600">
              {pendingPayroll} Pending
            </p>
          </div>
        </div>
      </div>

      {/* ==================================================
          ATTENDANCE + WORKFORCE
      ================================================== */}
      <div className="grid gap-6 xl:grid-cols-3">

        {/* Workforce */}
        <div className="p-6 bg-white border shadow-sm xl:col-span-2 rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Workforce Overview
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Current employee distribution.
              </p>
            </div>

            <UsersIcon
              size={20}
              className="text-indigo-500"
            />
          </div>

          <div className="grid gap-8 mt-8 md:grid-cols-2">

            {/* Circle */}
            <div className="flex items-center justify-center">
              <div
                className="relative flex items-center justify-center rounded-full w-44 h-44"
                style={{
                  background: `conic-gradient(#4f46e5 ${
                    activePercentage * 3.6
                  }deg, #e2e8f0 0deg)`,
                }}
              >
                <div className="flex flex-col items-center justify-center w-32 h-32 bg-white rounded-full">
                  <span className="text-3xl font-bold text-slate-900">
                    {activePercentage}%
                  </span>

                  <span className="mt-1 text-xs text-slate-500">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600">
                  Total Employees
                </span>

                <span className="font-bold text-slate-900">
                  {totalEmployees}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50">
                <span className="text-sm text-emerald-700">
                  Active Employees
                </span>

                <span className="font-bold text-emerald-700">
                  {activeEmployees}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600">
                  Inactive Employees
                </span>

                <span className="font-bold text-slate-700">
                  {inactiveEmployees}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance */}
        <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                Today's Attendance
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Daily attendance summary.
              </p>
            </div>

            <CalendarCheck
              size={20}
              className="text-emerald-500"
            />
          </div>

          <div className="flex items-center justify-center mt-7">
            <div
              className="flex items-center justify-center w-32 h-32 rounded-full"
              style={{
                background: `conic-gradient(#10b981 ${
                  attendancePercentage * 3.6
                }deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="flex flex-col items-center justify-center w-24 h-24 bg-white rounded-full">
                <span className="text-2xl font-bold text-slate-900">
                  {attendancePercentage}%
                </span>

                <span className="text-[10px] text-slate-400">
                  Attendance
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-7">

            <div className="flex justify-between">
              <span className="text-xs text-slate-500">
                Present
              </span>

              <span className="text-sm font-bold text-emerald-600">
                {presentToday}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-xs text-slate-500">
                Absent
              </span>

              <span className="text-sm font-bold text-rose-600">
                {absentToday}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-xs text-slate-500">
                Late
              </span>

              <span className="text-sm font-bold text-amber-600">
                {lateToday}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-xs text-slate-500">
                On Leave
              </span>

              <span className="text-sm font-bold text-indigo-600">
                {onLeaveToday}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          HR OPERATIONS
      ================================================== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-10 h-10 text-amber-600 bg-amber-50 rounded-xl">
              <CalendarDays size={19} />
            </div>

            <span className="text-xs text-slate-400">
              Holidays
            </span>
          </div>

          <p className="mt-5 text-2xl font-bold text-slate-900">
            {upcomingHolidays}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Upcoming Holidays
          </p>
        </div>

        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-10 h-10 text-rose-600 bg-rose-50 rounded-xl">
              <Receipt size={19} />
            </div>

            <span className="text-xs text-slate-400">
              Expenses
            </span>
          </div>

          <p className="mt-5 text-2xl font-bold text-slate-900">
            {totalExpenses}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Expense Records
          </p>

          <p className="mt-3 text-xs text-amber-600">
            {pendingExpenses} Pending
          </p>
        </div>

        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-10 h-10 text-violet-600 bg-violet-50 rounded-xl">
              <TrendingUp size={19} />
            </div>

            <span className="text-xs text-slate-400">
              Performance
            </span>
          </div>

          <p className="mt-5 text-2xl font-bold text-slate-900">
            {performanceReviews}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Performance Reviews
          </p>
        </div>

        <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-10 h-10 text-blue-600 bg-blue-50 rounded-xl">
              <FileText size={19} />
            </div>

            <span className="text-xs text-slate-400">
              Leave
            </span>
          </div>

          <p className="mt-5 text-2xl font-bold text-slate-900">
            {pendingLeaves}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Pending Leave Requests
          </p>
        </div>
      </div>

      {/* ==================================================
          RAW BACKEND GROUPS
          Automatically shows any additional metrics returned
          by backend without hardcoding them.
      ================================================== */}
      {Object.entries(dashboard)
        .filter(
          ([key, value]) =>
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            ![
              "employees",
              "attendance",
              "leaves",
              "leave",
              "payroll",
              "expenses",
              "performance",
              "holidays",
            ].includes(key)
        )
        .map(([group, metrics]) => {
          const rows = Object.entries(metrics).filter(
            ([, value]) =>
              typeof value === "number" ||
              typeof value === "string"
          );

          if (!rows.length) return null;

          const title = group
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (c) => c.toUpperCase());

          return (
            <div
              key={group}
              className="p-6 bg-white border shadow-sm rounded-2xl border-slate-200"
            >
              <h3 className="font-bold text-slate-900">
                {title}
              </h3>

              <div className="grid gap-4 mt-5 sm:grid-cols-2 lg:grid-cols-4">
                {rows.map(([key, value]) => (
                  <div
                    key={key}
                    className="p-4 rounded-xl bg-slate-50"
                  >
                    <p className="text-xs text-slate-500">
                      {key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (c) =>
                          c.toUpperCase()
                        )}
                    </p>

                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

   