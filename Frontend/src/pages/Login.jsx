import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import API from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await API.post("/auth/login", { email, password });

      // Save JWT token in localStorage
      localStorage.setItem("token", res.data.token);

      // Redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      if (err.response) {
        setError(err.response.data.message || "Login failed");
      } else {
        setError("Network error. Try again later.");
      }
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

        <h2 className="text-2xl font-bold text-center text-slate-800">Sign in to CRM</h2>
        <p className="mt-1 text-sm text-center text-slate-500">Manage your business smarter</p>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute top-3 left-3 text-slate-400" />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute top-3 left-3 text-slate-400" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-sm text-center text-slate-600">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            className="font-medium text-indigo-600 cursor-pointer"
          >
            Create one
          </span>
        </p>
      </div>
    </div>
  );
}
