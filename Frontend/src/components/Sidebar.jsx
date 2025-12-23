import {
  LayoutDashboard,
  User,
  Users,
  FileText,
  CreditCard,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="flex flex-col justify-between w-64 min-h-screen text-white bg-black">
      <div>
        <div className="p-6 text-sm text-gray-400">Main Menu</div>

        <nav className="px-4 space-y-1">
          <MenuItem icon={<LayoutDashboard />} label="Dashboard" active />
          <MenuItem icon={<User />} label="Contact Info" />
          <MenuItem icon={<Users />} label="My Team" />
          <MenuItem icon={<FileText />} label="Tax Report" />
          <MenuItem icon={<CreditCard />} label="Billing" />
          <MenuItem icon={<Plug />} label="Connected Services" />
        </nav>

        <div className="p-6 text-sm text-gray-400">Preference</div>
        <nav className="px-4 space-y-1">
          <MenuItem icon={<User />} label="Profile" />
          <MenuItem icon={<Settings />} label="Settings" />
        </nav>
      </div>

      <div className="p-4">
        <MenuItem icon={<LogOut />} label="Log Out" />
      </div>
    </aside>
  );
}

function MenuItem({ icon, label, active }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer ${
        active ? "bg-gray-800" : "hover:bg-gray-900"
      }`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
