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
  Warehouse,
  ShoppingCart,
  ClipboardList,
  Layers,
  Truck,
} from "lucide-react";
import { Cloud } from "lucide-react";

/* =========================================================
   DASHBOARD LAYOUT
========================================================= */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
      <Sidebar open={sidebarOpen} />

      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        <Topbar onMenu={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 overflow-y-auto md:p-6">
          <Outlet />
        </main>
      </div>

      <AIAssistant />
    </div>
  );
}

/* =========================================================
   SIDEBAR (ZOHO STYLE)
========================================================= */
function Sidebar({ open }) {
  const navigate = useNavigate();
  const [erpOpen, setErpOpen] = useState(true);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

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
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
        <NavItem open={open} to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem open={open} to="/users" icon={Users} label="Users" />
        <NavItem open={open} to="/clients" icon={UserCheck} label="Clients" />
        <NavItem open={open} to="/products" icon={Package} label="CRM Products" />
        <NavItem open={open} to="/leads" icon={BarChart3} label="Leads" />
        <NavItem open={open} to="/salesforce" icon={Cloud} label="Salesforce" />
        <NavItem open={open} to="/auditlogs" icon={Shield} label="Audit Logs" />

        {/* ===== ERP MODULE ===== */}
        {open && (
          <div className="mt-6">
            <button
              onClick={() => setErpOpen(!erpOpen)}
              className="flex items-center w-full gap-3 px-3 py-2 text-xs tracking-wider text-indigo-200 uppercase rounded-lg hover:bg-white/10"
            >
              <Layers size={16} />
              <span>ERP / Inventory</span>
              <ChevronDown
                size={14}
                className={`ml-auto transition-transform ${
                  erpOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                erpOpen ? "max-h-[420px]" : "max-h-0"
              }`}
            >
              <div className="pl-4 mt-2 ml-3 space-y-1 border-l border-white/20">
                <NavSubItem to="/stocks/products" icon={Package} label="Products" />
                <NavSubItem to="/stocks/warehouses" icon={Warehouse} label="Warehouses" />
                <NavSubItem to="/stocks/vendors" icon={Truck} label="Vendors" />
                <NavSubItem
                  to="/stocks/purchase-orders"
                  icon={ClipboardList}
                  label="Purchase Orders"
                />
                <NavSubItem
                  to="/stocks/sales-orders"
                  icon={ShoppingCart}
                  label="Sales Orders"
                />
                <NavSubItem to="/stocks/inventory" icon={Layers} label="Inventory" />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* FOOTER */}
      <div className="p-3 border-t border-white/10">
        <NavItem open={open} to="/settings" icon={Settings} label="Settings" />
        <button
          onClick={logout}
          className={`flex items-center gap-4 w-full px-3 py-3 rounded-xl
          text-red-300 hover:bg-red-500/20 ${!open && "justify-center"}`}
        >
          <LogOut size={20} />
          {open && "Logout"}
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   NAV ITEMS
========================================================= */
function NavItem({ to, icon: Icon, label, open }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 px-3 py-3 rounded-xl transition-all
        ${isActive
          ? "bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
          : "text-indigo-200 hover:bg-white/10"}
        ${!open && "justify-center"}`
      }
    >
      <Icon size={20} />
      {open && <span className="text-sm">{label}</span>}
    </NavLink>
  );
}

function NavSubItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition
        ${isActive
          ? "bg-white/20 text-white"
          : "text-indigo-200 hover:bg-white/10"}`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

/* =========================================================
   TOPBAR
========================================================= */
function Topbar({ onMenu }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <button onClick={onMenu} className="p-2 rounded-lg hover:bg-slate-100">
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2 rounded-lg hover:bg-slate-100"
          >
            <Bell size={18} />
            <span className="absolute w-2 h-2 bg-red-500 rounded-full top-1 right-1 animate-pulse" />
          </button>

          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100"
            >
              <div className="flex items-center justify-center w-8 h-8 text-white bg-indigo-600 rounded-full">
                A
              </div>
              <ChevronDown size={14} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 z-50 w-40 p-2 mt-2 bg-white border shadow-xl rounded-xl">
                <DropdownItem label="Profile" onClick={() => navigate("/profile")} />
                <DropdownItem label="Settings" onClick={() => navigate("/settings")} />
                <DropdownItem label="Logout" danger onClick={() => navigate("/login")} />
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
      ${danger ? "text-red-500 hover:bg-red-100" : "hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );
}

/* =========================================================
   AI ASSISTANT
========================================================= */
function AIAssistant() {
  return (
    <button
      title="AI Assistant"
      className="fixed z-40 flex items-center justify-center text-white bg-indigo-600 rounded-full shadow-xl bottom-6 right-6 w-14 h-14 hover:scale-105"
    >
      <Brain />
    </button>
  );
}
