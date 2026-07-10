import React from "react";
import {
  Menu,
  Bell,
  Search,
  UserCircle,
  ChevronDown,
} from "lucide-react";

export default function Navbar({ onMenu }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur bg-white/80 border-slate-200">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">

        {/* LEFT */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="p-2 transition rounded-lg hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          <div className="flex-col hidden leading-tight sm:flex">
            <span className="text-sm font-semibold text-slate-800">
              Ready Tech CRM
            </span>
            <span className="text-xs text-slate-500">
              Smart Business Platform
            </span>
          </div>
        </div>

        {/* CENTER SEARCH */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 w-[280px]">
          <Search size={16} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search leads, clients..."
            className="w-full text-sm bg-transparent outline-none placeholder:text-slate-500"
          />
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">

          {/* Notifications */}
          <button className="relative p-2 transition rounded-lg hover:bg-slate-100">
            <Bell size={18} />
            <span className="absolute w-2 h-2 bg-red-500 rounded-full top-1 right-1"></span>
          </button>

          {/* USER */}
          <div className="flex items-center gap-2 px-2 py-1 transition rounded-lg cursor-pointer hover:bg-slate-100">
            <UserCircle size={28} className="text-slate-600" />
            <div className="flex-col hidden text-xs leading-tight md:flex">
              <span className="font-medium text-slate-700">Admin</span>
              <span className="text-slate-500">admin@crm.com</span>
            </div>
            <ChevronDown size={14} className="hidden md:block text-slate-400" />
          </div>

        </div>
      </div>
    </header>
  );
}
