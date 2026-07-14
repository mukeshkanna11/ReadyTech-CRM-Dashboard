import { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Building2,
  Mail,
  SlidersHorizontal,
  Save,
} from "lucide-react";

const TABS = [
  { key: "company", label: "Company Profile", icon: Building2 },
  { key: "email", label: "Email Settings", icon: Mail },
  { key: "system", label: "System Settings", icon: SlidersHorizontal },
];

const DEFAULTS = {
  company: {
    // Basic Information
    companyName: "ReadyTech Solutions",
    logo: "",

    // Contact
    email: "admin@crm.com",
    phone: "+91 98765 43210",
    website: "https://www.readytechsolutions.com",

    // Business Registration
    gstNumber: "",
    panNumber: "",
    registrationNumber: "",

    // Address
    address: "",
    city: "",
    state: "",
    country: "India",
    postalCode: "",

    // Localization
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "English",

    // Financial
    fiscalYear: "April - March",
  },

  email: {
    smtpHost: "",
    smtpPort: "587",
    username: "",
    password: "",
    fromName: "ReadyTech CRM",
    fromEmail: "",
    encryption: "TLS",
    notifications: true,
  },

  system: {
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12 Hours",
    perPage: "20",

    maintenance: false,
    autoBackup: true,
  },
};

const load = (key) => {
  try {
    const raw = localStorage.getItem(`settings:${key}`);
    return raw ? { ...DEFAULTS[key], ...JSON.parse(raw) } : DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
};

export default function Settings() {
  const [tab, setTab] = useState("company");
  const [company, setCompany] = useState(() => load("company"));
  const [email, setEmail] = useState(() => load("email"));
  const [system, setSystem] = useState(() => load("system"));

  const save = (key, value) => {
    localStorage.setItem(`settings:${key}`, JSON.stringify(value));
    toast.success("Settings saved");
  };

  return (
    <div className="min-h-screen p-4 space-y-6 sm:p-6 lg:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      {/* ===== Premium Enterprise Header ===== */}
<motion.div
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
  className="relative overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 shadow-2xl"
>
  {/* Background Effects */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.25),transparent_40%)]" />
  <div className="absolute rounded-full -top-20 -right-20 h-72 w-72 bg-indigo-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-24 -left-16 h-60 w-60 bg-cyan-500/10 blur-3xl" />

  <div className="relative flex flex-col justify-between gap-8 p-8 lg:flex-row lg:items-center">
    {/* Left */}
    <div className="flex items-center gap-5">
      <div className="flex items-center justify-center w-20 h-20 border shadow-xl rounded-3xl border-white/10 bg-white/10 backdrop-blur-xl">
        <SettingsIcon className="w-10 h-10 text-indigo-400" />
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Settings Center
          </h1>

          <span className="px-3 py-1 text-xs font-semibold border rounded-full border-emerald-400/30 bg-emerald-500/20 text-emerald-300">
            Enterprise
          </span>
        </div>

        <p className="max-w-2xl mt-2 text-sm leading-6 text-slate-300">
          Configure your organization profile, email services, system
          preferences and business settings from one centralized workspace.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <div className="px-4 py-2 border rounded-xl border-white/10 bg-white/5 backdrop-blur">
            <p className="text-xs text-slate-400">Organization</p>
            <p className="text-sm font-semibold text-white">
              ReadyTech Solutions
            </p>
          </div>

          <div className="px-4 py-2 border rounded-xl border-white/10 bg-white/5 backdrop-blur">
            <p className="text-xs text-slate-400">Environment</p>
            <p className="font-semibold text-emerald-400">
              Production
            </p>
          </div>

          <div className="px-4 py-2 border rounded-xl border-white/10 bg-white/5 backdrop-blur">
            <p className="text-xs text-slate-400">Last Updated</p>
            <p className="text-sm font-semibold text-white">
              Today • 09:45 AM
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Right */}
    <div className="grid grid-cols-2 gap-4 lg:w-[360px]">
      <div className="p-4 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">
        <p className="text-xs tracking-wider uppercase text-slate-400">
          Company
        </p>
        <h3 className="mt-1 text-2xl font-bold text-white">100%</h3>
        <p className="text-sm text-emerald-400">
          Profile Configured
        </p>
      </div>

      <div className="p-4 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">
        <p className="text-xs tracking-wider uppercase text-slate-400">
          System
        </p>
        <h3 className="mt-1 text-2xl font-bold text-white">99.9%</h3>
        <p className="text-sm text-cyan-400">
          Healthy Status
        </p>
      </div>

      <div className="p-4 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">
        <p className="text-xs tracking-wider uppercase text-slate-400">
          Email
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">
          SMTP Ready
        </h3>
        <p className="text-sm text-emerald-400">
          Secure Connection
        </p>
      </div>

      <div className="p-4 border rounded-2xl border-white/10 bg-white/5 backdrop-blur">
        <p className="text-xs tracking-wider uppercase text-slate-400">
          Security
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">
          Protected
        </h3>
        <p className="text-sm text-indigo-300">
          SSL Enabled
        </p>
      </div>
    </div>
  </div>
</motion.div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* TABS */}
        {/* ================= Enterprise Settings Navigation ================= */}
<div className="sticky overflow-hidden border shadow-2xl top-6 lg:col-span-1 rounded-3xl border-slate-200/70 bg-white/80 backdrop-blur-xl h-max">

  {/* Header */}
  <div className="relative p-6 overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900">

    <div className="absolute w-32 h-32 rounded-full -top-10 -right-10 bg-white/10 blur-2xl" />

    <div className="relative">
      <div className="flex items-center justify-center mb-4 text-white w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-lg">
        <SettingsIcon size={26} />
      </div>

      <h2 className="text-xl font-bold text-white">
        Settings Center
      </h2>

      <p className="mt-1 text-sm leading-6 text-indigo-100">
        Configure your organization, email server and enterprise preferences.
      </p>
    </div>

  </div>

  {/* Navigation */}
  <div className="p-3 space-y-2">

    {TABS.map((t) => {

      const Active = tab === t.key;

      return (

        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-4 py-4 transition-all duration-300

          ${
            Active
              ? "border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xl scale-[1.02]"
              : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-md"
          }`}
        >

          {/* Active Glow */}
          {Active && (
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          )}

          <div className="relative flex items-center gap-4">

            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all

              ${
                Active
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-indigo-600 group-hover:bg-indigo-100"
              }`}
            >
              <t.icon size={20} />
            </div>

            <div className="text-left">

              <h3
                className={`text-sm font-semibold

                ${
                  Active
                    ? "text-white"
                    : "text-slate-800"
                }`}
              >
                {t.label}
              </h3>

              <p
                className={`text-xs

                ${
                  Active
                    ? "text-indigo-100"
                    : "text-slate-400"
                }`}
              >
                Configure Settings
              </p>

            </div>

          </div>

          <div className="relative">

            {Active ? (

              <div className="flex items-center gap-2">

                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />

                <span className="text-xs font-medium">
                  Active
                </span>

              </div>

            ) : (

              <ChevronRight
                size={18}
                className="transition-transform text-slate-400 group-hover:translate-x-1"
              />

            )}

          </div>

        </button>

      );

    })}

  </div>

  {/* Footer */}
  <div className="p-5 border-t border-slate-200 bg-slate-50">

    <div className="p-4 border border-green-200 rounded-2xl bg-green-50">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-xs tracking-wide uppercase text-slate-500">
            System Status
          </p>

          <h4 className="mt-1 font-semibold text-slate-800">
            Enterprise Ready
          </h4>

        </div>

        <span className="flex items-center justify-center w-10 h-10 text-green-600 bg-green-100 rounded-xl">
          ✓
        </span>

      </div>

      <div className="h-2 mt-3 overflow-hidden rounded-full bg-slate-200">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500" />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Configuration Status: 100%
      </p>

    </div>

  </div>

</div>

        {/* PANEL */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white border shadow-sm rounded-3xl border-slate-200 lg:col-span-3"
        >
          {tab === "company" && (
  <Section
    title="Company Profile"
    onSave={() => save("company", company)}
  >
    {/* Company Header */}
    <div className="mb-8 overflow-hidden border shadow-xl rounded-3xl border-slate-200 bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-900">
      <div className="flex flex-col items-center justify-between gap-6 p-8 lg:flex-row">
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold text-white rounded-3xl bg-white/20 backdrop-blur">
            RT
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              Organization Profile
            </h2>

            <p className="max-w-xl mt-2 text-sm text-indigo-100">
              Configure your company information used across CRM, ERP and future
              SaaS applications.
            </p>

            <div className="flex flex-wrap gap-3 mt-4">
              <span className="px-3 py-1 text-xs text-white rounded-full bg-white/15">
                Enterprise
              </span>

              <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-200">
                Active Organization
              </span>

              <span className="px-3 py-1 text-xs rounded-full bg-cyan-500/20 text-cyan-200">
                Secure Configuration
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 text-center rounded-2xl bg-white/10 backdrop-blur">
            <p className="text-xs text-indigo-100">Profile</p>
            <h3 className="mt-1 text-xl font-bold text-white">100%</h3>
          </div>

          <div className="p-4 text-center rounded-2xl bg-white/10 backdrop-blur">
            <p className="text-xs text-indigo-100">Status</p>
            <h3 className="mt-1 text-xl font-bold text-emerald-300">
              Active
            </h3>
          </div>
        </div>
      </div>
    </div>

    {/* Form Card */}
    <div className="p-8 border shadow-sm rounded-3xl border-slate-200 bg-slate-50/50">

      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-800">
          Company Information
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Update your organization profile and business information.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <Field label="Company Name">
          <input
            className={INPUT}
            value={company.name}
            onChange={(e) =>
              setCompany({ ...company, name: e.target.value })
            }
            placeholder="ReadyTech Solutions"
          />
        </Field>

        <Field label="Business Email">
          <input
            className={INPUT}
            value={company.email}
            onChange={(e) =>
              setCompany({ ...company, email: e.target.value })
            }
            placeholder="info@readytechsolutions.in"
          />
        </Field>

        <Field label="Phone Number">
          <input
            className={INPUT}
            value={company.phone}
            onChange={(e) =>
              setCompany({ ...company, phone: e.target.value })
            }
          />
        </Field>

        <Field label="Website">
          <input
            className={INPUT}
            value={company.website}
            onChange={(e) =>
              setCompany({ ...company, website: e.target.value })
            }
          />
        </Field>

        <Field label="GST / Tax ID">
          <input
            className={INPUT}
            value={company.taxId}
            onChange={(e) =>
              setCompany({ ...company, taxId: e.target.value })
            }
          />
        </Field>

        <Field label="Currency">
          <select
            className={INPUT}
            value={company.currency}
            onChange={(e) =>
              setCompany({ ...company, currency: e.target.value })
            }
          >
            {["INR", "USD", "EUR", "GBP", "AED"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <div className="lg:col-span-2">
          <Field label="Business Address">
            <textarea
              rows={4}
              className={`${INPUT} resize-none`}
              value={company.address}
              onChange={(e) =>
                setCompany({
                  ...company,
                  address: e.target.value,
                })
              }
            />
          </Field>
        </div>@

      </div>
    </div>
  </Section>
)}

          {tab === "email" && (
            <Section
  title="Email Configuration Center"
  onSave={() => save("email", email)}
>
  {/* Header */}
  <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 via-indigo-600 to-slate-900">
    <div className="flex flex-col justify-between gap-6 p-8 lg:flex-row lg:items-center">
      <div>
        <h2 className="text-2xl font-bold text-white">
          SMTP & Email Configuration
        </h2>

        <p className="max-w-2xl mt-2 text-sm text-sky-100">
          Configure your enterprise email server for CRM notifications,
          invoices, quotations, customer communication and automated workflows.
        </p>

        <div className="flex flex-wrap gap-3 mt-5">
          <span className="px-4 py-2 text-xs font-medium text-white rounded-full bg-white/15">
            Enterprise SMTP
          </span>

          <span className="px-4 py-2 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-200">
            Secure Email
          </span>

          <span className="px-4 py-2 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-200">
            TLS Encryption
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 text-center rounded-2xl bg-white/10 backdrop-blur">
          <p className="text-xs text-sky-100">Server</p>
          <h3 className="mt-1 text-xl font-bold text-white">
            SMTP
          </h3>
        </div>

        <div className="p-4 text-center rounded-2xl bg-white/10 backdrop-blur">
          <p className="text-xs text-sky-100">Status</p>
          <h3 className="mt-1 text-lg font-bold text-emerald-300">
            Ready
          </h3>
        </div>
      </div>
    </div>
  </div>

  {/* SMTP Card */}
  <div className="p-8 border rounded-3xl border-slate-200 bg-slate-50">

    <div className="flex items-center justify-between mb-8">
      <div>
        <h3 className="text-xl font-bold text-slate-800">
          SMTP Configuration
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Configure outgoing mail server credentials.
        </p>
      </div>

      <span className="px-4 py-2 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
        Secure Connection
      </span>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">

      <Field label="SMTP Host">
        <input
          className={INPUT}
          value={email.smtpHost}
          onChange={(e) =>
            setEmail({
              ...email,
              smtpHost: e.target.value,
            })
          }
          placeholder="smtp.gmail.com"
        />
      </Field>

      <Field label="SMTP Port">
        <input
          className={INPUT}
          value={email.smtpPort}
          onChange={(e) =>
            setEmail({
              ...email,
              smtpPort: e.target.value,
            })
          }
          placeholder="587"
        />
      </Field>

      <Field label="SMTP Username">
        <input
          className={INPUT}
          value={email.username}
          onChange={(e) =>
            setEmail({
              ...email,
              username: e.target.value,
            })
          }
        />
      </Field>

      <Field label="SMTP Password">
        <input
          type="password"
          className={INPUT}
          value={email.password}
          onChange={(e) =>
            setEmail({
              ...email,
              password: e.target.value,
            })
          }
        />
      </Field>

      <Field label="From Name">
        <input
          className={INPUT}
          value={email.fromName}
          onChange={(e) =>
            setEmail({
              ...email,
              fromName: e.target.value,
            })
          }
        />
      </Field>

      <Field label="From Email">
        <input
          className={INPUT}
          value={email.fromEmail}
          onChange={(e) =>
            setEmail({
              ...email,
              fromEmail: e.target.value,
            })
          }
        />
      </Field>

      <Field label="Encryption">
        <select
          className={INPUT}
          value={email.encryption}
          onChange={(e) =>
            setEmail({
              ...email,
              encryption: e.target.value,
            })
          }
        >
          {["TLS", "SSL", "None"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>

      <div className="flex items-end">
        <button
          type="button"
          className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02]"
        >
          Test SMTP Connection
        </button>
      </div>

    </div>
  </div>

  {/* Notifications */}
  <div className="p-6 mt-8 bg-white border rounded-3xl border-slate-200">

    <h3 className="mb-6 text-lg font-bold text-slate-800">
      Notification Preferences
    </h3>

    <Toggle
      label="Email Notifications"
      desc="Automatically send invoices, quotations, lead updates, reminders and customer communications."
      value={email.notifications}
      onChange={(v) =>
        setEmail({
          ...email,
          notifications: v,
        })
      }
    />
  </div>
</Section>
          )}

          {tab === "system" && (
            <Section
  title="System Configuration"
  onSave={() => save("system", system)}
>
  {/* Enterprise Header */}
  <div className="mb-8 overflow-hidden shadow-xl rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-700 to-cyan-600">
    <div className="flex flex-col justify-between gap-6 p-8 lg:flex-row lg:items-center">

      <div>
        <h2 className="text-2xl font-bold text-white">
          System Configuration Center
        </h2>

        <p className="max-w-2xl mt-2 text-sm text-slate-200">
          Configure global application settings, localization, security,
          performance and maintenance preferences for your organization.
        </p>

        <div className="flex flex-wrap gap-3 mt-5">
          <span className="px-4 py-2 text-xs font-medium text-white rounded-full bg-white/10">
            Enterprise Ready
          </span>

          <span className="px-4 py-2 text-xs font-medium text-green-200 rounded-full bg-green-500/20">
            Secure Environment
          </span>

          <span className="px-4 py-2 text-xs font-medium rounded-full bg-cyan-500/20 text-cyan-200">
            Auto Backup Enabled
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">

        <div className="p-5 text-center rounded-2xl bg-white/10 backdrop-blur">
          <p className="text-xs text-slate-200">
            Environment
          </p>

          <h3 className="mt-1 text-xl font-bold text-white">
            Production
          </h3>
        </div>

        <div className="p-5 text-center rounded-2xl bg-white/10 backdrop-blur">
          <p className="text-xs text-slate-200">
            Status
          </p>

          <h3 className="mt-1 text-xl font-bold text-green-300">
            Healthy
          </h3>
        </div>

      </div>

    </div>
  </div>

  {/* Configuration Card */}

  <div className="p-8 border rounded-3xl border-slate-200 bg-slate-50">

    <div className="mb-8">
      <h3 className="text-xl font-bold text-slate-800">
        General Configuration
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        Configure localization, display preferences and system behavior.
      </p>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">

      <Field label="Timezone">
        <select
          className={INPUT}
          value={system.timezone}
          onChange={(e) =>
            setSystem({
              ...system,
              timezone: e.target.value,
            })
          }
        >
          {[
            "Asia/Kolkata",
            "UTC",
            "America/New_York",
            "Europe/London",
            "Asia/Dubai",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>

      <Field label="Date Format">
        <select
          className={INPUT}
          value={system.dateFormat}
          onChange={(e) =>
            setSystem({
              ...system,
              dateFormat: e.target.value,
            })
          }
        >
          {[
            "DD/MM/YYYY",
            "MM/DD/YYYY",
            "YYYY-MM-DD",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>

      <Field label="Language">
        <select
          className={INPUT}
          value={system.language}
          onChange={(e) =>
            setSystem({
              ...system,
              language: e.target.value,
            })
          }
        >
          {[
            "English",
            "Hindi",
            "Spanish",
            "French",
            "Arabic",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>

      <Field label="Records Per Page">
        <select
          className={INPUT}
          value={system.perPage}
          onChange={(e) =>
            setSystem({
              ...system,
              perPage: e.target.value,
            })
          }
        >
          {["10", "20", "50", "100"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>

    </div>
  </div>

  {/* Security & Maintenance */}

  <div className="grid gap-6 mt-8 lg:grid-cols-2">

    <div className="p-6 border border-orange-200 rounded-3xl bg-orange-50">

      <h3 className="mb-5 text-lg font-bold text-slate-800">
        Maintenance Settings
      </h3>

      <Toggle
        label="Maintenance Mode"
        desc="Temporarily disable application access for non-administrator users."
        value={system.maintenance}
        onChange={(v) =>
          setSystem({
            ...system,
            maintenance: v,
          })
        }
      />

    </div>

    <div className="p-6 border border-green-200 rounded-3xl bg-green-50">

      <h3 className="mb-5 text-lg font-bold text-slate-800">
        Backup Configuration
      </h3>

      <Toggle
        label="Automatic Database Backup"
        desc="Automatically create scheduled backups to protect your enterprise data."
        value={system.autoBackup}
        onChange={(v) =>
          setSystem({
            ...system,
            autoBackup: v,
          })
        }
      />

    </div>

  </div>

  {/* System Health */}

  <div className="p-8 mt-8 bg-white border rounded-3xl border-slate-200">

    <h3 className="mb-6 text-xl font-bold text-slate-800">
      System Health
    </h3>

    <div className="grid gap-6 md:grid-cols-4">

      <div className="p-5 text-center rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-500">CPU Status</p>
        <h4 className="mt-2 text-2xl font-bold text-green-600">
          Normal
        </h4>
      </div>

      <div className="p-5 text-center rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-500">Memory</p>
        <h4 className="mt-2 text-2xl font-bold text-indigo-600">
          68%
        </h4>
      </div>

      <div className="p-5 text-center rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-500">Database</p>
        <h4 className="mt-2 text-2xl font-bold text-emerald-600">
          Online
        </h4>
      </div>

      <div className="p-5 text-center rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-500">Version</p>
        <h4 className="mt-2 text-2xl font-bold text-cyan-600">
          v2.0
        </h4>
      </div>

    </div>

  </div>
</Section>
          )}
        </motion.div>
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/40";

function Field({ label, children, required = false, helper }) {
  return (
    <div className="space-y-2">

      <div className="flex items-center justify-between">

        <label className="text-sm font-semibold tracking-wide text-slate-700">
          {label}

          {required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </label>

        {helper && (
          <span className="text-xs text-slate-400">
            {helper}
          </span>
        )}

      </div>

      {children}

    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  onSave,
}) {
  return (
    <div className="space-y-8">

      <div className="sticky top-0 z-10 p-6 border shadow-lg rounded-3xl border-slate-200 bg-white/80 backdrop-blur-xl">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <h2 className="text-2xl font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {subtitle ||
                "Manage and configure your enterprise settings."}
            </p>

          </div>

          <div className="flex gap-3">

            <button
              type="button"
              className="px-5 py-3 text-sm font-semibold transition bg-white border rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Reset
            </button>

            <button
              onClick={onSave}
              className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 shadow-xl rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-105 hover:shadow-indigo-300"
            >
              <Save size={18} />
              Save Changes
            </button>

          </div>

        </div>

      </div>

      {children}

    </div>
  );
}
function Toggle({
  label,
  desc,
  value,
  onChange,
}) {
  return (
    <div className="flex items-center justify-between p-5 transition bg-white border shadow-sm rounded-3xl border-slate-200 hover:shadow-lg">

      <div>

        <h4 className="text-base font-semibold text-slate-800">
          {label}
        </h4>

        <p className="mt-1 text-sm text-slate-500">
          {desc}
        </p>

      </div>

      <button
        onClick={() => onChange(!value)}
        className={`relative h-8 w-16 rounded-full transition-all duration-300 ${
          value
            ? "bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg"
            : "bg-slate-300"
        }`}
      >

        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
            value
              ? "left-9"
              : "left-1"
          }`}
        />

      </button>

    </div>
  );
}