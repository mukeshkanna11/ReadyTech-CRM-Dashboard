import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Camera, Mail, Phone, User, Briefcase, Building2, Calendar, ShieldCheck, Trash2, Loader2 } from "lucide-react";

import {
  getMyProfile,
  updateMyProfile,
  fileToAvatar,
  initialsOf,
  PROFILE_EVENT,
} from "../services/profileService";

/* =========================================================
   MY PROFILE — own record only (GET/PATCH /api/user/me)
========================================================= */
export default function ProfilePage() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [avatar, setAvatar] = useState(null); // preview (data URL) or null
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    getMyProfile()
      .then((u) => {
        setMe(u);
        setForm({ name: u.name || "", phone: u.phone || "" });
        setAvatar(u.avatar || null);
      })
      .catch(() => setMe(false));
  }, []);

  const dirty =
    me && (form.name.trim() !== (me.name || "") || form.phone.trim() !== (me.phone || "") || avatar !== (me.avatar || null));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatar(await fileToAvatar(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || saving) return;
    try {
      setSaving(true);
      const updated = await updateMyProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        avatar,
      });
      setMe(updated);
      setAvatar(updated.avatar || null);
      window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: updated }));
      toast.success("Profile updated");
    } catch {
      /* API interceptor shows the server message */
    } finally {
      setSaving(false);
    }
  };

  if (me === null) {
    return <div className="grid h-64 place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  if (me === false) {
    return <p className="p-6 text-sm text-rose-600">Could not load your profile.</p>;
  }

  const input =
    "w-full px-3 py-2.5 text-sm bg-white border outline-none rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

  return (
    <div className="max-w-4xl p-4 mx-auto space-y-6 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Manage your photo and contact details.</p>
      </div>

      <form onSubmit={save} className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
        {/* Header / photo */}
        <div className="h-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500" />
        <div className="flex flex-col gap-4 px-6 pb-6 -mt-12 sm:flex-row sm:items-end">
          <div className="relative w-24 h-24 shrink-0">
            {avatar ? (
              <img src={avatar} alt="Profile" className="object-cover w-24 h-24 rounded-full shadow-lg ring-4 ring-white" />
            ) : (
              <div className="grid w-24 h-24 text-2xl font-bold text-white rounded-full shadow-lg place-items-center ring-4 ring-white bg-gradient-to-br from-indigo-600 to-violet-600">
                {initialsOf(form.name || me.name)}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 grid w-8 h-8 text-white rounded-full shadow place-items-center bg-slate-900 hover:bg-slate-700 ring-2 ring-white"
              title="Change photo"
            >
              <Camera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate text-slate-900">{me.name}</p>
            <p className="text-sm truncate text-slate-500">{me.email}</p>
          </div>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 text-xs font-medium border rounded-xl sm:self-end border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={13} /> Remove photo
            </button>
          )}
        </div>

        {/* Editable fields */}
        <div className="grid gap-5 px-6 pb-6 sm:grid-cols-2">
          <Field icon={User} label="Full name">
            <input className={input} value={form.name} maxLength={80} required
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field icon={Mail} label="Email" hint="Used to sign in — contact an admin to change it">
            <input className={`${input} bg-slate-50 text-slate-500`} value={me.email} disabled />
          </Field>
          <Field icon={Phone} label="Phone">
            <input className={input} value={form.phone} maxLength={20} placeholder="+91 98765 43210"
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field icon={ShieldCheck} label="Role">
            <input className={`${input} bg-slate-50 text-slate-500 capitalize`} value={me.role || "—"} disabled />
          </Field>
          <Field icon={Building2} label="Department">
            <input className={`${input} bg-slate-50 text-slate-500`} value={me.department || "—"} disabled />
          </Field>
          <Field icon={Briefcase} label="Designation">
            <input className={`${input} bg-slate-50 text-slate-500`} value={me.designation || "—"} disabled />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t bg-slate-50/60 border-slate-100">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={13} /> Member since {new Date(me.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <button type="button" disabled={saving}
                onClick={() => { setForm({ name: me.name || "", phone: me.phone || "" }); setAvatar(me.avatar || null); }}
                className="px-4 py-2 text-sm font-medium bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            )}
            <button type="submit" disabled={!dirty || saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white shadow-sm rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" />} Save changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ icon: Icon, label, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-slate-600">
        <Icon size={13} className="text-slate-400" /> {label}
      </span>
      {children}
      {hint && <span className="block mt-1 text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
