import { Mail, Phone, ShieldCheck, Key, Lock, Globe, Calendar } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="max-w-6xl p-4 mx-auto space-y-8 md:p-6">
      <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>

      {/* Grid Layout */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* Avatar & Summary */}
        <div className="flex flex-col items-center p-6 space-y-4 bg-white shadow-lg rounded-2xl">
          <div className="flex items-center justify-center text-5xl font-bold text-white bg-indigo-600 rounded-full w-28 h-28">
            A
          </div>
          <p className="text-xl font-semibold">Admin User</p>
          <p className="text-sm text-slate-500">Administrator</p>

          <div className="space-y-2 text-center">
            <p className="text-sm text-slate-500">Member since</p>
            <p className="font-medium text-slate-700">Jan 1, 2023</p>
          </div>
        </div>

        {/* Personal & Contact Details */}
        <div className="p-6 space-y-4 bg-white shadow-lg rounded-2xl md:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Personal Details</h2>

          <div className="grid gap-4">
            <ProfileItem icon={<Mail size={18} />} label="Email" value="admin@crm.com" />
            <ProfileItem icon={<Phone size={18} />} label="Phone" value="+91 98765 43210" />
            <ProfileItem icon={<Globe size={18} />} label="Website" value="www.readytechsolutions.com" />
            <ProfileItem icon={<Calendar size={18} />} label="Joined On" value="Jan 1, 2023" />
            <ProfileItem icon={<ShieldCheck size={18} />} label="Role & Access" value="Full Access (Admin)" />
            <ProfileItem icon={<Key size={18} />} label="Password" value="********" />
            <ProfileItem icon={<Lock size={18} />} label="Two-Factor Auth" value="Enabled" />
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Settings */}
        <div className="p-8 space-y-4 bg-white shadow-lg rounded-2xl">
          <h2 className="text-lg font-semibold text-slate-800">Security Settings</h2>
          <p className="text-sm text-slate-500">
            Manage your account security settings and ensure your account is safe.
          </p>
          <button className="px-4 py-2 text-white transition bg-indigo-600 rounded-lg hover:bg-indigo-700">
            Change Password
          </button>
          <button className="px-4 py-2 ml-3 text-indigo-600 transition border border-indigo-600 rounded-lg hover:bg-indigo-50">
             Two-Factor Authentication
          </button>
        </div>

        {/* Social & Contact Info */}
        <div className="p-6 space-y-4 bg-white shadow-lg rounded-2xl">
          <h2 className="text-lg font-semibold text-slate-800">Social & Contact</h2>
          <p className="text-sm text-slate-500">
            Add links to your social profiles or external websites.
          </p>
          <ProfileItem icon={<Globe size={18} />} label="LinkedIn" value="linkedin.com/in/adminuser" />
          <ProfileItem icon={<Globe size={18} />} label="Twitter" value="@adminuser" />
          <ProfileItem icon={<Globe size={18} />} label="Website" value="www.readytechsolutions.com" />
        </div>
      </div>

      {/* Notes / About Section */}
      <div className="p-6 bg-white shadow-lg rounded-2xl">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">About Me</h2>
        <textarea
          placeholder="Write something about yourself..."
          className="w-full h-24 p-3 text-sm border rounded-lg outline-none resize-none border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700"
        />
      </div>
    </div>
  );
}

function ProfileItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 p-4 transition rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700">
      <div className="text-indigo-600">{icon}</div>
      <div className="flex flex-col">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-medium text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
