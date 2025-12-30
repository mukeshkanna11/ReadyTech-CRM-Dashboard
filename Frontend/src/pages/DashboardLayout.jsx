import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  Bell,
  ChevronDown,
  Brain,
  LayoutDashboard,
  Users,
  Shield,
  UserCheck,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

/* =========================================================
   DASHBOARD LAYOUT
========================================================= */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(false);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-950">

        {/* SIDEBAR */}
        <Sidebar open={sidebarOpen} />

        {/* MAIN AREA */}
        <div
          className={`flex flex-col flex-1 transition-all duration-300 ${
            sidebarOpen ? "ml-64" : "ml-20"
          }`}
        >
          <Topbar
            onMenu={() => setSidebarOpen(!sidebarOpen)}
            dark={dark}
            setDark={setDark}
          />

          <main className="flex-1 p-4 overflow-y-auto md:p-6">
            <Outlet />
          </main>
        </div>

        {/* FLOATING AI BUTTON */}
        <AIAssistant />
      </div>
    </div>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */
function Sidebar({ open }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const menuItems = [
    { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { name: "Users", to: "/users", icon: Users },
    { name: "Clients", to: "/clients", icon: UserCheck },
    { name: "Products", to: "/products", icon: Package },
    { name: "Leads", to: "/leads", icon: BarChart3 },
    { name: "Audit Logs", to: "/auditlogs", icon: Shield },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col
      bg-gradient-to-b from-indigo-700 via-indigo-800 to-indigo-900
      text-white shadow-xl transition-all duration-300
      ${open ? "w-64" : "w-20"}`}
    >
      {/* LOGO */}
      <div className="flex items-center justify-center h-16 border-b border-white/10">
        <span className="font-bold tracking-wide">
          {open ? "🚀 ReadyTechSolutions" : "RTS"}
        </span>
      </div>

      {/* MENU */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map(({ name, to, icon: Icon }) => (
          <NavLink
            key={name}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-4 px-3 py-3 rounded-xl transition-all
              ${
                isActive
                  ? "bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  : "text-indigo-200 hover:bg-white/10"
              }
              ${!open && "justify-center"}`
            }
            title={!open ? name : ""}
          >
            <Icon size={20} />
            {open && <span className="text-sm">{name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-white/10">
        <NavLink
          to="/settings"
          className={`flex items-center gap-4 px-3 py-3 rounded-xl
          text-indigo-200 hover:bg-white/10
          ${!open && "justify-center"}`}
        >
          <Settings size={20} />
          {open && "Settings"}
        </NavLink>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-4 w-full px-3 py-3 rounded-xl
          text-red-300 hover:bg-red-500/20
          ${!open && "justify-center"}`}
        >
          <LogOut size={20} />
          {open && "Logout"}
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   TOPBAR
========================================================= */
function Topbar({ onMenu, dark, setDark }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleProfileNav = (path) => {
    setProfileOpen(false);
    if (path === "logout") {
      localStorage.removeItem("token");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur dark:border-slate-800">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">

        {/* LEFT */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu size={22} />
          </button>

          <div className="flex-col hidden leading-tight md:flex">
            <span className="text-sm font-semibold dark:text-white">
              CRM Dashboard
            </span>
            <span className="text-xs text-slate-500">
              Business Growth Panel
            </span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">

          

          {/* NOTIFICATIONS */}
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Bell size={18} className="text-slate-600 dark:text-white" />
            <span className="absolute w-2 h-2 bg-red-500 rounded-full top-1 right-1 animate-pulse" />
          </button>

          {/* PROFILE DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center justify-center w-8 h-8 font-bold text-white bg-indigo-600 rounded-full">
                A
              </div>
              <ChevronDown size={14} className={`transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 z-50 p-2 mt-2 bg-white border shadow-xl w-44 dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700">
                <DropdownItem label="My Profile" onClick={() => handleProfileNav("/profile")} />
                <DropdownItem label="Settings" onClick={() => handleProfileNav("/settings")} />
                <div className="h-px my-1 bg-slate-200 dark:bg-slate-700" />
                <DropdownItem label="Logout" danger onClick={() => handleProfileNav("logout")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   DROPDOWN ITEM
========================================================= */
function DropdownItem({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm rounded-lg transition
        ${danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"}
      `}
    >
      {label}
    </button>
  );
}

/* =========================================================
   FLOATING AI ASSISTANT
========================================================= */
function AIAssistant() {
  return (
    <button
      title="AI Assistant"
      className="fixed z-40 flex items-center justify-center text-white transition bg-indigo-600 rounded-full shadow-xl bottom-6 right-6 w-14 h-14 hover:scale-105"
    >
      <Brain />
    </button>
  );
}
