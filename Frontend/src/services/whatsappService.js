import API from "./api";

/* =========================================================
   WHATSAPP INBOX API
   Reuses the shared axios instance (auth interceptor).
   No tokens or secrets ever reach the browser.
========================================================= */

export const getConversations = async ({ page = 1, limit = 20, search = "", unread = false } = {}) => {
  const { data } = await API.get("/whatsapp/conversations", {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
      ...(unread ? { unread: "true" } : {}),
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

export const sendMessage = async (conversationId, text) => {
  const { data } = await API.post(
    `/whatsapp/conversations/${conversationId}/messages`,
    { text }
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
