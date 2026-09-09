import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plane,
  RefreshCw,
  Users,
} from "lucide-react";

import * as hr from "../../services/hr";
import { HR_ENUMS } from "../../services/hr";
import { Badge } from "./HRSection";
import { empName, fmtDate, statusTone } from "./hrFormat";

/* ======================================================
   MAIN HR CALENDAR

   Single month view that overlays the three existing HR
   data sources on one grid:
     • Holidays  GET /api/hr/holidays?fromDate&toDate
     • Leaves    GET /api/hr/leaves?fromDate&toDate&status
     • Shifts    GET /api/hr/shifts?status=Active
                 (workingDays drives the Week Off shading)

   No new endpoints — everything comes from services/hr.js.
====================================================== */

/* Grid runs Monday → Sunday to match the Shift.workingDays enum. */
const WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Local YYYY-MM-DD key (avoids UTC drift from toISOString). */
const key = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Monday of the week containing the 1st of the month. */
const gridStartOf = (year, month) => {
  const first = new Date(year, month, 1);
  return addDays(first, -((first.getDay() + 6) % 7));
};

const LEAVE_TONE = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Cancelled: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function HRCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [leaveStatus, setLeaveStatus] = useState("Approved");
  const [shiftId, setShiftId] = useState("");
  const [show, setShow] = useState({
    holidays: true,
    leaves: true,
    shifts: true,
  });
  const [selected, setSelected] = useState(key(new Date()));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const days = useMemo(() => {
    const start = gridStartOf(year, month);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [year, month]);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const gridStart = days[0];
    const gridEnd = days[41];

    try {
      const [holidayRes, leaveRes, shiftRes] = await Promise.all([
        hr.getHolidays({
          fromDate: key(gridStart),
          toDate: key(gridEnd),
          isActive: true,
          limit: 200,
        }),
        // The leaves endpoint ranges on fromDate only, so we widen the
        // window backwards and clip overlaps on the client.
        hr.getLeaves({
          fromDate: key(addDays(gridStart, -90)),
          toDate: key(gridEnd),
          ...(leaveStatus ? { status: leaveStatus } : {}),
          limit: 100,
        }),
        hr.getShifts({ status: "Active", limit: 100 }),
      ]);

      setHolidays(hr.readList(holidayRes).rows);
      setLeaves(hr.readList(leaveRes).rows);
      setShifts(hr.readList(shiftRes).rows);
    } catch (err) {
      setHolidays([]);
      setLeaves([]);
      setShifts([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load calendar data"
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, leaveStatus]);

  useEffect(() => {
    load();
  }, [load]);

  /* ================= INDEX BY DAY ================= */
  const holidayMap = useMemo(() => {
    const m = {};
    holidays.forEach((h) => {
      if (!h?.date) return;
      (m[key(new Date(h.date))] ||= []).push(h);
    });
    return m;
  }, [holidays]);

  const leaveMap = useMemo(() => {
    const m = {};
    const gridStart = days[0];
    const gridEnd = days[41];

    leaves.forEach((l) => {
      if (!l?.fromDate) return;
      const from = new Date(l.fromDate);
      const to = new Date(l.toDate || l.fromDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return;

      let d = from < gridStart ? new Date(gridStart) : from;
      const stop = to > gridEnd ? gridEnd : to;

      for (; d <= stop; d = addDays(d, 1)) (m[key(d)] ||= []).push(l);
    });
    return m;
  }, [leaves, days]);

  const activeShift = useMemo(
    () => shifts.find((s) => s._id === shiftId) || null,
    [shifts, shiftId]
  );

  /** Shifts scheduled on a weekday (a shift with no workingDays runs daily). */
  const shiftsOn = useCallback(
    (weekday) => {
      const pool = activeShift ? [activeShift] : shifts;
      return pool.filter(
        (s) =>
          !Array.isArray(s.workingDays) ||
          s.workingDays.length === 0 ||
          s.workingDays.includes(weekday)
      );
    },
    [shifts, activeShift]
  );

  /* ================= SUMMARY ================= */
  const monthStats = useMemo(() => {
    const inMonth = (d) => d.getMonth() === month && d.getFullYear() === year;

    const holidayCount = Object.entries(holidayMap).filter(([k]) =>
      k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
    ).length;

    const leaveDays = days.filter(
      (d) => inMonth(d) && (leaveMap[key(d)] || []).length
    ).length;

    const onLeave = new Set();
    days.forEach((d) => {
      if (!inMonth(d)) return;
      (leaveMap[key(d)] || []).forEach((l) =>
        onLeave.add(typeof l.employee === "object" ? l.employee?._id : l.employee)
      );
    });

    return {
      holidays: holidayCount,
      leaveDays,
      employeesOnLeave: onLeave.size,
      shifts: shifts.length,
    };
  }, [holidayMap, leaveMap, days, month, year, shifts.length]);

  const upcoming = useMemo(
    () =>
      holidays
        .filter((h) => h?.date && new Date(h.date) >= new Date(key(today)))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5),
    [holidays, today]
  );

  const selectedDate = useMemo(() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selected]);

  const selectedWeekday = WEEK[(selectedDate.getDay() + 6) % 7];
  const selectedHolidays = holidayMap[selected] || [];
  const selectedLeaves = leaveMap[selected] || [];
  const selectedShifts = shiftsOn(selectedWeekday);

  const move = (delta) => setCursor(new Date(year, month + delta, 1));

  const jumpToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(key(today));
  };

  const monthLabel = cursor.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  /* ================= UI ================= */
  return (
    <div className="space-y-5">
      {/* ============ TOOLBAR ============ */}
      <div className="flex flex-col gap-4 p-4 bg-white border shadow-sm rounded-2xl border-slate-200 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => move(-1)}
            title="Previous month"
            className="p-2.5 border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="min-w-[11rem] text-center">
            <p className="text-base font-bold text-slate-900">{monthLabel}</p>
            <p className="text-[11px] text-slate-500">
              Holidays · Leave · Shifts
            </p>
          </div>

          <button
            onClick={() => move(1)}
            title="Next month"
            className="p-2.5 border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={jumpToday}
            className="px-3 py-2 ml-1 text-xs font-semibold border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "holidays", label: "Holidays", icon: CalendarDays },
            { id: "leaves", label: "Leave", icon: Plane },
            { id: "shifts", label: "Shifts", icon: Clock },
          ].map((l) => {
            const Icon = l.icon;
            const on = show[l.id];
            return (
              <button
                key={l.id}
                onClick={() => setShow((s) => ({ ...s, [l.id]: !s[l.id] }))}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-xl transition ${
                  on
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "border-slate-200 text-slate-400 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} />
                {l.label}
              </button>
            );
          })}

          <select
            value={leaveStatus}
            onChange={(e) => setLeaveStatus(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 outline-none rounded-xl focus:border-indigo-500"
          >
            <option value="">Leave: All statuses</option>
            {HR_ENUMS.leaveStatus.map((s) => (
              <option key={s} value={s}>
                Leave: {s}
              </option>
            ))}
          </select>

          <select
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 outline-none rounded-xl focus:border-indigo-500"
          >
            <option value="">Shift: All active</option>
            {shifts.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
                {s.code ? ` (${s.code})` : ""}
              </option>
            ))}
          </select>

          <button
            onClick={load}
            title="Refresh"
            className="p-2.5 border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ============ MONTH SUMMARY ============ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Holidays this month",
            value: monthStats.holidays,
            icon: CalendarDays,
            cls: "text-amber-600 bg-amber-50",
          },
          {
            label: "Days with leave",
            value: monthStats.leaveDays,
            icon: Plane,
            cls: "text-indigo-600 bg-indigo-50",
          },
          {
            label: "Employees on leave",
            value: monthStats.employeesOnLeave,
            icon: Users,
            cls: "text-violet-600 bg-violet-50",
          },
          {
            label: "Active shifts",
            value: monthStats.shifts,
            icon: Clock,
            cls: "text-emerald-600 bg-emerald-50",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-4 p-4 bg-white border shadow-sm rounded-2xl border-slate-200"
            >
              <div
                className={`flex items-center justify-center w-11 h-11 rounded-xl ${s.cls}`}
              >
                <Icon size={19} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? "—" : s.value}
                </p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ ERROR ============ */}
      {error && !loading && (
        <div className="p-8 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
          <AlertTriangle className="mx-auto mb-3 text-rose-500" size={28} />
          <p className="font-semibold text-slate-800">
            Couldn't load calendar data
          </p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 mt-4 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <div className="grid gap-5 xl:grid-cols-3">
          {/* ============ GRID ============ */}
          <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200 xl:col-span-2">
            <div className="grid grid-cols-7 border-b bg-slate-50 border-slate-200">
              {WEEK.map((d) => (
                <div
                  key={d}
                  className="px-2 py-3 text-[11px] font-bold tracking-wide text-center uppercase text-slate-500"
                >
                  <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                  <span className="sm:hidden">{d.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 42 }, (_, i) => (
                  <div
                    key={i}
                    className="h-24 border-b border-r border-slate-100 sm:h-28"
                  >
                    <div className="w-full h-full bg-slate-50 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {days.map((d) => {
                  const k = key(d);
                  const weekday = WEEK[(d.getDay() + 6) % 7];
                  const inMonth = d.getMonth() === month;
                  const isToday = k === key(today);
                  const isSelected = k === selected;

                  const dayHolidays = show.holidays ? holidayMap[k] || [] : [];
                  const dayLeaves = show.leaves ? leaveMap[k] || [] : [];
                  const daysShifts = show.shifts ? shiftsOn(weekday) : [];
                  const weekOff =
                    show.shifts && shifts.length > 0 && daysShifts.length === 0;

                  const shownHolidays = dayHolidays.slice(0, 1);
                  const shownLeaves = dayLeaves.slice(
                    0,
                    shownHolidays.length ? 1 : 2
                  );
                  const extra =
                    dayHolidays.length +
                    dayLeaves.length -
                    shownHolidays.length -
                    shownLeaves.length;

                  return (
                    <button
                      key={k}
                      onClick={() => setSelected(k)}
                      className={`relative h-24 sm:h-28 p-2 text-left align-top border-b border-r border-slate-100 transition ${
                        inMonth ? "bg-white" : "bg-slate-50/60"
                      } ${weekOff ? "bg-slate-100/70" : ""} ${
                        dayHolidays.length ? "bg-amber-50/60" : ""
                      } ${
                        isSelected
                          ? "ring-2 ring-inset ring-indigo-500"
                          : "hover:bg-indigo-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full ${
                            isToday
                              ? "bg-indigo-600 text-white"
                              : inMonth
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {d.getDate()}
                        </span>

                        {weekOff && (
                          <span className="text-[9px] font-semibold uppercase text-slate-400">
                            Off
                          </span>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {shownHolidays.map((h) => (
                          <p
                            key={h._id}
                            title={h.name}
                            className="px-1.5 py-0.5 text-[10px] font-semibold truncate border rounded-md bg-amber-100 border-amber-200 text-amber-800"
                          >
                            {h.name}
                          </p>
                        ))}

                        {shownLeaves.map((l) => (
                          <p
                            key={`${l._id}-${k}`}
                            title={`${empName(l.employee)} · ${l.leaveType} · ${
                              l.status
                            }`}
                            className={`px-1.5 py-0.5 text-[10px] font-medium truncate border rounded-md ${
                              LEAVE_TONE[l.status] || LEAVE_TONE.Cancelled
                            }`}
                          >
                            {empName(l.employee)}
                          </p>
                        ))}

                        {extra > 0 && (
                          <p className="text-[10px] font-semibold text-slate-400">
                            +{extra} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* LEGEND */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t bg-slate-50 border-slate-200">
              {[
                { c: "bg-amber-200", l: "Holiday" },
                { c: "bg-emerald-200", l: "Approved leave" },
                { c: "bg-amber-100", l: "Pending leave" },
                { c: "bg-slate-200", l: "Week off (shift)" },
                { c: "bg-indigo-600", l: "Today" },
              ].map((x) => (
                <span
                  key={x.l}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500"
                >
                  <span className={`w-3 h-3 rounded ${x.c}`} />
                  {x.l}
                </span>
              ))}
            </div>
          </div>

          {/* ============ DAY DETAIL ============ */}
          <div className="space-y-5">
            <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-400">
                {selectedWeekday}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {fmtDate(selectedDate)}
              </h3>

              {/* Holidays */}
              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <CalendarDays size={13} /> Holidays
                </p>

                {selectedHolidays.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    No holiday on this date.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedHolidays.map((h) => (
                      <div
                        key={h._id}
                        className="p-3 border rounded-xl border-amber-200 bg-amber-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-amber-900">
                            {h.name}
                          </p>
                          <Badge value={h.type} tone="amber" />
                        </div>
                        {h.description && (
                          <p className="mt-1 text-xs text-amber-700">
                            {h.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leaves */}
              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <Plane size={13} /> On leave ({selectedLeaves.length})
                </p>

                {selectedLeaves.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Nobody on leave for this date.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedLeaves.map((l) => (
                      <div
                        key={`${l._id}-detail`}
                        className="flex items-center justify-between gap-2 p-3 border rounded-xl border-slate-200"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-slate-800">
                            {empName(l.employee)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {l.leaveType} · {fmtDate(l.fromDate)} →{" "}
                            {fmtDate(l.toDate)}
                          </p>
                        </div>
                        <Badge value={l.status} tone={statusTone(l.status)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shifts */}
              <div className="mt-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                  <Clock size={13} /> Shifts running
                </p>

                {selectedShifts.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {shifts.length
                      ? "Week off — no shift scheduled."
                      : "No active shifts configured."}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedShifts.map((s) => (
                      <div
                        key={s._id}
                        className="flex items-center justify-between gap-2 p-3 border rounded-xl border-slate-200"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-slate-800">
                            {s.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.startTime} – {s.endTime}
                            {s.isNightShift ? " · Night" : ""}
                          </p>
                        </div>
                        <Badge value={s.code} tone="blue" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming holidays */}
            <div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Upcoming holidays
              </h3>

              {loading ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-xl bg-slate-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No upcoming holidays in this month's range.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {upcoming.map((h) => (
                    <div
                      key={`up-${h._id}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-slate-800">
                          {h.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {fmtDate(h.date)}
                        </p>
                      </div>
                      <Badge value={h.type} tone="blue" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
