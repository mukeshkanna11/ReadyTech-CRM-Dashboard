import {
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  ShieldCheck,
  Key,
  Users,
  BadgeCheck,
  MonitorSmartphone,
  Lock,
  Copy,
  CheckCircle2,
  MapPin,
  Pencil,
  History,
} from "lucide-react";
import { FaLinkedin, FaTwitter } from "react-icons/fa";

export default function ProfilePage() {
  return (
    <div className="max-w-6xl p-4 mx-auto space-y-8 md:p-6">
      <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>

      {/* Grid Layout */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* Enterprise Profile Card */}

<div className="relative overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

  {/* Background Gradient */}
  <div className="h-28 bg-gradient-to-r from-indigo-700 via-violet-600 to-cyan-500" />

  {/* Avatar */}
  <div className="relative flex justify-center -mt-14">
    <div className="relative">

      <div className="flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-indigo-600 to-violet-600 text-5xl font-bold text-white shadow-2xl">
        A
      </div>

      <span className="absolute w-6 h-6 bg-green-500 border-4 border-white rounded-full bottom-2 right-2" />

    </div>
  </div>

  {/* User Details */}
  <div className="px-6 pb-6 text-center">

    <h2 className="mt-4 text-2xl font-bold text-slate-900">
      Admin User
    </h2>

    <p className="mt-1 text-sm font-medium text-indigo-600">
      Super Administrator
    </p>

    <div className="flex justify-center gap-2 mt-4">

      <span className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
        Active
      </span>

      <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
        Enterprise
      </span>

    </div>

    {/* Stats */}

    <div className="grid grid-cols-2 gap-4 mt-8">

      <div className="p-4 border rounded-2xl border-slate-200 bg-slate-50">

        <p className="text-xs tracking-wide uppercase text-slate-500">
          Member Since
        </p>

        <h4 className="mt-1 font-semibold text-slate-800">
          Jan 01, 2023
        </h4>

      </div>

      <div className="p-4 border rounded-2xl border-slate-200 bg-slate-50">

        <p className="text-xs tracking-wide uppercase text-slate-500">
          Last Login
        </p>

        <h4 className="mt-1 font-semibold text-green-600">
          Today
        </h4>

      </div>

    </div>

    {/* Quick Info */}

    <div className="mt-6 space-y-3">

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50">

        <span className="text-sm text-slate-500">
          Role
        </span>

        <span className="font-semibold text-slate-800">
          Administrator
        </span>

      </div>

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50">

        <span className="text-sm text-slate-500">
          Access Level
        </span>

        <span className="font-semibold text-indigo-600">
          Full Access
        </span>

      </div>

      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50">

        <span className="text-sm text-slate-500">
          Account Status
        </span>

        <span className="font-semibold text-green-600">
          Active
        </span>

      </div>

    </div>

    {/* Buttons */}

    <div className="mt-8 space-y-3">

      <button className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02]">
        Edit Profile
      </button>

      <button className="w-full px-5 py-3 font-semibold transition bg-white border rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-100">
        Change Password
      </button>

    </div>

  </div>

</div>

        {/* Personal & Contact Details */}
        {/* Personal & Contact Details */}

<div className="bg-white border shadow-xl rounded-3xl border-slate-200 md:col-span-2">

  {/* Header */}

  <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200">

    <div>

      <h2 className="text-2xl font-bold text-slate-900">
        Personal Information
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Manage your profile, contact details and account information.
      </p>

    </div>

    <button className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105">
      Edit Profile
    </button>

  </div>

  {/* Body */}

  <div className="grid gap-5 p-8 lg:grid-cols-2">

    <ProfileItem
      icon={<Mail size={20} />}
      label="Email Address"
      value="admin@crm.com"
    />

    <ProfileItem
      icon={<Phone size={20} />}
      label="Mobile Number"
      value="+91 98765 43210"
    />

    <ProfileItem
      icon={<Globe size={20} />}
      label="Website"
      value="www.readytechsolutions.com"
    />

    <ProfileItem
      icon={<Calendar size={20} />}
      label="Member Since"
      value="01 Jan 2023"
    />

    <ProfileItem
      icon={<ShieldCheck size={20} />}
      label="Role"
      value="Super Administrator"
    />

    <ProfileItem
      icon={<Key size={20} />}
      label="Password"
      value="••••••••••••"
    />

    <ProfileItem
      icon={<Lock size={20} />}
      label="Two Factor Authentication"
      value="Enabled"
    />

    <ProfileItem
      icon={<Building2 size={20} />}
      label="Organization"
      value="ReadyTech Solutions"
    />

    <ProfileItem
      icon={<Users size={20} />}
      label="Department"
      value="Management"
    />

    <ProfileItem
      icon={<Globe size={20} />}
      label="Timezone"
      value="Asia / Kolkata"
    />

    <ProfileItem
      icon={<BadgeCheck size={20} />}
      label="Account Status"
      value="Active"
    />

    <ProfileItem
      icon={<History size={20} />}
      label="Last Login"
      value="Today, 10:15 AM"
    />

  </div>

</div>
      </div>

      {/* Enterprise Account Settings */}

<div className="grid gap-6 lg:grid-cols-2">

  {/* Security Center */}

  <div className="bg-white border shadow-xl rounded-3xl border-slate-200">

    <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200">

      <div>

        <h2 className="text-2xl font-bold text-slate-900">
          Security Center
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Protect your account with enterprise-grade security controls.
        </p>

      </div>

      <span className="px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
        Protected
      </span>

    </div>

    <div className="p-8 space-y-5">

      <ProfileItem
        icon={<ShieldCheck size={20} />}
        label="Security Status"
        value="Protected"
      />

      <ProfileItem
        icon={<Lock size={20} />}
        label="Two-Factor Authentication"
        value="Enabled"
      />

      <ProfileItem
        icon={<History size={20} />}
        label="Last Password Change"
        value="15 Days Ago"
      />

      <ProfileItem
        icon={<MonitorSmartphone size={20} />}
        label="Active Sessions"
        value="3 Devices"
      />

      <div className="flex flex-wrap gap-3 pt-4">

        <button className="px-6 py-3 font-semibold text-white transition shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-105">
          Change Password
        </button>

        <button className="px-6 py-3 font-semibold text-indigo-600 transition border border-indigo-600 rounded-2xl hover:bg-indigo-50">
          Manage 2FA
        </button>

      </div>

    </div>

  </div>

  {/* Contact & Social */}

  <div className="bg-white border shadow-xl rounded-3xl border-slate-200">

    <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200">

      <div>

        <h2 className="text-2xl font-bold text-slate-900">
          Contact & Social
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Professional profile and social network information.
        </p>

      </div>

      <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
        Verified
      </span>

    </div>

    <div className="p-8 space-y-5">

      <ProfileItem
  icon={<FaLinkedin size={18} className="text-blue-600" />}
  label="LinkedIn"
  value="linkedin.com/in/adminuser"
/>

      <ProfileItem
        icon={<Globe size={20} />}
        label="Website"
        value="www.readytechsolutions.com"
      />

      <ProfileItem
        icon={<Mail size={20} />}
        label="Business Email"
        value="admin@readytechsolutions.com"
      />

      <ProfileItem
        icon={<Phone size={20} />}
        label="Support Number"
        value="+91 98765 43210"
      />

      <ProfileItem
        icon={<MapPin size={20} />}
        label="Office Location"
        value="Coimbatore, Tamil Nadu"
      />

    </div>

  </div>

</div>
      {/* Professional Profile */}

<div className="bg-white border shadow-xl rounded-3xl border-slate-200">

  {/* Header */}

  <div className="flex items-center justify-between px-8 py-6 border-b border-slate-200">

    <div>
      <h2 className="text-2xl font-bold text-slate-900">
        Professional Profile
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Update your professional information and personal biography.
      </p>
    </div>

    <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
      Public Profile
    </span>

  </div>

  <div className="p-8 space-y-8">

    {/* Profile Information */}

    <div className="grid gap-6 md:grid-cols-2">

      <div>
        <label className="block mb-2 text-sm font-semibold text-slate-700">
          Employee ID
        </label>

        <input
          type="text"
          defaultValue="RTS-EMP-0001"
          className="w-full px-4 py-3 transition border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div>
        <label className="block mb-2 text-sm font-semibold text-slate-700">
          Department
        </label>

        <input
          type="text"
          defaultValue="Administration"
          className="w-full px-4 py-3 transition border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div>
        <label className="block mb-2 text-sm font-semibold text-slate-700">
          Job Title
        </label>

        <input
          type="text"
          defaultValue="System Administrator"
          className="w-full px-4 py-3 transition border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div>
        <label className="block mb-2 text-sm font-semibold text-slate-700">
          Experience
        </label>

        <input
          type="text"
          defaultValue="5 Years"
          className="w-full px-4 py-3 transition border rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </div>

    </div>

    {/* Skills */}

    <div>

      <label className="block mb-3 text-sm font-semibold text-slate-700">
        Professional Skills
      </label>

      <div className="flex flex-wrap gap-3">

        {[
          "CRM",
          "ERP",
          "Leadership",
          "Management",
          "Business Analytics",
          "Sales",
          "Communication",
          "AI Automation",
        ].map((skill) => (
          <span
            key={skill}
            className="px-4 py-2 text-sm font-medium text-indigo-700 rounded-full bg-gradient-to-r from-indigo-100 to-violet-100"
          >
            {skill}
          </span>
        ))}

      </div>

    </div>

    {/* Biography */}

    <div>

      <label className="block mb-3 text-sm font-semibold text-slate-700">
        Biography
      </label>

      <textarea
        rows={6}
        placeholder="Write a professional introduction about yourself..."
        className="w-full p-4 text-sm transition border resize-none rounded-2xl border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
      />

    </div>

    {/* Footer */}

    <div className="flex items-center justify-between pt-6 border-t border-slate-200">

      <p className="text-sm text-slate-500">
        Last updated: Today at 10:45 AM
      </p>

      <button className="px-6 py-3 font-semibold text-white transition shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-105">
        Save Profile
      </button>

    </div>

  </div>

</div>
    </div>
  );
}



function ProfileItem({
  icon,
  label,
  value,
  verified = true,
  editable = false,
}) {
  return (
    <div className="relative p-5 overflow-hidden transition-all duration-300 bg-white border shadow-sm group rounded-2xl border-slate-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl">

      {/* Background Glow */}
      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 bg-gradient-to-r from-indigo-50 via-transparent to-violet-50 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between">

        <div className="flex items-center gap-4">

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 text-white shadow-lg rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
            {icon}
          </div>

          {/* Content */}
          <div>

            <div className="flex items-center gap-2">

              <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                {label}
              </p>

              {verified && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                  Verified
                </span>
              )}

            </div>

            <p className="mt-1 text-base font-semibold text-slate-900">
              {value}
            </p>

          </div>

        </div>

        {/* Right Actions */}

        <div className="flex items-center gap-2">

          {verified && (
            <CheckCircle2
              size={18}
              className="text-emerald-500"
            />
          )}

          <button className="p-2 transition rounded-xl text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
            <Copy size={16} />
          </button>

          {editable && (
            <button className="p-2 transition rounded-xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
              <Pencil size={16} />
            </button>
          )}

        </div>

      </div>

    </div>
  );
}
