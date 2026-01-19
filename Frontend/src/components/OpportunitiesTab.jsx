import { useEffect, useState } from "react";
import API from "../../services/api";
import { Briefcase, IndianRupee } from "lucide-react";

const STAGES = [
  "Prospecting",
  "Proposal",
  "Closed Won",
  "Closed Lost",
];

export default function OpportunitiesTab() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const fetchOpportunities = async () => {
    try {
      const res = await API.get("/opportunities");
      setOpportunities(res.data.data || []);
    } catch (err) {
      console.error("Fetch opportunities error", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading opportunities...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      {STAGES.map((stage) => {
        const stageData = opportunities.filter(
          (o) => o.stage === stage
        );

        const totalValue = stageData.reduce(
          (sum, o) => sum + (o.value || 0),
          0
        );

        return (
          <div
            key={stage}
            className="p-4 bg-white shadow rounded-2xl"
          >
            <h3 className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
              <Briefcase size={18} />
              {stage}
            </h3>

            <p className="mb-2 text-sm text-gray-500">
              Deals: {stageData.length}
            </p>

            <p className="flex items-center gap-1 mb-4 font-bold text-green-600">
              <IndianRupee size={16} />
              {totalValue.toLocaleString()}
            </p>

            <div className="space-y-3">
              {stageData.map((op) => (
                <div
                  key={op._id}
                  className="p-3 border rounded-lg hover:bg-gray-50"
                >
                  <p className="font-medium">{op.title}</p>
                  <p className="text-xs text-gray-500">
                    Value: ₹{op.value?.toLocaleString()}
                  </p>
                </div>
              ))}

              {stageData.length === 0 && (
                <p className="text-xs text-gray-400">
                  No opportunities
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
