import { useState } from "react";
import { Sun, Moon, ShieldCheck, Mail, Bell, Link } from "lucide-react";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="max-w-5xl p-4 mx-auto space-y-6 md:p-6">

      {/* Page Title */}
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>

      {/* Notifications Section */}
      <CardSection title="Notifications">
        <SettingToggle title="Email Notifications" desc="Receive updates via email" />
        <SettingToggle title="Push Notifications" desc="Receive alerts in real-time" />
        <SettingToggle title="Security Alerts" desc="Login & access alerts" />
      </CardSection>

      {/* Appearance Section */}
      <CardSection title="Appearance">
        <SettingToggle
          title="Dark Mode"
          desc="Reduce eye strain at night"
          toggleValue={darkMode}
          setToggle={setDarkMode}
          iconOn={<Moon size={16} />}
          iconOff={<Sun size={16} />}
        />
      </CardSection>

      {/* Security Section */}
      <CardSection title="Security">
        <SettingToggle
          title="Two-Factor Authentication"
          desc="Extra layer of account security"
        />
        <SettingToggle
          title="Password Change Reminders"
          desc="Receive reminders to update password"
        />
      </CardSection>

      {/* Integrations Section */}
      <CardSection title="Integrations">
        <SettingToggle
          title="CRM API Access"
          desc="Enable API for external integrations"
          icon={<Link size={16} />}
        />
        <SettingToggle
          title="Third-Party Apps"
          desc="Connect with external apps like Slack, Google Workspace"
        />
      </CardSection>

    </div>
  );
}

/* ---------- SETTING TOGGLE COMPONENT ---------- */
function SettingToggle({ title, desc, toggleValue, setToggle, icon, iconOn, iconOff }) {
  const isControlled = toggleValue !== undefined && setToggle !== undefined;
  const [localToggle, setLocalToggle] = useState(false);

  const active = isControlled ? toggleValue : localToggle;

  const handleToggle = () => {
    if (isControlled) setToggle(!toggleValue);
    else setLocalToggle(!localToggle);
  };

  return (
    <div className="flex items-center justify-between p-3 transition bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
      <div className="flex items-center gap-3">
        {icon && <div className="text-indigo-600">{icon}</div>}
        <div className="flex flex-col">
          <p className="font-medium text-slate-800 dark:text-white">{title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        className={`w-12 h-6 relative rounded-full transition-colors focus:outline-none ${
          active ? "bg-indigo-600" : "bg-gray-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`absolute left-0 top-0 w-6 h-6 bg-white rounded-full shadow transform transition-transform ${
            active ? "translate-x-6" : "translate-x-0"
          } flex items-center justify-center text-indigo-600`}
        >
          {active && iconOn ? iconOn : !active && iconOff ? iconOff : ""}
        </span>
      </button>
    </div>
  );
}

/* ---------- CARD SECTION ---------- */
function CardSection({ title, children }) {
  return (
    <div className="p-4 space-y-3 bg-white shadow dark:bg-slate-900 rounded-2xl">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
