import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  Building2,
  Tag,
} from "lucide-react";

import {
  getConversations,
  getMessages,
  sendMessage,
  markRead,
} from "../../services/whatsappService";

/* Poll the list infrequently and only when the tab is visible.
   Real updates arrive via webhook; this is just a safety net. */
const LIST_REFRESH_MS = 30000;

/* =========================================================
   WHATSAPP INBOX
========================================================= */
export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState({ conversation: null, messages: [] });

  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [listError, setListError] = useState("");
  const [text, setText] = useState("");

  const bottomRef = useRef(null);

  /* ============ debounce search ============ */
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ============ conversation list ============ */
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
        });

        setConversations(items);
        setPagination(p);
      } catch {
        setListError("Could not load conversations.");
      } finally {
        setListLoading(false);
      }
    },
    [page, debouncedSearch, unreadOnly]
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  /* silent background refresh — visible tab only */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadList({ silent: true });
    }, LIST_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadList]);

  /* ============ active thread ============ */
  const loadThread = useCallback(async (id, opts = {}) => {
    if (!id) return;
    try {
      if (!opts.silent) setThreadLoading(true);
      const data = await getMessages(id, { page: 1, limit: 30 });
      setThread({ conversation: data.conversation, messages: data.messages });
    } catch {
      setThread({ conversation: null, messages: [] });
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const openConversation = useCallback(
    async (conv) => {
      setActiveId(conv._id);
      setText("");
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

  /* ============ send ============ */
  const windowOpen = thread.conversation?.window?.open;

  const handleSend = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending || !activeId) return;

    try {
      setSending(true);
      await sendMessage(activeId, body);
      setText("");
      await loadThread(activeId, { silent: true });
      loadList({ silent: true });
    } catch (err) {
      const res = err?.response?.data;
      if (res?.code === "WINDOW_EXPIRED") {
        toast.error(res.message);
        await loadThread(activeId, { silent: true });
      }
      /* other errors already surfaced by the API interceptor */
    } finally {
      setSending(false);
    }
  };

  const totalUnread = useMemo(
    () => conversations.reduce((n, c) => n + (c.unreadCount || 0), 0),
    [conversations]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* ================= HEADER ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid text-emerald-600 h-10 w-10 place-items-center rounded-xl bg-emerald-50">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">WhatsApp Inbox</h1>
            <p className="text-xs text-slate-500">
              {pagination?.total ?? 0} conversations
              {totalUnread > 0 && ` · ${totalUnread} unread`}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadList();
            if (activeId) loadThread(activeId, { silent: true });
          }}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition bg-white border rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} className={listLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ================= 3-COLUMN LAYOUT ================= */}
      <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* ---------- LEFT: conversation list ---------- */}
        <div className="flex flex-col min-h-0 bg-white border shadow-sm rounded-2xl border-slate-200">
          <div className="p-3 space-y-2 border-b border-slate-100">
            <div className="relative">
              <Search
                size={15}
                className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number"
                className="w-full py-2 pl-9 pr-3 text-sm border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <button
              onClick={() => {
                setUnreadOnly((v) => !v);
                setPage(1);
              }}
              className={`w-full rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                unreadOnly
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {unreadOnly ? "Showing unread only" : "Show unread only"}
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listLoading ? (
              <Centered>
                <Loader2 size={18} className="animate-spin" /> Loading…
              </Centered>
            ) : listError ? (
              <Centered tone="text-rose-600">
                <XCircle size={18} /> {listError}
              </Centered>
            ) : conversations.length === 0 ? (
              <Centered>
                <Inbox size={18} /> No conversations yet
              </Centered>
            ) : (
              conversations.map((c) => (
                <button
                  key={c._id}
                  onClick={() => openConversation(c)}
                  className={`w-full border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50 ${
                    activeId === c._id ? "bg-emerald-50/60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate text-slate-900">
                      {c.profileName || c.phoneNumber}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTime(c.lastMessageAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs truncate text-slate-500">
                      {c.lastMessageDirection === "outbound" && "You: "}
                      {c.lastMessagePreview || "—"}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="grid min-w-[18px] place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <WindowDot open={c.window?.open} />
                    {c.assignedTo?.name && (
                      <span className="text-[10px] text-slate-400 truncate">
                        · {c.assignedTo.name}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between p-2 text-xs border-t border-slate-100">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded-lg disabled:opacity-40 hover:bg-slate-100"
              >
                Prev
              </button>
              <span className="text-slate-500">
                {page} / {pagination.pages}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded-lg disabled:opacity-40 hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* ---------- CENTER: thread ---------- */}
        <div className="flex flex-col min-h-0 bg-white border shadow-sm rounded-2xl border-slate-200">
          {!activeId ? (
            <Centered>
              <MessageSquare size={20} /> Select a conversation
            </Centered>
          ) : threadLoading ? (
            <Centered>
              <Loader2 size={18} className="animate-spin" /> Loading messages…
            </Centered>
          ) : !thread.conversation ? (
            <Centered tone="text-rose-600">
              <XCircle size={18} /> Could not load this conversation
            </Centered>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-900">
                    {thread.conversation.profileName ||
                      thread.conversation.phoneNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {thread.conversation.phoneNumber}
                  </p>
                </div>
                <WindowBadge conv={thread.conversation} />
              </div>

              <div className="flex-1 min-h-0 p-4 space-y-2 overflow-y-auto bg-slate-50/60">
                {thread.messages.length === 0 ? (
                  <Centered>No messages yet</Centered>
                ) : (
                  thread.messages.map((m) => <Bubble key={m._id} m={m} />)
                )}
                <div ref={bottomRef} />
              </div>

              {/* composer */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-slate-100"
              >
                {!windowOpen && (
                  <div className="flex items-start gap-2 p-2.5 mb-2 text-xs border rounded-xl border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>
                      24-hour window expired. An approved WhatsApp template is
                      required.
                    </span>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={!windowOpen || sending}
                    placeholder={
                      windowOpen
                        ? "Type a message…"
                        : "Template required to reply"
                    }
                    className="flex-1 px-3 py-2 text-sm border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!windowOpen || sending || !text.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                  >
                    {sending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* ---------- RIGHT: CRM details ---------- */}
        <div className="hidden min-h-0 overflow-y-auto bg-white border shadow-sm lg:block rounded-2xl border-slate-200">
          {!thread.conversation ? (
            <Centered>
              <User size={18} /> Customer details
            </Centered>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                  Customer
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {thread.conversation.profileName || "Unknown"}
                </p>
                <p className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                  <Phone size={12} /> {thread.conversation.phoneNumber}
                </p>
              </div>

              <Row label="Window">
                <WindowBadge conv={thread.conversation} compact />
              </Row>

              <Row label="Status">{thread.conversation.status}</Row>

              <Row label="Owner">
                {thread.conversation.assignedTo?.name || "Unassigned"}
              </Row>

              {thread.conversation.lead && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-slate-400">
                    <Tag size={12} /> Linked Lead
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {thread.conversation.lead.name}
                  </p>
                  <Row label="Company">
                    {thread.conversation.lead.company || "—"}
                  </Row>
                  <Row label="Stage">
                    {thread.conversation.lead.status || "—"}
                  </Row>
                  <Row label="Source">
                    {thread.conversation.lead.source || "—"}
                  </Row>
                </div>
              )}

              {thread.conversation.client && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-slate-400">
                    <Building2 size={12} /> Linked Client
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {thread.conversation.client.companyName}
                  </p>
                  <Row label="Contact">
                    {thread.conversation.client.contactPerson || "—"}
                  </Row>
                </div>
              )}

              {!thread.conversation.lead && !thread.conversation.client && (
                <p className="pt-3 text-xs border-t border-slate-100 text-slate-500">
                  Not linked to a CRM record yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   UI HELPERS
========================================================= */
function Bubble({ m }) {
  const out = m.direction === "outbound";

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          out
            ? "bg-emerald-600 text-white"
            : "bg-white text-slate-800 border border-slate-200"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{m.body}</p>

        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            out ? "text-emerald-100" : "text-slate-400"
          }`}
        >
          <span>{formatTime(m.timestamp)}</span>
          {out && <MessageStatus status={m.status} />}
        </div>

        {m.status === "failed" && m.error?.message && (
          <p className="mt-1 text-[10px] text-rose-100">{m.error.message}</p>
        )}
      </div>
    </div>
  );
}

function MessageStatus({ status }) {
  if (status === "failed")
    return <AlertTriangle size={11} className="text-rose-200" />;
  if (status === "read") return <CheckCheck size={12} />;
  if (status === "delivered") return <CheckCheck size={12} className="opacity-70" />;
  if (status === "sent") return <Check size={12} />;
  return <Clock size={11} />;
}

function WindowDot({ open }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${
        open ? "text-emerald-600" : "text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          open ? "bg-emerald-500" : "bg-slate-300"
        }`}
      />
      {open ? "Window active" : "Window expired"}
    </span>
  );
}

function WindowBadge({ conv, compact }) {
  const open = conv?.window?.open;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        open
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <Clock size={11} />
      {open
        ? compact
          ? "Active"
          : "24h window active"
        : compact
        ? "Expired"
        : "Window expired"}
    </span>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 mt-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-right text-slate-800">{children}</span>
    </div>
  );
}

function Centered({ children, tone = "text-slate-500" }) {
  return (
    <div
      className={`flex h-full min-h-[160px] items-center justify-center gap-2 p-6 text-sm ${tone}`}
    >
      {children}
    </div>
  );
}

const formatTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();

  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "short" });
};
