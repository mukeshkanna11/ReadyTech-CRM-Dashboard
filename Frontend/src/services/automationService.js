import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/* =========================================================
   AUTOMATION API
========================================================= */

const automationApi = axios.create({
  baseURL: `${API_BASE_URL}/automations`,
  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================================================
   AUTH INTERCEPTOR
========================================================= */

automationApi.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

automationApi.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      console.warn("Automation API: Unauthorized");

      // Don't automatically logout here.
      // Your existing auth system should handle logout/session expiry.
    }

    return Promise.reject(error);
  }
);

/* =========================================================
   HELPERS
========================================================= */

const handleResponse = (response) => {
  return response?.data;
};

const handleError = (error) => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Something went wrong";

  throw new Error(message);
};

/* =========================================================
   GET ALL AUTOMATIONS
========================================================= */

export const getAutomations = async (params = {}) => {
  try {
    const response = await automationApi.get("/", {
      params,
    });

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   GET SINGLE AUTOMATION
========================================================= */

export const getAutomation = async (id) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.get(`/${id}`);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   CREATE AUTOMATION
========================================================= */

export const createAutomation = async (payload) => {
  try {
    if (!payload) {
      throw new Error("Automation data is required");
    }

    const response = await automationApi.post("/", payload);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   UPDATE AUTOMATION
========================================================= */

export const updateAutomation = async (id, payload) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    if (!payload) {
      throw new Error("Automation data is required");
    }

    const response = await automationApi.put(`/${id}`, payload);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   ACTIVATE AUTOMATION
========================================================= */

export const activateAutomation = async (id) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.post(`/${id}/activate`);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   PAUSE AUTOMATION
========================================================= */

export const pauseAutomation = async (id) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.post(`/${id}/pause`);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   DUPLICATE AUTOMATION
========================================================= */

export const duplicateAutomation = async (id) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.post(`/${id}/duplicate`);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   TEST AUTOMATION
========================================================= */

export const testAutomation = async (id, payload = {}) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.post(`/${id}/test`, payload);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   GET EXECUTION LOGS
========================================================= */

export const getAutomationExecutions = async (
  id,
  params = {}
) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.get(
      `/${id}/executions`,
      {
        params,
      }
    );

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   DELETE AUTOMATION
========================================================= */

export const deleteAutomation = async (id) => {
  try {
    if (!id) {
      throw new Error("Automation ID is required");
    }

    const response = await automationApi.delete(`/${id}`);

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   OPTIONAL: AUTOMATION STATS
   Use only if backend endpoint exists
========================================================= */

export const getAutomationStats = async (params = {}) => {
  try {
    const response = await automationApi.get("/stats", {
      params,
    });

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   OPTIONAL: AUTOMATION TEMPLATES
   Use only if backend endpoint exists
========================================================= */

export const getAutomationTemplates = async (params = {}) => {
  try {
    const response = await automationApi.get("/templates", {
      params,
    });

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   OPTIONAL: CREATE FROM TEMPLATE
========================================================= */

export const createAutomationFromTemplate = async (
  templateId,
  payload = {}
) => {
  try {
    if (!templateId) {
      throw new Error("Template ID is required");
    }

    const response = await automationApi.post(
      `/templates/${templateId}/create`,
      payload
    );

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   OPTIONAL: BULK ACTIONS
========================================================= */

export const bulkActivateAutomations = async (ids = []) => {
  try {
    const response = await automationApi.post(
      "/bulk/activate",
      {
        ids,
      }
    );

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

export const bulkPauseAutomations = async (ids = []) => {
  try {
    const response = await automationApi.post(
      "/bulk/pause",
      {
        ids,
      }
    );

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

export const bulkDeleteAutomations = async (ids = []) => {
  try {
    const response = await automationApi.post(
      "/bulk/delete",
      {
        ids,
      }
    );

    return handleResponse(response);
  } catch (error) {
    handleError(error);
  }
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default automationApi;