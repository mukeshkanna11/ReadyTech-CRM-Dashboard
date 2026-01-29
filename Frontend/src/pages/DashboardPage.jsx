// UltimateDashboard.jsx
import { useEffect, useState } from "react";
import { Users, Package, Truck, ShoppingCart, PieChart, DollarSign, Activity } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import CountUp from "react-countup"; // npm install react-countup

export default function UltimateDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({});
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [ordersTrend, setOrdersTrend] = useState([]);
  const [salesCategory, setSalesCategory] = useState([]);
  const [inventoryLevels, setInventoryLevels] = useState([]);
  const [latestOrders, setLatestOrders] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  const COLORS = ["#3b82f6", "#6366f1", "#f59e0b", "#ef4444", "#10b981"];

  const fetchData = async () => {
    setLoading(true);
    try {
      // MOCK DATA (replace with real API calls)
      const products = Array.from({ length: 120 }, (_, i) => ({ name: `Product ${i+1}`, qty: Math.floor(Math.random() * 100) }));
      const sales = Array.from({ length: 80 }, (_, i) => ({
        createdAt: new Date(Date.now() - i * 86400000),
        totalAmount: Math.floor(Math.random() * 1500 + 100),
        category: ["Mobile", "Watches", "Desktop"][i % 3],
        customer: `Customer ${i % 10 + 1}`
      }));
      const orders = Array.from({ length: 10 }, (_, i) => ({
        orderNumber: `SO-${1000 + i}`,
        customer: `Customer ${i+1}`,
        items: Math.floor(Math.random() * 10 + 1),
        status: i % 2 === 0 ? "Shipped" : "Pending",
      }));

      // Metrics
      setMetrics({
        products: products.length,
        salesOrders: sales.length,
        purchaseOrders: 40,
        users: 25,
        revenue: sales.reduce((sum, s) => sum + s.totalAmount, 0),
        shipments: orders.filter(o => o.status === "Shipped").length,
      });

      // Revenue trend
      const revenueMap = {};
      const ordersMap = {};
      sales.forEach(s => {
        const month = new Date(s.createdAt).toLocaleString("default", { month: "short" });
        revenueMap[month] = (revenueMap[month] || 0) + s.totalAmount;
        ordersMap[month] = (ordersMap[month] || 0) + 1;
      });
      setRevenueTrend(Object.keys(revenueMap).map(m => ({ month: m, revenue: revenueMap[m], orders: ordersMap[m] })));

      // Sales category
      const categoryMap = {};
      sales.forEach(s => categoryMap[s.category] = (categoryMap[s.category] || 0) + 1);
      setSalesCategory(Object.keys(categoryMap).map(k => ({ name: k, value: categoryMap[k] })));

      // Inventory levels
      setInventoryLevels(products.sort((a,b)=>b.qty-a.qty).slice(0,10));

      // Latest orders
      setLatestOrders(orders);

      // Top customers
      const customerMap = {};
      sales.forEach(s => customerMap[s.customer] = (customerMap[s.customer] || 0) + s.totalAmount);
      setTopCustomers(Object.entries(customerMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,total])=>({ name, total })));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="p-6 text-gray-500">Loading dashboard…</div>;

  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">

      {/* ================= KPI CARDS ================= */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Products" value={metrics.products} icon={Package} color="from-blue-400 to-blue-600"/>
        <MetricCard title="Sales Orders" value={metrics.salesOrders} icon={ShoppingCart} color="from-purple-400 to-purple-600"/>
        <MetricCard title="Purchase Orders" value={metrics.purchaseOrders} icon={Truck} color="from-indigo-400 to-indigo-600"/>
        <MetricCard title="Users" value={metrics.users} icon={Users} color="from-yellow-400 to-yellow-600"/>
        <MetricCard title="Revenue" value={`$${metrics.revenue}`} icon={DollarSign} color="from-green-400 to-green-600"/>
        <MetricCard title="Shipments" value={metrics.shipments} icon={Package} color="from-red-400 to-red-600"/>
      </div>

      {/* ================= TREND CHARTS ================= */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Revenue & Orders Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="month"/>
              <YAxis/>
              <Tooltip/>
              <Line dataKey="revenue" stroke="#3b82f6" strokeWidth={3} type="monotone"/>
              <Line dataKey="orders" stroke="#f59e0b" strokeWidth={3} type="monotone"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Sales by Category">
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie data={salesCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                {salesCategory.map((entry,index) => <Cell key={index} fill={COLORS[index % COLORS.length]}/>)}
              </Pie>
              <Legend/>
            </RePieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top Inventory">
          <BarChart width={300} height={250} data={inventoryLevels} margin={{top:5,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Bar dataKey="qty" fill="#6366f1" radius={[6,6,0,0]}/>
          </BarChart>
        </Card>
      </div>

      {/* ================= LATEST ORDERS ================= */}
      <Card title="Latest Orders" fullWidth>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Order #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Items</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {latestOrders.map((o,i)=>(
                <tr key={i} className="cursor-pointer hover:bg-gray-100">
                  <td className="px-4 py-2">{o.orderNumber}</td>
                  <td className="px-4 py-2">{o.customer}</td>
                  <td className="px-4 py-2">{o.items}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${o.status==="Shipped"?"bg-green-100 text-green-800":"bg-yellow-100 text-yellow-800"}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= TOP CUSTOMERS ================= */}
      <Card title="Top Customers">
        {topCustomers.map((c,i)=>(
          <div key={i} className="flex justify-between px-2 py-1 rounded-md hover:bg-gray-50">
            <span>{c.name}</span>
            <span className="font-semibold">${c.total}</span>
          </div>
        ))}
      </Card>

      {/* ================= ERP TOOLS ================= */}
      <Card title="ERP Tools">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {["Products","Inventory","Sales Orders","Purchase Orders","Users","Reports","Analytics","Shipments"].map((tool,i)=>(
            <div key={i} className="p-3 text-center text-gray-700 transition bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">{tool}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */
function Card({ title, children, fullWidth=false }) {
  return (
    <div className={`p-6 bg-white border shadow-lg rounded-xl ${fullWidth ? "w-full" : ""}`}>
      <h3 className="mb-4 text-lg font-semibold text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }) {
  return (
    <div className={`p-5 rounded-xl shadow-lg cursor-pointer transform transition hover:scale-105 bg-gradient-to-br ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <p className="mt-1 text-2xl font-bold">
            <CountUp end={value} duration={1.5} separator=","/>
          </p>
        </div>
        <Icon size={28} className="opacity-80"/>
      </div>
    </div>
  );
}
