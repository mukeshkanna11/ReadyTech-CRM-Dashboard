import API from "./api";

/* =========================================================
   WHATSAPP INBOX API
   Reuses the shared axios instance (auth interceptor).
   No tokens or secrets ever reach the browser.
========================================================= */

export const getConversations = async ({ page = 1, limit = 20, search = "", unread = false, channel = "", status = "" } = {}) => {
  const { data } = await API.get("/whatsapp/conversations", {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(unread ? { unread: "true" } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    },
  });

  return { items: data?.data || [], pagination: data?.pagination };
};

export const getMessages = async (conversationId, { page = 1, limit = 30 } = {}) => {
  const { data } = await API.get(
    `/whatsapp/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );

  return {
    conversation: data?.data?.conversation || null,
    messages: data?.data?.messages || [],
    pagination: data?.pagination,
  };
};

export const sendMessage = async (conversationId, text, media = null) => {
  const { data } = await API.post(
    `/whatsapp/conversations/${conversationId}/messages`,
    { text, ...(media ? { media } : {}) }
  );

  return data?.data;
};

export const markRead = async (conversationId) => {
  const { data } = await API.patch(
    `/whatsapp/conversations/${conversationId}/read`
  );

  return data?.data;
};

export const syncWhatsApp = async () => {
  const { data } = await API.post("/whatsapp/sync");
  return data?.data;
};

/* ---------- Unified inbox actions ---------- */
export const updateConversation = async (id, patch) => {
  const { data } = await API.patch(`/whatsapp/conversations/${id}`, patch);
  return data?.data;
};

export const addNote = async (id, body) => {
  const { data } = await API.post(`/whatsapp/conversations/${id}/notes`, { body });
  return data?.data;
};

export const convertToLead = async (id) => {
  const { data } = await API.post(`/whatsapp/conversations/${id}/lead`);
  return data;
};

export const getAssignees = async () => {
  const { data } = await API.get("/whatsapp/assignees");
  return data?.data || [];
};

/* Authenticated media proxy → object URL (token stays in the header) */
export const getMediaUrl = async (conversationId, messageId) => {
  const { data } = await API.get(
    `/whatsapp/conversations/${conversationId}/messages/${messageId}/media`,
    { responseType: "blob" }
  );
  return URL.createObjectURL(data);
};

export const connectWhatsApp = async (payload) => {
  const { data } = await API.post("/whatsapp/connect", payload);
  return data?.data;
};

export const disconnectWhatsApp = async () => {
  const { data } = await API.post("/whatsapp/disconnect");
  return data?.data;
};
