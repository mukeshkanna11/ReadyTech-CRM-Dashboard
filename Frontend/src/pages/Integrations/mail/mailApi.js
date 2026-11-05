// Mail workspace helpers — API calls (silent: errors are shown in the UI),
// formatting and attachment encoding. All data comes from /api/email/mailbox.
import API from "../../../services/api";

const BASE = "/email/mailbox";
const opts = (extra = {}) => ({ silent: true, ...extra });

export const mailApi = {
  summary: () => API.get(`${BASE}/summary`, opts()).then((r) => r.data.data),
  list: (params) => API.get(`${BASE}/messages`, opts({ params })).then((r) => r.data.data),
  get: (id) => API.get(`${BASE}/messages/${id}`, opts()).then((r) => r.data.data),
  flags: (id, body) => API.patch(`${BASE}/messages/${id}`, body, opts()).then((r) => r.data.data),
  remove: (id) => API.delete(`${BASE}/messages/${id}`, opts()).then((r) => r.data.data),
  links: (id, links) => API.put(`${BASE}/messages/${id}/links`, { links }, opts()).then((r) => r.data.data),
  conversations: (params) => API.get(`${BASE}/conversations`, opts({ params })).then((r) => r.data.data),
  thread: (key) => API.get(`${BASE}/conversations/${key}`, opts()).then((r) => r.data.data),
  saveDraft: (body, id) =>
    (id ? API.put(`${BASE}/drafts/${id}`, body, opts({ timeout: 60000 })) : API.post(`${BASE}/drafts`, body, opts({ timeout: 60000 }))).then((r) => r.data.data),
  send: (body) => API.post(`${BASE}/send`, body, opts({ timeout: 90000 })).then((r) => r.data),
  linkTargets: (type, q) => API.get(`${BASE}/link-targets`, opts({ params: { type, q } })).then((r) => r.data.data),
};

export const errorText = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.message || (err?.response ? fallback : "Can't reach the server. Check your connection and try again.");

/* Binary download — bypasses the JSON-only axios interceptor */
export const downloadAttachment = async (a) => {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${BASE}/attachments/${a.id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Download failed");
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement("a"), { href: url, download: a.filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
    r.readAsDataURL(file);
  });

export const BLOCKED_EXT = /\.(ade|adp|apk|app|appx|bat|cab|chm|cmd|com|cpl|dll|dmg|exe|hta|ins|iso|isp|jar|js|jse|lib|lnk|mde|msc|msi|msix|msp|mst|nsh|pif|ps1|reg|scr|sct|shb|sys|vb|vbe|vbs|vxd|wsc|wsf|wsh)$/i;

export const fmtSize = (n = 0) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });
  return date.toLocaleDateString();
};
export const fmtFull = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");

export const LINK_TYPES = [
  { id: "lead", label: "Lead", group: "CRM" },
  { id: "client", label: "Customer", group: "ERP" },
  { id: "vendor", label: "Supplier", group: "ERP" },
  { id: "salesOrder", label: "Sales Order", group: "ERP" },
  { id: "purchaseOrder", label: "Purchase Order", group: "ERP" },
];
export const linkLabel = (type) => LINK_TYPES.find((t) => t.id === type)?.label || type;

export const newClientId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* Quoted original for reply / forward */
export const quoteBlock = (m, mode) => {
  const body = m.html || esc(m.text).replace(/\n/g, "<br>");
  const meta = mode === "forward"
    ? `---------- Forwarded message ----------<br>From: ${esc(m.from)}<br>Date: ${esc(fmtFull(m.date))}<br>Subject: ${esc(m.subject)}<br>To: ${esc((m.to || []).join(", "))}<br><br>`
    : `On ${esc(fmtFull(m.date))}, ${esc(m.from)} wrote:<br>`;
  return `<p><br></p><div>${meta}<blockquote style="margin:0 0 0 .8ex;border-left:2px solid #cbd5e1;padding-left:1ex">${body}</blockquote></div>`;
};

/* Email HTML is rendered inside a sandboxed iframe (no scripts, no same-origin) */
export const emailDocument = (m) => `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data: https:">
<style>body{margin:0;padding:4px 2px;font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{color:#475569}a{color:#4f46e5}pre{white-space:pre-wrap}</style>
</head><body>${m.html || `<pre style="font:inherit">${esc(m.text)}</pre>`}</body></html>`;
