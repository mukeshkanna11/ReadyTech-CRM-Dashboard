import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
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

import { applyTheme, getTheme } from "../services/theme";
import API from "../services/api";

const NOTIF_LABELS = { email: "Email notifications", push: "Push notifications", securityAlerts: "Security alerts" };

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(() => getTheme() === "dark");
  const toggleTheme = (on) => {
    const value = typeof on === "function" ? on(darkMode) : on;
    setDarkMode(applyTheme(value ? "dark" : "light") === "dark");
  };

  /* Notifications — workspace preferences persisted on the backend */
  const [notif, setNotif] = useState(null);
  const [notifStatus, setNotifStatus] = useState("loading"); // loading | ready | error | forbidden
  const [savingKey, setSavingKey] = useState(null);

  const loadNotif = () => {
    setNotifStatus("loading");
    API.get("/admin/settings/notifications")
      .then((res) => {
        setNotif(res.data?.data);
        setNotifStatus("ready");
      })
      .catch((err) => setNotifStatus(err.response?.status === 403 ? "forbidden" : "error"));
  };

  useEffect(loadNotif, []);

  const saveNotif = async (key, value) => {
    if (savingKey) return;
    const previous = notif;
    setSavingKey(key);
    setNotif({ ...notif, [key]: value });
    try {
      const res = await API.put("/admin/settings/notifications", { [key]: value });
      setNotif(res.data?.data);
      toast.success(`${NOTIF_LABELS[key]} ${value ? "enabled" : "disabled"}`);
    } catch {
      setNotif(previous); // interceptor shows the error toast
    } finally {
      setSavingKey(null);
    }
  };

  /* Integrations — workspace API access + third-party apps */
  const [integ, setInteg] = useState(null);
  const [integStatus, setIntegStatus] = useState("loading"); // loading | ready | error | forbidden
  const [integBusy, setIntegBusy] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);

  const loadInteg = () => {
    setIntegStatus("loading");
    API.get("/admin/settings/integrations")
      .then((res) => {
        setInteg(res.data?.data);
        setIntegStatus("ready");
      })
      .catch((err) => setIntegStatus(err.response?.status === 403 ? "forbidden" : "error"));
  };

  useEffect(loadInteg, []);

  const integRequest = async (request, successMsg) => {
    if (integBusy) return;
    setIntegBusy(true);
    try {
      const res = await request();
      setInteg(res.data?.data);
      if (res.data?.data?.key) setNewApiKey(res.data.data.key);
      toast.success(successMsg);
    } catch {
      /* interceptor shows the error toast; state stays as last saved */
    } finally {
      setIntegBusy(false);
    }
  };

  const integToggle = (key, label) => ({
    toggleValue: !!integ?.[key],
    setToggle: (v) =>
      integRequest(() => API.put("/admin/settings/integrations", { [key]: v }), `${label} ${v ? "enabled" : "disabled"}`),
    disabled: integStatus !== "ready" || integBusy,
  });

  /* AI Settings — enforced by the backend for this workspace */
  const [ai, setAi] = useState(null);
  const [aiStatus, setAiStatus] = useState("loading"); // loading | ready | error | forbidden
  const [aiSaving, setAiSaving] = useState(false);

  const loadAi = () => {
    setAiStatus("loading");
    API.get("/admin/settings/ai")
      .then((res) => {
        setAi(res.data?.data);
        setAiStatus("ready");
      })
      .catch((err) => setAiStatus(err.response?.status === 403 ? "forbidden" : "error"));
  };

  useEffect(loadAi, []);

  const aiToggle = (key, label) => ({
    toggleValue: !!ai?.[key],
    setToggle: async (v) => {
      if (aiSaving) return;
      const previous = ai;
      setAiSaving(true);
      setAi({ ...ai, [key]: v });
      try {
        const res = await API.put("/admin/settings/ai", { [key]: v });
        setAi(res.data?.data);
        toast.success(`${label} ${v ? "enabled" : "disabled"}`);
      } catch {
        setAi(previous); // interceptor shows the error toast
      } finally {
        setAiSaving(false);
      }
    },
    disabled: aiStatus !== "ready" || aiSaving,
  });

  /* Security — 2FA is per user, password reminder is a workspace policy */
  const [sec, setSec] = useState(null); // GET /user/me/security
  const [secPolicy, setSecPolicy] = useState(null); // admin-only
  const [secStatus, setSecStatus] = useState("loading");
  const [secBusy, setSecBusy] = useState(false);
  const [tfa, setTfa] = useState({ step: null, password: "", code: "", setup: null, recoveryCodes: null });

  const loadSec = () => {
    setSecStatus("loading");
    API.get("/user/me/security")
      .then((res) => {
        setSec(res.data?.data);
        setSecStatus("ready");
      })
      .catch(() => setSecStatus("error"));
    API.get("/admin/settings/security")
      .then((res) => setSecPolicy(res.data?.data))
      .catch((err) => setSecPolicy(err.response?.status === 403 ? "forbidden" : null));
  };

  useEffect(loadSec, []);

  const secCall = async (fn, onOk) => {
    if (secBusy) return;
    setSecBusy(true);
    try {
      await onOk(await fn());
    } catch {
      /* interceptor shows the error toast */
    } finally {
      setSecBusy(false);
    }
  };

  const tfaSubmit = (e) => {
    e.preventDefault();
    if (tfa.step === "password") {
      secCall(() => API.post("/user/me/2fa/setup", { password: tfa.password }), (res) =>
        setTfa({ ...tfa, step: "verify", password: "", setup: res.data?.data }));
    } else if (tfa.step === "verify") {
      secCall(() => API.post("/user/me/2fa/enable", { code: tfa.code }), (res) => {
        setSec(res.data?.data);
        setTfa({ step: "codes", password: "", code: "", setup: null, recoveryCodes: res.data?.data?.recoveryCodes });
        toast.success("Two-factor authentication enabled");
      });
    } else if (tfa.step === "disable") {
      const code = tfa.code.trim();
      secCall(
        () => API.post("/user/me/2fa/disable", { password: tfa.password, ...(/^\d{6}$/.test(code) ? { code } : { recoveryCode: code }) }),
        (res) => {
          setSec(res.data?.data);
          setTfa({ step: null, password: "", code: "", setup: null, recoveryCodes: null });
          toast.success("Two-factor authentication disabled");
        }
      );
    }
  };

  /* Backup & Recovery */
  const [bk, setBk] = useState(null);
  const [bkStatus, setBkStatus] = useState("loading");
  const [bkBusy, setBkBusy] = useState(false);

  const loadBk = () => {
    setBkStatus("loading");
    API.get("/admin/settings/backup")
      .then((res) => {
        setBk(res.data?.data);
        setBkStatus("ready");
      })
      .catch((err) => setBkStatus(err.response?.status === 403 ? "forbidden" : "error"));
  };

  useEffect(loadBk, []);

  const bkCall = async (fn, msg) => {
    if (bkBusy) return;
    setBkBusy(true);
    try {
      const res = await fn();
      setBk(res.data?.data);
      toast.success(res.data?.message || msg);
    } catch {
      /* interceptor shows the error toast */
    } finally {
      setBkBusy(false);
    }
  };

  const restorePoint = async (p) => {
    if (bkBusy) return;
    try {
      const { data } = await API.post(`/admin/backup/restore-points/${p.id}/validate`);
      const v = data?.data;
      if (!v?.valid) {
        toast.error(`Restore point is not valid: ${v?.problems?.join("; ")}`);
        return;
      }
      const typed = window.prompt(
        `Restore ${v.totalDocs} records from ${new Date(v.createdAt).toLocaleString()}?\n\n` +
          "This REPLACES this workspace's current CRM data (users and settings are not affected). " +
          "Current data is saved as a new restore point first.\n\nType RESTORE to confirm."
      );
      if (typed !== "RESTORE") {
        toast("Restore cancelled");
        return;
      }
      bkCall(() => API.post(`/admin/backup/restore-points/${p.id}/restore`, { confirm: "RESTORE" }), "Restore completed");
    } catch {
      /* interceptor shows the error toast */
    }
  };

  const notifToggle = (key) => ({
    toggleValue: !!notif?.[key],
    setToggle: (v) => saveNotif(key, v),
    disabled: notifStatus !== "ready" || !!savingKey,
  });

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
        {notifStatus !== "ready"
          ? "—"
          : Object.values(notif || {}).some(Boolean) ? "Enabled" : "Disabled"}
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
      {notifStatus === "loading" && (
        <p className="text-sm text-slate-500">Loading notification settings…</p>
      )}
      {notifStatus === "forbidden" && (
        <p className="text-sm text-amber-600">Only workspace admins can manage notification settings.</p>
      )}
      {notifStatus === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load notification settings.{" "}
          <button onClick={loadNotif} className="font-semibold underline">Retry</button>
        </p>
      )}

      <SettingToggle
        title="Email Notifications"
        desc="Receive updates via email"
        icon={<Mail size={18} />}
        {...notifToggle("email")}
      />

      <SettingToggle
        title="Push Notifications"
        desc="Receive alerts in real-time"
        icon={<Bell size={18} />}
        {...notifToggle("push")}
      />

      <SettingToggle
        title="Security Alerts"
        desc="Notify login and permission changes"
        icon={<ShieldCheck size={18} />}
        {...notifToggle("securityAlerts")}
      />
    </CardSection>

    <CardSection title="Appearance">
      <SettingToggle
        title="Dark Mode"
        desc="Reduce eye strain at night"
        toggleValue={darkMode}
        setToggle={toggleTheme}
        icon={<Moon size={18} />}
        iconOn={<Moon size={16} />}
        iconOff={<Sun size={16} />}
      />
    </CardSection>

    <CardSection title="Security">
      {secStatus === "loading" && <p className="text-sm text-slate-500">Loading security settings…</p>}
      {secStatus === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load security settings.{" "}
          <button onClick={loadSec} className="font-semibold underline">Retry</button>
        </p>
      )}

      <SettingToggle
        title="Two-Factor Authentication"
        desc="Extra layer of account security"
        icon={<ShieldCheck size={18} />}
        toggleValue={!!sec?.twoFactor?.enabled}
        setToggle={(v) => setTfa({ step: v ? "password" : "disable", password: "", code: "", setup: null, recoveryCodes: null })}
        disabled={secStatus !== "ready" || secBusy || !!tfa.step}
      />

      {tfa.step && (
        <form onSubmit={tfaSubmit} className="p-4 space-y-3 text-sm border rounded-2xl border-slate-200 dark:border-slate-700">
          {tfa.step === "codes" ? (
            <>
              <p className="font-semibold text-amber-700">
                Save these recovery codes now — each works once and they won't be shown again:
              </p>
              <pre className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">{tfa.recoveryCodes?.join("\n")}</pre>
              <button type="button" onClick={() => setTfa({ step: null })} className="font-semibold text-indigo-600">Done</button>
            </>
          ) : (
            <>
              {tfa.step === "verify" && (
                <>
                  <p>Scan with an authenticator app (Google Authenticator, Authy, 1Password…), then enter the 6-digit code.</p>
                  <img src={tfa.setup?.qrCode} alt="2FA QR code" className="w-40 h-40" />
                  <p className="break-all">Manual key: <code>{tfa.setup?.secret}</code></p>
                </>
              )}
              {(tfa.step === "password" || tfa.step === "disable") && (
                <input type="password" autoComplete="current-password" placeholder="Current password" value={tfa.password}
                  onChange={(e) => setTfa({ ...tfa, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800" />
              )}
              {(tfa.step === "verify" || tfa.step === "disable") && (
                <input inputMode="text" autoComplete="one-time-code"
                  placeholder={tfa.step === "disable" ? "Authenticator code or recovery code" : "6-digit code"}
                  value={tfa.code} onChange={(e) => setTfa({ ...tfa, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-slate-50 dark:bg-slate-800" />
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={secBusy} className="font-semibold text-indigo-600 disabled:opacity-50">
                  {secBusy ? "Please wait…" : tfa.step === "password" ? "Continue" : tfa.step === "verify" ? "Enable 2FA" : "Disable 2FA"}
                </button>
                <button type="button" onClick={() => setTfa({ step: null })} className="text-slate-500">Cancel</button>
              </div>
            </>
          )}
        </form>
      )}
      {sec?.twoFactor?.enabled && !tfa.step && (
        <p className="text-sm text-slate-500">Recovery codes remaining: {sec.twoFactor.recoveryCodesRemaining}</p>
      )}

      <SettingToggle
        title="Password Change Reminder"
        desc="Receive reminders to update password"
        icon={<ShieldCheck size={18} />}
        toggleValue={!!secPolicy?.passwordReminder}
        setToggle={(v) =>
          secCall(() => API.put("/admin/settings/security", { passwordReminder: v }), async (res) => {
            setSecPolicy(res.data?.data);
            const me = await API.get("/user/me/security");
            setSec(me.data?.data);
            toast.success(`Password change reminder ${v ? "enabled" : "disabled"}`);
          })
        }
        disabled={!secPolicy || secPolicy === "forbidden" || secBusy}
      />
      {secPolicy === "forbidden" && (
        <p className="text-sm text-amber-600">Only workspace admins can change the password reminder policy.</p>
      )}
      {sec?.password && (
        <p className={`text-sm ${sec.password.reminderDue ? "text-red-600 font-semibold" : "text-slate-500"}`}>
          Your password is {sec.password.ageDays ?? "?"} days old
          {sec.password.reminderEnabled ? ` (policy: change every ${sec.password.maxAgeDays} days)` : ""}.
          {sec.password.reminderDue ? " Please change it now." : ""}
        </p>
      )}
    </CardSection>

    <CardSection title="Integrations">
      {integStatus === "loading" && (
        <p className="text-sm text-slate-500">Loading integration settings…</p>
      )}
      {integStatus === "forbidden" && (
        <p className="text-sm text-amber-600">Only workspace admins can manage integrations.</p>
      )}
      {integStatus === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load integration settings.{" "}
          <button onClick={loadInteg} className="font-semibold underline">Retry</button>
        </p>
      )}

      <SettingToggle
        title="CRM API Access"
        desc="Enable API for external integrations"
        icon={<Link size={18} />}
        {...integToggle("apiAccess", "CRM API access")}
      />

      {integStatus === "ready" && (
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            API key:{" "}
            {integ?.apiKey ? <code>{integ.apiKey.prefix}…</code> : "none"} · read-only (GET) access to
            leads, clients, opportunities, products, invoices and activities via the <code>X-API-Key</code> header.
          </p>
          {newApiKey && (
            <p className="p-2 break-all rounded-lg bg-amber-50 text-amber-800">
              Copy this key now — it won't be shown again: <code>{newApiKey}</code>
            </p>
          )}
          <div className="flex gap-3">
            <button
              disabled={integBusy}
              onClick={() => integRequest(() => API.post("/admin/settings/integrations/api-key"), "API key generated")}
              className="font-semibold text-indigo-600 disabled:opacity-50"
            >
              {integ?.apiKey ? "Regenerate key" : "Generate key"}
            </button>
            {integ?.apiKey && (
              <button
                disabled={integBusy}
                onClick={() => {
                  setNewApiKey(null);
                  integRequest(() => API.delete("/admin/settings/integrations/api-key"), "API key revoked");
                }}
                className="font-semibold text-red-600 disabled:opacity-50"
              >
                Revoke key
              </button>
            )}
          </div>
        </div>
      )}

      <SettingToggle
        title="Third Party Apps"
        desc="Slack, Google Workspace, Teams"
        icon={<Link size={18} />}
        {...integToggle("thirdPartyApps", "Third party apps")}
      />

      {integStatus === "ready" && (
        <ul className="space-y-1 text-sm">
          {integ?.providers?.map((p) => (
            <li key={p.id} className="text-slate-500">
              {p.name}: <span className="font-semibold text-amber-600">Not available</span> — {p.reason}
            </li>
          ))}
        </ul>
      )}
    </CardSection>

    <CardSection title="AI Settings">
      {aiStatus === "loading" && (
        <p className="text-sm text-slate-500">Loading AI settings…</p>
      )}
      {aiStatus === "forbidden" && (
        <p className="text-sm text-amber-600">Only workspace admins can manage AI settings.</p>
      )}
      {aiStatus === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load AI settings.{" "}
          <button onClick={loadAi} className="font-semibold underline">Retry</button>
        </p>
      )}
      {aiStatus === "ready" && !ai?.configured && (
        <p className="text-sm text-red-600">
          Claude API key is not configured on the server — AI features will return an error until it is set.
        </p>
      )}

      <SettingToggle
        title="Claude AI Assistant"
        desc="Enable AI across CRM modules"
        {...aiToggle("claude", "Claude AI Assistant")}
      />

      <SettingToggle
        title="AI Suggestions"
        desc="Display intelligent recommendations"
        {...aiToggle("suggestions", "AI Suggestions")}
      />
    </CardSection>

    <CardSection title="Backup & Recovery">
      {bkStatus === "loading" && <p className="text-sm text-slate-500">Loading backup settings…</p>}
      {bkStatus === "forbidden" && (
        <p className="text-sm text-amber-600">Only workspace admins can manage backups.</p>
      )}
      {bkStatus === "error" && (
        <p className="text-sm text-red-600">
          Couldn't load backup settings.{" "}
          <button onClick={loadBk} className="font-semibold underline">Retry</button>
        </p>
      )}

      <SettingToggle
        title="Automatic Backup"
        desc="Daily secure cloud backup"
        toggleValue={!!bk?.autoBackup}
        setToggle={(v) => bkCall(() => API.put("/admin/settings/backup", { autoBackup: v }), "Saved")}
        disabled={bkStatus !== "ready" || bkBusy || !bk?.autoBackupAvailable}
      />
      {bkStatus === "ready" && !bk?.autoBackupAvailable && (
        <p className="text-sm text-amber-600">Unavailable: {bk?.autoBackupReason}</p>
      )}

      <SettingToggle
        title="Restore Points"
        desc="Maintain recovery checkpoints"
        toggleValue={!!bk?.restorePoints}
        setToggle={(v) => bkCall(() => API.put("/admin/settings/backup", { restorePoints: v }), `Restore points ${v ? "enabled" : "disabled"}`)}
        disabled={bkStatus !== "ready" || bkBusy}
      />

      {bkStatus === "ready" && (
        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Daily checkpoints of this workspace's CRM data, stored in the same database (keeps the latest {bk?.retention}).
            {bk?.scheduler?.lastRunAt ? ` Last scheduler run: ${new Date(bk.scheduler.lastRunAt).toLocaleString()}.` : ""}
          </p>
          {bk?.scheduler?.lastError && <p className="text-red-600">Last scheduler error: {bk.scheduler.lastError}</p>}
          {bk?.restorePoints && (
            <button
              disabled={bkBusy}
              onClick={() => bkCall(() => API.post("/admin/backup/restore-points"), "Restore point created")}
              className="font-semibold text-indigo-600 disabled:opacity-50"
            >
              {bkBusy ? "Working…" : "Create restore point now"}
            </button>
          )}
          {bk?.points?.length ? (
            <ul className="space-y-1">
              {bk.points.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span>
                    {new Date(p.createdAt).toLocaleString()} · {p.trigger} ·{" "}
                    <span className={p.status === "completed" ? "text-green-600" : "text-red-600"}>{p.status}</span>
                    {p.status === "completed" ? ` · ${p.totalDocs} records` : p.error ? ` · ${p.error}` : ""}
                  </span>
                  {p.status === "completed" && (
                    <button disabled={bkBusy} onClick={() => restorePoint(p)} className="font-semibold text-red-600 disabled:opacity-50">
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">No restore points yet.</p>
          )}
        </div>
      )}
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
  disabled = false,
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
        disabled={disabled}
        aria-pressed={!!active}
        className={`relative h-8 w-16 rounded-full transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
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