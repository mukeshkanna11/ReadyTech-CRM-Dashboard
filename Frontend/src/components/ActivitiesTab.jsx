import { useEffect, useState } from "react";
import API from "../../services/api";
import {
  Phone,
  Mail,
  CalendarCheck,
  CheckCircle,
} from "lucide-react";

const ICONS = {
  Call: <Phone size={16} />,
  Email: <Mail size={16} />,
  Meeting: <CalendarCheck size={16} />,
};

export default function ActivitiesTab() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await API.get("/activities");
      setActivities(res.data.data || []);
    } catch (err) {
      console.error("Fetch activities error", err);
    } finally {
      setLoading(false);
    }
  };

  const markDone = async (id) => {
    try {
      await API.put(`/activities/${id}`, { done: true });
      fetchActivities();
    } catch (err) {
      console.error("Update activity error", err);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading activities...</p>;
  }

  return (
    <div className="p-6 bg-white shadow rounded-2xl">
      <h2 className="mb-4 text-lg font-semibold">Activity Timeline</h2>

      <div className="space-y-4">
        {activities.map((a) => (
          <div
            key={a._id}
            className="flex items-start justify-between p-4 border rounded-lg"
          >
            <div className="flex gap-3">
              <div className="mt-1 text-blue-600">
                {ICONS[a.type]}
              </div>

              <div>
                <p className="font-medium">{a.type}</p>
                <p className="text-sm text-gray-500">
                  {a.notes || "No notes"}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {!a.done && (
              <button
                onClick={() => markDone(a._id)}
                className="flex items-center gap-1 text-sm text-green-600 hover:underline"
              >
                <CheckCircle size={16} />
                Mark Done
              </button>
            )}

            {a.done && (
              <span className="text-xs font-medium text-green-600">
                Completed
              </span>
            )}
          </div>
        ))}

        {activities.length === 0 && (
          <p className="text-sm text-gray-400">
            No activities yet
          </p>
        )}
      </div>
    </div>
  );
}
