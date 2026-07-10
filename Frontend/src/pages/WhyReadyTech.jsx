import { useEffect, useState } from "react";
import {
  ShieldCheck,
  TrendingUp,
  Zap,
  Users,
  Cloud,
  Lock,
  CheckCircle2,
  BarChart3,
  Layers,
  Sun,
  Moon,
} from "lucide-react";

export default function WhyReadyTech() {
  /* ============ DARK MODE ============ */
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    darkMode ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="min-h-screen transition-colors bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold">ReadyTech Solutions</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </header>

      {/* ================= HERO ================= */}
      <section className="px-6 py-16 text-white bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="max-w-5xl mx-auto">
          <h2 className="mb-4 text-4xl font-bold">
            Why ReadyTech Solutions?
          </h2>
          <p className="max-w-2xl text-lg text-indigo-100">
            We build smart, scalable and customer-centric digital solutions
            that help businesses grow faster, sell smarter and operate better.
          </p>

          <div className="flex flex-col gap-4 mt-6 sm:flex-row">
            <button className="px-6 py-3 font-semibold text-indigo-700 bg-white rounded-xl">
              Get Started – Free
            </button>
            <button className="px-6 py-3 border border-white rounded-xl">
              Request a Demo
            </button>
          </div>
        </div>
      </section>

      {/* ================= PROBLEM / SOLUTION ================= */}
      <section className="max-w-6xl px-6 py-16 mx-auto">
        <h3 className="mb-10 text-2xl font-bold text-center">
          Businesses struggle. We simplify.
        </h3>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div className="p-6 bg-white shadow dark:bg-slate-800 rounded-2xl">
            <h4 className="mb-4 font-semibold">Common Problems</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-300">
              <li>❌ Scattered customer data</li>
              <li>❌ Manual sales follow-ups</li>
              <li>❌ Poor pipeline visibility</li>
              <li>❌ Low team productivity</li>
              <li>❌ No actionable insights</li>
            </ul>
          </div>

          <div className="p-6 bg-white shadow dark:bg-slate-800 rounded-2xl">
            <h4 className="mb-4 font-semibold">ReadyTech Solutions</h4>
            <ul className="space-y-3 text-slate-600 dark:text-slate-300">
              <li>✅ Centralized CRM platform</li>
              <li>✅ Automated workflows</li>
              <li>✅ Visual sales pipeline</li>
              <li>✅ Team collaboration tools</li>
              <li>✅ Real-time analytics</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= CORE FEATURES ================= */}
      <section className="px-6 py-16 bg-slate-100 dark:bg-slate-800">
        <div className="max-w-6xl mx-auto">
          <h3 className="mb-12 text-2xl font-bold text-center">
            What makes ReadyTech different?
          </h3>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: <Users />,
                title: "Customer-centric CRM",
                desc: "Every feature is built around customer experience.",
              },
              {
                icon: <Zap />,
                title: "Automation-first",
                desc: "Automate leads, tasks, follow-ups and assignments.",
              },
              {
                icon: <BarChart3 />,
                title: "Actionable Analytics",
                desc: "Forecast revenue and track performance in real time.",
              },
              {
                icon: <Cloud />,
                title: "Cloud-based",
                desc: "Access your business anywhere, anytime.",
              },
              {
                icon: <Lock />,
                title: "Secure by design",
                desc: "Enterprise-grade security & data protection.",
              },
              {
                icon: <Layers />,
                title: "Scalable architecture",
                desc: "Grow from startup to enterprise without switching tools.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-6 bg-white shadow dark:bg-slate-900 rounded-2xl"
              >
                <div className="mb-3 text-indigo-600">{f.icon}</div>
                <h4 className="mb-2 font-semibold">{f.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= INDUSTRIES ================= */}
      <section className="max-w-6xl px-6 py-16 mx-auto">
        <h3 className="mb-10 text-2xl font-bold text-center">
          Industries we empower
        </h3>

        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            "IT & SaaS",
            "Real Estate",
            "Education",
            "Healthcare",
            "Retail",
            "Manufacturing",
            "Finance",
            "Startups",
          ].map((industry, i) => (
            <div
              key={i}
              className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl"
            >
              {industry}
            </div>
          ))}
        </div>
      </section>

      {/* ================= WHY CHOOSE US ================= */}
      <section className="px-6 py-16 text-white bg-indigo-600">
        <div className="max-w-5xl mx-auto">
          <h3 className="mb-8 text-2xl font-bold text-center">
            Why businesses choose ReadyTech
          </h3>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              "Free forever CRM with unlimited users",
              "Modern UI inspired by Zoho & Odoo",
              "Faster deployment & easy onboarding",
              "Customizable for any business",
              "Local support & global standards",
              "Future-ready AI integrations",
            ].map((point, i) => (
              <div key={i} className="flex gap-3">
                <CheckCircle2 className="text-green-300" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="px-6 py-16 text-center">
        <h3 className="mb-3 text-3xl font-bold">
          Ready to grow with ReadyTech?
        </h3>
        <p className="mb-6 text-slate-500 dark:text-slate-400">
          No credit card required • Instant access • Scales as you grow
        </p>
        <button className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-xl">
          Start using ReadyTech CRM
        </button>
      </section>
    </div>
  );
}
