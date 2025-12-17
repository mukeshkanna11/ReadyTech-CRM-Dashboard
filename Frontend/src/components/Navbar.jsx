import React from "react";
import { Menu, Bell, Search, UserCircle } from "lucide-react";

export default function Navbar({ onMenu }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          className="p-2 transition rounded-lg hover:bg-slate-100"
        >
          <Menu size={20} />
        </button>

        <h1 className="hidden text-lg font-semibold text-slate-800 sm:block">
          CRM Dashboard
        </h1>
      </div>

      {/* Center Search */}
      <div className="items-center hidden px-3 py-2 rounded-lg md:flex bg-slate-100 w-72">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          placeholder="Search leads, clients..."
          className="w-full px-2 text-sm bg-transparent outline-none"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-slate-100">
          <Bell size={18} />
          <span className="absolute w-2 h-2 bg-red-500 rounded-full top-1 right-1"></span>
        </button>

        <div className="flex items-center gap-2 cursor-pointer">
          <UserCircle size={28} className="text-slate-600" />
          <div className="hidden text-sm md:block">
            <p className="font-medium text-slate-700">Admin</p>
            <p className="text-xs text-slate-500">admin@crm.com</p>
          </div>
        </div>
      </div>
    </header>
  );
}
