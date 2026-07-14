import { useState, useRef, useEffect } from "react";
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
  Receipt,
  ClipboardList,
  Layers,
  Truck,
  Sparkles,
  Bot,
  PenTool,
  LineChart,
  Search,
  Mail,
  MessageSquare,
  TrendingUp,
  User,
  KeyRound,
  SlidersHorizontal,
  ArrowLeftRight,
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
          sidebarOpen ? "ml-[270px]" : "ml-20"
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
   SIDEBAR
========================================================= */
const CRM_LINKS = [
  { to: "/users", icon: Users, label: "Users" },
  { to: "/clients", icon: UserCheck, label: "Clients" },
  { to: "/products", icon: Package, label: "CRM Products" },
  { to: "/leads", icon: BarChart3, label: "Leads" },
  { to: "/salesforce", icon: Cloud, label: "Salesforce" },
  { to: "/invoices", icon: Receipt, label: "Invoices" },
  { to: "/auditlogs", icon: Shield, label: "Audit Logs" },
];

const ERP_LINKS = [
  { to: "/stocks/products", icon: Package, label: "Products" },
  { to: "/stocks/warehouses", icon: Warehouse, label: "Warehouses" },
  { to: "/stocks/vendors", icon: Truck, label: "Vendors" },
  { to: "/stocks/purchase-orders", icon: ClipboardList, label: "Purchase Orders" },
  { to: "/stocks/sales-orders", icon: ShoppingCart, label: "Sales Orders" },
  { to: "/stocks/inventory", icon: Layers, label: "Inventory" },
  { to: "/stocks/stock-adjustment", icon: SlidersHorizontal, label: "Stock Adjustment" },
  { to: "/stocks/warehouse-transfer", icon: ArrowLeftRight, label: "Warehouse Transfer" },
];

/* AI tools reuse existing routes where the feature lives; those without a page are marked "Soon" */
const AI_LINKS = [
  { to: "/dashboard", icon: Bot, label: "AI Assistant" },
  { to: "/leads", icon: LineChart, label: "AI Lead Analysis" },
  { to: "/clients", icon: Sparkles, label: "AI Client Insights" },
  { to: "/ai/content-generator", icon: PenTool, label: "AI Content Generator" },
  { to: "/ai/seo-tool", icon: Search, label: "AI SEO Tool" },
  { to: "/ai/email-generator", icon: Mail, label: "AI Email Generator" },
  { to: "/ai/customer-communication", icon: MessageSquare, label: "AI Customer Communication" },
  { to: "/ai/sales-recommendations", icon: TrendingUp, label: "AI Sales Recommendations" },
];

function Sidebar({ open }) {
  const navigate = useNavigate();
  const [crmOpen, setCrmOpen] = useState(true);
  const [erpOpen, setErpOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden
      border-r border-white/5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950
      text-white shadow-2xl transition-[width] duration-300 ease-in-out
      ${open ? "w-[270px]" : "w-20"}`}
    >
      {/* LOGO (fixed top) */}
      <div className="flex items-center h-16 gap-3 px-5 border-b shrink-0 border-white/10">
        <div className="grid shadow-lg rounded-xl h-9 w-9 shrink-0 place-items-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-900/40">
          <Sparkles size={18} />
        </div>
        {open && (
          <div className="leading-tight whitespace-nowrap">
            <p className="text-sm font-bold tracking-wide">ReadyTechSolutions</p>
            <p className="text-[10px] text-slate-400">CRM + ERP Suite</p>
          </div>
        )}
      </div>

      {/* MENU (only this scrolls) */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-x-hidden overflow-y-auto">
        <NavItem open={open} to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavGroup open={open} title="CRM" icon={Users} items={CRM_LINKS} expanded={crmOpen} onToggle={() => setCrmOpen(!crmOpen)} />
        <NavGroup open={open} title="ERP" icon={Layers} items={ERP_LINKS} expanded={erpOpen} onToggle={() => setErpOpen(!erpOpen)} />
        <NavGroup open={open} title="AI Tools" icon={Sparkles} items={AI_LINKS} expanded={aiOpen} onToggle={() => setAiOpen(!aiOpen)} />
      </nav>

      {/* FOOTER (fixed bottom) */}
      <div className="p-3 border-t shrink-0 border-white/10">
        <button
          onClick={logout}
          title="Logout"
          className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl text-rose-300 whitespace-nowrap transition hover:bg-rose-500/20 ${!open && "justify-center"}`}
        >
          <LogOut size={20} className="shrink-0" />
          {open && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

/* =========================================================
   NAV GROUP (collapsible section)
========================================================= */
function NavGroup({ open, title, icon: Icon, items, expanded, onToggle }) {
  if (!open) {
    return (
      <div className="pt-4 mt-4 space-y-1.5 border-t border-white/10">
        {items.map((it) => (
          <NavItem key={it.label} open={false} {...it} />
        ))}
      </div>
    );
  }

  return (
    <div className="pt-4 mt-4 border-t border-white/10">
      <button
        onClick={onToggle}
        className="flex items-center w-full gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition whitespace-nowrap hover:text-slate-200"
      >
        <Icon size={14} className="shrink-0" />
        <span>{title}</span>
        <ChevronDown size={13} className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[560px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="mt-1.5 space-y-1">
          {items.map((it) => (
            <NavSubItem key={it.label} {...it} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   NAV ITEMS
========================================================= */
function NavItem({ to, icon: Icon, label, open, soon }) {
  if (soon) {
    return (
      <div
        title={label}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 cursor-default whitespace-nowrap ${!open && "justify-center"}`}
      >
        <Icon size={20} className="shrink-0" />
        {open && <span className="text-sm truncate">{label}</span>}
        {open && (
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            Soon
          </span>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap
        ${isActive ? "bg-indigo-500/20 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}
        ${!open && "justify-center"}`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`absolute left-0 h-6 w-1 rounded-r-full bg-indigo-400 transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
          <Icon size={20} className="transition-transform shrink-0 group-hover:scale-110" />
          {open && <span className="text-sm truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function NavSubItem({ to, icon: Icon, label, soon }) {
  if (soon) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 ml-4 text-sm rounded-lg cursor-default whitespace-nowrap text-slate-500">
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">Soon</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 ml-4 rounded-lg text-sm transition whitespace-nowrap
        ${isActive ? "bg-indigo-500/20 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`
      }
    >
      <Icon size={16} className="transition-transform shrink-0 group-hover:scale-110" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

/* =========================================================
   TOPBAR
========================================================= */
function Topbar({ onMenu }) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState("");
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const onClickAway = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/60 shadow-sm shadow-slate-900/5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/50">
      <div className="flex items-center h-16 gap-3 px-4 md:px-6">

        {/* LEFT */}
        <button
          onClick={onMenu}
          className="p-2 transition rounded-xl hover:bg-slate-100/80 active:scale-95"
        >
          <Menu size={22} className="text-slate-700" />
        </button>

        <div className="hidden leading-tight md:block">
          <p className="text-sm font-semibold text-slate-800">ReadyTechS CRM + ERP</p>
          <p className="text-xs text-slate-500">Business Intelligence Platform</p>
        </div>

        {/* SEARCH */}
        <div className="relative flex-1 max-w-md ml-2 md:ml-8">
          <Search size={17} className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full py-2 pl-10 pr-4 text-sm transition border outline-none bg-white/70 rounded-xl border-slate-200/70 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-1.5 ml-auto sm:gap-2">

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
              className="relative p-2 transition rounded-xl hover:bg-slate-100/80 active:scale-95"
            >
              <Bell size={18} className="text-slate-700" />
              <span className="absolute w-2 h-2 rounded-full bg-rose-500 top-1.5 right-1.5 ring-2 ring-white animate-pulse" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 z-50 mt-3 overflow-hidden border shadow-xl w-72 rounded-2xl border-slate-200/70 bg-white/90 shadow-slate-900/10 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">New</span>
                </div>
                <div className="px-4 py-6 text-sm text-center text-slate-500">
                  You’re all caught up.
                </div>
                <button
                  onClick={() => { setNotifOpen(false); navigate("/notifications"); }}
                  className="w-full px-4 py-3 text-sm font-medium text-indigo-600 transition border-t border-slate-100 hover:bg-indigo-50/60"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>

          {/* PROFILE */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
              className="flex items-center gap-2 p-1 transition sm:pr-2 rounded-xl hover:bg-slate-100/80"
            >
              <div className="flex items-center justify-center text-sm font-semibold text-white rounded-full shadow-md w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 ring-2 ring-white">
                A
              </div>
              <div className="hidden leading-tight text-left sm:block">
                <p className="text-xs font-semibold text-slate-800">Admin</p>
                <p className="text-[10px] text-slate-500">Administrator</p>
              </div>
              <ChevronDown size={14} className={`hidden sm:block text-slate-500 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 z-50 w-56 mt-3 overflow-hidden border shadow-xl rounded-2xl border-slate-200/70 bg-white/90 shadow-slate-900/10 backdrop-blur-xl">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-center text-sm font-semibold text-white rounded-full w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600">
                    A
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-slate-800">Admin</p>
                    <p className="text-xs text-slate-500">admin@crm.com</p>
                  </div>
                </div>
                <div className="p-1.5">
                  <DropdownItem icon={User} label="My Profile" onClick={() => { setProfileOpen(false); navigate("/profile"); }} />
                  <DropdownItem icon={Settings} label="Settings" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
                  <DropdownItem icon={KeyRound} label="Change Password" onClick={() => { setProfileOpen(false); navigate("/profile"); }} />
                  <div className="h-px my-1 bg-slate-100" />
                  <DropdownItem icon={LogOut} label="Logout" danger onClick={logout} />
                </div>
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
function DropdownItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition
      ${danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {Icon && <Icon size={16} className={danger ? "text-rose-500" : "text-slate-400"} />}
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
