// src/pages/Automation/AutomationTemplates.jsx

import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  FileText,
  Filter,
  Mail,
  MoreHorizontal,
  Package,
  Play,
  Plus,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* =========================================================
   TEMPLATE DATA
========================================================= */

const TEMPLATE_CATEGORIES = [
  "All",
  "Leads",
  "Sales",
  "Clients",
  "Tasks",
  "Invoices",
  "Inventory",
  "ERP",
];

const AUTOMATION_TEMPLATES = [
  {
    id: "lead-follow-up",
    name: "New Lead Follow-up",
    description:
      "Automatically assign a new lead, send a welcome email, and create a follow-up task.",
    category: "Leads",
    module: "Leads",
    icon: Users,
    iconStyle: "bg-indigo-50 text-indigo-600",
    popular: true,
    premium: false,
    steps: 3,
    trigger: "Lead Created",
    actions: ["Assign Lead", "Send Email", "Create Task"],
    timeSaved: "2 hrs/week",
  },

  {
    id: "lead-score",
    name: "Lead Score & Assignment",
    description:
      "Score incoming leads based on source and automatically assign qualified leads to sales.",
    category: "Leads",
    module: "Leads",
    icon: Target,
    iconStyle: "bg-violet-50 text-violet-600",
    popular: true,
    premium: true,
    steps: 4,
    trigger: "Lead Created",
    actions: ["Check Condition", "Update Score", "Assign Owner"],
    timeSaved: "3 hrs/week",
  },

  {
    id: "deal-won",
    name: "Deal Won → Client",
    description:
      "Convert a successful opportunity into a client and automatically create onboarding tasks.",
    category: "Sales",
    module: "Opportunities",
    icon: TrendingUp,
    iconStyle: "bg-emerald-50 text-emerald-600",
    popular: true,
    premium: false,
    steps: 4,
    trigger: "Opportunity Won",
    actions: ["Create Client", "Create Task", "Send Email"],
    timeSaved: "4 hrs/week",
  },

  {
    id: "client-welcome",
    name: "New Client Welcome",
    description:
      "Send a professional welcome email and create an onboarding checklist for every new client.",
    category: "Clients",
    module: "Clients",
    icon: Users,
    iconStyle: "bg-sky-50 text-sky-600",
    popular: false,
    premium: false,
    steps: 3,
    trigger: "Client Created",
    actions: ["Send Email", "Create Task", "Notify Team"],
    timeSaved: "1.5 hrs/week",
  },

  {
    id: "invoice-overdue",
    name: "Invoice Overdue Reminder",
    description:
      "Automatically remind customers when an invoice becomes overdue and notify the finance team.",
    category: "Invoices",
    module: "Invoices",
    icon: FileText,
    iconStyle: "bg-rose-50 text-rose-600",
    popular: true,
    premium: false,
    steps: 3,
    trigger: "Invoice Overdue",
    actions: ["Check Due Date", "Send Email", "Notify Finance"],
    timeSaved: "2.5 hrs/week",
  },

  {
    id: "invoice-created",
    name: "Invoice Created Notification",
    description:
      "Send the invoice to the customer automatically as soon as an invoice is created.",
    category: "Invoices",
    module: "Invoices",
    icon: FileText,
    iconStyle: "bg-orange-50 text-orange-600",
    popular: false,
    premium: false,
    steps: 2,
    trigger: "Invoice Created",
    actions: ["Send Email", "Create Activity"],
    timeSaved: "1 hr/week",
  },

  {
    id: "low-stock",
    name: "Low Stock Alert",
    description:
      "Monitor product stock levels and alert your inventory team when stock falls below the threshold.",
    category: "Inventory",
    module: "Products",
    icon: Package,
    iconStyle: "bg-amber-50 text-amber-600",
    popular: true,
    premium: true,
    steps: 3,
    trigger: "Stock Level Changed",
    actions: ["Check Stock", "Send Alert", "Create Task"],
    timeSaved: "3 hrs/week",
  },

  {
    id: "purchase-reorder",
    name: "Automatic Reorder Alert",
    description:
      "Create a purchase task when product availability reaches the configured reorder level.",
    category: "ERP",
    module: "Inventory",
    icon: ShoppingCart,
    iconStyle: "bg-cyan-50 text-cyan-600",
    popular: false,
    premium: true,
    steps: 4,
    trigger: "Stock Below Reorder Level",
    actions: ["Check Stock", "Find Vendor", "Create Purchase Task"],
    timeSaved: "5 hrs/week",
  },

  {
    id: "task-due",
    name: "Task Due Reminder",
    description:
      "Notify employees automatically when an assigned task is approaching its due date.",
    category: "Tasks",
    module: "Tasks",
    icon: Clock3,
    iconStyle: "bg-purple-50 text-purple-600",
    popular: false,
    premium: false,
    steps: 2,
    trigger: "Task Due Soon",
    actions: ["Check Due Date", "Send Notification"],
    timeSaved: "1 hr/week",
  },

  {
    id: "sales-order",
    name: "Sales Order Processing",
    description:
      "Automate order confirmation, stock reservation, and internal notifications after an order is created.",
    category: "ERP",
    module: "Sales Orders",
    icon: ShoppingCart,
    iconStyle: "bg-green-50 text-green-600",
    popular: false,
    premium: true,
    steps: 5,
    trigger: "Sales Order Created",
    actions: [
      "Reserve Stock",
      "Send Confirmation",
      "Notify Warehouse",
    ],
    timeSaved: "6 hrs/week",
  },
];

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function Badge({ children, type = "default" }) {
  const styles = {
    default: "bg-slate-100 text-slate-600",
    premium: "bg-violet-50 text-violet-700 border border-violet-100",
    popular: "bg-amber-50 text-amber-700 border border-amber-100",
    module: "bg-indigo-50 text-indigo-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[type]}`}
    >
      {type === "premium" && <Sparkles size={11} />}
      {type === "popular" && <TrendingUp size={11} />}
      {children}
    </span>
  );
}

function TemplateIcon({ template, size = 22 }) {
  const Icon = template.icon;

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${template.iconStyle}`}
    >
      <Icon size={size} strokeWidth={1.8} />
    </div>
  );
}

/* =========================================================
   TEMPLATE CARD
========================================================= */

function TemplateCard({ template, onUse }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-200/60">
      {/* Top Accent */}
      <div className="w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-500 opacity-80" />

      <div className="flex flex-col flex-1 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <TemplateIcon template={template} />

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center justify-center w-8 h-8 transition rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Template options"
            >
              <MoreHorizontal size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 w-40 p-1 overflow-hidden bg-white border shadow-xl top-9 rounded-xl border-slate-200">
                <button
                  type="button"
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium text-left rounded-lg text-slate-600 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Copy size={14} />
                  Duplicate
                </button>

                <button
                  type="button"
                  className="flex items-center w-full gap-2 px-3 py-2 text-xs font-medium text-left rounded-lg text-slate-600 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <Edit3 size={14} />
                  Preview
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge type="module">{template.module}</Badge>

          {template.popular && <Badge type="popular">Popular</Badge>}

          {template.premium && <Badge type="premium">Premium</Badge>}
        </div>

        {/* Content */}
        <div className="mt-4">
          <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
            {template.name}
          </h3>

          <p className="mt-2 text-sm leading-6 line-clamp-3 text-slate-500">
            {template.description}
          </p>
        </div>

        {/* Workflow Preview */}
        <div className="p-3 mt-5 border rounded-xl border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center text-indigo-600 bg-white rounded-lg shadow-sm h-7 w-7">
              <Zap size={14} />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Trigger
              </p>
              <p className="text-xs font-semibold truncate text-slate-700">
                {template.trigger}
              </p>
            </div>
          </div>

          <div className="h-3 my-2 ml-3 border-l border-dashed border-slate-300" />

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center bg-white rounded-lg shadow-sm h-7 w-7 text-violet-600">
              <Settings2 size={14} />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Actions
              </p>

              <p className="text-xs font-semibold truncate text-slate-700">
                {template.actions.join(" • ")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-5 mt-auto">
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Settings2 size={13} />
                {template.steps} steps
              </span>

              <span className="w-1 h-1 rounded-full bg-slate-300" />

              <span className="flex items-center gap-1.5">
                <Clock3 size={13} />
                Save {template.timeSaved}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onUse(template)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 active:scale-[0.99]"
          >
            Use Template
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function AutomationTemplates() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return AUTOMATION_TEMPLATES.filter((template) => {
      const matchesCategory =
        category === "All" || template.category === category;

      const matchesPremium =
        !showPremiumOnly || template.premium === true;

      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.module.toLowerCase().includes(query) ||
        template.trigger.toLowerCase().includes(query);

      return matchesCategory && matchesPremium && matchesSearch;
    });
  }, [search, category, showPremiumOnly]);

  const handleUseTemplate = (template) => {
    /*
      Pass template data to AutomationBuilder.

      AutomationBuilder can read:
      location.state.template

      Example:
      {
        name,
        trigger,
        conditions,
        actions
      }
    */

    navigate("/automations/new", {
      state: {
        template,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/70">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-[1600px] px-5 py-6 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-5 text-xs font-medium text-slate-400">
            <button
              type="button"
              onClick={() => navigate("/automations")}
              className="transition hover:text-indigo-600"
            >
              Automations
            </button>

            <ChevronRight size={13} />

            <span className="text-slate-600">Templates</span>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                <Sparkles size={13} />
                Automation Templates
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Automate your workflow faster
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
                Start with a ready-made CRM or ERP workflow and customize it
                for your business in minutes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/automations/new")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
            >
              <Plus size={17} />
              Create From Scratch
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          MAIN
      ===================================================== */}
      <main className="mx-auto max-w-[1600px] px-5 py-6 sm:px-6 lg:px-8">
        {/* ===================================================
            FEATURED BANNER
        =================================================== */}
        <section className="relative p-6 overflow-hidden text-white border border-indigo-100 shadow-xl mb-7 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 shadow-indigo-100 sm:p-7">
          <div className="absolute w-64 h-64 rounded-full pointer-events-none -right-20 -top-20 bg-white/10 blur-3xl" />
          <div className="absolute w-56 h-56 rounded-full pointer-events-none -bottom-24 left-1/3 bg-sky-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3 text-indigo-100">
                <Bot size={19} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                  Smart Automation
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Build once. Let your CRM & ERP work automatically.
              </h2>

              <p className="max-w-xl mt-2 text-sm leading-6 text-indigo-100">
                Connect triggers, conditions and actions to remove repetitive
                work from your sales, finance and inventory processes.
              </p>

              <div className="flex flex-wrap gap-3 mt-5 text-xs font-medium text-indigo-50">
                <span className="flex items-center gap-1.5">
                  <Check size={14} />
                  No-code workflows
                </span>

                <span className="flex items-center gap-1.5">
                  <Check size={14} />
                  CRM + ERP actions
                </span>

                <span className="flex items-center gap-1.5">
                  <Check size={14} />
                  Real-time execution
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 lg:block">
              <div className="relative w-[280px] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <div className="p-3 bg-white shadow-xl rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center text-indigo-600 rounded-lg h-9 w-9 bg-indigo-50">
                      <Zap size={17} />
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        When
                      </p>
                      <p className="text-xs font-bold text-slate-800">
                        New Lead Created
                      </p>
                    </div>
                  </div>

                  <div className="h-4 my-2 ml-4 border-l border-dashed border-slate-300" />

                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-lg h-9 w-9 bg-emerald-50 text-emerald-600">
                      <Mail size={17} />
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Then
                      </p>
                      <p className="text-xs font-bold text-slate-800">
                        Send Welcome Email
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            SEARCH + FILTER
        =================================================== */}
        <section className="mb-6">
          <div className="flex flex-col gap-4 p-4 bg-white border shadow-sm rounded-2xl border-slate-200 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative w-full lg:max-w-md">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search automation templates..."
                className="w-full pl-10 pr-4 text-sm transition border outline-none h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />
            </div>

            {/* Premium Filter */}
            <button
              type="button"
              onClick={() => setShowPremiumOnly((value) => !value)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                showPremiumOnly
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Sparkles size={15} />
              Premium
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 pb-1 mt-4 overflow-x-auto">
            <Filter size={15} className="mr-1 shrink-0 text-slate-400" />

            {TEMPLATE_CATEGORIES.map((item) => {
              const active = category === item;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </section>

        {/* ===================================================
            RESULT HEADER
        =================================================== */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Workflow templates
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredTemplates.length} templates available
            </p>
          </div>

          {(search || category !== "All" || showPremiumOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setShowPremiumOnly(false);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ===================================================
            TEMPLATE GRID
        =================================================== */}
        {filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100 text-slate-400">
              <Search size={24} />
            </div>

            <h3 className="mt-4 text-base font-bold text-slate-800">
              No templates found
            </h3>

            <p className="max-w-md mt-1 text-sm leading-6 text-slate-500">
              Try another search term or remove one of the active filters.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setShowPremiumOnly(false);
              }}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-600"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* ===================================================
            FOOTER CTA
        =================================================== */}
        <section className="mt-8 overflow-hidden bg-white border rounded-2xl border-slate-200">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center text-white h-11 w-11 shrink-0 rounded-xl bg-slate-900">
                <Settings2 size={19} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Need a custom workflow?
                </h3>

                <p className="max-w-xl mt-1 text-sm leading-6 text-slate-500">
                  Build your own automation with custom triggers, conditions,
                  delays and CRM/ERP actions.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/automations/new")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Plus size={16} />
              Build Custom Automation
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}