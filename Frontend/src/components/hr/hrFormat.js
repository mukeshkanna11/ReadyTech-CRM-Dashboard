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
