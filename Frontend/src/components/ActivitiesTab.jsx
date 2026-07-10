import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import {
  Phone,
  Mail,
  CalendarCheck,
  CheckCircle,
  Clock,
  Filter,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const ICONS = {
  Call: <Phone size={16} className="text-blue-500" />,
  Email: <Mail size={16} className="text-purple-500" />,
  Meeting: <CalendarCheck size={16} className="text-green-500" />,
};

const STATUS_COLORS = {
  Pending: "text-yellow-500 bg-yellow-100 dark:bg-yellow-800",
  Completed: "text-green-600 bg-green-100 dark:bg-green-800",
  Overdue: "text-red-600 bg-red-100 dark:bg-red-800",
};

export default function ActivitiesTab() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await API.get("/activities");
      setActivities(res.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch activities");
      console.error("Fetch activities error", err);
    } finally {
      setLoading(false);
    }
  };

  const markDone = async (id) => {
    try {
      await API.put(`/activities/${id}`, { done: true });
      toast.success("Marked as completed");
      fetchActivities();
    } catch (err) {
      toast.error("Failed to update activity");
      console.error("Update activity error", err);
    }
  };

  const filteredActivities = useMemo(() => {
    return activities
      .filter((a) =>
        `${a.notes || ""}`.toLowerCase().includes(search.toLowerCase())
      )
      .filter((a) =>
        statusFilter === "All"
          ? true
          : a.done
          ? statusFilter === "Completed"
          : statusFilter === "Pending"
      )
      .filter((a) => (typeFilter === "All" ? true : a.type === typeFilter));
  }, [activities, search, statusFilter, typeFilter]);

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-300">Loading activities...</p>;
  }

  return (
    <div className="space-y-6">

      {/* Header + Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Activity Timeline</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Track all your CRM activities, update status, and monitor progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities"
              className="w-full py-2 pl-10 pr-3 border rounded-lg md:w-64 dark:bg-slate-800 dark:border-gray-700 dark:text-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border rounded-lg dark:bg-slate-800 dark:border-gray-700 dark:text-white"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Completed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="p-2 border rounded-lg dark:bg-slate-800 dark:border-gray-700 dark:text-white"
          >
            <option>All</option>
            <option>Call</option>
            <option>Email</option>
            <option>Meeting</option>
          </select>

          <button
            onClick={fetchActivities}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 transition bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Filter size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Activity Cards */}
      <div className="space-y-4">
        {filteredActivities.map((a) => {
          const status = a.done ? "Completed" : new Date(a.dueDate) < new Date() ? "Overdue" : "Pending";

          return (
            <div
              key={a._id}
              className="flex items-start justify-between p-4 transition bg-white border shadow rounded-xl hover:shadow-lg dark:bg-slate-800"
            >
              <div className="flex gap-3">
                <div className="mt-1">{ICONS[a.type]}</div>

                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{a.type}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-300">{a.notes || "No notes"}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[status]}`}
                >
                  {status}
                </span>

                {!a.done && (
                  <button
                    onClick={() => markDone(a._id)}
                    className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                  >
                    <CheckCircle size={16} /> Mark Done
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredActivities.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-300">No activities found.</p>
        )}
      </div>

      {/* Optional Summary */}
      <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-3">
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Total Activities</h3>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{activities.length}</p>
        </div>
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Completed</h3>
          <p className="text-2xl font-bold text-green-600">{activities.filter(a => a.done).length}</p>
        </div>
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Pending / Overdue</h3>
          <p className="text-2xl font-bold text-yellow-500">{activities.filter(a => !a.done).length}</p>
        </div>
      </div>
    </div>
  );
}
