import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Users, ClipboardList, Package } from "lucide-react";
import API from "../services/api";

// Company logo
import companyLogo from "../assets/logo.png";

const ADMIN_EMAIL = "siva@readytechsolutions.in";

export default function Login() {
  const navigate = useNavigate();

  // Admin state
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

  /* ================= ADMIN LOGIN ================= */
  const handleAdminLogin = async (e) => {
    e.preventDefault();

    if (!adminPassword) {
      setAdminError("Password is required");
      return;
    }

    setAdminLoading(true);
    setAdminError("");

    try {
      const { data } = await API.post("/auth/login", {
        email: ADMIN_EMAIL,
        password: adminPassword,
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (err) {
      setAdminError(
        err.response?.data?.message || "Admin login failed"
      );
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-50">

      {/* ================= Floating Icons ================= */}
      <div className="absolute w-16 h-16 rounded-full bg-indigo-100/30 top-10 left-10 animate-bounce-slow blur-xl"></div>
      <div className="absolute w-20 h-20 rounded-full bg-purple-100/30 bottom-20 right-12 animate-pulse-slow blur-xl"></div>
      <div className="absolute w-12 h-12 rounded-full bg-pink-100/30 top-1/3 right-20 animate-spin-slow blur-xl"></div>

      {/* ================= Login Card ================= */}
      <div className="relative z-10 w-full max-w-sm p-8 bg-white border border-gray-200 shadow-2xl rounded-3xl">

        {/* ================= Company Info ================= */}
        <div className="mb-6 text-center">
          <img src={companyLogo} alt="Company Logo" className="w-20 h-20 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-900">ReadyTech CRM</h1>
          <p className="text-xs italic text-gray-500">
            Manage clients, sales, inventory, and employees efficiently.
          </p>
        </div>

        {/* ================= Floating CRM Icons ================= */}
        <div className="flex justify-around mb-4 text-indigo-500">
          <Users size={24} className="animate-float-up-down" />
          <ClipboardList size={24} className="delay-200 animate-float-up-down" />
          <Package size={24} className="animate-float-up-down delay-400" />
        </div>
        <p className="mb-4 text-xs text-center text-gray-400">
          Track users, sales orders, and inventory seamlessly
        </p>

        {/* ================= Admin Login Form ================= */}
        <h2 className="mb-3 text-lg font-semibold text-center text-gray-900">Admin Login</h2>

        {adminError && (
          <p className="mb-3 text-sm text-center text-red-500">{adminError}</p>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-3">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute text-indigo-500 left-3 top-3" />
            <input
              type="email"
              value={ADMIN_EMAIL}
              disabled
              className="w-full py-2.5 pl-10 pr-3 text-sm font-medium text-indigo-800 bg-indigo-100 cursor-not-allowed rounded-lg focus:outline-none"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute text-indigo-500 left-3 top-3" />
            <input
              type="password"
              placeholder="Enter your password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full py-2.5 pl-10 pr-3 text-sm font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={adminLoading}
            className="w-full py-2.5 font-semibold text-white bg-indigo-600 shadow-md rounded-lg hover:bg-indigo-700 transition"
          >
            {adminLoading ? "Signing in..." : "Login"}
          </button>
        </form>

        {/* ================= Footer ================= */}
        <div className="mt-5 text-xs text-center text-gray-400">
          &copy; {new Date().getFullYear()} ReadyTech Solutions. All rights reserved.
        </div>
      </div>
    </div>
  );
}
