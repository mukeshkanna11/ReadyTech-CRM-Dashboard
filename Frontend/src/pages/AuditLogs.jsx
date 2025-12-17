import React, { useEffect, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  const fetch = async () => {
    try {
      const { data } = await API.get("/audit"); // matches backend route /api/audit
      setLogs(data);
    } catch (err) {
      toast.error("Failed to load audit logs");
    }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Audit Logs</h2>
      <div className="space-y-2">
        {logs.map(l => (
          <div key={l._id} className="p-3 bg-white rounded shadow">
            <div className="text-sm text-slate-500">{new Date(l.createdAt).toLocaleString()} • {l.user?.name || l.user}</div>
            <div className="font-medium">{l.action}</div>
            <pre className="mt-1 text-xs text-slate-600">{JSON.stringify(l.details || l.description || {}, null, 2)}</pre>
          </div>
        ))}
        {logs.length === 0 && <div className="text-slate-500">No logs yet</div>}
      </div>
    </div>
  );
}
