import React, { useEffect, useMemo, useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  User,
  FileText,
  Activity,
  X,
} from "lucide-react";

/* =========================================================
   ENTERPRISE CRM – CLIENTS MODULE (ZOHO-STYLE)
   Features:
   - Client list with search
   - Create / Edit / Delete
   - Client profile drawer
   - Notes & activity timeline (basic)
   - CMS, Benefits, Stats, Features, FAQ
   - Responsive + production-ready
========================================================= */

/* ================= FAQ Data ================= */
const faqData = [
  {
    question: "What is client management software?",
    answer:
      "Client management software helps you attract, nurture and build long-term client relationships that are mutually profitable. Your business is empowered with centralized client information, omnichannel communication, robust activity management and automation to help you understand and address your client needs effectively.",
  },
  {
    question: "Does ReadyTech Solutions provide a free client management app?",
    answer:
      "Yes! ReadyTech Solutions offers a free version of our client management software with essential features to get started, perfect for small businesses or teams testing the waters.",
  },
  {
    question: "How do I evaluate top client management software?",
    answer:
      "Focus on features such as contact management, automation, pipeline tracking, reporting, integrations, scalability and ease of use. Choose software that fits your team's workflow and growth plans.",
  },
  {
    question:
      "Why is it important to choose the best client relationship management software?",
    answer:
      "Choosing the right CRM ensures streamlined processes, happier clients, better sales conversion and a single source of truth for all your client data, reducing errors and inefficiencies.",
  },
  {
    question: "How is client management software used?",
    answer:
      "It is used to track interactions, manage contacts, organize tasks, automate workflows, generate reports and provide actionable insights for improving customer relationships and sales processes.",
  },
  {
    question: "What is the best client management tool for small businesses?",
    answer:
      "For small businesses, a simple, intuitive and affordable solution like ReadyTech Solutions' client management software provides essential features without unnecessary complexity.",
  },
  {
    question:
      "What are the critical capabilities to look out for in a client management software?",
    answer:
      "Key capabilities include contact & activity management, sales pipeline tracking, reporting & analytics, integrations, automation, mobile access and scalability for future growth.",
  },
];

/* ================= FAQ Item Component ================= */
const FAQItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border shadow-sm rounded-2xl">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between w-full px-6 py-4 text-lg font-medium text-left text-slate-800 focus:outline-none"
      >
        <span>{question}</span>
        <span className="text-xl font-bold text-indigo-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-6 py-4 border-t text-slate-600 bg-indigo-50 rounded-b-2xl">
          {answer}
        </div>
      )}
    </div>
  );
};

/* ================= Reusable Components ================= */
const StatCard = ({ value, label }) => (
  <div className="p-6 text-center text-white transition bg-indigo-700 shadow rounded-2xl hover:shadow-lg">
    <p className="text-2xl font-bold">{value}</p>
    <p className="mt-1 text-xs text-indigo-200">{label}</p>
  </div>
);

const BenefitCard = ({ title, content }) => (
  <div className="p-6 transition bg-white border shadow rounded-2xl hover:shadow-lg">
    <h4 className="mb-2 text-lg font-semibold text-indigo-600">{title}</h4>
    <p className="text-sm text-slate-600">{content}</p>
  </div>
);

const CMSBlock = ({ title, content, colSpan }) => (
  <div className={`space-y-4 ${colSpan === 2 ? "md:col-span-2" : ""}`}>
    <h3 className="text-xl font-semibold text-indigo-600">{title}</h3>
    <p className="text-slate-600">{content}</p>
  </div>
);

/* ================= Main Clients Component ================= */
export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeClient, setActiveClient] = useState(null);

  const emptyForm = {
    name: "",
    company: "",
    email: "",
    phone: "",
    status: "Active",
    source: "Website",
    address: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  /* ================= Fetch Clients ================= */
  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/clients");
      setClients(data);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  /* ================= Create / Update Client ================= */
  const saveClient = async (e) => {
    e.preventDefault();
    try {
      if (form._id) {
        await API.put(`/clients/${form._id}`, form);
        toast.success("Client updated");
      } else {
        await API.post("/clients", form);
        toast.success("Client created");
      }
      setDrawerOpen(false);
      setForm(emptyForm);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    }
  };

  /* ================= Delete Client ================= */
  const removeClient = async (id) => {
    if (!confirm("Delete this client permanently?")) return;
    try {
      await API.delete(`/clients/${id}`);
      toast.success("Client removed");
      fetchClients();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ================= Filtered Clients ================= */
  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  return (
    <div className="space-y-6">

      {/* ================= Header ================= */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500">Manage customers, communications & activities</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchClients} className="flex items-center gap-2 px-4 py-2 text-sm border rounded-xl">
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => { setForm(emptyForm); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-xl bg-slate-900"
          >
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      {/* ================= Search ================= */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company or email"
          className="w-full py-2 pl-10 pr-3 text-sm border rounded-xl"
        />
      </div>

      {/* ================= Client Table ================= */}
      <div className="overflow-x-auto bg-white border shadow-sm rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">Loading...</td>
              </tr>
            )}
            {!loading && filteredClients.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">No clients found</td>
              </tr>
            )}
            {filteredClients.map((c) => (
              <tr key={c._id} className="border-t hover:bg-slate-50">
                <td
                  className="px-4 py-3 cursor-pointer"
                  onClick={() => { setActiveClient(c); setProfileOpen(true); }}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td className="px-4 py-3">{c.company || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-1 text-xs ${c.status === "Active" ? "bg-green-100 text-green-700" : "bg-slate-100"}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">{c.source}</td>
                <td className="px-4 py-3 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="flex gap-2 px-4 py-3">
                  <button onClick={() => { setForm(c); setDrawerOpen(true); }}><Pencil size={16} /></button>
                  <button onClick={() => removeClient(c._id)}><Trash2 size={16} className="text-red-600" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= Drawer (Create/Edit) ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form onSubmit={saveClient} className="w-full max-w-md p-6 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{form._id ? "Edit Client" : "New Client"}</h2>
              <X onClick={() => setDrawerOpen(false)} className="cursor-pointer" />
            </div>
            {Object.keys(emptyForm).map((key) =>
              key !== "notes" ? (
                <input
                  key={key}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              ) : (
                <textarea
                  key={key}
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              )
            )}
            <button className="w-full py-2 text-white rounded bg-slate-900">Save Client</button>
          </form>
        </div>
      )}

      {/* ================= Client Profile ================= */}
      {profileOpen && activeClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-lg p-6 space-y-4 bg-white">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">{activeClient.name}</h2>
              <X onClick={() => setProfileOpen(false)} className="cursor-pointer" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><User size={14}/> {activeClient.email}</div>
              <div>{activeClient.phone}</div>
              <div>{activeClient.company}</div>
              <div>{activeClient.status}</div>
            </div>
            <div className="pt-3 border-t">
              <h3 className="flex items-center gap-2 mb-2 font-medium"><FileText size={16}/> Notes</h3>
              <p className="text-sm text-slate-600">{activeClient.notes || "No notes"}</p>
            </div>
            <div className="pt-3 border-t">
              <h3 className="flex items-center gap-2 mb-2 font-medium"><Activity size={16}/> Activity</h3>
              <p className="text-xs text-slate-500">Activity timeline integration ready</p>
            </div>
          </div>
        </div>
      )}

      {/* ================= CMS / Benefits / Stats / Features / FAQ ================= */}
      {/* Landing / Intro */}
      <div className="relative py-20 bg-gradient-to-b from-indigo-50 to-white">
  {/* Decorative circles */}
  <div className="absolute w-40 h-40 bg-indigo-200 rounded-full -top-10 -left-10 opacity-30 mix-blend-multiply filter blur-3xl"></div>
  <div className="absolute bg-indigo-300 rounded-full -bottom-10 -right-10 w-60 h-60 opacity-20 mix-blend-multiply filter blur-3xl"></div>

  <div className="relative max-w-4xl px-6 mx-auto space-y-6 text-center">
    <h1 className="text-5xl font-extrabold leading-tight text-slate-900 md:text-4xl">
      Transform Your Client Relationships
    </h1>
    <p className="text-lg text-slate-700 md:text-xl">
      ReadyTech Solutions Client Management Software empowers businesses of all sizes to centralize client data, track interactions and streamline workflows seamlessly.
    </p>
    <p className="text-lg text-slate-700 md:text-xl">
      Gain actionable insights, automate processes and elevate your customer experience to drive retention, growth and revenue.
    </p>

    {/* CTA Buttons */}
    <div className="flex flex-col gap-4 mt-6 md:flex-row md:justify-center">
      <button className="px-6 py-3 text-white transition bg-indigo-700 shadow-lg rounded-xl hover:bg-indigo-800">
        Get Started Free
      </button>
      <button className="px-6 py-3 text-indigo-700 transition border border-indigo-700 rounded-xl hover:bg-indigo-50">
        Learn More
      </button>
    </div>
  </div>
</div>


      {/* CMS Section */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl px-6 mx-auto space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Why do you need a Client Management System?</h2>
            <p className="text-lg text-slate-600">
              In today's competitive market, keeping your customers happy is more important than ever.
              Acquiring new customers is far more expensive than retaining existing ones.
            </p>
          </div>
          <div className="grid gap-10 md:grid-cols-2">
            <CMSBlock title="Understand & Delight Your Customers" content="A client management system (CMS) helps you track and manage your interactions with clients, from the first touchpoint to the last support ticket, ensuring every experience is exceptional." />
            <CMSBlock title="Centralized Customer Data" content="Consolidate all customer information, interactions and transactions in one place, giving your team quick access to history and insights for informed decision-making." />
            <CMSBlock title="Automation & Efficiency" content="Automate customer engagement and sales processes to ensure timely follow-ups, reduce manual errors and free your team to focus on closing deals." />
            <CMSBlock title="Data-Driven Insights" content="Slice and dice through your customer data to generate accurate forecasts, identify trends and gain actionable insights to improve client relationships." />
            <CMSBlock title="Personalized Engagements" content="When your data is scattered across multiple apps, building a good rapport with clients is tough. With a CMS, you get a complete view of every client, allowing you to personalize interactions, optimize your business processes and ultimately drive more sales and revenue." colSpan={2} />
          </div>
        </div>
      </section>

      {/* Benefits / Stats / Features */}
      <section className="py-20 bg-gray-50">
        <div className="px-6 mx-auto space-y-16 max-w-7xl">
          <div className="space-y-4 text-center">
            <h2 className="text-4xl font-bold text-slate-900">What Features Should Businesses Look for in a Client Management Software?</h2>
            <p className="max-w-2xl mx-auto text-lg text-slate-600">Whether you're a small business or a large enterprise, understanding the key features of a client management system is essential to optimize your workflow, improve client satisfaction and increase revenue.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <BenefitCard title="Win More Sales" content="Your whole team accesses the same information, ensuring a seamless and consistent client journey." />
            <BenefitCard title="See the Big Picture" content="Get a complete view of all your customer data—personal details, communication and history." />
            <BenefitCard title="Efficiency" content="Automate mundane tasks so your sales team can focus on closing deals and driving revenue." />
            <BenefitCard title="Happy Clients" content="Personalize every engagement and address concerns to retain clients who love doing business with you." />
          </div>
          <div className="grid gap-6 text-center md:grid-cols-5">
            <StatCard value="$8.71" label="ROI per $1 Invested" />
            <StatCard value="300%" label="Sales Conversion Increase" />
            <StatCard value="27%" label="Customer Retention Improvement" />
            <StatCard value="5%" label="Increase in Retention" />
            <StatCard value="25%" label="Increase in Profits" />
          </div>

          {/* Features Table */}
          <div className="overflow-x-auto bg-white border shadow rounded-3xl">
            <table className="min-w-full text-sm table-auto">
              <thead className="bg-indigo-50">
                <tr>
                  <th className="px-6 py-4 font-semibold text-left text-slate-700">Feature</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Small Businesses / SMEs</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Enterprises</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Contact Management</td>
                  <td className="px-6 py-4">Basic contact details, notes and communication history</td>
                  <td className="px-6 py-4">Advanced profiling, segmentation and marketing integration</td>
                </tr>
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Omni-channel Features</td>
                  <td className="px-6 py-4">Emails, calls and interactions tracking</td>
                  <td className="px-6 py-4">Integrated communication across chat, social, help desk and projects</td>
                </tr>
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Activity Management</td>
                  <td className="px-6 py-4">Basic to-do lists and task assignments</td>
                  <td className="px-6 py-4">Advanced workflow automation, task management and collaboration</td>
                </tr>
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Sales & Pipeline Tracking</td>
                  <td className="px-6 py-4">Basic deal tracking and stages</td>
                  <td className="px-6 py-4">Multiple pipelines, forecasting and reporting</td>
                </tr>
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Integration Capabilities</td>
                  <td className="px-6 py-4">Basic integration capabilities</td>
                  <td className="px-6 py-4">ERP, marketing tools and unified workflow integration</td>
                </tr>
                <tr className="transition hover:bg-indigo-50">
                  <td className="px-6 py-4 font-medium">Customization & Scalability</td>
                  <td className="px-6 py-4">Basic customization</td>
                  <td className="px-6 py-4">Advanced workflows, fields and scalability for complex needs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl px-6 mx-auto space-y-12">
          <div className="space-y-3 text-center">
            <h2 className="text-4xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <p className="max-w-2xl mx-auto text-lg text-slate-600">Answers to the most common questions about ReadyTech Solutions Client Management Software.</p>
          </div>
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
