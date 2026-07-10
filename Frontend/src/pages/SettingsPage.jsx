import { useState } from "react";
import {
  Sun,
  Moon,
  ShieldCheck,
  Bell,
  Link,
  Mail,
  BrainCircuit,
  Database,
  Cloud,
  History,
  Key,
  Users,
  UserCog,
  Building2,
  CreditCard,
  Globe,
  Settings2,
  BadgeCheck
} from "lucide-react";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="p-6 mx-auto space-y-8 max-w-7xl">

  {/* Hero Header */}
  <div className="relative p-8 overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-700 to-violet-700">

    <div className="absolute rounded-full -right-20 -top-20 h-72 w-72 bg-white/10 blur-3xl" />

    <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between">

      <div>

        <h1 className="text-4xl font-bold">
          Enterprise Settings
        </h1>

        <p className="max-w-2xl mt-3 text-indigo-100">
          Configure security, notifications, AI preferences, integrations and
          enterprise platform settings for your organization.
        </p>

        <div className="flex flex-wrap gap-3 mt-6">

          <span className="px-4 py-2 text-sm rounded-full bg-white/10">
            CRM
          </span>

          <span className="px-4 py-2 text-sm rounded-full bg-white/10">
            ERP
          </span>

          <span className="px-4 py-2 text-sm rounded-full bg-white/10">
            AI Enabled
          </span>

        </div>

      </div>

      <div className="mt-8 lg:mt-0">

        <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-xl">

          <p className="text-sm text-indigo-200">
            Platform Status
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Healthy
          </h2>

          <p className="mt-1 text-sm text-indigo-100">
            Enterprise Ready
          </p>

        </div>

      </div>

    </div>

  </div>

  {/* Overview Cards */}

  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

    <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
      <p className="text-sm text-slate-500">Security</p>
      <h3 className="mt-2 text-2xl font-bold text-green-600">
        Protected
      </h3>
    </div>

    <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
      <p className="text-sm text-slate-500">Notifications</p>
      <h3 className="mt-2 text-2xl font-bold text-indigo-600">
        Enabled
      </h3>
    </div>

    <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
      <p className="text-sm text-slate-500">API Status</p>
      <h3 className="mt-2 text-2xl font-bold text-cyan-600">
        Connected
      </h3>
    </div>

    <div className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200">
      <p className="text-sm text-slate-500">AI Services</p>
      <h3 className="mt-2 text-2xl font-bold text-violet-600">
        Active
      </h3>
    </div>

  </div>

  {/* Settings Grid */}

  <div className="grid gap-6 lg:grid-cols-2">

    <CardSection title="Notifications">
      <SettingToggle
        title="Email Notifications"
        desc="Receive updates via email"
        icon={<Mail size={18} />}
      />

      <SettingToggle
        title="Push Notifications"
        desc="Receive alerts in real-time"
        icon={<Bell size={18} />}
      />

      <SettingToggle
        title="Security Alerts"
        desc="Notify login and permission changes"
        icon={<ShieldCheck size={18} />}
      />
    </CardSection>

    <CardSection title="Appearance">
      <SettingToggle
        title="Dark Mode"
        desc="Reduce eye strain at night"
        toggleValue={darkMode}
        setToggle={setDarkMode}
        icon={<Moon size={18} />}
        iconOn={<Moon size={16} />}
        iconOff={<Sun size={16} />}
      />
    </CardSection>

    <CardSection title="Security">
      <SettingToggle
        title="Two-Factor Authentication"
        desc="Extra layer of account security"
        icon={<ShieldCheck size={18} />}
      />

      <SettingToggle
        title="Password Change Reminder"
        desc="Receive reminders to update password"
        icon={<ShieldCheck size={18} />}
      />
    </CardSection>

    <CardSection title="Integrations">
      <SettingToggle
        title="CRM API Access"
        desc="Enable API for external integrations"
        icon={<Link size={18} />}
      />

      <SettingToggle
        title="Third Party Apps"
        desc="Slack, Google Workspace, Teams"
        icon={<Link size={18} />}
      />
    </CardSection>

    <CardSection title="AI Settings">
      <SettingToggle
        title="Claude AI Assistant"
        desc="Enable AI across CRM modules"
      />

      <SettingToggle
        title="AI Suggestions"
        desc="Display intelligent recommendations"
      />
    </CardSection>

    <CardSection title="Backup & Recovery">
      <SettingToggle
        title="Automatic Backup"
        desc="Daily secure cloud backup"
      />

      <SettingToggle
        title="Restore Points"
        desc="Maintain recovery checkpoints"
      />
    </CardSection>

  </div>

</div>
  );
}

function SettingToggle({
  title,
  desc,
  toggleValue,
  setToggle,
  icon,
  iconOn,
  iconOff,
  badge = "Enabled",
}) {
  const isControlled =
    toggleValue !== undefined && setToggle !== undefined;

  const [localToggle, setLocalToggle] = useState(false);

  const active = isControlled ? toggleValue : localToggle;

  const handleToggle = () => {
    if (isControlled) {
      setToggle(!toggleValue);
    } else {
      setLocalToggle(!localToggle);
    }
  };

  return (
    <div className="flex items-center justify-between p-5 transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900">

      {/* Left */}

      <div className="flex items-start gap-4">

        <div className="flex items-center justify-center w-12 h-12 text-white shadow-lg rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
          {icon}
        </div>

        <div>

          <div className="flex items-center gap-2">

            <h3 className="text-base font-semibold text-slate-800 dark:text-white">
              {title}
            </h3>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                active
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {active ? badge : "Disabled"}
            </span>

          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {desc}
          </p>

        </div>

      </div>

      {/* Toggle */}

      <button
        onClick={handleToggle}
        className={`relative h-8 w-16 rounded-full transition-all duration-300 ${
          active
            ? "bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-300/40"
            : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-all duration-300 ${
            active ? "left-9" : "left-1"
          }`}
        >
          {active
            ? iconOn || (
                <span className="text-xs font-bold text-green-600">✓</span>
              )
            : iconOff || (
                <span className="text-xs text-slate-400">•</span>
              )}
        </span>
      </button>

    </div>
  );
}

/* ---------- ENTERPRISE CARD SECTION ---------- */

function CardSection({
  title,
  subtitle,
  icon,
  badge = "Active",
  children,
}) {
  return (
    <div className="relative overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-3xl border-slate-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900">

      {/* Background Glow */}
      <div className="absolute w-40 h-40 transition-opacity duration-500 rounded-full -right-16 -top-16 bg-indigo-500/10 blur-3xl group-hover:opacity-100" />

      {/* Header */}
      <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">

        <div className="flex items-center gap-4">

          {icon && (
            <div className="flex items-center justify-center w-12 h-12 text-white shadow-lg rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600">
              {icon}
            </div>
          )}

          <div>

            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle || "Manage your enterprise preferences"}
            </p>

          </div>

        </div>

        <span className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
          {badge}
        </span>

      </div>

      {/* Body */}

      <div className="p-6 space-y-4">

        {children}

      </div>

    </div>
  );
}