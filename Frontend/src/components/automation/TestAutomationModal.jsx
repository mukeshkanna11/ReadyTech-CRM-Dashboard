// src/components/automation/TestAutomationModal.jsx

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  Loader2,
  Play,
  X,
} from "lucide-react";

export default function TestAutomationModal({
  open,
  onClose,
  onTest,
  automation,
}) {
  const [payload, setPayload] = useState(
    JSON.stringify(
      {
        name: "Test Lead",
        email: "test@example.com",
        source: "Website",
        status: "new",
      },
      null,
      2
    )
  );

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      let parsedPayload;

      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        setResult({
          success: false,
          message: "Invalid JSON payload.",
        });
        return;
      }

      const response = await onTest?.(
        automation,
        parsedPayload
      );

      setResult(
        response || {
          success: true,
          message: "Automation test completed successfully.",
        }
      );
    } catch (error) {
      setResult({
        success: false,
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Automation test failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden bg-white border shadow-2xl rounded-2xl border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Test Automation
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Run this workflow against sample data.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center rounded-lg h-9 w-9 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Test Payload
              </label>

              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <Code2 size={12} />
                JSON
              </span>
            </div>

            <textarea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={11}
              spellCheck={false}
              className="w-full p-4 font-mono text-xs leading-6 border outline-none rounded-xl border-slate-200 bg-slate-950 text-slate-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>

          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.success
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-rose-100 bg-rose-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                ) : (
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0 text-rose-600"
                  />
                )}

                <div>
                  <p
                    className={`text-xs font-bold ${
                      result.success
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {result.success
                      ? "Test Successful"
                      : "Test Failed"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {result.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}

            {loading ? "Running Test..." : "Run Test"}
          </button>
        </div>
      </div>
    </div>
  );
}