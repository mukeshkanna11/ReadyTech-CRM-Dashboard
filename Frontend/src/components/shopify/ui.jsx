import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

/* Shared building blocks for the Shopify Integration page */

export function Card({ title, subtitle, icon: Icon, actions, children, className = "" }) {
  return (
    <section className={`bg-white border shadow-sm rounded-2xl border-slate-200 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex items-start min-w-0 gap-3">
            {Icon && (
              <div className="grid w-9 h-9 rounded-xl bg-slate-100 text-slate-600 place-items-center shrink-0">
                <Icon size={18} />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className="p-5 space-y-4 sm:p-6">{children}</div>
    </section>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function Badge({ tone = "slate", children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="p-3 rounded-xl bg-slate-50">
      <dt className="text-xs font-medium tracking-wide uppercase text-slate-500">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="p-6 space-y-4 bg-white border shadow-sm rounded-2xl border-slate-200" aria-busy="true">
      <Skeleton className="w-1/3 h-5" />
      <Skeleton className="w-2/3 h-4" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    </div>
  );
}

const NOTICE = {
  info: ["bg-sky-50 border-sky-200 text-sky-800", Info],
  success: ["bg-emerald-50 border-emerald-200 text-emerald-800", CheckCircle2],
  warning: ["bg-amber-50 border-amber-200 text-amber-800", AlertTriangle],
  error: ["bg-red-50 border-red-200 text-red-700", XCircle],
};

export function Notice({ type = "info", title, children, action }) {
  const [cls, Icon] = NOTICE[type];
  return (
    <div role={type === "error" ? "alert" : "status"} className={`flex items-start gap-2.5 p-3.5 text-sm border rounded-xl ${cls}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 break-words">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }) {
  const Icon = icon || Info;
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center border border-dashed rounded-xl border-slate-200">
      <Icon size={22} className="text-slate-400" />
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 text-xs text-slate-500">{children}</p>}
    </div>
  );
}

const BUTTON = {
  primary: "text-white bg-emerald-600 hover:bg-emerald-700",
  secondary: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
  danger: "border border-red-200 text-red-600 bg-white hover:bg-red-50",
};

export function Button({ variant = "secondary", loading, icon: Icon, children, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON[variant]} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

/* Modal confirmation; Escape / backdrop cancel unless busy */
export function ConfirmDialog({ open, title, children, confirmLabel = "Confirm", busy, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-slate-900/40" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg p-6 space-y-4 bg-white shadow-xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <div className="space-y-3 text-sm text-slate-600">{children}</div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
