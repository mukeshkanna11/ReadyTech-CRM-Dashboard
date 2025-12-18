import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Shield,
  UserCheck,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ClipboardList,
} from "lucide-react";

/* =========================================================
   DASHBOARD LAYOUT
========================================================= */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar open={sidebarOpen} />
      {/* Main content with dynamic margin */}
      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        <Topbar onMenu={() => setSidebarOpen(!sidebarOpen)} />
        <main className="h-screen p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


/* =========================================================
   SIDEBAR
========================================================= */
function Sidebar({ open }) {
  const [hovered, setHovered] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const menuItems = [
    { name: "Dashboard", to: "/dashboard", icon: <LayoutDashboard size={20} /> },
    { name: "Users", to: "/users", icon: <Users size={20} /> },
    { name: "Clients", to: "/clients", icon: <UserCheck size={20} /> },
    { name: "Products", to: "/products", icon: <Package size={20} /> },
    { name: "Leads", to: "/leads", icon: <BarChart3 size={20} /> },
    { name: "Audit Logs", to: "/auditlogs", icon: <Shield size={20} /> },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-full bg-gradient-to-b from-indigo-700 via-indigo-800 to-indigo-900 text-white shadow-lg z-20 transition-all duration-300
        ${open ? "w-64" : "w-20"} 
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 text-xl font-bold border-b border-indigo-800">
        {open ? "ReadyTechSolutions" : "RTS"}
      </div>

      {/* Menu Items */}
      <nav className="flex flex-col flex-1 p-3 space-y-2 overflow-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-4 p-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-white/20 text-white"
                  : "text-indigo-200 hover:bg-white/10"
              } ${!open && "justify-center"}`
            }
            title={!open ? item.name : ""}
          >
            <span>{item.icon}</span>
            {open && <span className="font-medium">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Settings & Logout */}
      <div className="p-3 border-t border-indigo-800">
        <NavLink
          to="/settings"
          className={`flex items-center gap-4 p-3 rounded-lg text-indigo-200 hover:bg-white/10 ${
            !open && "justify-center"
          }`}
          title={!open ? "Settings" : ""}
        >
          <Settings size={20} />
          {open && <span>Settings</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className={`flex items-center w-full gap-4 p-3 mt-2 rounded-lg text-red-400 hover:bg-red-700/20 transition ${
            !open && "justify-center"
          }`}
          title={!open ? "Logout" : ""}
        >
          <LogOut size={20} />
          {open && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   TOPBAR
========================================================= */
function Topbar({ onMenu }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-white border-b shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenu}
          className="p-2 transition rounded-lg hover:bg-slate-100 md:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="hidden text-xl font-semibold text-slate-700 md:block">
          CRM Dashboard
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-600">
          Welcome, <span className="font-semibold">Admin</span>
        </div>
        <div className="flex items-center justify-center w-8 h-8 font-bold text-white bg-indigo-600 rounded-full cursor-pointer">
          A
        </div>
      </div>
    </header>
  );
}
