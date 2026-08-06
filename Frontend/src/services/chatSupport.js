import API from "./api";

/* ======================================================
   CHAT SUPPORT API
   Thin wrapper over /api/chat/conversations/*.
====================================================== */

const SESSION_KEY = "rt_chat_session_id";

/** Stable per-browser session id so the transcript survives a page reload. */
export const getSessionId = () => {
  let id = localStorage.getItem(SESSION_KEY);

  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }

  return id;
};

export const startConversation = async (visitor = {}) => {
  const { data } = await API.post("/chat/conversations/start", {
    sessionId: getSessionId(),
    visitor,
  });
  return data;
};

export const sendMessage = async (message, visitor = {}) => {
  const { data } = await API.post("/chat/conversations/message", {
    sessionId: getSessionId(),
    message,
    visitor,
  });
  return data;
};

export const fetchConversation = async () => {
  const { data } = await API.get(
    `/chat/conversations/session/${getSessionId()}`
  );
  return data;
};

export const clearConversation = async () => {
  const { data } = await API.delete(
    `/chat/conversations/session/${getSessionId()}`
  );
  return data;
};
