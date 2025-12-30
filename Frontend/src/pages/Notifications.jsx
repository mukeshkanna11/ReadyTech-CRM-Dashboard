import { useState } from "react";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Filter,
  Check,
} from "lucide-react";

export default function Notifications() {
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New Lead Assigned",
      message: "Enterprise client lead added to Sales Funnel.",
      type: "info",
      time: "2 mins ago",
      read: false,
    },
    {
      id: 2,
      title: "AI Bot Conversation Started",
      message: "A visitor is actively chatting with AI assistant.",
      type: "info",
      time: "10 mins ago",
      read: false,
    },
    {
      id: 3,
      title: "Milestone Completed",
      message: "CRM Phase 2 delivered successfully.",
      type: "success",
      time: "1 hour ago",
      read: true,
    },
    {
      id: 4,
      title: "Payment Pending",
      message: "Invoice #RTS-204 is overdue by 2 days.",
      type: "alert",
      time: "Yesterday",
      read: false,
    },
    {
      id: 5,
      title: "New Client Testimonial",
      message: "Client submitted a 5⭐ testimonial.",
      type: "success",
      time: "2 days ago",
      read: true,
    },
    {
      id: 6,
      title: "Server Health Warning",
      message: "High response time detected on API server.",
      type: "alert",
      time: "3 days ago",
      read: true,
    },
  ]);

  /* ================= FILTER LOGIC ================= */
  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "alert") return n.type === "alert";
    return true;
  });

  /* ================= MARK AS READ ================= */
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  /* ================= ICON ================= */
  const renderIcon = (type) => {
    if (type === "success") return <CheckCircle size={20} />;
    if (type === "alert") return <AlertCircle size={20} />;
    return <Info size={20} />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 text-indigo-600 bg-indigo-100 rounded-xl">
            <Bell />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
              Notifications
            </h1>
            <p className="text-sm text-slate-500">
              System, sales & AI activity updates
            </p>
          </div>
        </div>

        {/* FILTER */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          {["all", "unread", "alert"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg transition
                ${
                  filter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-xl dark:bg-slate-800">
            <Bell className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-500">
              No notifications found
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-xl border
              transition hover:shadow-md
              ${
                n.read
                  ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  : "bg-indigo-50 dark:bg-slate-800 border-indigo-200 dark:border-indigo-700"
              }`}
            >
              {/* ICON */}
              <div
                className={`p-2 rounded-lg
                ${
                  n.type === "success"
                    ? "bg-green-100 text-green-600"
                    : n.type === "alert"
                    ? "bg-red-100 text-red-600"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                {renderIcon(n.type)}
              </div>

              {/* CONTENT */}
              <div className="flex-1">
                <p className="font-medium text-slate-800 dark:text-white">
                  {n.title}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {n.message}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {n.time}
                </p>
              </div>

              {/* ACTION */}
              {!n.read && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-indigo-600 transition bg-indigo-100 rounded-lg hover:bg-indigo-200"
                >
                  <Check size={14} /> Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
