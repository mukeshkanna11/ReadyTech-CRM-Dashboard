import { useState } from "react";
import { motion } from "framer-motion";
import { isAdmin, getUser } from "../utils/auth";
import {
  User,
  Lock,
  Bell,
  Palette,
  Settings,
  Shield,
  Trash2,
  Moon,
  Sun
} from "lucide-react";

export default function SettingsPage() {

  const user = getUser();
  const admin = isAdmin();

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  const toggleTheme = () => {
    const t = !darkMode;
    setDarkMode(t);
    document.documentElement.classList.toggle("dark", t);
    localStorage.setItem("theme", t ? "dark" : "light");
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900">

        {/* HEADER */}
        <header className="flex justify-between px-6 py-4 bg-white shadow dark:bg-slate-800">
          <h1 className="text-xl font-bold text-indigo-600">
            Settings ({user.role.toUpperCase()})
          </h1>

          <button onClick={toggleTheme}>
            {darkMode ? <Sun /> : <Moon />}
          </button>
        </header>

        <div className="max-w-6xl px-4 py-10 mx-auto space-y-8">

          {/* PROFILE – ALL USERS */}
          <Section title="Profile" icon={<User />}>
            <Input label="Name" defaultValue={user.name} />
            <Input label="Email" defaultValue="admin@readytechsolutions.com" />
          </Section>

          {/* SECURITY – ADMIN & MANAGER */}
          {(admin || user.role === "manager") && (
            <Section title="Security" icon={<Lock />}>
              <Input label="Change Password" type="password" />
              <Toggle label="Two Factor Authentication" />
            </Section>
          )}

          {/* NOTIFICATIONS – ALL */}
          <Section title="Notifications" icon={<Bell />}>
            <Toggle label="Email Alerts" />
            <Toggle label="WhatsApp Alerts" />
          </Section>

          {/* APPEARANCE – ALL */}
          <Section title="Appearance" icon={<Palette />}>
            <Toggle label="Dark Mode" checked={darkMode} onChange={toggleTheme} />
          </Section>

          {/* CRM SETTINGS – ADMIN ONLY */}
          {admin && (
            <Section title="CRM Settings" icon={<Settings />}>
              <Toggle label="Auto Lead Assignment" />
              <Toggle label="AI Lead Scoring" />
            </Section>
          )}

          {/* DANGER ZONE – ADMIN ONLY */}
          {admin && (
            <Section title="Danger Zone" icon={<Shield />}>
              <button className="flex gap-2 px-4 py-2 text-white bg-red-600 rounded-lg">
                <Trash2 /> Delete Entire CRM
              </button>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

/* ---------- COMPONENTS ---------- */

function Section({ title, icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-4 bg-white shadow dark:bg-slate-800 rounded-xl"
    >
      <h2 className="flex items-center gap-2 font-bold text-indigo-600">
        {icon} {title}
      </h2>
      {children}
    </motion.div>
  );
}

function Input({ label, type = "text", defaultValue }) {
  return (
    <div>
      <label className="text-sm">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full p-3 rounded-lg bg-slate-100 dark:bg-slate-900"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-indigo-600"
      />
    </label>
  );
}
