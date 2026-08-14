import API from "./api";

/* ======================================================
   CHAT / ENQUIRY API
   Uses existing backend:
   POST /api/chat

   Backend handles:
   - Chat creation
   - Lead creation
   - Company email
====================================================== */

export const submitEnquiry = async (payload) => {
  const { data } = await API.post("/chat", payload);
  return data;
};