// Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BarChart3,
  Package,
  Shield,
  Settings,
  LogOut,
} from "lucide-react";

export default function Sidebar({ open }) {
  return (
    <aside
      className={`$${open ? "w-64" : "w-20"} transition-all duration-300 bg-[#0f172a] text-slate-200 flex flex-col shadow-xl`}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 font-bold text-white bg-indigo-600 rounded-lg">
            R
          </div>
          {open && (
            <span className="text-lg font-semibold tracking-wide">
              ReadyTechCRM
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1">
        <SideItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" open={open} />
        <SideItem to="/leads" icon={<BarChart3 size={18} />} label="Leads" open={open} />
        <SideItem to="/clients" icon={<UserCheck size={18} />} label="Clients" open={open} />
        <SideItem to="/users" icon={<Users size={18} />} label="Users" open={open} />
        <SideItem to="/products" icon={<Package size={18} />} label="Products" open={open} />
        <SideItem to="/auditlogs" icon={<Shield size={18} />} label="Audit Logs" open={open} />
      </nav>

      {/* Footer */}
      <div className="p-3 space-y-1 border-t border-slate-700">
        <SideItem to="/settings" icon={<Settings size={18} />} label="Settings" open={open} />
        <button className="flex items-center w-full gap-3 px-3 py-2 transition rounded-lg text-slate-300 hover:bg-slate-800">
          <LogOut size={18} />
          {open && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

/* =============================== */
/* Sidebar Item                   */
/* =============================== */

function SideItem({ to, icon, label, open }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? "bg-indigo-600 text-white shadow"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <div className="relative">
        {icon}
        <span className="absolute w-2 h-2 bg-indigo-500 rounded-full opacity-0 -right-1 -top-1 group-hover:opacity-100" />
      </div>
      {open && <span className="whitespace-nowrap">{label}</span>}
    </NavLink>
  );
}
