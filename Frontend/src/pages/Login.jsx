import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import API from "../services/api";
import companyLogo from "../assets/Rtech-logo.png";

const ADMIN_EMAIL = "siva@readytechsolutions.in";

export default function Login() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      navigate("/dashboard");
    }

    const savedPassword = localStorage.getItem("rememberPassword");

    if (savedPassword) {
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data } = await API.post("/auth/login", {
        email: ADMIN_EMAIL,
        password,
      });

      if (rememberMe) {
        localStorage.setItem("rememberPassword", password);
      } else {
        localStorage.removeItem("rememberPassword");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/dashboard");
    } catch (err) {
      setError(
        err?.response?.data?.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950" />

      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[140px]" />

      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[140px]" />

      <div className="relative z-10 flex min-h-screen">

        {/* LEFT SIDE */}
        <div className="items-center justify-center hidden px-16 lg:flex lg:w-1/2">

          <div className="max-w-xl text-white">

            <img
              src={companyLogo}
              alt="ReadyTech"
              className="w-24 h-24 mb-8"
            />

            <h1 className="text-5xl font-black leading-tight">
              ReadyTechSolutions
            </h1>

            <h2 className="mt-2 text-3xl font-semibold text-indigo-300">
              CRM & ERP Platform
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              Manage leads, customers, inventory,
              projects, employees, invoices and business
              operations from one powerful dashboard.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-10">

              <div className="p-5 border rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl">
                <CheckCircle2 className="mb-3 text-green-400" />
                <h3 className="font-semibold">
                  CRM Management
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Leads & Customers
                </p>
              </div>

              <div className="p-5 border rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl">
                <CheckCircle2 className="mb-3 text-blue-400" />
                <h3 className="font-semibold">
                  Inventory
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Products & Stock
                </p>
              </div>

              <div className="p-5 border rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl">
                <CheckCircle2 className="mb-3 text-purple-400" />
                <h3 className="font-semibold">
                  Projects
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Workflow Tracking
                </p>
              </div>

              <div className="p-5 border rounded-2xl bg-white/5 border-white/10 backdrop-blur-xl">
                <CheckCircle2 className="mb-3 text-pink-400" />
                <h3 className="font-semibold">
                  Reports
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Business Analytics
                </p>
              </div>

            </div>

          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center justify-center flex-1 p-6">

          <div className="w-full max-w-md">

            <div className="p-8 border shadow-2xl bg-white/95 backdrop-blur-xl rounded-3xl border-white/20">

              <div className="mb-8 text-center">

                <img
                  src={companyLogo}
                  alt="ReadyTech"
                  className="w-20 h-20 mx-auto mb-4"
                />

                <h2 className="text-3xl font-bold text-slate-900">
                  Welcome Back
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Sign in to continue to your dashboard
                </p>

              </div>

              {error && (
                <div className="p-3 mb-4 text-sm text-red-600 border border-red-200 rounded-xl bg-red-50">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleLogin}
                className="space-y-5"
              >
                {/* Email */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-slate-700">
                    Admin Email
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute text-indigo-500 left-4 top-4"
                    />

                    <input
                      value={ADMIN_EMAIL}
                      disabled
                      className="w-full py-3 pr-4 font-medium border pl-11 rounded-xl bg-slate-100 text-slate-700"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-slate-700">
                    Password
                  </label>

                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute text-indigo-500 left-4 top-4"
                    />

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter your password"
                      className="w-full py-3 pr-12 border pl-11 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-4 top-4"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between">

                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() =>
                        setRememberMe(
                          !rememberMe
                        )
                      }
                    />
                    Remember Me
                  </label>

                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <ShieldCheck size={14} />
                    Secure Login
                  </div>

                </div>

                {/* Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center w-full gap-2 py-3 font-semibold text-white transition-all shadow-lg rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01]"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      Login
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

              </form>

              <div className="pt-6 mt-8 border-t">

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                  <ShieldCheck size={14} />
                  Enterprise Protected Access
                </div>

                <p className="mt-3 text-xs text-center text-slate-400">
                  © {new Date().getFullYear()} ReadyTech
                  Solutions. All rights reserved.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}