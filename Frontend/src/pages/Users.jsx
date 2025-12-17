import React, { useEffect, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";

export default function Users() {
  const [users, setUsers] = useState([]);

  const fetch = async () => {
    try {
      const { data } = await API.get("/admin/users");
      setUsers(data);
    } catch (err) {
      toast.error("Failed to load users");
    }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Users</h2>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u._id} className="flex items-center justify-between p-3 bg-white rounded shadow">
            <div>
              <div className="font-semibold">{u.name}</div>
              <div className="text-sm text-slate-500">{u.email} • {u.role}</div>
            </div>
            <div className="text-sm text-slate-400">{new Date(u.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
