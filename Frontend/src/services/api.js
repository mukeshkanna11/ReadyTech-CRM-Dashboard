import axios from "axios";
import { toast } from "react-hot-toast";

/* ======================================================
   BASE URL
====================================================== */
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000/api"
    : "https://readytech-crm-dashboard.onrender.com/api";

/* ======================================================
   AXIOS INSTANCE
====================================================== */
const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // enable only if cookies are used
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/* ======================================================
   REQUEST INTERCEPTOR
   Attach JWT token automatically
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
   RESPONSE INTERCEPTOR
   Global error handling (Enterprise Safe)
====================================================== */
API.interceptors.response.use(
  (response) => response,

  (error) => {
    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    switch (status) {
      case 401:
        // Prevent infinite loop
        if (!window.location.pathname.includes("/login")) {
          toast.error("Session expired. Please login again.");
          localStorage.removeItem("token");
          window.location.replace("/login");
        }
        break;

      case 403:
        toast.error("You don’t have permission to perform this action.");
        break;

      case 404:
        toast.error("Requested resource not found.");
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
        toast.error(data?.message || "Something went wrong.");
    }

    return Promise.reject(error);
  }
);

export default API;
