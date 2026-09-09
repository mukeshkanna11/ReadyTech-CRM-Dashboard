/* ======================================================
   HR display helpers (pure functions, shared by HR tabs)
====================================================== */

/** Safe nested read: val(row, "employee.firstName") */
export const val = (row, path) =>
  path.split(".").reduce((o, k) => (o == null ? o : o[k]), row);

export const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "—" : x.toLocaleDateString("en-IN");
};

export const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Employee display name — the API populates `employee` on most records. */
export const empName = (e) =>
  !e
    ? "—"
    : typeof e === "string"
    ? e
    : [e.firstName, e.lastName].filter(Boolean).join(" ") ||
      e.name ||
      e.employeeCode ||
      "—";

/** "09:30" -> "9:30 AM" (shift/attendance times are stored as HH:mm strings). */
export const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return String(t);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
};

/** Duration between two HH:mm strings, in hours (handles night shifts). */
export const spanHours = (start, end) => {
  const toMin = (t) => {
    const [h, m] = String(t || "").split(":").map(Number);
    return Number.isNaN(h) ? null : h * 60 + (m || 0);
  };
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null) return null;
  return Math.round((((b - a + 1440) % 1440) / 60) * 10) / 10;
};

/** Maps any backend status enum value onto a Badge tone. */
export const statusTone = (s) => {
  const v = String(s || "").toLowerCase();

  if (
    [
      "active",
      "approved",
      "present",
      "paid",
      "reimbursed",
      "finalized",
      "processed",
    ].includes(v)
  )
    return "green";

  if (
    ["inactive", "rejected", "absent", "cancelled", "terminated"].includes(v)
  )
    return "red";

  if (
    ["pending", "submitted", "draft", "half day", "late", "on leave"].includes(v)
  )
    return "amber";

  if (["generated", "reviewed", "work from home"].includes(v)) return "blue";

  return "slate";
};
