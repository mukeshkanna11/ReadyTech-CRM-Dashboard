import { useEffect, useState } from "react";
import API from "../services/api";

export default function InvoiceAnalytics() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const res = await API.get("/invoices");
    const invoices = res.data.data || res.data;

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + (inv.grandTotal || 0),
      0
    );

    const paid = invoices.filter(
      (i) => i.status === "Paid"
    ).length;

    const pending = invoices.filter(
      (i) => i.status === "Partially Paid"
    ).length;

    const overdue = invoices.filter(
      (i) => i.status === "Overdue"
    ).length;

    setStats({
      totalRevenue,
      paid,
      pending,
      overdue,
    });
  };

  return (
    <div className="grid grid-cols-4 gap-6 p-10">
      <div className="p-6 bg-white shadow rounded-xl">
        <h3>Total Revenue</h3>
        <p className="text-xl font-bold">
          ₹ {stats.totalRevenue}
        </p>
      </div>

      <div className="p-6 bg-green-100 rounded-xl">
        Paid: {stats.paid}
      </div>

      <div className="p-6 bg-yellow-100 rounded-xl">
        Partial: {stats.pending}
      </div>

      <div className="p-6 bg-red-100 rounded-xl">
        Overdue: {stats.overdue}
      </div>
    </div>
  );
}
