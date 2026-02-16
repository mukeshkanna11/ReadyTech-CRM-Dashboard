import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import ProtectedRoute from "./components/ProtectedRoute";

/* ================== LAYOUT ================== */
import DashboardLayout from "./pages/DashboardLayout";

/* ================== AUTH ================== */
import Login from "./pages/Login";

/* ================== LAZY LOAD MODULES ================== */
/* Core CRM */
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const Clients = lazy(() => import("./pages/Clients"));
const Products = lazy(() => import("./pages/Products"));
const Leads = lazy(() => import("./pages/Leads"));
const Users = lazy(() => import("./pages/Users"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));

/* Billing */
const InvoiceList = lazy(() => import("./pages/InvoiceList"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const ViewInvoice = lazy(() => import("./pages/ViewInvoice"));
const InvoiceAnalytics = lazy(() => import("./pages/InvoiceAnalytics"));

/* Salesforce */
const SalesforceModule = lazy(() => import("./pages/SalesforceModule"));
const SalesforceDashboard = lazy(() => import("./pages/SalesforceDashboard"));
const LeadsTab = lazy(() => import("./components/LeadsTab"));
const OpportunitiesTab = lazy(() => import("./components/OpportunitiesTab"));
const ActivitiesTab = lazy(() => import("./components/ActivitiesTab"));

/* ERP / Stocks */
const StockProducts = lazy(() => import("./pages/Stcoks/Products"));
const Warehouses = lazy(() => import("./pages/Stcoks/Warehouses"));
const Vendors = lazy(() => import("./pages/Stcoks/Vendors"));
const PurchaseOrders = lazy(() => import("./pages/Stcoks/PurchaseOrders"));
const SalesOrders = lazy(() => import("./pages/Stcoks/SalesOrders"));
const Inventory = lazy(() => import("./pages/Stcoks/Inventory"));

/* Info / Settings */
const WhyReadyTech = lazy(() => import("./pages/WhyReadyTech"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

/* ================== LOADER ================== */
const Loader = () => (
  <div className="flex items-center justify-center h-screen text-lg font-semibold">
    Loading ReadyTech CRM...
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>

          {/* ================= PUBLIC ROUTES ================= */}
          <Route path="/login" element={<Login />} />

          {/* ================= PROTECTED AREA ================= */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Default Redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* ======================================================
                          CORE CRM MODULE
            ====================================================== */}
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<Clients />} />
            <Route path="products" element={<Products />} />
            <Route path="leads" element={<Leads />} />
            <Route path="users" element={<Users />} />
            <Route path="auditlogs" element={<AuditLogs />} />

            {/* ======================================================
                          BILLING MODULE
            ====================================================== */}
            <Route path="invoices">
              <Route index element={<InvoiceList />} />
              <Route path="create" element={<CreateInvoice />} />
              <Route path="analytics" element={<InvoiceAnalytics />} />
              <Route path=":id" element={<ViewInvoice />} />
            </Route>

            {/* ======================================================
                          SALESFORCE MODULE
            ====================================================== */}
            <Route path="salesforce" element={<SalesforceModule />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<SalesforceDashboard />} />
              <Route path="leads" element={<LeadsTab />} />
              <Route path="opportunities" element={<OpportunitiesTab />} />
              <Route path="activities" element={<ActivitiesTab />} />
            </Route>

            {/* ======================================================
                          ERP / STOCKS MODULE
            ====================================================== */}
            <Route path="stocks">
              <Route index element={<Navigate to="products" replace />} />
              <Route path="products" element={<StockProducts />} />
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="sales-orders" element={<SalesOrders />} />
              <Route path="inventory" element={<Inventory />} />
            </Route>

            {/* ======================================================
                          SETTINGS & INFO
            ====================================================== */}
            <Route path="why-readytech" element={<WhyReadyTech />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<ProfilePage />} />

          </Route>

          {/* ================= FALLBACK ================= */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </Suspense>
    </Router>
  );
}
