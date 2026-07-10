import axios from "axios";
import { toast } from "react-hot-toast";

/* ======================================================
   BASE URL (ENV-FIRST, FAIL SAFE)
====================================================== */
const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  console.error(
    "❌ VITE_API_URL is missing. Check Netlify / .env configuration"
  );
}

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const API = axios.create({
  baseURL: BASE_URL, // e.g. https://readytech-crm-backend.onrender.com
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: false, // set true ONLY if using cookies
});

/* ======================================================
   REQUEST INTERCEPTOR
====================================================== */
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

/* ======================================================
   RESPONSE INTERCEPTOR (ENTERPRISE SAFE)
====================================================== */
API.interceptors.response.use(
  (response) => {
    // 🔒 Guard: backend must return JSON
    const contentType = response.headers["content-type"];

    if (
      contentType &&
      !contentType.includes("application/json")
    ) {
      console.error("❌ Non-JSON response received:", response);
      throw new Error("Invalid JSON response from server");
    }

    return response;
  },

  (error) => {
    // 🌐 Network / CORS / Server down
    if (!error.response) {
      toast.error("Server unreachable. Please try again later.");
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    switch (status) {
      case 401:
        if (!window.location.pathname.includes("/login")) {
          toast.error("Session expired. Please login again.");
          localStorage.removeItem("token");
          window.location.replace("/login");
        }
        break;

      case 403:
        toast.error("Access denied.");
        break;

      case 404:
        toast.error("API endpoint not found.");
        break;

      case 422:
        toast.error(data?.message || "Validation error.");
        break;

      case 500:
      case 502:
      case 503:
        toast.error("Server error. Please try again later.");
        break;

      default:
        toast.error(data?.message || "Unexpected error occurred.");
    }

    return Promise.reject(error);
  }
);

export default API;
