import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Coffee,
  Edit,
  Inbox,
  Moon,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import * as hr from "../../services/hr";
import { HR_ENUMS } from "../../services/hr";
import { Badge } from "./HRSection";
import { empName, fmtTime, spanHours } from "./hrFormat";

/* ======================================================
   SHIFTS BOARD

   Professional shift roster built on the existing endpoints:
     GET    /api/hr/shifts
     POST   /api/hr/shifts
     PUT    /api/hr/shifts/:id
     PATCH  /api/hr/shifts/:id/status
     DELETE /api/hr/shifts/:id
     GET    /api/hr/shifts/:id/employees
====================================================== */

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EMPTY = {
  name: "",
  code: "",
  startTime: "",
  endTime: "",
  breakMinutes: 60,
  gracePeriodMinutes: 15,
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  isNightShift: false,
  status: "Active",
};

const inputCls =
  "w-full p-3 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500";

/** Position of a HH:mm time on a 24h track, as a percentage. */
const pct = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  if (Number.isNaN(h)) return 0;
  return ((h * 60 + (m || 0)) / 1440) * 100;
};

export default function ShiftsBoard() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [roster, setRoster] = useState(null); // { shift, employees, loading }

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await hr.getShifts({
        limit: 100,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      setShifts(hr.readList(data).rows);
    } catch (err) {
      setShifts([]);
      setError(
        err?.response?.data?.message || err?.message || "Failed to load shifts"
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  /* ================= FORM ================= */
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({
      name: s.name || "",
      code: s.code || "",
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      breakMinutes: s.breakMinutes ?? 60,
      gracePeriodMinutes: s.gracePeriodMinutes ?? 15,
      workingDays: Array.isArray(s.workingDays) ? s.workingDays : [],
      isNightShift: Boolean(s.isNightShift),
      status: s.status || "Active",
    });
    setModal(true);
  };

  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(d)
        ? f.workingDays.filter((x) => x !== d)
        : DAYS.filter((x) => x === d || f.workingDays.includes(x)),
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.name.trim()) return toast.error("Shift name is required");
    if (!form.code.trim()) return toast.error("Shift code is required");
    if (!form.startTime) return toast.error("Start time is required");
    if (!form.endTime) return toast.error("End time is required");

    const payload = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      breakMinutes: Number(form.breakMinutes) || 0,
      gracePeriodMinutes: Number(form.gracePeriodMinutes) || 0,
    };

    try {
      setSaving(true);
      if (editingId) {
        await hr.updateShift(editingId, payload);
        toast.success("Shift updated");
      } else {
        await hr.createShift(payload);
        toast.success("Shift created");
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (s) => {
    const next = s.status === "Active" ? "Inactive" : "Active";
    try {
      await hr.setShiftStatus(s._id, { status: next });
      toast.success(`Shift marked ${next}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Status update failed");
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    try {
      await hr.deleteShift(s._id);
      toast.success("Shift deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const openRoster = async (s) => {
    setRoster({ shift: s, employees: [], loading: true, error: "" });
    try {
      const res = await hr.getShiftEmployees(s._id);
      setRoster({
        shift: s,
        employees: hr.readList(res).rows,
        loading: false,
        error: "",
      });
    } catch (err) {
      setRoster({
        shift: s,
        employees: [],
        loading: false,
        error:
          err?.response?.data?.message || "Failed to load assigned employees",
      });
    }
  };

  const activeCount = shifts.filter((s) => s.status === "Active").length;
  const nightCount = shifts.filter((s) => s.isNightShift).length;

  /* ================= UI ================= */
  return (
    <div className="space-y-5">
      {/* ============ TOOLBAR ============ */}
      <div className="flex flex-col gap-3 p-4 bg-white border shadow-sm rounded-2xl border-slate-200 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute text-slate-400 left-3 top-3"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shifts..."
              className="w-full py-2.5 pl-9 pr-3 text-sm border outline-none rounded-xl bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 outline-none rounded-xl focus:border-indigo-500"
          >
            <option value="">Status: All</option>
            {HR_ENUMS.activeStatus.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="hidden gap-4 text-xs text-slate-500 sm:flex">
            <span className="text-emerald-600 font-semibold">
              {activeCount} Active
            </span>
            <span>{nightCount} Night</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh"
            className="p-2.5 text-slate-600 border rounded-xl border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white shadow-lg rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-indigo-500/30"
          >
            <Plus size={16} />
            Add Shift
          </button>
        </div>
      </div>

      {/* ============ LOADING ============ */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-56 bg-white border shadow-sm rounded-2xl border-slate-200 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ============ ERROR ============ */}
      {!loading && error && (
        <div className="p-10 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
          <AlertTriangle className="mx-auto mb-3 text-rose-500" size={28} />
          <p className="font-semibold text-slate-800">Couldn't load shifts</p>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 mt-4 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ============ EMPTY ============ */}
      {!loading && !error && shifts.length === 0 && (
        <div className="p-12 text-center bg-white border shadow-sm rounded-2xl border-slate-200">
          <Inbox className="mx-auto mb-3 text-slate-300" size={32} />
          <p className="font-semibold text-slate-700">No shifts found</p>
          <p className="mt-1 text-sm text-slate-400">
            {search || status
              ? "Try clearing the search or filters."
              : 'Click "Add Shift" to define your first shift.'}
          </p>
        </div>
      )}

      {/* ============ SHIFT CARDS ============ */}
      {!loading && !error && shifts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shifts.map((s) => {
            const hours = spanHours(s.startTime, s.endTime);
            const start = pct(s.startTime);
            const end = pct(s.endTime);
            const wrap = end <= start; // crosses midnight

            return (
              <div
                key={s._id}
                className="flex flex-col p-5 bg-white border shadow-sm rounded-2xl border-slate-200 hover:shadow-md transition"
              >
                {/* header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${
                        s.isNightShift
                          ? "bg-indigo-50 text-indigo-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {s.isNightShift ? <Moon size={19} /> : <Sun size={19} />}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold truncate text-slate-900">
                        {s.name}
                      </p>
                      <p className="text-xs font-semibold tracking-wide text-slate-400">
                        {s.code}
                      </p>
                    </div>
                  </div>

                  <Badge
                    value={s.status}
                    tone={s.status === "Active" ? "green" : "red"}
                  />
                </div>

                {/* timing */}
                <div className="flex items-center justify-between mt-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      Start
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {fmtTime(s.startTime)}
                    </p>
                  </div>

                  <div className="px-2.5 py-1 text-[11px] font-bold rounded-full text-indigo-700 bg-indigo-50">
                    {hours != null ? `${hours} h` : "—"}
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      End
                    </p>
                    <p className="text-sm font-semibold text-slate-800">
                      {fmtTime(s.endTime)}
                    </p>
                  </div>
                </div>

                {/* 24h track */}
                <div className="relative w-full h-2 mt-3 overflow-hidden rounded-full bg-slate-100">
                  {wrap ? (
                    <>
                      <span
                        className="absolute h-2 bg-gradient-to-r from-indigo-500 to-blue-500"
                        style={{ left: `${start}%`, width: `${100 - start}%` }}
                      />
                      <span
                        className="absolute left-0 h-2 bg-gradient-to-r from-indigo-500 to-blue-500"
                        style={{ width: `${end}%` }}
                      />
                    </>
                  ) : (
                    <span
                      className="absolute h-2 bg-gradient-to-r from-indigo-500 to-blue-500"
                      style={{ left: `${start}%`, width: `${end - start}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                  <span>12 AM</span>
                  <span>12 PM</span>
                  <span>12 AM</span>
                </div>

                {/* working days */}
                <div className="flex gap-1.5 mt-4">
                  {DAYS.map((d) => {
                    const on =
                      !Array.isArray(s.workingDays) ||
                      s.workingDays.length === 0 ||
                      s.workingDays.includes(d);
                    return (
                      <span
                        key={d}
                        title={`${d}${on ? "" : " — week off"}`}
                        className={`flex items-center justify-center w-7 h-7 text-[10px] font-bold rounded-lg ${
                          on
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {d.slice(0, 1)}
                      </span>
                    );
                  })}
                </div>

                {/* meta */}
                <div className="flex flex-wrap gap-2 mt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50">
                    <Coffee size={12} /> {s.breakMinutes ?? 0}m break
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50">
                    <Clock size={12} /> {s.gracePeriodMinutes ?? 0}m grace
                  </span>
                </div>

                {/* actions */}
                <div className="flex items-center gap-2 pt-4 mt-auto border-t border-slate-100">
                  <button
                    onClick={() => openRoster(s)}
                    className="flex items-center flex-1 gap-2 px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 bg-slate-50 hover:bg-slate-100"
                  >
                    <Users size={14} /> Employees
                  </button>

                  <button
                    onClick={() => toggleStatus(s)}
                    title={s.status === "Active" ? "Deactivate" : "Activate"}
                    className={`p-2 rounded-lg ${
                      s.status === "Active"
                        ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                        : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                    }`}
                  >
                    <Power size={15} />
                  </button>

                  <button
                    onClick={() => openEdit(s)}
                    title="Edit"
                    className="p-2 text-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100"
                  >
                    <Edit size={15} />
                  </button>

                  <button
                    onClick={() => remove(s)}
                    title="Delete"
                    className="p-2 text-red-600 rounded-lg bg-red-50 hover:bg-red-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ ROSTER DRAWER ============ */}
      {roster && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setRoster(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full overflow-y-auto bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-200">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">
                  Assigned employees
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {roster.shift.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {fmtTime(roster.shift.startTime)} –{" "}
                  {fmtTime(roster.shift.endTime)}
                </p>
              </div>

              <button
                onClick={() => setRoster(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {roster.loading &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-slate-100 animate-pulse"
                  />
                ))}

              {!roster.loading && roster.error && (
                <div className="p-6 text-center">
                  <AlertTriangle
                    className="mx-auto mb-3 text-rose-500"
                    size={26}
                  />
                  <p className="text-sm text-slate-500">{roster.error}</p>
                </div>
              )}

              {!roster.loading && !roster.error && !roster.employees.length && (
                <div className="p-8 text-center">
                  <Inbox className="mx-auto mb-3 text-slate-300" size={30} />
                  <p className="font-semibold text-slate-700">
                    No employees assigned
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Assign this shift from the Employees tab.
                  </p>
                </div>
              )}

              {!roster.loading &&
                !roster.error &&
                roster.employees.map((e) => (
                  <div
                    key={e._id}
                    className="flex items-center justify-between gap-3 p-4 border rounded-xl border-slate-200"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-800">
                        {empName(e)}
                      </p>
                      <p className="text-xs truncate text-slate-500">
                        {e.employeeCode}
                        {e.designation ? ` · ${e.designation}` : ""}
                        {e.department ? ` · ${e.department}` : ""}
                      </p>
                    </div>
                    <Badge
                      value={e.status}
                      tone={e.status === "Active" ? "green" : "slate"}
                    />
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL ============ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? "Update Shift" : "Create Shift"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    SHIFT NAME <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. General Shift"
                    className={`${inputCls} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    CODE <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. GEN"
                    className={`${inputCls} mt-2 uppercase`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    START TIME <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                    className={`${inputCls} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    END TIME <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm({ ...form, endTime: e.target.value })
                    }
                    className={`${inputCls} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    BREAK (MINUTES)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.breakMinutes}
                    onChange={(e) =>
                      setForm({ ...form, breakMinutes: e.target.value })
                    }
                    className={`${inputCls} mt-2`}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    GRACE PERIOD (MINUTES)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.gracePeriodMinutes}
                    onChange={(e) =>
                      setForm({ ...form, gracePeriodMinutes: e.target.value })
                    }
                    className={`${inputCls} mt-2`}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500">
                    WORKING DAYS
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DAYS.map((d) => {
                      const on = form.workingDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          className={`px-3 py-2 text-xs font-semibold border rounded-xl transition ${
                            on
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Unselected days are treated as week offs in the HR Calendar.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    STATUS
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className={`${inputCls} mt-2 bg-white`}
                  >
                    {HR_ENUMS.activeStatus.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center w-full gap-3 p-3 border cursor-pointer rounded-xl border-slate-200 bg-slate-50">
                    <input
                      type="checkbox"
                      checked={form.isNightShift}
                      onChange={(e) =>
                        setForm({ ...form, isNightShift: e.target.checked })
                      }
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Night shift
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="flex-1 py-3 text-sm font-semibold border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 text-sm font-semibold text-white shadow-lg rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Shift"
                    : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
