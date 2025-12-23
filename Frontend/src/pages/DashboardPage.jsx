import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  TrendingUp,
  Users,
  Target,
  Zap,
  Activity,
  Calendar,
  ArrowUpRight,
  Layers,
} from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();

  /* ================= THEME ================= */
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

  return (
    <div className="min-h-screen px-4 py-6 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-white">

      {/* ================= TOP BAR ================= */}
      <div className="flex items-center justify-between mx-auto mb-6 max-w-7xl">
        <h1 className="text-xl font-bold tracking-wide">
          ReadyTech <span className="text-indigo-500">CRM</span>
        </h1>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 transition rounded-xl bg-white/60 dark:bg-slate-800 backdrop-blur hover:scale-105"
        >
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </div>

      {/* ================= HERO FLOATING BANNER ================= */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-w-7xl mx-auto overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_60%)]" />

        <div className="relative grid items-center gap-10 px-10 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold leading-tight">
              Build smarter <br />
              sell faster 🚀
            </h2>

            <p className="max-w-md mt-4 text-indigo-100">
              All-in-one CRM to track leads, automate workflows,
              analyze performance and scale your business.
            </p>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => navigate("/contact")}
                className="px-6 py-3 font-semibold text-indigo-700 transition bg-white rounded-xl hover:scale-105"
              >
                Get Started Free
              </button>

              <button
                onClick={() => navigate("/why-readytech")}
                className="px-6 py-3 transition border border-white rounded-xl hover:bg-white hover:text-indigo-700"
              >
                Why ReadyTech?
              </button>
            </div>
          </div>

          {/* Floating Illustration */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="hidden md:block"
          >
            <img
              src="https://illustrations.popsy.co/white/business-analytics.svg"
              alt="CRM Illustration"
              className="w-full drop-shadow-2xl"
            />
          </motion.div>
        </div>
      </motion.div>

      {/* ================= FLOATING STATS ================= */}
      <div className="grid grid-cols-2 gap-6 mx-auto mt-12 max-w-7xl sm:grid-cols-4">
        {[
          { icon: <Users />, label: "Active Users", value: "12,480" },
          { icon: <TrendingUp />, label: "Monthly Growth", value: "+38%" },
          { icon: <Target />, label: "Deals Closed", value: "2,940" },
          { icon: <Zap />, label: "Automation Rate", value: "91%" },
        ].map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -6 }}
            className="p-6 shadow-lg bg-white/70 dark:bg-slate-800/60 backdrop-blur rounded-2xl"
          >
            <div className="mb-3 text-indigo-500">{item.icon}</div>
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ================= INSIGHTS SECTION ================= */}
      <div className="grid grid-cols-1 gap-6 mx-auto max-w-7xl mt-14 md:grid-cols-3">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-6 shadow bg-white/70 dark:bg-slate-800/60 backdrop-blur rounded-2xl"
        >
          <Activity className="mb-3 text-indigo-500" />
          <h3 className="font-semibold">Live Activity</h3>
          <p className="mt-2 text-sm text-slate-500">
            Track calls, emails, meetings and tasks in real time.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-6 shadow bg-white/70 dark:bg-slate-800/60 backdrop-blur rounded-2xl"
        >
          <Calendar className="mb-3 text-indigo-500" />
          <h3 className="font-semibold">Smart Scheduling</h3>
          <p className="mt-2 text-sm text-slate-500">
            Auto reminders and calendar sync for your sales team.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-6 shadow bg-white/70 dark:bg-slate-800/60 backdrop-blur rounded-2xl"
        >
          <Layers className="mb-3 text-indigo-500" />
          <h3 className="font-semibold">Unified Workspace</h3>
          <p className="mt-2 text-sm text-slate-500">
            Deals, contacts, pipelines & analytics in one place.
          </p>
        </motion.div>
      </div>

      {/* ================= FINAL CTA ================= */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="max-w-7xl p-10 mx-auto mt-16 text-center text-white bg-indigo-600 rounded-[2rem]"
      >
        <h3 className="text-3xl font-bold">
          Scale your business with confidence
        </h3>
        <p className="mt-2 text-indigo-100">
          No credit card • Free forever plan • Enterprise ready
        </p>

        <button
          onClick={() => navigate("/contact")}
          className="inline-flex items-center gap-2 px-8 py-4 mt-6 font-semibold text-indigo-700 transition bg-white rounded-xl hover:scale-105"
        >
          Start Now <ArrowUpRight />
        </button>
      </motion.div>
    </div>
  );
}
