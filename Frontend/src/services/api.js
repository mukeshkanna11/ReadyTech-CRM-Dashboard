import axios from "axios";
import { toast } from "react-hot-toast";

// Create Axios instance
const API = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:5000/api"
      : "https://readytech-crm-dashboard.onrender.com/api",
  withCredentials: true, // necessary if backend uses cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// ================= REQUEST INTERCEPTOR =================
// Automatically attach token to all requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ================= RESPONSE INTERCEPTOR =================
// Handle 401 unauthorized globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      if (status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.removeItem("token"); // remove old token
        // Optionally redirect to login
        window.location.href = "/login";
      } else if (status === 403) {
        toast.error("You do not have permission to perform this action.");
      } else if (status >= 500) {
        toast.error("Server error. Try again later.");
      }
    } else {
      toast.error("Network error. Check your connection.");
    }
    return Promise.reject(error);
  }
);

export default API;
