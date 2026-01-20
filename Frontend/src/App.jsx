import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

/* ================== LAYOUT ================== */
import DashboardLayout from "./pages/DashboardLayout";

/* ================== CORE PAGES ================== */
import DashboardPage from "./pages/DashboardPage";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Leads from "./pages/Leads";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";

/* ================== AUTH ================== */
import Login from "./pages/Login";
import Register from "./pages/Register";

/* ================== INFO / SETTINGS ================== */
import WhyReadyTech from "./pages/WhyReadyTech";
import ContactPage from "./pages/ContactPage";
import SettingsPage from "./pages/SettingsPage";
import Notifications from "./pages/Notifications";
import ProfilePage from "./pages/ProfilePage";

/* ================== SALESFORCE ================== */
import SalesforceModule from "./pages/SalesforceModule";
import SalesforceDashboard from "./pages/SalesforceDashboard";
import LeadsTab from "./components/LeadsTab";
import OpportunitiesTab from "./components/OpportunitiesTab";
import ActivitiesTab from "./components/ActivitiesTab";

/* ================== PROTECTION ================== */
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* ================= PUBLIC ROUTES ================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ================= PROTECTED ROUTES ================= */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Default redirect */}
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* ===== MAIN CRM PAGES ===== */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<Clients />} />
          <Route path="products" element={<Products />} />
          <Route path="leads" element={<Leads />} />
          <Route path="users" element={<Users />} />
          <Route path="auditlogs" element={<AuditLogs />} />

          {/* ===== SALESFORCE MODULE ===== */}
          <Route path="salesforce" element={<SalesforceModule />}>
            {/* Default tab redirect */}
            <Route index element={<Navigate to="leads" replace />} />

            {/* Tabs as separate routes */}
            <Route path="dashboard" element={<SalesforceDashboard />} />
            <Route path="leads" element={<LeadsTab />} />
            <Route path="opportunities" element={<OpportunitiesTab />} />
            <Route path="activities" element={<ActivitiesTab />} />
          </Route>

          {/* ===== SETTINGS & INFO ===== */}
          <Route path="why-readytech" element={<WhyReadyTech />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
