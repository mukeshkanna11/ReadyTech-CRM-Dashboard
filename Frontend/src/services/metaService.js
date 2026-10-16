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

export const subscribeMetaPage = async () => {
  const { data } = await API.post("/meta/subscribe-page");
  return data?.data;
};

/* ---------- Instagram Inbox (Instagram Login) ---------- */
export const getInstagramOAuthUrl = async () => {
  const { data } = await API.get("/meta/instagram/oauth/url");
  return data?.data?.url;
};

export const refreshInstagram = async () => {
  const { data } = await API.post("/meta/instagram/refresh");
  return data?.data;
};

export const subscribeInstagram = async () => {
  const { data } = await API.post("/meta/instagram/subscribe");
  return data?.data;
};

export const disconnectInstagram = async () => {
  const { data } = await API.post("/meta/instagram/disconnect");
  return data?.data;
};
