import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock, Shield } from "lucide-react";
import API from "../services/api";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await API.post("/auth/register", form);

      // ✅ Go to login after success
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("REGISTER ERROR:", err);

      setError(
        err.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-sm p-8 bg-white shadow-xl rounded-xl">
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 text-xl font-bold text-white bg-indigo-600 rounded-xl">
            R
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-800">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-center text-slate-500">
          Start managing your business
        </p>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          {/* Name */}
          <div className="relative">
            <User size={16} className="absolute top-3 left-3 text-slate-400" />
            <input
              type="text"
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute top-3 left-3 text-slate-400" />
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute top-3 left-3 text-slate-400" />
            <input
              type="password"
              name="password"
              placeholder="Create password"
              value={form.password}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Role */}
          <div className="relative">
            <Shield size={16} className="absolute top-3 left-3 text-slate-400" />
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-sm text-center text-slate-600">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            className="font-medium text-indigo-600 cursor-pointer"
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}
