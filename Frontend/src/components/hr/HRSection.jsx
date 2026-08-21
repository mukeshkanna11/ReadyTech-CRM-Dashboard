import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2, RefreshCw, AlertTriangle, Inbox } from "lucide-react";
import toast from "react-hot-toast";

import { readList } from "../../services/hr";
import { val } from "./hrFormat";

/* ======================================================
   GENERIC HR CRUD SECTION

   One table + modal + search/filter/pagination shell used by every
   HR tab, driven by a config object. Keeps the HR module consistent
   with the existing ERP pages without duplicating a table per section.

   config = {
     title, singular,
     api: { list, create?, update?, remove? },
     columns: [{ key, label, render?, className? }],
     fields:  [{ name, label, type, options?, required?, half? }],
     filters: [{ name, label, options }],
     searchable: bool,
     actions?: (row, reload) => ReactNode,
     initialForm: {},
     toForm?: (row) => ({}),
     toPayload?: (form) => ({}),
   }
====================================================== */

const inputCls =
  "w-full p-3 text-sm border outline-none rounded-xl bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500";

export const Badge = ({ value, tone = "slate" }) => {
  const tones = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
        tones[tone] || tones.slate
      }`}
    >
      {value || "—"}
    </span>
  );
};

export default function HRSection({ config }) {
  const {
    title,
    singular,
    api,
    columns = [],
    fields = [],
    filters = [],
    searchable = true,
    actions,
    initialForm = {},
    toForm,
    toPayload,
  } = config;

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState({});

  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  /* ================= LOAD ================= */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.list({
        page,
        limit: 10,
        ...(searchable && search ? { search } : {}),
        ...filterState,
      });

      const parsed = readList(data);
      setRows(parsed.rows);
      setMeta({ page: parsed.page, pages: parsed.pages, total: parsed.total });
    } catch (err) {
      setRows([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to load ${title.toLowerCase()}`
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, JSON.stringify(filterState)]);

  useEffect(() => {
    load();
  }, [load]);

  /* ================= FORM ================= */
  const openAdd = () => {
    setEditingId(null);
    setForm(initialForm);
    setModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm(toForm ? toForm(row) : { ...initialForm, ...row });
    setModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const missing = fields.find((f) => f.required && !String(form[f.name] ?? "").trim());
    if (missing) return toast.error(`${missing.label} is required`);

    try {
      setSaving(true);
      const payload = toPayload ? toPayload(form) : form;

      if (editingId) {
        if (!api.update) return toast.error("Editing is not supported here");
        await api.update(editingId, payload);
        toast.success(`${singular} updated`);
      } else {
        await api.create(payload);
        toast.success(`${singular} created`);
      }

      setModal(false);
      load();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}?`)) return;
    try {
      await api.remove(id);
      toast.success(`${singular} deleted`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    }
  };

  const canCreate = Boolean(api.create && fields.length);

  return (
    <div className="space-y-5">

      {/* ============ TOOLBAR ============ */}
      <div className="flex flex-col gap-3 p-4 bg-white border shadow-sm rounded-2xl border-slate-200 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex flex-wrap items-center gap-3">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute text-slate-400 left-3 top-3" size={16} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full py-2.5 pl-9 pr-3 text-sm border outline-none rounded-xl bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500"
              />
            </div>
          )}

          {filters.map((f) => (
            <select
              key={f.name}
              value={filterState[f.name] || ""}
              onChange={(e) => {
                setFilterState((s) => ({ ...s, [f.name]: e.target.value }));
                setPage(1);
              }}
              className="py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 outline-none rounded-xl focus:border-indigo-500"
            >
              <option value="">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            title="Refresh"
            className="p-2.5 text-slate-600 border rounded-xl border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          {canCreate && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white shadow-lg rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-indigo-500/30"
            >
              <Plus size={16} />
              Add {singular}
            </button>
          )}
        </div>
      </div>

      {/* ============ TABLE ============ */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 border-slate-200">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`p-4 font-semibold text-left text-slate-600 whitespace-nowrap ${
                      c.className || ""
                    }`}
                  >
                    {c.label}
                  </th>
                ))}
                {(api.update || api.remove || actions) && (
                  <th className="p-4 font-semibold text-center text-slate-600">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {/* LOADING */}
              {loading &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={`sk-${i}`} className="border-b border-slate-100">
                    {columns.map((c) => (
                      <td key={c.key} className="p-4">
                        <div className="h-3 rounded-full bg-slate-100 animate-pulse" />
                      </td>
                    ))}
                    {(api.update || api.remove || actions) && (
                      <td className="p-4">
                        <div className="h-3 rounded-full bg-slate-100 animate-pulse" />
                      </td>
                    )}
                  </tr>
                ))}

              {/* ERROR */}
              {!loading && error && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-10 text-center">
                    <AlertTriangle className="mx-auto mb-3 text-rose-500" size={28} />
                    <p className="font-semibold text-slate-800">Couldn't load {title.toLowerCase()}</p>
                    <p className="mt-1 text-sm text-slate-500">{error}</p>
                    <button
                      onClick={load}
                      className="px-4 py-2 mt-4 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {/* EMPTY */}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-12 text-center">
                    <Inbox className="mx-auto mb-3 text-slate-300" size={32} />
                    <p className="font-semibold text-slate-700">No {title.toLowerCase()} found</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {search || Object.values(filterState).some(Boolean)
                        ? "Try clearing the search or filters."
                        : canCreate
                        ? `Click "Add ${singular}" to create the first record.`
                        : "Nothing to show yet."}
                    </p>
                  </td>
                </tr>
              )}

              {/* ROWS */}
              {!loading &&
                !error &&
                rows.map((row) => (
                  <tr
                    key={row._id}
                    className="transition border-b border-slate-100 hover:bg-indigo-50/40"
                  >
                    {columns.map((c) => (
                      <td key={c.key} className="p-4 align-middle text-slate-700">
                        {c.render ? c.render(row) : val(row, c.key) ?? "—"}
                      </td>
                    ))}

                    {(api.update || api.remove || actions) && (
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {actions?.(row, load)}

                          {api.update && fields.length > 0 && (
                            <button
                              onClick={() => openEdit(row)}
                              title="Edit"
                              className="p-2 text-blue-600 rounded-lg bg-blue-50 hover:bg-blue-100"
                            >
                              <Edit size={15} />
                            </button>
                          )}

                          {api.remove && (
                            <button
                              onClick={() => remove(row._id)}
                              title="Delete"
                              className="p-2 text-red-600 rounded-lg bg-red-50 hover:bg-red-100"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ============ PAGINATION ============ */}
        {!loading && !error && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50 border-slate-200">
            <p className="text-xs text-slate-500">
              Page {meta.page} of {meta.pages} · {meta.total} record
              {meta.total === 1 ? "" : "s"}
            </p>

            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium border rounded-lg border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={meta.page >= meta.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs font-medium border rounded-lg border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============ MODAL ============ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? `Update ${singular}` : `Create ${singular}`}
              </h3>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {fields.map((f) => (
                  <div
                    key={f.name}
                    className={f.half ? "col-span-1" : "col-span-2"}
                  >
                    <label className="text-xs font-semibold text-slate-500">
                      {f.label.toUpperCase()}
                      {f.required && <span className="text-rose-500"> *</span>}
                    </label>

                    {f.type === "select" ? (
                      <select
                        value={form[f.name] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [f.name]: e.target.value })
                        }
                        className={`${inputCls} mt-2 bg-white`}
                      >
                        <option value="">Select {f.label}</option>
                        {(f.options || []).map((o) => {
                          const value = typeof o === "string" ? o : o.value;
                          const label = typeof o === "string" ? o : o.label;
                          return (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={form[f.name] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [f.name]: e.target.value })
                        }
                        className={`${inputCls} mt-2 resize-none`}
                      />
                    ) : (
                      <input
                        type={f.type || "text"}
                        step={f.type === "number" ? "any" : undefined}
                        value={form[f.name] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [f.name]: e.target.value })
                        }
                        placeholder={f.placeholder || ""}
                        className={`${inputCls} mt-2`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
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
                    ? `Update ${singular}`
                    : `Create ${singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
