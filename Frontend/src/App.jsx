import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Leads from "./pages/Leads";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";
import WhyReadyTech from "./pages/WhyReadyTech";
import ContactPage from "./pages/ContactPage";  
import SettingsPage from "./pages/SettingsPage";
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Layout */}
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<Clients />} />
          <Route path="products" element={<Products />} />
          <Route path="leads" element={<Leads />} />
          <Route path="users" element={<Users />} />
          <Route path="auditlogs" element={<AuditLogs />} />
          <Route path="why-readytech" element={<WhyReadyTech />} />
          <Route path="/contact" element={<ContactPage />} />
<Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Redirect unknown paths */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
