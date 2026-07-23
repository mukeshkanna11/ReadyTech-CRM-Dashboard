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
  ChevronDown,
  UsersIcon,
  Bot,
  Filter,
  Users,
  CheckCircle,
  Building2,
  Mail,
  Phone,
  Globe,
  CreditCard,
  Hash,
  MapPin,
  Briefcase,
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

import ClientAIAssistant from "../components/ClientAIAssistant";

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

/* ================= KPI Card ================= */
function Kpi({
  title,
  value,
  icon: Icon,
  accent,
  description,
  badge
}) {

  const styles = {
    indigo: {
      bg: "from-indigo-600 to-blue-600",
      icon: "bg-indigo-500/30",
      badge: "text-indigo-200 bg-indigo-400/10"
    },

    green: {
      bg: "from-emerald-600 to-green-600",
      icon: "bg-green-500/30",
      badge: "text-green-200 bg-green-400/10"
    },

    amber: {
      bg: "from-orange-500 to-amber-600",
      icon: "bg-orange-400/30",
      badge: "text-yellow-100 bg-yellow-400/10"
    }
  };


  return (
    <div
      className={`
        relative
        overflow-hidden
        p-6
        text-white
        shadow-xl
        rounded-3xl
        bg-gradient-to-br
        ${styles[accent].bg}
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-2xl
      `}
    >

      {/* Glow */}
      <div className="absolute w-40 h-40 rounded-full -right-16 -top-16 bg-white/10 blur-3xl" />


      <div className="relative">


        {/* Top */}
        <div className="flex items-center justify-between">


          <div
            className={`
              flex
              items-center
              justify-center
              w-12
              h-12
              rounded-2xl
              backdrop-blur-xl
              ${styles[accent].icon}
            `}
          >
            <Icon size={25}/>
          </div>


          <span
            className={`
              px-3
              py-1
              text-xs
              font-semibold
              rounded-full
              ${styles[accent].badge}
            `}
          >
            {badge}
          </span>


        </div>



        {/* Value */}
        <div className="mt-6">

          <p className="text-sm text-white/80">
            {title}
          </p>


          <h2 className="mt-2 text-4xl font-bold">
            {value}
          </h2>


          <p className="mt-2 text-xs text-white/70">
            {description}
          </p>

        </div>



        {/* Footer */}
        <div className="flex items-center gap-2 mt-5 text-xs text-white/90">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"/>

          ReadyTech CRM Live Tracking

        </div>


      </div>

    </div>
  );
}

/* ================= Profile Detail Row ================= */
const Detail = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm break-words text-slate-700">{value || "—"}</p>
    </div>
  </div>
);

/* ================= Main Clients Component ================= */
export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeClient, setActiveClient] = useState(null);
  const [aiClient, setAiClient] = useState(null);


  const emptyForm = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  gstNumber: "",
  panNumber: "",

  clientType: "Customer",
  status: "Active",
  currentPlan: "",
  subscriptionStatus: "Active",

  notes: "",

  billingAddress: {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  },

  shippingAddress: {
    country: "India",
  },
};
const [form, setForm] = useState(emptyForm);

 const fetchClients = async () => {
  try {
    setLoading(true);

    const { data } = await API.get("/clients");

    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    setClients(list);
  } catch (err) {
    toast.error("Failed to load clients");
    console.error("CLIENT FETCH ERROR:", err);
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
    const payload = { ...form };

    // safety cleanup (important in real apps)
    delete payload.__v;
    delete payload.createdAt;
    delete payload.updatedAt;

    if (payload._id) {
      await API.put(`/clients/${payload._id}`, payload);
      toast.success("Client updated");
    } else {
      await API.post("/clients", payload);
      toast.success("Client created");
    }

    setDrawerOpen(false);
    setForm(emptyForm);
    fetchClients();
  } catch (err) {
    toast.error(err?.response?.data?.message || "Save failed");
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
  const q = search.trim().toLowerCase();
  return clients.filter((c) => {
    const matchesSearch =
      !q ||
      `${c.companyName || ""} ${c.contactPerson || ""} ${c.email || ""} ${c.phone || ""}`
        .toLowerCase()
        .includes(q);
    const matchesStatus =
      statusFilter === "All" || c.status === statusFilter;
    const matchesType =
      typeFilter === "All" || c.clientType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
}, [clients, search, statusFilter, typeFilter]);

  /* ================= KPI Stats ================= */
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "Active").length;
    const customers = clients.filter((c) => c.clientType === "Customer").length;
    return { total, active, customers };
  }, [clients]);

  return (
    <div className="space-y-6">

      {/* ================= Enterprise Header ================= */}
<div className="relative overflow-hidden shadow-xl p-7 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900">

  {/* Background Glow */}
  <div className="absolute rounded-full w-72 h-72 -right-20 -top-20 bg-blue-500/20 blur-3xl" />
  <div className="absolute rounded-full w-72 h-72 -left-20 -bottom-20 bg-indigo-500/20 blur-3xl" />


  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">


    {/* Title Section */}
    <div className="flex items-start gap-4">

      {/* Icon */}
      <div className="flex items-center justify-center border w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl border-white/20">
        <UsersIcon size={28} className="text-white" />
      </div>


      <div>

        <div className="flex flex-wrap items-center gap-3">

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Client Management
          </h1>


          <span className="px-3 py-1 text-xs font-semibold text-blue-200 border rounded-full bg-blue-500/20 border-blue-400/30">
            ReadyTech Solutions
          </span>

        </div>


        <p className="mt-2 text-sm text-slate-300">
          Manage clients, communications, business relationships and activities
          from a centralized CRM workspace.
        </p>


        <p className="mt-2 text-xs text-indigo-200">
          Designed for ReadyTech Solutions CRM ecosystem to maintain
          client records, improve engagement tracking and support scalable
          business operations.
        </p>


        {/* Status Badges */}
        <div className="flex flex-wrap gap-2 mt-4">

          <span className="px-3 py-1 text-xs font-medium text-green-300 border rounded-full bg-green-400/10 border-green-400/20">
            ● Client Database Active
          </span>


          <span className="px-3 py-1 text-xs font-medium text-purple-300 border rounded-full bg-purple-400/10 border-purple-400/20">
            CRM Relationship Hub
          </span>


          <span className="px-3 py-1 text-xs font-medium text-blue-300 border rounded-full bg-blue-400/10 border-blue-400/20">
            Enterprise Ready
          </span>

        </div>

      </div>

    </div>




    {/* Actions */}
    <div className="flex flex-wrap gap-3">

      <button
        onClick={fetchClients}
        className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-white transition border rounded-2xl bg-white/10 backdrop-blur-xl border-white/20 hover:bg-white/20"
      >
        <RefreshCw
          size={17}
          className={loading ? "animate-spin" : ""}
        />

        Refresh
      </button>



      <button
        onClick={() => {
          setForm(emptyForm);
          setDrawerOpen(true);
        }}
        className="
          flex items-center gap-2
          px-5 py-3
          text-sm font-semibold
          text-white
          transition-all
          shadow-lg
          rounded-2xl
          bg-gradient-to-r
          from-blue-600
          via-indigo-600
          to-purple-600
          hover:shadow-indigo-500/30
          hover:scale-[1.02]
        "
      >
        <Plus size={18} />

        Add New Client
      </button>

    </div>


  </div>

</div>

      {/* ================= Enterprise KPI Cards ================= */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">

  <Kpi
    title="Total Clients"
    value={stats.total}
    icon={Users}
    accent="indigo"
    description="All registered business clients"
    badge="CRM Database"
  />

  <Kpi
    title="Active Clients"
    value={stats.active}
    icon={CheckCircle}
    accent="green"
    description="Currently engaged client accounts"
    badge="Active"
  />

  <Kpi
    title="Customers"
    value={stats.customers}
    icon={Briefcase}
    accent="amber"
    description="Converted business relationships"
    badge="Business"
  />

</div>

     {/* ================= Enterprise Search & Filters ================= */}
<div className="relative flex flex-col gap-4 p-5 overflow-hidden bg-white border shadow-xl md:flex-row md:items-center md:justify-between rounded-3xl border-slate-200">

  {/* Background Accent */}
  <div className="absolute w-56 h-56 rounded-full -right-20 -top-20 bg-indigo-500/10 blur-3xl" />


  {/* Search */}
  <div className="relative z-10 flex-1 md:max-w-lg">

    <Search
      className="
        absolute
        text-slate-400
        left-4
        top-3.5
      "
      size={18}
    />


    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search clients by name, company, email or phone..."
      className="w-full py-3 pr-4 text-sm transition-all border outline-none pl-11 rounded-2xl bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
    />


  </div>



  {/* Filters */}
  <div className="relative z-10 flex flex-wrap items-center gap-3">


    {/* Filter Label */}
    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-indigo-600 rounded-xl bg-indigo-50">
      <Filter size={15}/>
      Client Filters
    </div>



    {/* Status */}
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="
        px-4
        py-2.5
        text-sm
        border
        outline-none
        rounded-xl
        bg-white
        border-slate-200
        text-slate-700
        focus:border-indigo-500
        focus:ring-4
        focus:ring-indigo-500/10
      "
    >
      <option value="All">
        All Status
      </option>

      <option value="Active">
        Active Clients
      </option>

      <option value="Inactive">
        Inactive Clients
      </option>

    </select>




   {/* Enterprise Client Type Dropdown */}

<div className="relative">

  <select
    value={typeFilter}
    onChange={(e) => setTypeFilter(e.target.value)}
    className="w-56 px-4 py-3 pr-10 text-sm font-medium transition-all duration-300 border shadow-sm outline-none appearance-none cursor-pointer rounded-2xl border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-700 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
  >

    <option value="All">
      All Client Types
    </option>

    <option value="Customer">
      👤 Customers
    </option>

    <option value="Prospect">
      🔥 Prospects
    </option>

    <option value="Partner">
      🤝 Partners
    </option>

  </select>


  {/* Dropdown Icon */}

  <ChevronDown
    size={18}
    className="absolute text-indigo-500 -translate-y-1/2 pointer-events-none right-4 top-1/2"
  />

</div>




    {/* Active Filter Clear */}
    {(search || statusFilter !== "All" || typeFilter !== "All") && (

      <button
        onClick={() => {
          setSearch("");
          setStatusFilter("All");
          setTypeFilter("All");
        }}

        className="
          flex
          items-center
          gap-2
          px-4
          py-2.5
          text-sm
          font-medium
          text-red-600
          transition
          rounded-xl
          bg-red-50
          hover:bg-red-100
        "
      >
        <X size={15}/>
        Clear Filters
      </button>

    )}


  </div>


</div>

      {/* Result Count */}
<div className="flex items-center justify-between px-1">

  <p className="text-xs text-slate-500">
    Showing{" "}
    <span className="font-semibold text-slate-700">
      {filteredClients.length}
    </span>{" "}
    of{" "}
    <span className="font-semibold text-slate-700">
      {clients.length}
    </span>{" "}
    clients
  </p>


  <span className="items-center hidden gap-2 text-xs font-medium text-indigo-600 md:flex">
    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>
    CRM Live Sync
  </span>

</div>



{/* ================= Enterprise Client Table ================= */}
<div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">

<div className="overflow-x-auto">

<table className="min-w-full text-sm">


{/* HEADER */}
<thead className="border-b bg-slate-50 border-slate-200">

<tr>

<th className="px-5 py-4 font-semibold text-left text-slate-600">
  Client
</th>

<th className="hidden px-5 py-4 font-semibold text-left text-slate-600 md:table-cell">
  Contact Details
</th>

<th className="px-5 py-4 font-semibold text-left text-slate-600">
  Status
</th>

<th className="hidden px-5 py-4 font-semibold text-left text-slate-600 sm:table-cell">
  Type
</th>

<th className="hidden px-5 py-4 font-semibold text-left text-slate-600 lg:table-cell">
  Created
</th>

<th className="px-5 py-4 font-semibold text-right text-slate-600">
  Actions
</th>

</tr>

</thead>



<tbody>


{/* Loading */}
{loading && (

<tr>
<td
colSpan="6"
className="px-5 py-12 text-center text-slate-500"
>
<div className="flex flex-col items-center gap-3">

<div className="w-8 h-8 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"/>

Loading client database...

</div>

</td>
</tr>

)}




{/* Empty */}
{!loading && filteredClients.length === 0 && (

<tr>

<td
colSpan="6"
className="px-5 py-12 text-center text-slate-500"
>

No clients found matching your filters

</td>

</tr>

)}




{/* DATA */}

{!loading && filteredClients.map((c)=>(

<tr
key={c._id}
className="transition-all border-b group hover:bg-indigo-50/40 border-slate-100"
>


{/* CLIENT */}

<td
className="px-5 py-4 cursor-pointer"
onClick={()=>{
setActiveClient(c);
setProfileOpen(true);
}}
>

<div className="flex items-center gap-4">


{/* Avatar */}

<div className="flex items-center justify-center font-bold text-indigo-700 bg-indigo-100 w-11 h-11 rounded-2xl"
>
{(
c.companyName ||
c.contactPerson ||
"?"
)
.charAt(0)
.toUpperCase()}

</div>



<div className="min-w-0">

<p className="font-semibold truncate text-slate-900"
>
{c.companyName ||
c.contactPerson ||
"Unnamed Client"}

</p>


<p className="text-xs truncate text-slate-500"
>
{c.email || "No email available"}

</p>

</div>


</div>

</td>





{/* CONTACT */}

<td className="hidden px-5 py-4 text-xs text-slate-600 md:table-cell">

<div className="flex items-center gap-2">

<Mail size={14}/>
{c.email || "—"}

</div>


<div className="flex items-center gap-2 mt-1 ">

<Phone size={14}/>
{c.phone || "—"}

</div>


</td>





{/* STATUS */}

<td className="px-5 py-4">


<span
className={`
inline-flex
items-center
gap-2
px-3
py-1.5
rounded-full
text-xs
font-semibold

${
c.status==="Active"
?
"bg-green-100 text-green-700"
:
"bg-slate-100 text-slate-600"
}

`}
>

<span className={`
w-2
h-2
rounded-full

${
c.status==="Active"
?
"bg-green-500"
:
"bg-slate-400"
}

`}/>


{c.status || "Unknown"}

</span>


</td>





{/* TYPE */}

<td className="hidden px-5 py-4 sm:table-cell">

<span className="px-3 py-1 text-xs font-medium text-blue-700 rounded-full bg-blue-50">

{c.clientType || "—"}

</span>


</td>





{/* DATE */}

<td className="hidden px-5 py-4 text-xs text-slate-500 lg:table-cell">

{c.createdAt
?
new Date(c.createdAt).toLocaleDateString()
:
"—"
}

</td>





{/* ACTIONS */}

<td className="px-5 py-4">

<div className="flex justify-end gap-2 ">


<button
onClick={()=>setAiClient(c)}
title="AI Client Assistant"
className="p-2 text-indigo-600 transition rounded-xl bg-indigo-50 hover:bg-indigo-100"
>
<Bot size={16}/>
</button>



<button
onClick={()=>{
setForm(c);
setDrawerOpen(true);
}}
title="Edit Client"
className="p-2 transition text-slate-600 rounded-xl bg-slate-50 hover:bg-slate-100"
>
<Pencil size={16}/>
</button>



<button
onClick={()=>removeClient(c._id)}
title="Delete Client"
className="p-2 text-red-600 transition rounded-xl bg-red-50 hover:bg-red-100"
>
<Trash2 size={16}/>
</button>


</div>

</td>



</tr>

))}


</tbody>

</table>

</div>

</div>

      {/* ================= Enterprise Client Drawer ================= */}
<AnimatePresence>
  {drawerOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
    >
      <motion.form
        onSubmit={saveClient}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 24 }}
        className="flex flex-col w-full h-full max-w-lg bg-white shadow-2xl"
      >

        {/* ================= Header ================= */}
        <div className="p-6 text-white bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

          <div className="flex items-start justify-between">

            <div>
              <h2 className="text-2xl font-bold">
                {form._id ? "Edit Client" : "Create New Client"}
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Manage client information for the ReadyTech Solutions CRM platform.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-2 rounded-xl hover:bg-white/10"
            >
              <X size={20} />
            </button>

          </div>

        </div>

        {/* ================= Form ================= */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">

          {/* Company Information */}
          <div>

            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase text-slate-500">
              Company Information
            </h3>

            <div className="space-y-4">

              <input
                placeholder="Company Name"
                value={form.companyName}
                onChange={(e)=>setForm({...form,companyName:e.target.value})}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
              />

              <input
                placeholder="Contact Person"
                value={form.contactPerson}
                onChange={(e)=>setForm({...form,contactPerson:e.target.value})}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
              />

            </div>

          </div>


          {/* Contact Details */}
          <div>

            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase text-slate-500">
              Contact Details
            </h3>

            <div className="space-y-4">

              <input
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e)=>setForm({...form,email:e.target.value})}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
              />

              <input
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e)=>setForm({...form,phone:e.target.value})}
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
              <input
  type="text"
  placeholder="Billing Address"
  value={form.billingAddress?.addressLine1 || ""}
  onChange={(e) =>
    setForm({
      ...form,
      billingAddress: {
        ...form.billingAddress,
        addressLine1: e.target.value,
      },
    })
  }
  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
/>

            </div>

          </div>


          {/* Business Details */}
          <div>

            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase text-slate-500">
              Business Information
            </h3>

            <div className="grid grid-cols-2 gap-4">

              <select
                value={form.clientType}
                onChange={(e)=>setForm({...form,clientType:e.target.value})}
                className="p-3 border rounded-xl"
              >
                <option>Customer</option>
                <option>Prospect</option>
                <option>Partner</option>
              </select>

              <select
                value={form.status}
                onChange={(e)=>setForm({...form,status:e.target.value})}
                className="p-3 border rounded-xl"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>

            </div>

          </div>


          {/* Notes */}
          <div>

            <h3 className="mb-4 text-sm font-semibold tracking-wide uppercase text-slate-500">
              Additional Notes
            </h3>

            <textarea
              rows={5}
              placeholder="Enter client requirements, follow-up notes, meeting summary..."
              value={form.notes}
              onChange={(e)=>setForm({...form,notes:e.target.value})}
              className="w-full p-3 border resize-none rounded-xl focus:ring-2 focus:ring-indigo-500"
            />

          </div>


          {/* ReadyTech Note */}
          <div className="p-4 border border-indigo-100 rounded-2xl bg-indigo-50">

            <p className="text-sm font-semibold text-indigo-700">
              ReadyTech Solutions CRM
            </p>

            <p className="mt-1 text-xs leading-6 text-indigo-600">
              Client information is securely maintained within the ReadyTech
              Solutions Growth Suite CRM platform to support customer
              relationship management, sales engagement, and long-term business
              collaboration.
            </p>

          </div>

        </div>


        {/* ================= Footer ================= */}
        <div className="flex gap-3 p-6 border-t bg-slate-50">

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex-1 py-3 font-medium border rounded-xl hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            className="flex-1 py-3 font-semibold text-white transition rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-xl"
          >
            {form._id ? "Update Client" : "Create Client"}
          </button>

        </div>

      </motion.form>
    </motion.div>
  )}
</AnimatePresence>

      {/* ================= Enterprise Client Profile ================= */}
<AnimatePresence>
{profileOpen && activeClient && (

<motion.div
  initial={{opacity:0}}
  animate={{opacity:1}}
  exit={{opacity:0}}
  className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
  onClick={() => setProfileOpen(false)}
>


<motion.div
  initial={{x:"100%"}}
  animate={{x:0}}
  exit={{x:"100%"}}
  transition={{type:"spring", damping:25}}
  className="flex flex-col w-full h-full max-w-lg bg-white shadow-2xl"
  onClick={(e)=>e.stopPropagation()}
>


{/* ================= HEADER ================= */}

<div className="relative px-6 overflow-hidden text-white py-7 bg-gradient-to-br from-slate-950 via-indigo-900 to-blue-900">


<div className="absolute w-56 h-56 rounded-full -right-20 -top-20 bg-blue-500/20 blur-3xl"/>


<button
onClick={()=>setProfileOpen(false)}
className="absolute p-2 right-5 top-5 rounded-xl bg-white/10 hover:bg-white/20"
>
<X size={20}/>
</button>



<div className="relative flex items-center gap-4">


<div className="flex items-center justify-center w-16 h-16 text-2xl font-bold border rounded-3xl bg-white/10 border-white/20 backdrop-blur-xl">

{(
activeClient.companyName ||
activeClient.contactPerson ||
"?"
)
.charAt(0)
.toUpperCase()}

</div>



<div className="min-w-0">

<div className="flex items-center gap-2">

<h2 className="text-2xl font-bold truncate ">

{activeClient.companyName ||
activeClient.contactPerson ||
"Unnamed Client"}

</h2>

</div>


<p className="mt-1 text-sm text-slate-300">
ReadyTech Solutions CRM Client Profile
</p>



<div className="flex flex-wrap gap-2 mt-3">


<span className={`
px-3
py-1
text-xs
font-semibold
rounded-full

${
activeClient.status==="Active"
?
"bg-green-500/20 text-green-200"
:
"bg-white/10 text-slate-200"
}

`}>

● {activeClient.status || "Unknown"}

</span>



{activeClient.clientType && (

<span className="px-3 py-1 text-xs text-blue-200 rounded-full bg-blue-400/20">

{activeClient.clientType}

</span>

)}


</div>


</div>


</div>


</div>





{/* ================= BODY ================= */}

<div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto bg-slate-50">



{/* Contact Card */}

<section className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200">


<h3 className="flex items-center gap-2 mb-4 text-xs font-bold tracking-wider uppercase text-slate-400">

<User size={14}/>
Contact Information

</h3>



<div className="grid gap-3 sm:grid-cols-2">

<Detail
icon={User}
label="Contact Person"
value={activeClient.contactPerson}
/>


<Detail
icon={Mail}
label="Email"
value={activeClient.email}
/>


<Detail
icon={Phone}
label="Phone"
value={activeClient.phone}
/>


<Detail
icon={Globe}
label="Website"
value={activeClient.website}
/>


</div>


</section>






{/* Business */}

<section className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200">


<h3 className="flex items-center gap-2 mb-4 text-xs font-bold tracking-wider uppercase text-slate-400">

<Building2 size={14}/>
Business Information

</h3>



<div className="grid gap-3 sm:grid-cols-2">


<Detail
icon={Building2}
label="Company"
value={activeClient.companyName}
/>


<Detail
icon={Briefcase}
label="Client Type"
value={activeClient.clientType}
/>


<Detail
icon={Hash}
label="GST Number"
value={activeClient.gstNumber}
/>


<Detail
icon={Hash}
label="PAN Number"
value={activeClient.panNumber}
/>


<Detail
icon={CreditCard}
label="Current Plan"
value={activeClient.currentPlan}
/>


<Detail
icon={CreditCard}
label="Subscription"
value={activeClient.subscriptionStatus}
/>


</div>


</section>







{/* Address */}

{activeClient.billingAddress &&
Object.values(activeClient.billingAddress).some(
(v)=>v && `${v}`.trim()
)
&& (

<section className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200">


<h3 className="mb-3 text-xs font-bold tracking-wider uppercase text-slate-400">

Billing Address

</h3>


<div className="flex gap-3 text-sm text-slate-600">

<MapPin
size={18}
className="text-indigo-500"
/>


<span>

{[
activeClient.billingAddress.addressLine1,
activeClient.billingAddress.addressLine2,
activeClient.billingAddress.city,
activeClient.billingAddress.state,
activeClient.billingAddress.pincode,
activeClient.billingAddress.country
]
.filter(Boolean)
.join(", ")}

</span>


</div>


</section>

)}







{/* Notes */}

<section className="p-5 bg-white border shadow-sm rounded-3xl border-slate-200">


<h3 className="flex items-center gap-2 mb-3 text-xs font-bold tracking-wider uppercase text-slate-400">

<FileText size={14}/>
Client Notes

</h3>


<p className="text-sm leading-relaxed text-slate-600">

{activeClient.notes ||
"No notes available"}

</p>


</section>





{/* Activity */}

<section className="p-5 border border-indigo-100 rounded-3xl bg-indigo-50">


<h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-500 uppercase ">

<Activity size={14}/>
Activity Timeline

</h3>


<p className="mt-2 text-sm text-indigo-600 ">

CRM activity tracking integration ready.

</p>


</section>



</div>






{/* ================= FOOTER ================= */}

<div className="p-5 bg-white border-t ">


<button
type="button"
onClick={()=>setAiClient(activeClient)}
className="flex items-center justify-center w-full gap-2 py-3 font-semibold text-white transition shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:shadow-indigo-500/30"
>

<Bot size={18}/>

Ask ReadyTech AI Assistant

</button>


</div>




</motion.div>

</motion.div>

)}
</AnimatePresence>
      {/* ================= AI Assistant Panel ================= */}
{aiClient && (
  <ClientAIAssistant
    client={aiClient}
    onClose={() => setAiClient(null)}
  />
)}



{/* ================= ReadyTech Solutions CRM Hero ================= */}
<div className="relative py-24 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950">


{/* Decorative Glow */}

<div className="absolute rounded-full w-96 h-96 -top-32 -left-32 bg-indigo-500/20 blur-3xl"/>


<div className="absolute rounded-full w-96 h-96 -bottom-32 -right-32 bg-blue-500/20 blur-3xl"/>



<div className="relative max-w-6xl px-6 mx-auto text-center ">


{/* Badge */}

<div className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-200 border rounded-full bg-white/10 backdrop-blur-xl border-white/20">

<span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>

ReadyTech Solutions CRM Platform

</div>




{/* Heading */}

<h1 className="max-w-4xl mx-auto mt-8 text-5xl font-extrabold leading-tight text-white md:text-6xl">

Transform Client Relationships
with Intelligent CRM Management

</h1>




{/* Description */}

<p className="max-w-3xl mx-auto mt-6 text-lg leading-relaxed text-slate-300">

ReadyTech Solutions Client Management Software helps organizations
centralize customer information, manage communication workflows,
track business relationships and improve operational efficiency.

</p>


<p className="max-w-3xl mx-auto mt-4 text-base text-indigo-200 ">

Built for scalable businesses with secure data management,
smart insights and AI-powered client assistance.

</p>





{/* CTA */}

<div className="flex flex-col justify-center gap-4 mt-10 sm:flex-row">


<button
className="px-8 py-3 font-semibold text-white transition-all shadow-xl rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105 hover:shadow-indigo-500/30"
>

Get Started Free

</button>



<button
className="px-8 py-3 font-semibold text-white transition border rounded-2xl bg-white/10 backdrop-blur-xl border-white/20 hover:bg-white/20"
>

Explore Features

</button>


</div>






{/* Trust Stats */}

<div className="grid max-w-4xl grid-cols-1 gap-4 mx-auto mt-16 sm:grid-cols-3">


<div className="p-5 border rounded-3xl bg-white/10 backdrop-blur-xl border-white/20">

<h3 className="text-3xl font-bold text-white ">
99%
</h3>

<p className="mt-1 text-sm text-slate-300">
Data Reliability
</p>

</div>




<div className="p-5 border rounded-3xl bg-white/10 backdrop-blur-xl border-white/20">

<h3 className="text-3xl font-bold text-white ">
24/7
</h3>

<p className="mt-1 text-sm text-slate-300">
Client Accessibility
</p>

</div>




<div className="p-5 border rounded-3xl bg-white/10 backdrop-blur-xl border-white/20">

<h3 className="text-3xl font-bold text-white ">
AI
</h3>

<p className="mt-1 text-sm text-slate-300">
Smart Assistance
</p>

</div>


</div>




</div>

</div>


      {/* ================= Why ReadyTech CRM Section ================= */}
<section className="relative py-20 overflow-hidden bg-slate-50">


{/* Background Decoration */}

<div className="absolute rounded-full w-72 h-72 bg-indigo-200/40 blur-3xl -top-20 -left-20"/>


<div className="absolute rounded-full w-80 h-80 bg-blue-200/30 blur-3xl -bottom-20 -right-20"/>



<div className="relative max-w-6xl px-6 mx-auto ">


{/* Heading */}

<div className="max-w-3xl mx-auto space-y-4 text-center ">


<div className="inline-flex px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full ">

ReadyTech Solutions CRM Intelligence

</div>



<h2 className="text-4xl font-extrabold text-slate-900 md:text-5xl">

Why Businesses Need a
Modern Client Management System?

</h2>



<p className="text-lg leading-relaxed text-slate-600">

In today's competitive digital landscape, managing customer
relationships efficiently is critical. ReadyTech Solutions CRM
helps businesses organize client data, automate workflows and
build stronger customer relationships.

</p>


</div>





{/* Feature Grid */}

<div className="grid gap-6 mt-14 md:grid-cols-2">


<CMSBlock

title="Understand & Delight Customers"

content="
Track every client interaction from first enquiry to
successful delivery. Build meaningful relationships with
complete customer visibility and personalized engagement.
"

/>



<CMSBlock

title="Centralized Client Intelligence"

content="
Store customer profiles, communication history, documents
and business information in one secure CRM platform for
faster decision-making.
"

/>




<CMSBlock

title="Smart Automation & Workflow"

content="
Automate follow-ups, reminders, client activities and sales
processes to improve productivity and reduce manual effort.
"

/>




<CMSBlock

title="Actionable Business Insights"

content="
Analyze customer trends, monitor performance and generate
valuable insights to improve sales strategy and business
growth.
"

/>





<div className=" md:col-span-2">

<CMSBlock

title="Personalized Client Experience"

content="
Every customer is unique. ReadyTech Solutions CRM provides
a complete 360° client view, enabling teams to deliver
personalized communication, improve retention and maximize
long-term revenue opportunities.
"

/>

</div>



</div>



{/* Bottom Trust Banner */}

<div className="flex flex-col items-center justify-between gap-5 p-8 mt-16 border border-indigo-500 md:flex-row rounded-3xl bg-gradient-to-r from-indigo-600 to-blue-600">


<div>

<h3 className="text-2xl font-bold text-white ">

Ready to transform your client management?

</h3>


<p className="mt-2 text-sm text-indigo-100 ">

Empower your team with ReadyTech Solutions Growth Suite CRM.

</p>


</div>



<button
className="px-6 py-3 font-semibold text-indigo-700 transition bg-white rounded-xl hover:scale-105"
>

Start Managing Smarter

</button>


</div>



</div>

</section>

     {/* ================= Benefits / Features / Stats ================= */}
<section className="relative py-24 overflow-hidden bg-slate-50">


{/* Background */}

<div className="absolute rounded-full w-96 h-96 bg-indigo-200/40 blur-3xl -top-20 -right-20"/>

<div className="absolute rounded-full w-80 h-80 bg-blue-200/30 blur-3xl -bottom-20 -left-20"/>



<div className="relative px-6 mx-auto space-y-20 max-w-7xl">



{/* Heading */}

<div className="max-w-4xl mx-auto space-y-5 text-center ">


<span className="inline-flex px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full ">

ReadyTech Solutions Growth Suite

</span>



<h2 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">

Powerful Features Designed for
Modern Client Management

</h2>


<p className="text-lg leading-relaxed text-slate-600">

Whether you are a growing startup or an enterprise organization,
ReadyTech Solutions CRM helps teams manage customer relationships,
automate workflows and accelerate business growth.

</p>


</div>





{/* Benefit Cards */}

<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">


<BenefitCard
title="Accelerate Sales Growth"
content="
Give your sales team complete customer visibility,
faster follow-ups and better conversion opportunities.
"
/>



<BenefitCard
title="360° Client Visibility"
content="
Access complete customer profiles, communication history,
documents and business insights from one platform.
"
/>



<BenefitCard
title="Smart Automation"
content="
Reduce repetitive tasks with automated workflows,
reminders and activity tracking.
"
/>



<BenefitCard
title="Customer Success"
content="
Deliver personalized experiences that improve satisfaction,
trust and long-term retention.
"
/>



</div>







{/* KPI Stats */}

<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">


<StatCard
value="8.7x"
label="Business ROI"
/>


<StatCard
value="300%"
label="Sales Growth"
/>


<StatCard
value="27%"
label="Retention Improvement"
/>


<StatCard
value="40%"
label="Workflow Efficiency"
/>


<StatCard
value="25%"
label="Profit Growth"
/>


</div>







{/* Feature Comparison */}

<div className="overflow-hidden bg-white border shadow-xl rounded-3xl border-slate-200">


<div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-blue-600">

<h3 className="text-xl font-bold text-white ">

CRM Capability Comparison

</h3>

<p className="mt-1 text-sm text-indigo-100 ">

Built for SMEs and enterprise-level business operations.

</p>


</div>



<div className="overflow-x-auto">


<table className="min-w-full text-sm ">


<thead className="bg-slate-50">


<tr>

<th className="px-6 py-4 font-semibold text-left text-slate-700">
Feature
</th>


<th className="px-6 py-4 font-semibold text-center text-slate-700">
SME Solutions
</th>


<th className="px-6 py-4 font-semibold text-center text-slate-700">
Enterprise Solutions
</th>


</tr>


</thead>



<tbody className="divide-y">


{[
[
"Client Management",
"Contacts, notes & communication tracking",
"Advanced profiling, segmentation & analytics"
],

[
"Communication Management",
"Email & call tracking",
"Omnichannel communication workflow"
],

[
"Activity Management",
"Tasks & reminders",
"Automation, collaboration & workflow engine"
],

[
"Sales Pipeline",
"Basic deal tracking",
"Forecasting, multiple pipelines & reports"
],

[
"Integration",
"Basic integrations",
"ERP, marketing & business ecosystem integration"
],

[
"Customization",
"Standard configuration",
"Custom workflows, fields & scalable architecture"
]

].map((item,index)=>(


<tr
key={index}
className="transition hover:bg-indigo-50/50"
>


<td className="px-6 py-5 font-semibold text-slate-900">

{item[0]}

</td>


<td className="px-6 py-5 text-center text-slate-600">

{item[1]}

</td>



<td className="px-6 py-5 text-center text-slate-600">

{item[2]}

</td>



</tr>


))}



</tbody>


</table>


</div>


</div>






{/* CTA */}

<div className="flex flex-col items-center justify-between gap-5 p-8 md:flex-row rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">


<div>

<h3 className="text-2xl font-bold text-white ">

Scale Your Business With ReadyTech CRM

</h3>


<p className="mt-2 text-sm text-slate-300">

Manage clients smarter. Automate faster. Grow better.

</p>


</div>



<button
className="py-3 font-semibold text-indigo-900 transition bg-white px-7 rounded-xl hover:scale-105"
>

Explore ReadyTech Solutions

</button>


</div>



</div>

</section>

      {/* ================= Enterprise FAQ Section ================= */}
<section className="relative py-24 overflow-hidden bg-slate-50">


{/* Background Effects */}

<div className="absolute rounded-full w-80 h-80 bg-indigo-200/40 blur-3xl -top-20 -left-20"/>


<div className="absolute rounded-full w-96 h-96 bg-blue-200/30 blur-3xl -bottom-20 -right-20"/>




<div className="relative max-w-5xl px-6 mx-auto ">



{/* Header */}

<div className="max-w-3xl mx-auto space-y-5 text-center ">


<span className="inline-flex px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full ">

ReadyTech Solutions Support Center

</span>




<h2 className="text-4xl font-extrabold text-slate-900 md:text-5xl">

Frequently Asked Questions

</h2>




<p className="text-lg leading-relaxed text-slate-600">

Find answers to common questions about
ReadyTech Solutions Client Management Software,
features, security and business operations.

</p>


</div>







{/* FAQ Cards */}

<div className="space-y-5 mt-14">


{faqData.map((faq,index)=>(


<div
key={index}
className="overflow-hidden transition-all duration-300 bg-white border shadow-sm rounded-3xl border-slate-200 hover:shadow-xl hover:border-indigo-200"
>


<FAQItem

question={faq.question}

answer={faq.answer}

/>


</div>


))}


</div>


{/* Support Banner */}

<div className="flex flex-col items-center justify-between gap-5 p-8 mt-16 md:flex-row rounded-3xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600">


<div>


<h3 className="text-2xl font-bold text-white ">

Still have questions?

</h3>



<p className="mt-2 text-sm text-indigo-100 ">

Our ReadyTech Solutions team is ready to help you
configure and optimize your CRM workflow.

</p>


</div>





<button

className="py-3 font-semibold text-indigo-700 transition bg-white px-7 rounded-xl hover:scale-105"

>

Contact Support

</button>


</div>





</div>


</section>



    </div>
  );
}
