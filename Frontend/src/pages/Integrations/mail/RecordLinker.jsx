import { useEffect, useState } from "react";
import { Link2, Loader2, Plus, X } from "lucide-react";
import { mailApi, LINK_TYPES, linkLabel, errorText } from "./mailApi";

/* Link an email to CRM leads, ERP customers / suppliers and orders */
export function LinkChips({ links = [], onRemove }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <span key={`${l.type}:${l.id}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
          <Link2 size={11} />
          <span className="text-indigo-500">{linkLabel(l.type)}:</span> {l.label || "record"}
          {onRemove && (
            <button type="button" onClick={() => onRemove(l)} className="ml-0.5 rounded-full hover:text-indigo-900" aria-label={`Remove link ${l.label}`}>
              <X size={11} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export default function RecordLinker({ links, onChange, onPick }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("lead");
  const [q, setQ] = useState("");
  const [state, setState] = useState({ loading: false, items: [], error: null });

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    const t = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      mailApi.linkTargets(type, q)
        .then((items) => live && setState({ loading: false, items, error: null }))
        .catch((err) => live && setState({ loading: false, items: [], error: errorText(err, "Couldn't search records") }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, type, q]);

  const add = (item) => {
    if (!links.some((l) => l.type === item.type && l.id === item.id)) onChange([...links, { type: item.type, id: item.id, label: item.label }]);
    onPick?.(item);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <LinkChips links={links} onRemove={(l) => onChange(links.filter((x) => !(x.type === l.type && x.id === l.id)))} />
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
          <Plus size={13} /> Link to record
        </button>
      </div>
      {open && (
        <div className="absolute left-0 z-20 w-full max-w-md p-3 mt-2 bg-white border shadow-lg rounded-xl border-slate-200">
          <div className="flex flex-wrap gap-1 mb-2">
            {LINK_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${type === t.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${linkLabel(type).toLowerCase()}s…`}
            className="w-full px-3 py-2 text-sm border rounded-lg border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="mt-2 overflow-y-auto max-h-56">
            {state.loading ? (
              <p className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Searching…</p>
            ) : state.error ? (
              <p className="px-2 py-3 text-xs text-red-600">{state.error}</p>
            ) : state.items.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">No matching {linkLabel(type).toLowerCase()}s.</p>
            ) : (
              state.items.map((item) => (
                <button key={item.id} type="button" onClick={() => add(item)} className="flex flex-col w-full px-2 py-1.5 text-left rounded-lg hover:bg-slate-50">
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  {item.email && <span className="text-xs text-slate-500">{item.email}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
