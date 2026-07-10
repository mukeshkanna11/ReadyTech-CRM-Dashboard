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


  } catch(err) {

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
      (s,i)=>s+i.qty*i.price,
      0
    ),
  0
);

  const summary = {
    total: orders.length,
    draft: orders.filter((o) => o.status === "DRAFT").length,
    approved: orders.filter((o) => o.status === "APPROVED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    pendingDelivery: orders.filter((o) => o.status === "APPROVED").length,
  };

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
      {/* HEADER */}
      {/* ================= PREMIUM HEADER ================= */}
<div className="relative p-6 overflow-hidden shadow-xl rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600">

  <div className="absolute rounded-full -right-20 -top-20 h-52 w-52 bg-white/10 blur-3xl" />

  <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

    <div className="flex items-center gap-4">

      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20">
        <FileText size={32} className="text-white"/>
      </div>

      <div>

        <h1 className="text-3xl font-bold text-white">
          Sales Orders
        </h1>

        <p className="mt-1 text-sm text-indigo-100">
          Manage orders, revenue, delivery and customer transactions
        </p>

      </div>

    </div>


    <button
      onClick={fetchOrders}
      className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl bg-white/20 backdrop-blur hover:bg-white/30"
    >
      <RefreshCcw size={17}/>
      Refresh
    </button>


  </div>

</div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

       <PremiumStat
  title="Total Orders"
  value={summary.total}
  icon={FileText}
  color="indigo"
/>

<PremiumStat
 title="Approved"
 value={summary.approved}
 icon={Clock}
 color="blue"
/>

<PremiumStat
 title="Delivered"
 value={summary.delivered}
 icon={Truck}
 color="emerald"
/>

<PremiumStat
 title="Pending Delivery"
 value={summary.pendingDelivery}
 icon={Clock}
 color="amber"
/>

<PremiumStat
 title="Revenue"
 value={`₹${revenue.toLocaleString()}`}
 icon={IndianRupee}
 color="violet"
/>
      </div>

     {/* ================= PREMIUM SEARCH + FILTER ================= */}
<div className="p-5 bg-white border shadow-sm rounded-2xl border-slate-200 dark:border-slate-800 dark:bg-slate-900">

  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">


    {/* Search */}
    <div className="relative w-full lg:w-96">

      <Search
        size={18}
        className="absolute left-3.5 top-3.5 text-slate-400"
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search order number or customer..."
        className="w-full py-3 pr-4 text-sm transition bg-white border outline-none rounded-xl border-slate-300 pl-11 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
      />

    </div>



    {/* Filters */}
    <div className="flex flex-wrap items-center gap-3">


      {/* Status */}
      <div className="relative">

        <select
          value={statusFilter}
          onChange={(e)=>setStatusFilter(e.target.value)}
          className="px-4 py-3 pr-10 text-sm font-medium bg-white border outline-none appearance-none rounded-xl border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800"
        >

          <option value="ALL">
            All Status
          </option>

          <option value="DRAFT">
            Draft
          </option>

          <option value="APPROVED">
            Approved
          </option>

          <option value="DELIVERED">
            Delivered
          </option>

          <option value="CANCELLED">
            Cancelled
          </option>

        </select>

      </div>



      {/* Quick Filters */}

      <button
        onClick={()=>setStatusFilter("APPROVED")}
        className="px-4 py-3 text-sm font-semibold text-indigo-600 transition rounded-xl bg-indigo-50 hover:bg-indigo-100"
      >
        Approved
      </button>


      <button
        onClick={()=>setStatusFilter("DELIVERED")}
        className="px-4 py-3 text-sm font-semibold transition rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
      >
        Delivered
      </button>


      <button
        onClick={()=>{
          setSearch("");
          setStatusFilter("ALL");
        }}
        className="px-4 py-3 text-sm font-semibold transition border rounded-xl text-slate-600 hover:bg-slate-100 dark:border-slate-700"
      >
        Clear
      </button>


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

          {filteredOrders.map((so)=>{

            const totalQty = so.items.reduce(
              (s,i)=>s+i.qty,
              0
            );


            const totalAmt = so.items.reduce(
              (s,i)=>s+(i.qty*i.price),
              0
            );


            const customerName =
              so.customer?.name || "Unknown";


            const initials =
              customerName
              .split(" ")
              .map(x=>x[0])
              .join("")
              .slice(0,2)
              .toUpperCase();



            return (

              <tr
                key={so._id}
                onClick={()=>toast(`SO ${so.soNumber}`)}
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

                      <FileText size={15}/>

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

                      <Users size={14}/>

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
  icon: Icon,
  color = "slate",
}) {

  const styles = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
    blue: "bg-blue-100 text-blue-600",
  };


  return (
    <div
      className="p-5 transition-all duration-300 bg-white border shadow-sm group rounded-2xl border-slate-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs font-medium text-slate-500">
            {title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </h2>

        </div>


        <div
          className={`rounded-2xl p-3 ${styles[color]} transition group-hover:scale-110`}
        >
          <Icon size={24}/>
        </div>


      </div>


      <p className="mt-4 text-xs text-slate-400">
        Updated this month
      </p>


    </div>
  );
}



function Th({ children }) {

  return (

    <th
      className="px-5 py-4 text-xs font-semibold tracking-wider text-left uppercase text-slate-500 dark:text-slate-300"
    >
      {children}
    </th>

  );

}



function Td({
  children,
  className = ""
}) {

  return (

    <td
      className={`
      px-5
      py-4
      ${className}
      `}
    >
      {children}
    </td>

  );

}



function Loader() {

  return (

    <div className="p-6 space-y-4">

      {[1,2,3,4].map((item)=>(

        <div
          key={item}
          className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
        />

      ))}

    </div>

  );

}



function Empty() {

  return (

    <div className="flex flex-col items-center justify-center py-16">


      <div className="p-5 mb-5 bg-indigo-100 rounded-full dark:bg-indigo-900/30">

        <FileText
          size={40}
          className="text-indigo-600"
        />

      </div>



      <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
        No Sales Orders Found
      </h3>



      <p className="mt-2 text-sm text-slate-500">
        Orders will appear here once customers place new orders.
      </p>


    </div>

  );

}
