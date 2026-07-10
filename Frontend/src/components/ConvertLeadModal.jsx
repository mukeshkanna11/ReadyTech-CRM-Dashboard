import { useState } from "react";
import API from "../services/api";
import toast from "react-hot-toast";
import { X } from "lucide-react";

export default function ConvertLeadModal({ lead, onClose, onSuccess }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const convertLead = async () => {
    try {
      setLoading(true);
      await API.post(`/leads/${lead._id}/convert`, {
        title: `${lead.source || "Lead"} Deal`,
        value: Number(value),
      });
      toast.success("Lead converted successfully");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md p-6 space-y-4 bg-white rounded-xl">
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Convert Lead</h2>
          <X onClick={onClose} className="cursor-pointer" />
        </div>

        <div>
          <p className="text-sm text-gray-500">
            Lead: <strong>{lead.name}</strong>
          </p>
        </div>

        <input
          type="number"
          placeholder="Opportunity Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full p-2 border rounded"
        />

        <button
          onClick={convertLead}
          disabled={loading}
          className="w-full py-2 text-white bg-green-600 rounded"
        >
          {loading ? "Converting..." : "Convert to Opportunity"}
        </button>
      </div>
    </div>
  );
}
