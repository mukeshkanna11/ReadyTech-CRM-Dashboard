import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Mail,
  Settings,
  Database,
  Plug,
  CheckCircle2,
  Moon,
  Sun,
  Info,
  BarChart3,
  Phone,
  MessageCircle,
  FileText,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();

  /* ================= DARK MODE ================= */
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    darkMode ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ================= AUTH ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  /* ================= TOOLTIP ================= */
  const tips = [
    "Invite your sales team",
    "Configure sales pipeline",
    "Connect business email",
    "Import CRM data",
    "Enable integrations",
  ];
  const [activeTip, setActiveTip] = useState(0);

  /* ================= SETUP STEPS ================= */
  const [steps, setSteps] = useState([
    {
      id: 1,
      title: "Invite your team",
      desc: "Collaborate and share updates in one place.",
      icon: <Users />,
      completed: false,
      action: () => navigate("/users"),
    },
    {
      id: 2,
      title: "Configure pipeline",
      desc: "Visualize opportunities using kanban stages.",
      icon: <BarChart3 />,
      completed: false,
      action: () => navigate("/deals"),
    },
    {
      id: 3,
      title: "Connect email",
      desc: "Track emails automatically inside CRM.",
      icon: <Mail />,
      completed: false,
      action: () => navigate("/settings/email"),
    },
    {
      id: 4,
      title: "Import data",
      desc: "Migrate leads, contacts & deals easily.",
      icon: <Database />,
      completed: false,
      action: () => navigate("/settings/import"),
    },
    {
      id: 5,
      title: "Integrations",
      desc: "Email, SMS, Live chat & more.",
      icon: <Plug />,
      completed: false,
      action: () => navigate("/integrations"),
    },
  ]);

  const completed = steps.filter(s => s.completed).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <div className="min-h-screen px-4 py-6 space-y-12 transition-colors bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ReadyTech Solutions CRM</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </div>

      {/* ================= HERO BANNER ================= */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-8 overflow-hidden text-white rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600"
      >
        <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
          Sales teams <br className="sm:hidden" />
          from good to <span className="text-yellow-300">great</span>
        </h2>

        <p className="max-w-xl text-indigo-100">
          ReadyTech CRM is a customer-centric platform to track leads,
          automate follow-ups, forecast revenue and close deals faster.
        </p>

        <div className="flex flex-col gap-4 mt-6 sm:flex-row">
          <button onClick={() => navigate("/contact")} className="px-6 py-3 font-semibold text-indigo-700 bg-white rounded-xl">
            Free forever – Get started
          </button>
          <button
  onClick={() => navigate("/why-readytech")}
  className="px-6 py-3 transition border border-white rounded-xl hover:bg-white hover:text-indigo-700"
>
  See why ReadyTech CRM
</button>

        </div>
      </motion.div>

      {/* ================= TRUST STATS ================= */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: "15M+", label: "Users" },
          { value: "99.9%", label: "Uptime" },
          { value: "24/7", label: "Support" },
          { value: "Secure", label: "Data Protection" },
        ].map((item, i) => (
          <div
            key={i}
            className="p-4 text-center bg-white shadow dark:bg-slate-800 rounded-xl"
          >
            <p className="text-xl font-bold text-indigo-600">{item.value}</p>
            <p className="text-sm text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ================= FEATURES ================= */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          {
            icon: <TrendingUp />,
            title: "Smart Sales Tracking",
            desc: "Pipeline visibility with accurate revenue forecasts.",
          },
          {
            icon: <Zap />,
            title: "Automation",
            desc: "Automate leads, follow-ups & assignments.",
          },
          {
            icon: <ShieldCheck />,
            title: "Secure & Reliable",
            desc: "Enterprise-grade security for your data.",
          },
        ].map((f, i) => (
          <div
            key={i}
            className="p-6 bg-white shadow dark:bg-slate-800 rounded-2xl"
          >
            <div className="mb-3 text-indigo-600">{f.icon}</div>
            <h3 className="mb-1 font-semibold">{f.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ================= SETUP PROGRESS ================= */}
      <div className="p-6 bg-white shadow dark:bg-slate-800 rounded-2xl">
        <div className="flex justify-between mb-2">
          <h3 className="font-semibold">Set up your CRM</h3>
          <span className="text-sm">{completed}/{steps.length}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full transition-all bg-indigo-600 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ================= SETUP CARDS ================= */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            whileHover={{ y: -4 }}
            className="relative p-6 bg-white shadow dark:bg-slate-800 rounded-2xl"
          >
            {activeTip === index && (
              <div className="absolute px-3 py-1 text-sm text-white bg-indigo-600 rounded-lg -top-10 left-4">
                {tips[index]}
              </div>
            )}

            <div className="flex gap-4">
              <div className="mt-1 text-indigo-600">
                {step.completed ? (
                  <CheckCircle2 className="text-green-500" />
                ) : (
                  step.icon
                )}
              </div>

              <div className="flex-1">
                <div className="flex justify-between">
                  <h4 className="font-semibold">{step.title}</h4>
                  <Info
                    size={16}
                    onClick={() => setActiveTip(index)}
                    className="cursor-pointer text-slate-400 hover:text-indigo-600"
                  />
                </div>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {step.desc}
                </p>

                {!step.completed ? (
                  <button
                    onClick={() => {
                      setSteps(prev =>
                        prev.map(s =>
                          s.id === step.id ? { ...s, completed: true } : s
                        )
                      );
                      step.action();
                    }}
                    className="mt-3 font-medium text-indigo-600"
                  >
                    Get started →
                  </button>
                ) : (
                  <span className="inline-block mt-2 text-sm text-green-500">
                    Completed ✔
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ================= FINAL CTA ================= */}
      <div className="p-8 text-center text-white bg-indigo-600 rounded-3xl">
        <h3 className="mb-2 text-2xl font-bold">
          Unleash your growth potential
        </h3>
        <p>No credit card required • Instant access</p>
      </div>
    </div>
  );
}
