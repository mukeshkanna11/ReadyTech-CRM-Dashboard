import API from "./api";

/* =========================================================
   META INTEGRATION API
   Reuses the shared axios instance (auth token interceptor).
   No Meta secrets or access tokens ever reach the frontend.
========================================================= */

export const getMetaStatus = async () => {
  const { data } = await API.get("/meta/status");
  return data?.data;
};

export const getMetaOAuthUrl = async () => {
  const { data } = await API.get("/meta/oauth/url");
  return data?.data?.url;
};

export const refreshMetaConnection = async () => {
  const { data } = await API.post("/meta/refresh");
  return data?.data;
};

export const disconnectMeta = async () => {
  const { data } = await API.post("/meta/disconnect");
  return data?.data;
};
