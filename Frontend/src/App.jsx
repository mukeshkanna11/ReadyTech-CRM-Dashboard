import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardLayout from "./pages/Dashboard";

import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Leads from "./pages/Leads";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";

import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Default */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          }
        />

        {/* Protected */}
        <Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  }
/>


        <Route path="/clients" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
        <Route path="/auditlogs" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
