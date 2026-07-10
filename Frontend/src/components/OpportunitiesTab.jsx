import { useEffect, useState, useMemo } from "react";
import API from "../services/api";
import { Briefcase, IndianRupee, Search, Filter } from "lucide-react";
import toast from "react-hot-toast";

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

      {/* Header + Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Opportunities</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Monitor deals, stages, and total values.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities"
              className="w-full py-2 pl-10 pr-3 border rounded-lg md:w-64 dark:bg-slate-800 dark:border-gray-700 dark:text-white"
            />
          </div>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="p-2 border rounded-lg dark:bg-slate-800 dark:border-gray-700 dark:text-white"
          >
            <option>All</option>
            {STAGES.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </select>

          <button
            onClick={fetchOpportunities}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 transition bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Filter size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Stage Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
        {STAGES.map((stage) => {
          const stageData = filteredOpportunities.filter((o) => o.stage === stage);
          const totalValue = stageData.reduce((sum, o) => sum + (o.value || 0), 0);

          return (
            <div
              key={stage}
              className="p-4 transition bg-white shadow dark:bg-slate-800 rounded-2xl hover:shadow-lg"
            >
              <h3 className="flex items-center gap-2 mb-3 font-semibold text-gray-700 dark:text-white">
                <Briefcase size={18} />
                {stage}
              </h3>

              <p className="mb-2 text-sm text-gray-500 dark:text-gray-300">
                Deals: {stageData.length}
              </p>

              <p className="flex items-center gap-1 mb-4 font-bold text-green-600 dark:text-green-400">
                <IndianRupee size={16} />
                {totalValue.toLocaleString()}
              </p>

              <div className="space-y-2 overflow-y-auto max-h-60">
                {stageData.map((op) => (
                  <div
                    key={op._id}
                    className="p-3 transition border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <p className="font-medium text-gray-800 dark:text-white">{op.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Value: ₹{op.value?.toLocaleString()}
                    </p>
                  </div>
                ))}

                {stageData.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No opportunities
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-3">
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Total Opportunities</h3>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredOpportunities.length}</p>
        </div>
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Total Value</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ₹{filteredOpportunities.reduce((sum, o) => sum + (o.value || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-white shadow dark:bg-slate-800 rounded-xl">
          <h3 className="mb-1 font-semibold text-gray-800 dark:text-white">Closed Won</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {filteredOpportunities.filter((o) => o.stage === "Closed Won").length}
          </p>
        </div>
      </div>
    </div>
  );
}
