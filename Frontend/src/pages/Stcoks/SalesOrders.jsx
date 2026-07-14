import { useEffect, useMemo, useState } from "react";
import API from "../../services/api";
import { toast } from "react-hot-toast";
import {
  Users,
  Search,
  RefreshCcw,
  IndianRupee,
  FileText,
  Truck,
  Clock,
  CheckCircle,
  Package,
  Download,
  TrendingUp,
  Plus,
} from "lucide-react";

export default function SalesOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  /* ================= FETCH ================= */
  const fetchOrders = async () => {
    try {

      setLoading(true);

      const res = await API.get("/sales");

      console.log("Sales Orders:", res.data);


      const salesData =
        Array.isArray(res.data)
          ? res.data
          : res.data.orders ||
          res.data.sales ||
          res.data.salesOrders ||
          res.data.data ||
          [];


      console.log("Final Orders Array:", salesData);


      setOrders(salesData);


    } catch (err) {

      console.log(err);
      toast.error("Failed to fetch sales orders");

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {
    fetchOrders();
  }, []);

  /* ================= FILTER ================= */
  const filteredOrders = useMemo(() => {

    return (Array.isArray(orders) ? orders : []).filter((so) => {
      const matchSearch =
        so.soNumber?.toLowerCase().includes(search.toLowerCase()) ||
        so.customer?.name?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || so.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  /* ================= KPI DATA ================= */
  const revenue = orders.reduce(
    (sum, so) =>
      sum +
      (so.items || []).reduce(
        (s, i) => s + i.qty * i.price,
        0
      ),
    0
  );

  const summary = {
    total: filteredOrders.length,
    approved: filteredOrders.filter(o => o.status === "Approved").length,
    pending: filteredOrders.filter(o => o.status === "Pending").length,
    delivered: filteredOrders.filter(o => o.status === "Delivered").length,
    pendingDelivery: filteredOrders.filter(o => o.deliveryStatus !== "Delivered").length,
    customers: new Set(
      filteredOrders.map(o => o.customer?.name)
    ).size,
  };

  const averageOrder =
    summary.total > 0
      ? Math.round(revenue / summary.total)
      : 0;

  /* ================= STATUS UI ================= */
  const statusStyle = {
    DRAFT: "bg-amber-100 text-amber-700",
    APPROVED: "bg-indigo-100 text-indigo-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
  };

  /* ================= UI ================= */
  return (
    <div className="space-y-5">

      {/* ================= ENTERPRISE SALES ORDER HEADER ================= */}
      <div className="relative p-8 overflow-hidden text-white shadow-2xl rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900">

        {/* Background Effects */}
        <div className="absolute rounded-full -top-24 -right-24 h-72 w-72 bg-cyan-400/10 blur-3xl" />
        <div className="absolute rounded-full -bottom-24 -left-24 h-72 w-72 bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_45%)]" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">

          {/* Left */}
          <div className="flex items-start gap-5">

            <div className="flex items-center justify-center w-20 h-20 border rounded-3xl border-white/20 bg-white/10 backdrop-blur">
              <FileText size={38} className="text-cyan-300" />
            </div>

            <div>

              <div className="flex flex-wrap items-center gap-2 mb-3">

                <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase border rounded-full border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
                  Enterprise ERP
                </span>

                <span className="px-3 py-1 text-xs font-semibold border rounded-full border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                  Live Order Management
                </span>

              </div>

              <h1 className="text-4xl font-bold tracking-tight">
                Sales Order Management
              </h1>

              <p className="max-w-3xl mt-3 text-sm leading-7 text-slate-300">

                Centralized platform to manage customer orders, quotations,
                invoicing, fulfillment, dispatch tracking, payment collection,
                revenue monitoring and order lifecycle management across the
                organization.

              </p>

              {/* Enterprise Highlights */}
              <div className="flex flex-wrap gap-5 mt-6 text-sm">

                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Order Processing
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" />
                  Customer Management
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  Revenue Tracking
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  Delivery Monitoring
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  Invoice Integration
                </div>

              </div>

            </div>

          </div>

          {/* Right */}
          <div className="flex flex-wrap items-center justify-end gap-4">

            <button
              onClick={fetchOrders}
              className="flex h-14 min-w-[170px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 font-semibold backdrop-blur transition hover:-translate-y-1 hover:bg-white/20"
            >
              <RefreshCcw
                size={18}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              className="flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 font-semibold shadow-xl transition hover:-translate-y-1"
            >
              <Plus size={18} />
              Create Sales Order
            </button>

            <button
              className="flex h-14 min-w-[170px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 font-semibold backdrop-blur transition hover:-translate-y-1 hover:bg-white/20"
            >
              <Download size={18} />
              Export
            </button>

          </div>

        </div>

      </div>

      {/* ================= ENTERPRISE KPI SECTION ================= */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">

        <PremiumStat
          title="Total Orders"
          value={summary.total}
          subtitle="All Sales Orders"
          icon={FileText}
          color="indigo"
          trend="+12.5%"
        />

        <PremiumStat
          title="Approved"
          value={summary.approved}
          subtitle="Ready for Processing"
          icon={CheckCircle}
          color="emerald"
          trend="+8.4%"
        />

        <PremiumStat
          title="Pending Approval"
          value={summary.pending}
          subtitle="Awaiting Review"
          icon={Clock}
          color="amber"
          trend="-3.2%"
        />

        <PremiumStat
          title="Delivered"
          value={summary.delivered}
          subtitle="Completed Orders"
          icon={Truck}
          color="green"
          trend="+18.7%"
        />

        <PremiumStat
          title="Pending Delivery"
          value={summary.pendingDelivery}
          subtitle="In Progress"
          icon={Package}
          color="orange"
          trend="+2.1%"
        />

        <PremiumStat
          title="Revenue"
          value={`₹${revenue.toLocaleString()}`}
          subtitle="Sales Revenue"
          icon={IndianRupee}
          color="violet"
          trend="+15.8%"
        />

        <PremiumStat
          title="Average Order"
          value={`₹${averageOrder.toLocaleString()}`}
          subtitle="Avg Order Value"
          icon={TrendingUp}
          color="cyan"
          trend="+6.4%"
        />

        <PremiumStat
          title="Customers"
          value={summary.customers}
          subtitle="Active Customers"
          icon={Users}
          color="blue"
          trend="+11.2%"
        />

      </div>


      {/* ================= ENTERPRISE SEARCH & FILTER BAR ================= */}
      <div className="p-6 bg-white border shadow-xl rounded-3xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          {/* Left */}
          <div className="flex flex-col flex-1 gap-4 lg:flex-row lg:items-center">

            {/* Search */}
            <div className="relative w-full lg:w-[420px]">

              <Search
                size={20}
                className="absolute left-4 top-4 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Sales Order, Customer, Invoice..."
                className="w-full rounded-2xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800"
              />

            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Date */}
            <input
              type="date"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800"
            />

            {/* Sort */}
            <select
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800"
            >
              <option>Newest First</option>
              <option>Oldest First</option>
              <option>Highest Amount</option>
              <option>Lowest Amount</option>
            </select>

          </div>

          {/* Right */}
          <div className="flex flex-wrap items-center gap-3">

            <button
              onClick={() => setStatusFilter("APPROVED")}
              className="px-5 py-3 text-sm font-semibold text-indigo-700 transition rounded-2xl bg-indigo-50 hover:bg-indigo-100"
            >
              Approved
            </button>

            <button
              onClick={() => setStatusFilter("DELIVERED")}
              className="px-5 py-3 text-sm font-semibold transition rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Delivered
            </button>

            <button
              onClick={() => setStatusFilter("PENDING")}
              className="px-5 py-3 text-sm font-semibold transition rounded-2xl bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              Pending
            </button>

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
              className="px-5 py-3 text-sm font-semibold transition border rounded-2xl border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700"
            >
              Clear Filters
            </button>

          </div>

        </div>

        {/* Bottom Info */}
        <div className="flex flex-col gap-3 pt-5 mt-5 text-sm border-t border-slate-200 lg:flex-row lg:items-center lg:justify-between dark:border-slate-700">

          <div className="flex flex-wrap items-center gap-3">

            <span className="px-3 py-1 font-medium text-indigo-700 bg-indigo-100 rounded-full">
              {filteredOrders.length} Orders
            </span>

            <span className="px-3 py-1 font-medium rounded-full bg-emerald-100 text-emerald-700">
              Revenue ₹{revenue.toLocaleString()}
            </span>

            <span className="px-3 py-1 font-medium rounded-full bg-amber-100 text-amber-700">
              Status : {statusFilter}
            </span>

          </div>

          <div className="text-sm text-slate-500">
            Last Updated : {new Date().toLocaleString()}
          </div>

        </div>

      </div>


      {/* ================= PREMIUM SALES ORDER TABLE ================= */}
      <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">

        {loading ? (
          <Loader />
        ) : filteredOrders.length === 0 ? (
          <Empty />
        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="bg-slate-50 dark:bg-slate-800">

                <tr>

                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Items</Th>
                  <Th>Quantity</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Created By</Th>

                </tr>

              </thead>


              <tbody>

                {filteredOrders.map((so) => {

                  const totalQty = so.items.reduce(
                    (s, i) => s + i.qty,
                    0
                  );


                  const totalAmt = so.items.reduce(
                    (s, i) => s + (i.qty * i.price),
                    0
                  );


                  const customerName =
                    so.customer?.name || "Unknown";


                  const initials =
                    customerName
                      .split(" ")
                      .map(x => x[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();



                  return (

                    <tr
                      key={so._id}
                      onClick={() => toast(`SO ${so.soNumber}`)}
                      className="transition border-t cursor-pointer hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >


                      {/* ORDER */}
                      <Td>

                        <div>

                          <p className="font-semibold text-indigo-600">
                            {so.soNumber}
                          </p>

                          <p className="text-xs text-slate-400">
                            Sales Order
                          </p>

                        </div>

                      </Td>




                      {/* CUSTOMER */}
                      <Td>

                        <div className="flex items-center gap-3">


                          <div
                            className="flex items-center justify-center w-10 h-10 text-sm font-bold text-white rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600"
                          >
                            {initials}
                          </div>


                          <div>

                            <p className="font-semibold text-slate-800 dark:text-white">
                              {customerName}
                            </p>

                            <p className="text-xs text-slate-400">
                              Customer
                            </p>

                          </div>


                        </div>

                      </Td>





                      {/* ITEMS */}
                      <Td>

                        <div className="flex items-center gap-2">

                          <div className="p-2 text-blue-600 bg-blue-100 rounded-lg">

                            <FileText size={15} />

                          </div>


                          <span>
                            {so.items.length} items
                          </span>

                        </div>

                      </Td>





                      {/* QTY */}
                      <Td>

                        <span className="font-bold">
                          {totalQty}
                        </span>

                        <span className="ml-1 text-xs text-slate-400">
                          units
                        </span>

                      </Td>





                      {/* AMOUNT */}
                      <Td>

                        <div>

                          <p className="font-bold text-emerald-600">
                            ₹{totalAmt.toLocaleString()}
                          </p>

                          <p className="text-xs text-slate-400">
                            Order Value
                          </p>

                        </div>


                      </Td>





                      {/* STATUS */}
                      <Td>

                        <span
                          className={`
                    inline-flex
                    rounded-full
                    px-3
                    py-1
                    text-xs
                    font-semibold
                    ${statusStyle[so.status]}
                    `}
                        >

                          {so.status}

                        </span>


                      </Td>





                      {/* DATE */}
                      <Td>

                        <p className="text-slate-500">
                          {new Date(
                            so.createdAt
                          ).toLocaleDateString()}
                        </p>

                      </Td>





                      {/* USER */}
                      <Td>

                        <div className="flex items-center gap-2">

                          <div className="p-2 rounded-lg bg-slate-100">

                            <Users size={14} />

                          </div>


                          <span>
                            {so.createdBy?.name || "-"}
                          </span>

                        </div>


                      </Td>



                    </tr>

                  );


                })}


              </tbody>


            </table>

          </div>

        )}

      </div>
    </div>
  );
}

/* ================= PREMIUM UI PARTS ================= */

function PremiumStat({
  title,
  value,
  subtitle = "Compared to last month",
  trend = "+12.4%",
  positive = true,
  icon: Icon,
  color = "slate",
}) {

  const styles = {
    slate: "from-slate-500 to-slate-700",
    indigo: "from-indigo-500 to-violet-600",
    emerald: "from-emerald-500 to-green-600",
    amber: "from-amber-500 to-orange-500",
    violet: "from-violet-500 to-fuchsia-600",
    blue: "from-blue-500 to-cyan-600",
    red: "from-red-500 to-rose-600",
  };

  return (

    <div className="relative p-6 overflow-hidden transition-all duration-300 bg-white border shadow-lg group rounded-3xl border-slate-200 hover:-translate-y-2 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900">

      <div className="absolute w-32 h-32 rounded-full -right-8 -top-8 bg-gradient-to-br from-white/30 to-transparent opacity-20 blur-2xl" />

      <div className="relative flex items-start justify-between">

        <div>

          <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
            {title}
          </p>

          <h2 className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {subtitle}
          </p>

        </div>

        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r ${styles[color]} text-white shadow-lg transition duration-300 group-hover:scale-110 group-hover:rotate-6`}
        >
          <Icon size={30} />
        </div>

      </div>

      <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${positive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
            }`}
        >
          {trend}
        </span>

        <span className="text-xs text-slate-400">
          Updated 2 min ago
        </span>

      </div>

    </div>

  );

}


function Th({ children }) {

  return (

    <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">

      {children}

    </th>

  );

}



function Td({ children, className = "" }) {

  return (

    <td
      className={`px-6 py-5 align-middle text-sm text-slate-700 dark:text-slate-200 ${className}`}
    >
      {children}
    </td>

  );

}



function Loader() {

  return (

    <div className="p-8 space-y-4">

      {[1, 2, 3, 4, 5].map((i) => (

        <div
          key={i}
          className="flex items-center gap-4 p-4 border rounded-2xl border-slate-200 dark:border-slate-800"
        >

          <div className="w-12 h-12 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />

          <div className="flex-1 space-y-2">

            <div className="w-48 h-4 rounded animate-pulse bg-slate-200 dark:bg-slate-700" />

            <div className="h-3 rounded w-72 animate-pulse bg-slate-100 dark:bg-slate-800" />

          </div>

          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />

        </div>

      ))}

    </div>

  );

}



function Empty() {

  return (

    <div className="flex flex-col items-center justify-center py-24">

      <div className="flex items-center justify-center rounded-full shadow-2xl h-28 w-28 bg-gradient-to-r from-indigo-500 to-violet-600">

        <FileText
          size={52}
          className="text-white"
        />

      </div>

      <h2 className="mt-8 text-2xl font-bold text-slate-900 dark:text-white">
        No Sales Orders Available
      </h2>

      <p className="max-w-md mt-3 text-sm leading-7 text-center text-slate-500">
        No sales orders match your current search or filters.
        Create a new sales order to start tracking customer purchases,
        invoicing, fulfillment, and revenue.
      </p>

      <button
        className="px-6 py-3 mt-8 font-semibold text-white transition shadow-lg rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:-translate-y-1 hover:shadow-2xl"
      >
        Create Sales Order
      </button>

    </div>

  );

}