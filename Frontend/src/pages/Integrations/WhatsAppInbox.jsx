import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  MessageSquare,
  Send,
  Search,
  RefreshCw,
  Check,
  CheckCheck,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Loader2,
  Inbox,
  XCircle,
  Paperclip,
  X,
  FileText,
  UserPlus,
  StickyNote,
  Layers,
  ExternalLink,
} from "lucide-react";
import { FaWhatsapp, FaInstagram, FaFacebookMessenger } from "react-icons/fa";

import {
  getConversations,
  getMessages,
  sendMessage,
  markRead,
  updateConversation,
  addNote,
  convertToLead,
  getAssignees,
  getMediaUrl,
} from "../../services/whatsappService";

/* Safety-net poll (visible tab only). Real data arrives via webhooks. */
const LIST_REFRESH_MS = 30000;
const THREAD_REFRESH_MS = 15000;
const MAX_UPLOAD = 7 * 1024 * 1024; // backend JSON limit is 10mb (base64)

const CHANNELS = {
  whatsapp: { label: "WhatsApp", icon: FaWhatsapp, dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  instagram: { label: "Instagram", icon: FaInstagram, dot: "bg-pink-500", chip: "bg-pink-50 text-pink-700" },
  messenger: { label: "Messenger", icon: FaFacebookMessenger, dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
};
const STATUSES = ["Open", "Pending", "Closed"];

const channelOf = (c) => CHANNELS[c?.channel] || CHANNELS.whatsapp;
const displayName = (c) => c?.profileName || c?.phoneNumber || "Unknown";
const initials = (name) =>
  String(name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const fmtTime = (d) => {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "2-digit", month: "short" });
};
const errMsg = (err, fallback) => err?.response?.data?.message || fallback;

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* =========================================================
   UNIFIED INBOX — WhatsApp + Instagram + Messenger
========================================================= */
export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("Open");

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState({ conversation: null, messages: [] });
  const [assignees, setAssignees] = useState([]);

  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [listError, setListError] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);

  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    getAssignees().then(setAssignees).catch(() => {});
  }, []);

  /* ============ list ============ */
  const loadList = useCallback(
    async (opts = {}) => {
      try {
        if (!opts.silent) setListLoading(true);
        setListError("");
        const { items, pagination: p } = await getConversations({
          page,
          limit: 20,
          search: debouncedSearch,
          unread: unreadOnly,
          channel,
          status,
        });
        setConversations(items);
        setPagination(p);
      } catch {
        setListError("Could not load conversations.");
      } finally {
        setListLoading(false);
      }
    },
    [page, debouncedSearch, unreadOnly, channel, status]
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadList({ silent: true });
    }, LIST_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadList]);

  /* ============ thread ============ */
  const loadThread = useCallback(async (id, opts = {}) => {
    if (!id) return;
    try {
      if (!opts.silent) setThreadLoading(true);
      const data = await getMessages(id, { page: 1, limit: 50 });
      setThread({ conversation: data.conversation, messages: data.messages });
    } catch {
      if (!opts.silent) setThread({ conversation: null, messages: [] });
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadThread(activeId, { silent: true });
    }, THREAD_REFRESH_MS);
    return () => clearInterval(id);
  }, [activeId, loadThread]);

  const openConversation = useCallback(
    async (conv) => {
      setActiveId(conv._id);
      setText("");
      setFile(null);
      await loadThread(conv._id);
      if (conv.unreadCount > 0) {
        try {
          await markRead(conv._id);
          setConversations((prev) =>
            prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c))
          );
        } catch {
          /* non-critical */
        }
      }
    },
    [loadThread]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  /* Merge an updated conversation into list + thread */
  const applyConversation = (conv) => {
    if (!conv) return;
    setThread((t) => ({ ...t, conversation: conv }));
    setConversations((prev) => prev.map((c) => (c._id === conv._id ? conv : c)));
  };

  /* ============ send ============ */
  const conv = thread.conversation;
  const isWhatsApp = (conv?.channel || "whatsapp") === "whatsapp";
  const windowOpen = conv?.window?.open;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_UPLOAD) return toast.error("Attachment must be under 7 MB");
    setFile(f);
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !file) || !activeId || sending) return;

    try {
      setSending(true);
      const media = file
        ? { data: await readFile(file), mimeType: file.type || "application/octet-stream", filename: file.name }
        : null;
      const message = await sendMessage(activeId, body, media);
      setThread((t) => ({ ...t, messages: [...t.messages, message] }));
      setText("");
      setFile(null);
      loadList({ silent: true });
    } catch (err) {
      toast.error(errMsg(err, "Message could not be sent"));
      loadThread(activeId, { silent: true });
    } finally {
      setSending(false);
    }
  };

  /* ============ actions ============ */
  const patch = async (changes) => {
    try {
      applyConversation(await updateConversation(activeId, changes));
      toast.success("Conversation updated");
    } catch (err) {
      toast.error(errMsg(err, "Update failed"));
    }
  };

  const handleNote = async (body) => {
    try {
      applyConversation(await addNote(activeId, body));
      return true;
    } catch (err) {
      toast.error(errMsg(err, "Note could not be saved"));
      return false;
    }
  };

  const handleConvert = async () => {
    try {
      const res = await convertToLead(activeId);
      applyConversation(res?.data);
      toast.success(res?.message || "Lead created");
    } catch (err) {
      toast.error(errMsg(err, "Could not convert to lead"));
    }
  };

  /* ============ render ============ */
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid w-10 h-10 text-white shadow-sm place-items-center rounded-xl bg-gradient-to-br from-emerald-500 via-sky-500 to-fuchsia-500">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Unified Inbox</h1>
            <p className="text-xs text-slate-500">WhatsApp, Instagram & Messenger in one place</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/integrations/meta"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Connections
          </Link>
          <button
            onClick={() => loadList()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} className={listLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_300px]">
        {/* ===== Conversation list ===== */}
        <aside className={`${activeId ? "hidden lg:flex" : "flex"} flex-col min-h-0 bg-white border shadow-sm rounded-2xl border-slate-200`}>
          <div className="p-3 space-y-2.5 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number"
                className="w-full py-2 pr-3 text-sm border outline-none pl-9 rounded-xl border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
              {[["", "All", Layers], ...Object.entries(CHANNELS).map(([k, v]) => [k, v.label, v.icon])].map(
                ([key, label, Icon]) => (
                  <button
                    key={key || "all"}
                    title={label}
                    onClick={() => { setChannel(key); setPage(1); }}
                    className={`flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg transition ${
                      channel === key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={13} /> <span className="hidden xl:inline">{label}</span>
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {[...STATUSES, ""].map((s) => (
                <button
                  key={s || "any"}
                  onClick={() => { setStatus(s); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full border transition ${
                    status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s || "All"}
                </button>
              ))}
              <label className="inline-flex items-center gap-1 ml-auto cursor-pointer text-slate-600">
                <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} className="rounded" />
                Unread
              </label>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listLoading && !conversations.length ? (
              <div className="grid h-40 place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
            ) : listError ? (
              <div className="p-6 text-sm text-center text-rose-600">{listError}</div>
            ) : !conversations.length ? (
              <div className="flex flex-col items-center gap-2 p-10 text-sm text-slate-400">
                <Inbox size={28} /> No conversations
              </div>
            ) : (
              conversations.map((c) => {
                const ch = channelOf(c);
                const active = c._id === activeId;
                return (
                  <button
                    key={c._id}
                    onClick={() => openConversation(c)}
                    className={`w-full text-left px-3 py-3 flex gap-3 border-b border-slate-50 transition ${
                      active ? "bg-sky-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="grid w-10 h-10 text-xs font-semibold rounded-full place-items-center bg-slate-100 text-slate-600">
                        {initials(displayName(c))}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-white ${ch.dot}`}>
                        <ch.icon size={9} className="text-white" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${c.unreadCount ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>
                          {displayName(c)}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">{fmtTime(c.lastMessageAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs truncate text-slate-500">
                          {c.lastMessageDirection === "outbound" && "You: "}
                          {c.lastMessagePreview || "—"}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="px-1.5 min-w-[18px] text-center text-[10px] font-bold text-white rounded-full bg-emerald-500">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      {(c.assignedTo || c.lead) && (
                        <div className="flex gap-1 mt-1">
                          {c.assignedTo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">@{c.assignedTo.name}</span>}
                          {c.lead && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Lead</span>}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 text-xs border-t border-slate-100 text-slate-500">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-slate-100">Prev</button>
              <span>{page} / {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-slate-100">Next</button>
            </div>
          )}
        </aside>

        {/* ===== Thread ===== */}
        <section className={`${activeId ? "flex" : "hidden lg:flex"} flex-col min-h-0 bg-white border shadow-sm rounded-2xl border-slate-200`}>
          {!activeId ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400">
              <MessageSquare size={36} />
              <p className="text-sm">Select a conversation</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <button onClick={() => setActiveId(null)} className="p-1 rounded lg:hidden hover:bg-slate-100"><X size={16} /></button>
                <div className="grid text-xs font-semibold rounded-full w-9 h-9 place-items-center bg-slate-100 text-slate-600">
                  {initials(displayName(conv))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-900">{displayName(conv)}</p>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${channelOf(conv).chip}`}>
                    {(() => { const I = channelOf(conv).icon; return <I size={11} />; })()}
                    {channelOf(conv).label}
                  </span>
                </div>
                {conv && (
                  <select
                    value={conv.status}
                    onChange={(e) => patch({ status: e.target.value })}
                    className="px-2 py-1.5 text-xs border rounded-lg border-slate-200"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>

              <div className="flex-1 min-h-0 px-4 py-4 space-y-2 overflow-y-auto bg-slate-50/60">
                {threadLoading ? (
                  <div className="grid h-full place-items-center text-slate-400"><Loader2 className="animate-spin" /></div>
                ) : (
                  thread.messages.map((m) => <Bubble key={m._id || m.messageId} m={m} conversationId={activeId} />)
                )}
                <div ref={bottomRef} />
              </div>

              {conv && !windowOpen && (
                <div className="flex items-start gap-2 px-4 py-2 text-xs border-t text-amber-800 bg-amber-50 border-amber-100">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {isWhatsApp
                    ? "The 24-hour customer service window has closed. Meta only allows an approved template message until the customer writes again."
                    : "Meta only allows replies within 24 hours of the customer's last message. Wait for the customer to message again."}
                </div>
              )}

              <form onSubmit={handleSend} className="p-3 border-t border-slate-100">
                {file && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-2 text-xs rounded-lg bg-slate-100 text-slate-700">
                    <FileText size={13} /> <span className="flex-1 truncate">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)}><X size={13} /></button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  {isWhatsApp && (
                    <>
                      <input ref={fileRef} type="file" hidden onChange={pickFile} accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/aac,audio/mpeg,audio/mp4,audio/ogg,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                      <button
                        type="button"
                        disabled={!windowOpen}
                        onClick={() => fileRef.current?.click()}
                        className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                        title="Attach"
                      >
                        <Paperclip size={18} />
                      </button>
                    </>
                  )}
                  <textarea
                    rows={1}
                    value={text}
                    disabled={!windowOpen || sending}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) handleSend(e);
                    }}
                    placeholder={windowOpen ? "Type a reply…  (Enter to send, Shift+Enter for newline)" : "Replies are locked"}
                    className="flex-1 px-3 py-2.5 text-sm border outline-none resize-none max-h-32 rounded-xl border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={!windowOpen || sending || (!text.trim() && !file)}
                    className="p-2.5 text-white rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* ===== Customer details ===== */}
        {conv && (
          <DetailsPanel
            conv={conv}
            assignees={assignees}
            onAssign={(id) => patch({ assignedTo: id || null })}
            onConvert={handleConvert}
            onNote={handleNote}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MESSAGE BUBBLE + MEDIA
========================================================= */
function Bubble({ m, conversationId }) {
  const out = m.direction === "outbound";
  const hasMedia = m.meta?.mediaId || m.meta?.attachments?.length;
  const placeholder = /^\[[a-z_]+\]$/.test(m.body || "");

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          out ? "bg-slate-900 text-white rounded-br-md" : "bg-white text-slate-800 border border-slate-100 rounded-bl-md"
        }`}
      >
        {m.meta?.mediaId && <WaMedia m={m} conversationId={conversationId} />}
        {m.meta?.attachments?.map((a, i) => <Attachment key={i} a={a} />)}
        {m.body && !(hasMedia && placeholder) && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${out ? "text-slate-300" : "text-slate-400"}`}>
          {fmtTime(m.timestamp)}
          {out && <StatusIcon status={m.status} />}
        </div>
        {m.status === "failed" && m.error?.message && (
          <p className="mt-1 text-[11px] text-rose-300">{m.error.message}</p>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === "read") return <CheckCheck size={12} className="text-sky-400" />;
  if (status === "delivered") return <CheckCheck size={12} />;
  if (status === "sent") return <Check size={12} />;
  if (status === "failed") return <XCircle size={12} className="text-rose-400" />;
  return <Clock size={12} />;
}

/* WhatsApp media via the authenticated backend proxy */
function WaMedia({ m, conversationId }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const type = m.meta?.type || m.type;

  useEffect(() => {
    let revoked = null;
    getMediaUrl(conversationId, m._id)
      .then((u) => { revoked = u; setUrl(u); })
      .catch(() => setFailed(true));
    return () => revoked && URL.revokeObjectURL(revoked);
  }, [conversationId, m._id]);

  if (failed) return <p className="text-xs italic opacity-70">[{type} unavailable]</p>;
  if (!url) return <div className="grid w-48 h-24 mb-1 rounded-lg place-items-center bg-black/5"><Loader2 size={16} className="animate-spin" /></div>;
  if (type === "image" || type === "sticker") return <img src={url} alt="" className="object-cover mb-1 rounded-lg max-h-64" />;
  if (type === "video") return <video src={url} controls className="mb-1 rounded-lg max-h-64" />;
  if (type === "audio") return <audio src={url} controls className="mb-1" />;
  return (
    <a href={url} download={m.meta?.filename || "file"} className="flex items-center gap-2 mb-1 underline">
      <FileText size={14} /> {m.meta?.filename || "Download file"}
    </a>
  );
}

/* Instagram / Messenger attachment (Meta CDN URL from the webhook) */
function Attachment({ a }) {
  if (a.type === "image") return <img src={a.url} alt="" className="object-cover mb-1 rounded-lg max-h-64" />;
  if (a.type === "video") return <video src={a.url} controls className="mb-1 rounded-lg max-h-64" />;
  if (a.type === "audio") return <audio src={a.url} controls className="mb-1" />;
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 mb-1 underline">
      <ExternalLink size={13} /> {a.type || "attachment"}
    </a>
  );
}

/* =========================================================
   DETAILS PANEL — customer, assignment, lead, notes
========================================================= */
function DetailsPanel({ conv, assignees, onAssign, onConvert, onNote }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ch = channelOf(conv);

  const submitNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    if (await onNote(note.trim())) setNote("");
    setBusy(false);
  };

  return (
    <aside className="flex-col hidden min-h-0 overflow-y-auto bg-white border shadow-sm lg:flex rounded-2xl border-slate-200">
      <div className="p-4 text-center border-b border-slate-100">
        <div className="grid mx-auto text-lg font-semibold rounded-full w-14 h-14 place-items-center bg-slate-100 text-slate-600">
          {initials(displayName(conv))}
        </div>
        <p className="mt-2 font-semibold text-slate-900">{displayName(conv)}</p>
        <span className={`inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full ${ch.chip}`}>
          <ch.icon size={11} /> {ch.label}
        </span>
      </div>

      <div className="p-4 space-y-3 text-sm border-b border-slate-100">
        {conv.phoneNumber && (
          <Row icon={Phone} label="Phone">{conv.phoneNumber}</Row>
        )}
        {conv.externalId && <Row icon={User} label={`${ch.label} ID`}>{conv.externalId}</Row>}
        <Row icon={Clock} label="Reply window">
          {conv.window?.open ? `Open until ${fmtTime(conv.window.expiresAt)}` : "Closed"}
        </Row>
        <div>
          <p className="mb-1 text-xs text-slate-500">Assigned to</p>
          <select
            value={conv.assignedTo?._id || ""}
            onChange={(e) => onAssign(e.target.value)}
            className="w-full px-2 py-2 text-sm border rounded-lg border-slate-200"
          >
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u._id} value={u._id}>{u.name || u.email}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 border-b border-slate-100">
        {conv.lead ? (
          <Link
            to="/leads"
            className="flex items-center justify-between px-3 py-2 text-sm rounded-xl bg-amber-50 text-amber-800"
          >
            <span className="truncate">Lead: {conv.lead.name}</span>
            <span className="text-xs">{conv.lead.status}</span>
          </Link>
        ) : conv.client ? (
          <p className="px-3 py-2 text-sm rounded-xl bg-sky-50 text-sky-800">Client: {conv.client.companyName}</p>
        ) : (
          <button
            onClick={onConvert}
            className="inline-flex items-center justify-center w-full gap-2 px-3 py-2 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:opacity-90"
          >
            <UserPlus size={15} /> Convert to Lead
          </button>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <p className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-700">
          <StickyNote size={13} /> Internal notes
        </p>
        <form onSubmit={submitNote} className="mb-3">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Visible to your team only"
            className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none border-amber-200 bg-amber-50/40 focus:border-amber-400"
          />
          <button disabled={busy || !note.trim()} className="w-full py-1.5 mt-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-900 disabled:opacity-50">
            {busy ? "Saving…" : "Add note"}
          </button>
        </form>
        <div className="space-y-2">
          {[...(conv.notes || [])].reverse().map((n) => (
            <div key={n._id} className="p-2 text-xs border rounded-lg bg-amber-50/60 border-amber-100">
              <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
              <p className="mt-1 text-[10px] text-slate-500">{n.authorName || "Team"} · {fmtTime(n.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="break-all text-slate-800">{children}</p>
      </div>
    </div>
  );
}
