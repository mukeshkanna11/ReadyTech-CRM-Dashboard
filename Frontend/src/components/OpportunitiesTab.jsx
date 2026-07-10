import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import { Briefcase, IndianRupee, Search, Filter } from "lucide-react";
import toast from "react-hot-toast";
import {
  BriefcaseBusiness,
  Home,
  ChevronRight,
  RefreshCw,
  Download,
  Plus,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import {
  ArrowRight,
} from "lucide-react";
const STAGES = ["Prospecting", "Proposal", "Closed Won", "Closed Lost"];

export default function OpportunitiesTab() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const res = await API.get("/opportunities");
      setOpportunities(res.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch opportunities");
      console.error("Fetch opportunities error", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOpportunities = useMemo(() => {
    return opportunities
      .filter((o) =>
        `${o.title || ""}`.toLowerCase().includes(search.toLowerCase())
      )
      .filter((o) => (stageFilter === "All" ? true : o.stage === stageFilter));
  }, [opportunities, search, stageFilter]);

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-300">Loading opportunities...</p>;
  }

  return (
    <div className="space-y-6">

      {/* ====================== HEADER ====================== */}
<div className="relative p-8 overflow-hidden text-white border shadow-2xl rounded-3xl border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

  {/* Background Effects */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />
  <div className="absolute rounded-full -right-16 -top-16 h-72 w-72 bg-blue-500/20 blur-3xl" />
  <div className="absolute rounded-full -bottom-16 -left-16 h-72 w-72 bg-purple-500/20 blur-3xl" />

  <div className="relative">

    {/* Top */}
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

      {/* Left */}
      <div>

        <div className="flex items-center gap-2 text-sm text-blue-200">
          <Home size={15} />
          Dashboard
          <ChevronRight size={15} />
          CRM
          <ChevronRight size={15} />
          <span className="font-medium text-white">
            Opportunities
          </span>
        </div>

        <div className="flex items-center gap-4 mt-4">

          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur">
            <BriefcaseBusiness size={30} />
          </div>

          <div>

            <h1 className="text-4xl font-bold">
              Opportunity Pipeline
            </h1>

            <p className="max-w-2xl mt-2 text-blue-100">
              Track deals, monitor pipeline progress, forecast revenue,
              and convert qualified opportunities into successful customers.
            </p>

          </div>

        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-6 mt-6 text-sm">

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            Pipeline Active
          </div>

          <div>
            Last Sync
            <span className="ml-2 font-semibold text-white">
              2 mins ago
            </span>
          </div>

          <div>
            Total Revenue
            <span className="ml-2 font-semibold text-emerald-300">
              ₹24.8L
            </span>
          </div>

        </div>

      </div>

      {/* Right Buttons */}
      <div className="flex flex-wrap gap-3">

        <button
          onClick={fetchOpportunities}
          className="flex items-center gap-2 px-5 py-3 font-semibold text-indigo-700 transition bg-white shadow-lg rounded-xl hover:scale-105"
        >
          <RefreshCw size={18} />
          Refresh
        </button>

        <button
          className="flex items-center gap-2 px-5 py-3 border rounded-xl border-white/20 bg-white/10 hover:bg-white/20"
        >
          <Download size={18} />
          Export
        </button>

        <button
          className="flex items-center gap-2 px-5 py-3 font-semibold transition rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105"
        >
          <Plus size={18} />
          New Opportunity
        </button>

      </div>

    </div>

    {/* Filters */}
    <div className="p-5 mt-8 border rounded-2xl border-white/10 bg-white/10 backdrop-blur">

      <div className="grid gap-4 lg:grid-cols-5">

        {/* Search */}
        <div className="relative lg:col-span-2">

          <Search
            size={18}
            className="absolute -translate-y-1/2 left-4 top-1/2 text-white/70"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities..."
            className="w-full py-3 pl-12 pr-4 text-white border rounded-xl border-white/20 bg-white/10 placeholder:text-white/60 focus:border-cyan-400 focus:outline-none"
          />

        </div>

        {/* Stage */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10 focus:outline-none"
        >
          <option className="text-black">All Stages</option>
          {STAGES.map((stage) => (
            <option
              key={stage}
              className="text-black"
            >
              {stage}
            </option>
          ))}
        </select>

        {/* Owner */}
        <select className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10">
          <option className="text-black">
            All Owners
          </option>
          <option className="text-black">
            Admin
          </option>
          <option className="text-black">
            Sales Team
          </option>
        </select>

        {/* Date */}
        <input
          type="date"
          className="px-4 py-3 text-white border rounded-xl border-white/20 bg-white/10"
        />

      </div>

    </div>

  </div>

</div>

      {/* ====================== PIPELINE BOARD ====================== */}

<div className="grid gap-6 xl:grid-cols-4">

  {STAGES.map((stage) => {

    const stageData = filteredOpportunities.filter(
      (o) => o.stage === stage
    );

    const totalValue = stageData.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    );

    return (

      <div
        key={stage}
        className="overflow-hidden transition-all duration-300 bg-white border shadow-lg border-slate-200 rounded-3xl hover:-translate-y-1 hover:shadow-2xl"
      >

        {/* Header */}
        <div className="p-5 text-white border-b bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15">
                <BriefcaseBusiness size={20} />
              </div>

              <div>

                <h3 className="font-semibold">
                  {stage}
                </h3>

                <p className="text-xs text-blue-200">
                  {stageData.length} Deals
                </p>

              </div>

            </div>

            <span className="px-3 py-1 text-xs rounded-full bg-white/15">
              ₹{totalValue.toLocaleString()}
            </span>

          </div>

        </div>

        {/* Cards */}
        <div className="max-h-[600px] space-y-4 overflow-y-auto p-4">

          {stageData.map((op) => (

            <div
              key={op._id}
              className="p-4 transition border rounded-2xl border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-white hover:shadow-lg"
            >

              {/* Title */}
              <div className="flex items-start justify-between">

                <div>

                  <h4 className="font-semibold text-slate-800">
                    {op.title}
                  </h4>

                  <p className="mt-1 text-xs text-slate-500">
                    {op.company || "No Company"}
                  </p>

                </div>

                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    op.priority === "High"
                      ? "bg-red-100 text-red-700"
                      : op.priority === "Medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {op.priority || "Low"}
                </span>

              </div>

              {/* Value */}
              <div className="flex items-center justify-between mt-4">

                <div>

                  <p className="text-xs text-slate-500">
                    Deal Value
                  </p>

                  <p className="font-bold text-emerald-600">
                    ₹{op.value?.toLocaleString()}
                  </p>

                </div>

                <div>

                  <p className="text-xs text-slate-500">
                    Probability
                  </p>

                  <p className="font-semibold text-indigo-600">
                    {op.probability || 70}%
                  </p>

                </div>

              </div>

              {/* Progress */}
              <div className="mt-4">

                <div className="flex justify-between mb-2 text-xs text-slate-500">

                  <span>Progress</span>

                  <span>
                    {op.probability || 70}%
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{
                      width: `${op.probability || 70}%`,
                    }}
                  />

                </div>

              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 mt-5 border-t">

                <div className="flex items-center gap-3">

                  <div className="flex items-center justify-center text-sm font-bold text-white rounded-full h-9 w-9 bg-gradient-to-r from-indigo-600 to-blue-600">
                    {(op.owner || "A")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>

                    <p className="text-sm font-medium">
                      {op.owner || "Admin"}
                    </p>

                    <p className="text-xs text-slate-500">
                      Owner
                    </p>

                  </div>

                </div>

                <button className="p-2 text-indigo-600 rounded-xl bg-indigo-50 hover:bg-indigo-100">
                  <ArrowRight size={18} />
                </button>

              </div>

            </div>

          ))}

          {stageData.length === 0 && (

            <div className="p-8 text-center border border-dashed rounded-2xl border-slate-300">

              <Inbox className="mx-auto mb-3 text-slate-300" size={36} />

              <p className="text-sm text-slate-500">
                No Opportunities
              </p>

            </div>

          )}

        </div>

      </div>

    );

  })}

</div>

     {/* ====================== SUMMARY KPI ====================== */}

<div className="grid gap-6 mt-8 sm:grid-cols-2 xl:grid-cols-4">

  {/* Total Opportunities */}
  <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:-translate-y-1 hover:shadow-2xl">

    <div className="absolute rounded-full -right-8 -top-8 h-28 w-28 bg-white/10 blur-3xl" />

    <div className="relative flex items-start justify-between">

      <div>
        <p className="text-sm text-blue-100">
          Total Opportunities
        </p>

        <h2 className="mt-3 text-4xl font-bold">
          {filteredOpportunities.length}
        </h2>

        <p className="mt-3 text-sm text-blue-100">
          +12% from last month
        </p>
      </div>

      <div className="p-3 rounded-2xl bg-white/20">
        <BriefcaseBusiness size={26} />
      </div>

    </div>

  </div>

  {/* Total Revenue */}
  <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 hover:-translate-y-1 hover:shadow-2xl">

    <div className="absolute rounded-full -right-8 -top-8 h-28 w-28 bg-white/10 blur-3xl" />

    <div className="relative flex items-start justify-between">

      <div>
        <p className="text-sm text-green-100">
          Pipeline Value
        </p>

        <h2 className="mt-3 text-4xl font-bold">
          ₹
          {filteredOpportunities
            .reduce((sum, o) => sum + (o.value || 0), 0)
            .toLocaleString()}
        </h2>

        <p className="mt-3 text-sm text-green-100">
          Forecast Revenue
        </p>
      </div>

      <div className="p-3 rounded-2xl bg-white/20">
        <IndianRupee size={26} />
      </div>

    </div>

  </div>

  {/* Closed Won */}
  <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-700 hover:-translate-y-1 hover:shadow-2xl">

    <div className="absolute rounded-full -right-8 -top-8 h-28 w-28 bg-white/10 blur-3xl" />

    <div className="relative flex items-start justify-between">

      <div>
        <p className="text-sm text-violet-100">
          Closed Won
        </p>

        <h2 className="mt-3 text-4xl font-bold">
          {
            filteredOpportunities.filter(
              (o) => o.stage === "Closed Won"
            ).length
          }
        </h2>

        <p className="mt-3 text-sm text-violet-100">
          Successfully Converted
        </p>
      </div>

      <div className="p-3 rounded-2xl bg-white/20">
        <CheckCircle2 size={26} />
      </div>

    </div>

  </div>

  {/* Win Rate */}
  <div className="relative p-6 overflow-hidden text-white transition-all duration-300 shadow-xl rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 hover:-translate-y-1 hover:shadow-2xl">

    <div className="absolute rounded-full -right-8 -top-8 h-28 w-28 bg-white/10 blur-3xl" />

    <div className="relative flex items-start justify-between">

      <div>

        <p className="text-sm text-orange-100">
          Win Rate
        </p>

        <h2 className="mt-3 text-4xl font-bold">
          {filteredOpportunities.length
            ? Math.round(
                (filteredOpportunities.filter(
                  (o) => o.stage === "Closed Won"
                ).length /
                  filteredOpportunities.length) *
                  100
              )
            : 0}
          %
        </h2>

        <p className="mt-3 text-sm text-orange-100">
          Conversion Success
        </p>

      </div>

      <div className="p-3 rounded-2xl bg-white/20">
        <TrendingUp size={26} />
      </div>

    </div>

  </div>

</div>
    </div>
  );
}
