import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Inbox, Send, FileText, Star, MessagesSquare, Archive, SquarePen, Plug, CheckCircle2, Reply, ReplyAll, Forward, Trash2,
  Paperclip, Search, RefreshCw, Loader2, ChevronLeft, Download, AlertTriangle, ArchiveRestore, MailOpen, Lock, Undo2, Mail,
} from "lucide-react";
import MailComposer from "./MailComposer";
import RecordLinker, { LinkChips } from "./RecordLinker";
import { mailApi, errorText, fmtDate, fmtFull, fmtSize, downloadAttachment, emailDocument } from "./mailApi";

/* =========================================================
   MAIL WORKSPACE — compose, sent mail, drafts, conversations
   and CRM / ERP links for this workspace's own mailboxes.
   Inbox appears only when a connected provider grants read
   access (never simulated).
========================================================= */
const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText, count: "drafts" },
  { id: "starred", label: "Starred", icon: Star },
  { id: "conversations", label: "Conversations", icon: MessagesSquare },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];
const NO_SEND = "Connect an email account to send";
const goToConnect = () => {
  const el = document.getElementById("mail-add-account") || document.getElementById("mail-settings-title");
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => document.getElementById("mail-add-account-email")?.focus(), 350);
};

/* Header connection pill: connected / reconnect required / not connected / checking */
function ConnectionPill({ summary, checking, error }) {
  if (error) return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100"><AlertTriangle size={12} /> {error}</span>;
  if (!summary || checking) return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"><Loader2 size={12} className="animate-spin" /> Checking connection…</span>;
  const { state } = summary.connection || {};
  const def = summary.defaultAccount;
  if (state === "connected") {
    const sender = def?.status === "connected" ? def : summary.accounts.find((a) => a.status === "connected");
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
        <CheckCircle2 size={12} /> Connected · <span className="font-medium break-all text-emerald-800">{sender?.email}</span> <span className="font-normal text-emerald-600">via {sender?.providerName}</span>
      </span>
    );
  }
  if (state === "error") return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100"><AlertTriangle size={12} /> Reconnect required — sending paused</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"><Plug size={12} /> Not connected</span>;
}
const EMPTY = {
  sent: ["No sent emails yet", "Emails you send from this workspace appear here."],
  drafts: ["No drafts", "Save an email as a draft to finish it later."],
  starred: ["Nothing starred", "Star important emails to find them quickly."],
  archived: ["No archived emails", "Archive emails to keep your lists tidy without deleting them."],
  trash: ["Trash is empty", "Deleted emails stay here until you delete them permanently."],
  conversations: ["No conversations yet", "Replies and follow-ups are grouped into conversations."],
};

const initials = (s = "") => (s.split("@")[0].match(/[a-z0-9]/gi) || ["?"]).slice(0, 2).join("").toUpperCase();
const Avatar = ({ email }) => (
  <div className="grid text-xs font-semibold text-indigo-700 rounded-full w-9 h-9 bg-indigo-50 place-items-center shrink-0">{initials(email)}</div>
);

const StatusBadge = ({ m }) => {
  if (m.status === "failed") return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-100">Failed</span>;
  if (m.status === "sending") return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">Sending…</span>;
  if (m.status === "draft") return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Draft</span>;
  return null;
};

/* Sandboxed: no scripts, links open in a new tab; sized to its content */
function EmailFrame({ message }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(120);
  const fit = () => {
    try {
      const h = ref.current?.contentDocument?.documentElement?.scrollHeight;
      if (h) setHeight(Math.min(Math.max(h + 8, 80), 4000));
    } catch { /* cross-origin: keep default */ }
  };
  return (
    <iframe ref={ref} title={`Email: ${message.subject || "(no subject)"}`} srcDoc={emailDocument(message)} onLoad={fit}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
      className="w-full border-0" style={{ height }} />
  );
}

function Attachments({ list }) {
  const [busy, setBusy] = useState(null);
  if (!list?.length) return null;
  const get = async (a) => {
    setBusy(a.id);
    try {
      await downloadAttachment(a);
    } catch (err) {
      toast.error(err.message || "Download failed");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="pt-4 mt-4 border-t border-slate-100">
      <p className="mb-2 text-xs font-semibold text-slate-500">{list.length} attachment{list.length > 1 ? "s" : ""}</p>
      <div className="flex flex-wrap gap-2">
        {list.map((a) => (
          <button key={a.id} onClick={() => get(a)} disabled={busy === a.id} className="inline-flex items-center gap-2 px-3 py-2 text-xs border rounded-lg border-slate-200 hover:bg-slate-50">
            {busy === a.id ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} className="text-slate-400" />}
            <span className="max-w-[200px] truncate font-medium text-slate-700">{a.filename}</span>
            <span className="text-slate-400">{fmtSize(a.size)}</span>
            <Download size={13} className="text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

const Recipients = ({ m }) => (
  <div className="text-xs text-slate-500 space-y-0.5">
    <p><span className="text-slate-400">To:</span> {(m.to || []).join(", ") || "—"}</p>
    {m.cc?.length > 0 && <p><span className="text-slate-400">Cc:</span> {m.cc.join(", ")}</p>}
    {m.bcc?.length > 0 && <p><span className="text-slate-400">Bcc:</span> {m.bcc.join(", ")}</p>}
  </div>
);

const iconBtn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40";

/* ---------------- Single message ---------------- */
function MessageView({ id, canSend, onBack, onCompose, onChanged, onOpenThread }) {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let live = true;
    mailApi.get(id).then((d) => live && setM(d)).catch((err) => live && setError(errorText(err, "Couldn't open this email.")));
    return () => { live = false; };
  }, [id]);

  const act = async (key, fn, done) => {
    setBusy(key);
    try {
      const r = await fn();
      if (done) toast.success(done);
      onChanged?.();
      return r;
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const flag = (patch, msg) => act(Object.keys(patch)[0], async () => { await mailApi.flags(id, patch); setM((x) => ({ ...x, ...patch })); }, msg);

  if (error) return <div className="p-8 text-sm text-center text-red-600">{error}</div>;
  if (!m) return <div className="flex items-center justify-center flex-1 gap-2 p-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading email…</div>;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100">
        <button onClick={onBack} className={`${iconBtn} lg:hidden`}><ChevronLeft size={15} /> Back</button>
        {!m.trashed && (
          <>
            <button onClick={() => onCompose({ mode: "reply", source: m })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Reply size={15} /> Reply</button>
            <button onClick={() => onCompose({ mode: "replyAll", source: m })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><ReplyAll size={15} /> Reply all</button>
            <button onClick={() => onCompose({ mode: "forward", source: m })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Forward size={15} /> Forward</button>
            <span className="w-px h-5 mx-1 bg-slate-200" />
            <button onClick={() => flag({ starred: !m.starred }, m.starred ? "Unstarred" : "Starred")} disabled={!!busy} className={iconBtn} aria-pressed={m.starred}>
              <Star size={15} className={m.starred ? "fill-amber-400 text-amber-400" : ""} /> {m.starred ? "Starred" : "Star"}
            </button>
            <button onClick={() => flag({ archived: !m.archived }, m.archived ? "Moved out of archive" : "Archived")} disabled={!!busy} className={iconBtn}>
              {m.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {m.archived ? "Unarchive" : "Archive"}
            </button>
            <button onClick={() => flag({ read: !m.read }, m.read ? "Marked as unread" : "Marked as read")} disabled={!!busy} className={iconBtn}>
              <MailOpen size={15} /> {m.read ? "Mark unread" : "Mark read"}
            </button>
          </>
        )}
        {m.trashed && <button onClick={() => flag({ trashed: false }, "Restored")} disabled={!!busy} className={iconBtn}><Undo2 size={15} /> Restore</button>}
        <button
          onClick={() => (!m.trashed || window.confirm("Delete this email permanently? This can't be undone.")) && act("del", () => mailApi.remove(id), m.trashed ? "Deleted permanently" : "Moved to trash").then(onBack)}
          disabled={!!busy} className={`${iconBtn} hover:text-red-600`}>
          {busy === "del" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {m.trashed ? "Delete forever" : "Delete"}
        </button>
      </div>

      <div className="flex-1 min-h-0 px-5 py-5 overflow-y-auto">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="flex-1 text-lg font-semibold break-words text-slate-900">{m.subject || "(no subject)"}</h2>
          <StatusBadge m={m} />
        </div>
        {m.status === "failed" && m.error && (
          <p className="flex items-start gap-2 p-3 mt-3 text-sm text-red-700 rounded-lg bg-red-50"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {m.error}</p>
        )}
        <div className="flex items-start gap-3 mt-4">
          <Avatar email={m.from} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800 break-all">{m.from}</p>
              <p className="text-xs text-slate-400">{fmtFull(m.date)}</p>
            </div>
            <Recipients m={m} />
          </div>
        </div>
        <div className="mt-3">
          <RecordLinker links={m.links} onChange={(links) => act("links", async () => {
            const saved = await mailApi.links(id, links);
            setM((x) => ({ ...x, links: saved }));
          }, "Links updated")} />
        </div>
        {onOpenThread && (
          <button onClick={() => onOpenThread(m.threadKey)} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">View whole conversation</button>
        )}
        <div className="mt-5"><EmailFrame message={m} /></div>
        <Attachments list={m.attachments} />
      </div>
    </div>
  );
}

/* ---------------- Conversation ---------------- */
function ThreadView({ threadKey, canSend, onBack, onCompose }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(new Set());

  useEffect(() => {
    let live = true;
    mailApi.thread(threadKey).then((d) => {
      if (!live) return;
      setT(d);
      setOpen(new Set([d.messages.at(-1)?.id]));
    }).catch((err) => live && setError(errorText(err, "Couldn't open this conversation.")));
    return () => { live = false; };
  }, [threadKey]);

  if (error) return <div className="p-8 text-sm text-center text-red-600">{error}</div>;
  if (!t) return <div className="flex items-center justify-center flex-1 gap-2 p-8 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading conversation…</div>;
  const last = t.messages.at(-1);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100">
        <button onClick={onBack} className={`${iconBtn} lg:hidden`}><ChevronLeft size={15} /> Back</button>
        <button onClick={() => onCompose({ mode: "reply", source: last })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Reply size={15} /> Reply</button>
        <button onClick={() => onCompose({ mode: "replyAll", source: last })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><ReplyAll size={15} /> Reply all</button>
        <button onClick={() => onCompose({ mode: "forward", source: last })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Forward size={15} /> Forward</button>
      </div>
      <div className="flex-1 min-h-0 px-5 py-5 overflow-y-auto">
        <h2 className="text-lg font-semibold break-words text-slate-900">{t.subject || "(no subject)"}</h2>
        <p className="mt-1 text-xs text-slate-500">{t.messages.length} message{t.messages.length > 1 ? "s" : ""}</p>
        <ol className="mt-4 space-y-3">
          {t.messages.map((m) => {
            const expanded = open.has(m.id);
            return (
              <li key={m.id} className="border rounded-xl border-slate-200">
                <button className="flex items-start w-full gap-3 p-3 text-left" onClick={() => setOpen((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} aria-expanded={expanded}>
                  <Avatar email={m.from} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 break-all">{m.from} <StatusBadge m={m} /></p>
                      <p className="text-xs text-slate-400">{fmtFull(m.date)}</p>
                    </div>
                    {expanded ? <Recipients m={m} /> : <p className="text-xs truncate text-slate-500">{m.snippet}</p>}
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4">
                    <LinkChips links={m.links} />
                    <div className="mt-2"><EmailFrame message={m} /></div>
                    <Attachments list={m.attachments} />
                    <div className="flex gap-1 mt-3">
                      <button onClick={() => onCompose({ mode: "reply", source: m })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Reply size={14} /> Reply</button>
                      <button onClick={() => onCompose({ mode: "forward", source: m })} disabled={!canSend} title={canSend ? undefined : NO_SEND} className={iconBtn}><Forward size={14} /> Forward</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ---------------- Workspace ---------------- */
export default function MailWorkspace({ renderSettings }) {
  const [folder, setFolder] = useState("sent");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [checking, setChecking] = useState(false); // re-confirming the connection after a change
  const [list, setList] = useState({ loading: true, items: [], total: 0, page: 1, error: null });
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ unread: false, attachments: false });
  const [selected, setSelected] = useState(null); // { type: "message" | "thread", id }
  const [composer, setComposer] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const listReq = useRef(0);
  const summaryReq = useRef(0);

  const connState = summary?.connection?.state || null; // connected | error | none
  // Actions unlock only when the backend has confirmed a usable mailbox
  const canSend = !!summary && !checking && !summaryError && summary.connection?.connected === true;
  const hasMailbox = connState === "connected" || connState === "error";

  const loadSummary = useCallback(() => {
    const req = ++summaryReq.current;
    return mailApi.summary()
      .then((s) => { if (req === summaryReq.current) { setSummary(s); setSummaryError(null); } })
      .catch((err) => { if (req === summaryReq.current) setSummaryError(errorText(err, "Couldn't check your email connection.")); });
  }, []);

  const loadList = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!hasMailbox || (folder === "inbox" && !summary?.inbox?.available)) return;
    const req = ++listReq.current;
    setList((l) => ({ ...l, loading: true, error: null, ...(append ? {} : { items: [] }) }));
    try {
      const data = folder === "conversations"
        ? await mailApi.conversations({ q: query, page })
        : await mailApi.list({ folder, q: query, page, unread: filters.unread ? "1" : undefined, attachments: filters.attachments ? "1" : undefined });
      if (req !== listReq.current) return;
      setList((l) => ({ loading: false, error: null, page: data.page, total: data.total, items: append ? [...l.items, ...data.items] : data.items }));
      setRefreshedAt(new Date());
    } catch (err) {
      if (req === listReq.current) setList((l) => ({ ...l, loading: false, error: errorText(err, "Couldn't load emails.") }));
    }
  }, [folder, query, filters, hasMailbox, summary?.inbox?.available]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  // Backend confirmed there is no usable mailbox: close stale compose / reader state
  useEffect(() => {
    if (summary && !checking && !summary.connection?.connected) setComposer(null);
    if (summary && !checking && summary.connection?.state === "none") setSelected(null);
  }, [summary, checking]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* Called by Email Settings after connect / disconnect / default / test.
     Locks every email action until the backend re-confirms the connection. */
  const onAccountsChanged = useCallback((change = {}) => {
    setChecking(true);
    if (change.disconnected) {
      setComposer(null);
      setSelected(null);
      setSummary((s) => (s ? { ...s, accounts: s.accounts.filter((a) => a.id !== change.disconnected), connection: { ...s.connection, connected: false } } : s));
    }
    loadSummary().finally(() => setChecking(false));
  }, [loadSummary]);

  const refresh = () => {
    setChecking(true);
    loadSummary().finally(() => setChecking(false));
    loadList();
  };
  const pick = (id) => {
    setFolder(id);
    setSelected(null);
  };
  const compose = (init = {}) => {
    if (!canSend) return toast.error(connState === "error" ? "Reconnect your email account in Email Settings to send." : `${NO_SEND}.`);
    setComposer(init);
  };

  const openItem = (item) => {
    if (folder === "conversations") return setSelected({ type: "thread", id: item.threadKey });
    if (folder === "drafts") {
      if (!canSend) return toast.error(`${NO_SEND} or edit drafts.`);
      return mailApi.get(item.id).then((d) => setComposer({ draft: d })).catch((err) => toast.error(errorText(err)));
    }
    setSelected({ type: "message", id: item.id });
    if (!item.read) setList((l) => ({ ...l, items: l.items.map((x) => (x.id === item.id ? { ...x, read: true } : x)) }));
  };

  const quickStar = async (e, item) => {
    e.stopPropagation();
    try {
      await mailApi.flags(item.id, { starred: !item.starred });
      setList((l) => ({ ...l, items: l.items.map((x) => (x.id === item.id ? { ...x, starred: !item.starred } : x)) }));
      loadSummary();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const counts = summary?.counts || {};
  const sendSummary = summary && { ...summary, accounts: summary.accounts.filter((a) => a.status === "connected") };
  const settingsEl = renderSettings?.({ onChanged: onAccountsChanged, capabilities: summary?.capabilities || [] });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="grid w-11 h-11 text-white shadow-sm rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 place-items-center shrink-0"><Mail size={20} /></div>
        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="text-xl font-bold leading-tight text-slate-900">Mail Integration</h1>
          <ConnectionPill summary={summary} checking={checking} error={summaryError} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-white border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50"
            title={refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString()}` : "Refresh"}>
            <RefreshCw size={15} className={checking || (list.loading && hasMailbox) ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => compose({})} disabled={!canSend} title={canSend ? "Compose a new email" : NO_SEND}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 shadow-sm rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed">
            <SquarePen size={16} /> Compose
          </button>
        </div>
      </header>

      {/* Email Settings — always visible */}
      {settingsEl}

      {summaryError && !summary ? (
        <div className="p-8 text-sm text-center text-red-600 bg-white border rounded-2xl border-slate-200">
          {summaryError} <button onClick={refresh} className="font-semibold underline">Retry</button>
        </div>
      ) : !summary ? (
        <div className="h-[420px] bg-white border rounded-2xl border-slate-200 animate-pulse" aria-busy="true" />
      ) : !hasMailbox ? (
        /* Disconnected: no actions, only the way to connect */
        <div className="px-6 py-14 text-center bg-white border border-dashed rounded-2xl border-slate-300">
          <div className="grid mx-auto mb-4 w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 place-items-center"><Plug size={24} /></div>
          <h2 className="text-lg font-semibold text-slate-900">Connect email account to start</h2>
          <p className="max-w-md mx-auto mt-2 text-sm text-slate-500">
            Connect your Gmail, Zoho Mail or custom-domain mailbox to compose, send and reply from ReadyTech. Emails here are sent only from your own connected account.
          </p>
          <button onClick={goToConnect} className="inline-flex items-center gap-2 px-5 py-2.5 mt-5 text-sm font-semibold text-white bg-indigo-600 shadow-sm rounded-xl hover:bg-indigo-700">
            <Plug size={16} /> Connect email account
          </button>
        </div>
      ) : (
        <>
          {connState === "error" && (
            <div className="flex flex-wrap items-center gap-3 p-4 text-sm border rounded-2xl border-amber-200 bg-amber-50 text-amber-800" role="status">
              <AlertTriangle size={18} className="shrink-0" />
              <span className="flex-1 min-w-0">Your email account needs to be reconnected. Compose, send, reply and forward are paused until the connection is confirmed — your mail history is still available.</span>
              <button onClick={goToConnect} className="px-3 py-1.5 text-xs font-semibold bg-white border rounded-lg border-amber-300 hover:bg-amber-100">Go to Email Settings</button>
            </div>
          )}

          <div className="flex flex-col overflow-hidden bg-white border shadow-sm lg:flex-row rounded-2xl border-slate-200 lg:h-[calc(100vh-12rem)] lg:min-h-[560px]">
            {/* Folders */}
            <nav className="flex gap-1 p-2 overflow-x-auto border-b lg:flex-col lg:w-52 lg:p-3 lg:border-b-0 lg:border-r border-slate-100 shrink-0 bg-slate-50/40" aria-label="Mail folders">
              {FOLDERS.map((f) => {
                const n = f.id === "inbox" ? counts.inboxUnread : f.count ? counts[f.count] : null;
                const active = folder === f.id;
                return (
                  <button key={f.id} onClick={() => pick(f.id)} aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl whitespace-nowrap transition-colors ${active ? "bg-white text-indigo-700 font-semibold shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70"}`}>
                    <f.icon size={16} className="shrink-0" />
                    <span className="flex-1 text-left">{f.label}</span>
                    {f.id === "inbox" && !summary.inbox.available && <Lock size={12} className="text-slate-400" />}
                    {n > 0 && <span className={`min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-semibold ${active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"}`}>{n}</span>}
                  </button>
                );
              })}
            </nav>

            {folder === "inbox" && !summary.inbox.available ? (
              <div className="grid flex-1 p-8 place-items-center">
                <div className="max-w-md text-center">
                  <div className="grid w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-500 place-items-center"><Lock size={20} /></div>
                  <h2 className="font-semibold text-slate-900">Inbox isn't available for this mailbox yet</h2>
                  <p className="mt-2 text-sm text-slate-500">{summary.inbox.reason}</p>
                  <p className="mt-3 text-xs text-slate-400">Compose, drafts, sent mail, conversations and record links work now.</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => compose({})} disabled={!canSend} title={canSend ? undefined : NO_SEND} className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed">Compose</button>
                    <button onClick={() => pick("sent")} className="px-3 py-2 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50">View sent mail</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* List */}
                <section className={`flex flex-col min-h-[420px] lg:min-h-0 lg:w-[340px] xl:w-[380px] lg:border-r border-slate-100 shrink-0 ${selected ? "hidden lg:flex" : "flex"}`}>
                  <div className="p-3 space-y-2 border-b border-slate-100">
                    <label className="relative block">
                      <Search size={15} className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, people, records…" aria-label="Search email"
                        className="w-full py-2 pr-3 text-sm border pl-9 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </label>
                    {folder !== "conversations" && (
                      <div className="flex gap-1.5">
                        {[["unread", "Unread"], ["attachments", "Has attachments"]].map(([k, l]) => (
                          <button key={k} onClick={() => setFilters((x) => ({ ...x, [k]: !x[k] }))} aria-pressed={filters[k]}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full ${filters[k] ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {list.error ? (
                      <div className="p-6 text-sm text-center text-red-600">{list.error} <button onClick={() => loadList()} className="font-semibold underline">Retry</button></div>
                    ) : list.loading && !list.items.length ? (
                      <ul className="divide-y divide-slate-100" aria-busy="true">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <li key={i} className="flex gap-3 p-4 animate-pulse"><div className="rounded-full w-9 h-9 bg-slate-100" /><div className="flex-1 space-y-2"><div className="w-1/2 h-3 rounded bg-slate-100" /><div className="w-3/4 h-3 rounded bg-slate-100" /></div></li>
                        ))}
                      </ul>
                    ) : !list.items.length ? (
                      <div className="p-8 text-center">
                        <p className="text-sm font-semibold text-slate-700">{query || filters.unread || filters.attachments ? "No matching emails" : EMPTY[folder]?.[0]}</p>
                        <p className="mt-1 text-xs text-slate-500">{query || filters.unread || filters.attachments ? "Try a different search or filter." : EMPTY[folder]?.[1]}</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {list.items.map((raw) => {
                          const item = folder === "conversations" ? { ...raw.latest, threadKey: raw.threadKey, count: raw.count, read: !raw.unread, starred: raw.starred } : raw;
                          const key = folder === "conversations" ? raw.threadKey : item.id;
                          const active = selected && selected.id === key;
                          const who = item.direction === "outbound" ? `To: ${(item.to || []).join(", ") || "(no recipients)"}` : item.from;
                          return (
                            <li key={key}>
                              <div role="button" tabIndex={0} onClick={() => openItem(folder === "conversations" ? raw : item)} onKeyDown={(e) => e.key === "Enter" && openItem(folder === "conversations" ? raw : item)}
                                className={`flex gap-3 px-4 py-3 cursor-pointer border-l-2 ${active ? "bg-indigo-50/70 border-indigo-500" : "border-transparent hover:bg-slate-50"}`}>
                                <Avatar email={item.direction === "outbound" ? item.to?.[0] || "" : item.from} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <p className={`flex-1 text-sm truncate ${item.read ? "text-slate-700" : "font-bold text-slate-900"}`}>{who}</p>
                                    <span className="text-[11px] text-slate-400 shrink-0">{fmtDate(item.date)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <p className={`flex-1 text-sm truncate ${item.read ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                                      {item.subject || "(no subject)"}{raw.count > 1 && <span className="ml-1 text-xs text-slate-400">({raw.count})</span>}
                                    </p>
                                    {item.attachmentCount > 0 && <Paperclip size={12} className="text-slate-400 shrink-0" />}
                                    {folder !== "conversations" && folder !== "drafts" && (
                                      <button onClick={(e) => quickStar(e, item)} className="p-0.5 shrink-0" aria-label={item.starred ? "Unstar" : "Star"}>
                                        <Star size={14} className={item.starred ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-slate-500"} />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <StatusBadge m={item} />
                                    <p className="flex-1 text-xs truncate text-slate-500">{item.status === "failed" ? item.error : item.snippet}</p>
                                  </div>
                                  {item.links?.length > 0 && <div className="mt-1"><LinkChips links={item.links.slice(0, 2)} /></div>}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {list.items.length > 0 && list.items.length < list.total && (
                      <div className="p-3 text-center">
                        <button onClick={() => loadList({ page: list.page + 1, append: true })} disabled={list.loading} className="text-sm font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                          {list.loading ? "Loading…" : `Load more (${list.total - list.items.length})`}
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Reader */}
                <section className={`flex-1 min-w-0 min-h-[420px] lg:min-h-0 ${selected ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}>
                  {!selected ? (
                    <div className="grid flex-1 p-8 text-center place-items-center">
                      <div>
                        <div className="grid w-12 h-12 mx-auto rounded-2xl bg-slate-50 text-slate-300 place-items-center"><Mail size={24} /></div>
                        <p className="mt-3 text-sm text-slate-500">{folder === "drafts" ? "Select a draft to continue writing it." : "Select an email to read it."}</p>
                      </div>
                    </div>
                  ) : selected.type === "thread" ? (
                    <ThreadView key={selected.id} threadKey={selected.id} canSend={canSend} onBack={() => setSelected(null)} onCompose={compose} />
                  ) : (
                    <MessageView key={selected.id} id={selected.id} canSend={canSend} onBack={() => setSelected(null)} onCompose={compose}
                      onChanged={() => { loadSummary(); loadList(); }}
                      onOpenThread={(key) => { setFolder("conversations"); setSelected({ type: "thread", id: key }); }} />
                  )}
                </section>
              </>
            )}
          </div>
        </>
      )}

      {composer && (canSend || checking) && (
        <MailComposer
          init={composer}
          summary={sendSummary}
          onClose={() => setComposer(null)}
          onOpenSettings={goToConnect}
          onConnectionLost={() => onAccountsChanged({})}
          onDone={({ type }) => {
            loadSummary();
            if (type === "sent" && folder !== "sent" && folder !== "conversations") setFolder("sent");
            else loadList();
          }}
        />
      )}
    </div>
  );
}
