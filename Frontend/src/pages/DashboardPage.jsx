import { useEffect, useState } from "react";
import {
  Users,
  Layers,
  Globe,
  Brain,
  TrendingUp,
  Target,
  ShieldCheck,
  BarChart3,
  Star,
  UserCog,
} from "lucide-react";

export default function DashboardPage() {
  const [role, setRole] = useState("Admin");
  const [testimonial, setTestimonial] = useState(0);

  const testimonials = [
    "Ready Tech Solutions transformed our business digitally with excellent support.",
    "Professional team, on-time delivery & scalable solutions. Highly recommended.",
    "Their AI & CRM solutions helped us improve productivity & ROI significantly.",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f8fafc] to-[#ecfeff] p-4 md:p-6">
      {/* BACKGROUND DECOR */}
      <div className="absolute rounded-full -top-32 -left-32 w-96 h-96 bg-blue-300/30 blur-3xl" />
      <div className="absolute rounded-full top-1/3 -right-32 w-96 h-96 bg-cyan-300/30 blur-3xl" />

      {/* CONTENT */}
      <div className="relative z-10">
        {/* HEADER */}
        <div className="flex flex-col gap-3 mb-6 md:flex-row md:justify-between md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Ready Tech Solutions CRM
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Smart IT • AI • Business Growth Platform
            </p>
          </div>

          {/* ROLE SWITCH */}
          <div className="flex items-center gap-2 px-3 py-2 text-sm shadow bg-white/80 backdrop-blur rounded-xl">
            <UserCog className="text-blue-600" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="font-medium bg-transparent outline-none"
            >
              <option>Admin</option>
              <option>Sales</option>
            </select>
          </div>
        </div>

        {/* TOP METRICS */}
        <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
          <Metric icon={<Users />} label="Clients" value="150+" />
          <Metric icon={<Layers />} label="Projects" value="300+" />
          <Metric icon={<ShieldCheck />} label="Success Rate" value="95%" />
          <Metric icon={<Globe />} label="Industries" value="10+" />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LIVE PROJECT SUCCESS */}
          <Card>
            <Title icon={<TrendingUp />}>Live Project Success</Title>
            <Progress label="On-Time Delivery" value={92} />
            <Progress label="Client Satisfaction" value={95} />
            <Progress label="System Stability" value={98} />
          </Card>

          {/* LEAD FUNNEL */}
          <Card>
            <Title icon={<Target />}>Lead Funnel</Title>
            <Funnel stage="Leads" value="320" />
            <Funnel stage="Qualified" value="180" />
            <Funnel stage="Proposals" value="95" />
            <Funnel stage="Converted" value="60" />
          </Card>

          {/* ROI */}
          <Card>
            <Title icon={<BarChart3 />}>ROI & Growth</Title>
            <div className="mt-4 text-center">
              <div className="text-4xl font-bold text-green-600">+42%</div>
              <p className="mt-1 text-xs text-gray-500">
                Average ROI in first 6 months
              </p>
            </div>
          </Card>

          {/* AI CHATBOT */}
          <Card className="lg:col-span-2">
            <Title icon={<Brain />}>AI Chatbot Demo</Title>
            <div className="p-4 text-sm border bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl">
              <p className="mb-2">
                🤖 <strong>AI Bot:</strong> Hello! How can I help your business grow?
              </p>
              <ul className="ml-4 space-y-1 text-gray-600 list-disc">
                <li>CRM Automation</li>
                <li>AI Chatbots</li>
                <li>Custom Software</li>
                <li>Digital Marketing</li>
              </ul>
            </div>
          </Card>

          {/* TESTIMONIAL */}
          <Card>
            <Title icon={<Star />}>Client Testimonials</Title>
            <p className="text-sm italic text-gray-700 transition-all">
              “{testimonials[testimonial]}”
            </p>
            <p className="mt-3 text-xs text-gray-500">
              ⭐⭐⭐⭐⭐ Verified Client
            </p>
          </Card>

          {/* ROLE BASED */}
          <Card className="lg:col-span-3">
            <Title icon={<UserCog />}>{role} Dashboard View</Title>
            {role === "Admin" ? (
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <Badge text="System Analytics" />
                <Badge text="User Management" />
                <Badge text="Revenue Tracking" />
                <Badge text="AI Optimization" />
              </div>
            ) : (
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <Badge text="Lead Tracking" />
                <Badge text="Deal Conversion" />
                <Badge text="Client Follow-ups" />
                <Badge text="Sales Insights" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow hover:shadow-lg transition ${className}`}
    >
      {children}
    </div>
  );
}

function Title({ icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-800">
      <span className="text-blue-600">{icon}</span>
      {children}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="flex items-center gap-4 p-4 transition shadow bg-white/90 backdrop-blur rounded-2xl hover:shadow-md">
      <div className="p-3 text-blue-600 bg-blue-100 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function Progress({ label, value }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1 text-xs">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden bg-gray-200 rounded-full">
        <div
          className="h-2 bg-gradient-to-r from-green-400 to-green-600"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Funnel({ stage, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span>{stage}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Badge({ text }) {
  return (
    <div className="px-3 py-2 font-medium text-center bg-slate-100 rounded-xl">
      {text}
    </div>
  );
}
