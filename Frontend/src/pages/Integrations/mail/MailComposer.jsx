import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Loader2, Paperclip, Save, Send, Trash2, X } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import RecordLinker from "./RecordLinker";
import { mailApi, errorText, readAsBase64, fmtSize, BLOCKED_EXT, newClientId, quoteBlock } from "./mailApi";

const field = "w-full min-w-0 px-0 py-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-slate-400";
const addrs = (list) => (list || []).join(", ");
const prefix = (p, s) => (new RegExp(`^${p}:`, "i").test(s || "") ? s : `${p}: ${s || ""}`.trim());

/* Initial fields for new / draft / reply / reply all / forward */
const initialState = ({ mode, source, draft }, accounts) => {
  if (draft) {
    return {
      accountId: draft.account || "", to: addrs(draft.to), cc: addrs(draft.cc), bcc: addrs(draft.bcc), subject: draft.subject || "",
      html: draft.html || "", kept: draft.attachments || [], links: draft.links || [], draftId: draft.id,
    };
  }
  if (!source) return { accountId: "", to: "", cc: "", bcc: "", subject: "", html: "", kept: [], links: [], draftId: null };
  const mine = new Set(accounts.map((a) => a.email.toLowerCase()));
  const notMine = (list) => (list || []).filter((e) => !mine.has(String(e).toLowerCase()));
  const outbound = source.direction === "outbound";
  let to = [];
  let cc = [];
  if (mode === "reply") to = outbound ? source.to : [source.from];
  if (mode === "replyAll") {
    to = outbound ? source.to : [source.from, ...notMine(source.to)];
    cc = notMine(source.cc);
  }
  return {
    accountId: source.account || "",
    to: addrs([...new Set(to)]), cc: addrs([...new Set(cc)]), bcc: "",
    subject: prefix(mode === "forward" ? "Fwd" : "Re", source.subject),
    html: quoteBlock(source, mode),
    kept: mode === "forward" ? (source.attachments || []).filter((a) => a.id) : [], // only files stored in ReadyTech
    links: source.links || [],
    draftId: null,
  };
};

export default function MailComposer({ init, summary, onClose, onDone, onOpenSettings, onConnectionLost }) {
  const accounts = summary?.accounts || [];
  const limits = summary?.limits || { files: 10, fileBytes: 5 * 1048576, totalBytes: 7 * 1048576 };
  const start = useMemo(() => initialState(init, accounts), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(() => ({
    ...start,
    accountId: accounts.some((a) => a.id === start.accountId) ? start.accountId : summary?.defaultAccount?.id || accounts[0]?.id || "",
    showCc: !!(start.cc || start.bcc),
  }));
  const [files, setFiles] = useState([]); // new uploads: { key, file }
  const [busy, setBusy] = useState(null); // "save" | "send"
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const clientId = useRef(newClientId());
  const fileInput = useRef(null);
  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };

  const account = accounts.find((a) => a.id === f.accountId);
  const caps = summary?.capabilities?.find((c) => c.accountId === f.accountId);
  const canAttach = caps ? caps.attachments !== false : true;
  const totalBytes = f.kept.reduce((n, a) => n + (a.size || 0), 0) + files.reduce((n, x) => n + x.file.size, 0);
  const attachCount = f.kept.length + files.length;
  const replyMeta = init.source && !init.draft ? { replyTo: init.source.id, mode: init.mode } : {};

  const addFiles = (list) => {
    const next = [...files];
    let total = totalBytes;
    for (const file of list) {
      if (BLOCKED_EXT.test(file.name)) { setError(`"${file.name}" can't be attached — executable and script files are blocked by mail providers.`); continue; }
      if (file.size > limits.fileBytes) { setError(`"${file.name}" is larger than ${fmtSize(limits.fileBytes)}.`); continue; }
      if (f.kept.length + next.length >= limits.files) { setError(`Up to ${limits.files} attachments per email.`); break; }
      if (total + file.size > limits.totalBytes) { setError(`Attachments are limited to ${fmtSize(limits.totalBytes)} in total.`); continue; }
      total += file.size;
      next.push({ key: `${file.name}-${file.size}-${Math.random()}`, file });
    }
    setFiles(next);
    setDirty(true);
  };

  const payload = async () => ({
    accountId: f.accountId || undefined,
    to: f.to, cc: f.cc, bcc: f.bcc, subject: f.subject, html: f.html,
    attachmentIds: f.kept.map((a) => a.id),
    attachments: await Promise.all(files.map(async ({ file }) => ({ filename: file.name, contentType: file.type || "application/octet-stream", data: await readAsBase64(file) }))),
    links: f.links.map(({ type, id }) => ({ type, id })),
    ...replyMeta,
  });

  const saveDraft = async ({ close } = {}) => {
    if (busy) return;
    setBusy("save");
    setError(null);
    try {
      const d = await mailApi.saveDraft(await payload(), f.draftId);
      setF((s) => ({ ...s, draftId: d.id, kept: d.attachments || [] }));
      setFiles([]);
      setDirty(false);
      toast.success("Draft saved");
      onDone?.({ type: "draft", message: d, close });
      if (close) onClose();
    } catch (err) {
      setError(errorText(err, "The draft couldn't be saved."));
      if (/^MAIL_/.test(err?.response?.data?.code || "")) onConnectionLost?.();
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (busy) return;
    if (!f.to.trim()) return setError("Add at least one recipient.");
    if (!f.subject.trim() && !window.confirm("Send this email without a subject?")) return;
    setBusy("send");
    setError(null);
    try {
      const res = await mailApi.send({ ...(await payload()), clientId: clientId.current, draftId: f.draftId || undefined });
      toast.success(res.message || "Email sent");
      setDirty(false);
      onDone?.({ type: "sent", message: res.data, close: true });
      onClose();
    } catch (err) {
      setError(errorText(err, "The email couldn't be sent."));
      // Backend says the mailbox is no longer usable: re-check and lock actions
      if (/^MAIL_/.test(err?.response?.data?.code || "")) onConnectionLost?.();
      // The server keeps a failed send as an editable draft — continue from it
      const failedId = err?.response?.data?.data?.id;
      if (failedId) {
        try {
          const d = await mailApi.get(failedId);
          setF((s) => ({ ...s, draftId: d.id, kept: d.attachments || [] }));
          setFiles([]);
          onDone?.({ type: "failed", message: d });
        } catch { /* keep local state */ }
      }
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    if (busy) return;
    if (dirty && (f.to || f.subject || f.html.replace(/<[^>]+>/g, "").trim() || files.length)) {
      if (window.confirm("Save this email as a draft before closing?")) return saveDraft({ close: true });
      if (!window.confirm("Discard this email?")) return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = init.draft ? "Edit draft" : { reply: "Reply", replyAll: "Reply all", forward: "Forward" }[init.mode] || "New email";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4 bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="flex flex-col w-full h-full max-w-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={close} disabled={!!busy} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close composer"><X size={18} /></button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600">Connect a mailbox before sending email.</p>
            <button onClick={() => { onClose(); onOpenSettings?.(); }} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Open Email Settings</button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 px-5 overflow-y-auto">
              <div className="divide-y divide-slate-100">
                <label className="flex items-center gap-3">
                  <span className="w-12 text-xs font-semibold text-slate-500 shrink-0">From</span>
                  <select value={f.accountId} onChange={(e) => set("accountId", e.target.value)} className={`${field} cursor-pointer`}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.displayName ? `${a.displayName} <${a.email}>` : a.email} · {a.providerName}{a.isDefault ? " (default)" : ""}{a.status === "error" ? " — needs attention" : ""}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-xs font-semibold text-slate-500 shrink-0">To</span>
                  <input value={f.to} onChange={(e) => set("to", e.target.value)} placeholder="name@company.com, …" className={field} autoFocus={!init.source || init.mode === "forward"} />
                  {!f.showCc && <button type="button" onClick={() => set("showCc", true)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 shrink-0">Cc / Bcc</button>}
                </div>
                {f.showCc && (
                  <>
                    <label className="flex items-center gap-3">
                      <span className="w-12 text-xs font-semibold text-slate-500 shrink-0">Cc</span>
                      <input value={f.cc} onChange={(e) => set("cc", e.target.value)} className={field} />
                    </label>
                    <label className="flex items-center gap-3">
                      <span className="w-12 text-xs font-semibold text-slate-500 shrink-0">Bcc</span>
                      <input value={f.bcc} onChange={(e) => set("bcc", e.target.value)} className={field} />
                    </label>
                  </>
                )}
                <label className="flex items-center gap-3">
                  <span className="w-12 text-xs font-semibold text-slate-500 shrink-0">Subject</span>
                  <input value={f.subject} onChange={(e) => set("subject", e.target.value)} maxLength={250} className={`${field} font-medium`} />
                </label>
              </div>

              {account?.status === "error" && (
                <p className="flex items-start gap-2 p-3 mt-3 text-xs rounded-lg bg-amber-50 text-amber-800">
                  <AlertTriangle size={14} className="mt-px shrink-0" /> {account.lastError || "This mailbox needs attention in Email Settings."}
                </p>
              )}

              <div className="py-3">
                <RichTextEditor initialHtml={start.html} onChange={(v) => set("html", v)} disabled={!!busy} autoFocus={!!init.source && init.mode !== "forward"} />
              </div>

              {attachCount > 0 && (
                <ul className="grid gap-2 pb-3 sm:grid-cols-2">
                  {f.kept.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs border rounded-lg border-slate-200">
                      <Paperclip size={13} className="text-slate-400 shrink-0" />
                      <span className="flex-1 truncate text-slate-700">{a.filename}</span>
                      <span className="text-slate-400">{fmtSize(a.size)}</span>
                      <button type="button" onClick={() => { set("kept", f.kept.filter((x) => x.id !== a.id)); }} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${a.filename}`}><X size={13} /></button>
                    </li>
                  ))}
                  {files.map(({ key, file }) => (
                    <li key={key} className="flex items-center gap-2 px-3 py-2 text-xs border rounded-lg border-slate-200">
                      <Paperclip size={13} className="text-slate-400 shrink-0" />
                      <span className="flex-1 truncate text-slate-700">{file.name}</span>
                      <span className="text-slate-400">{fmtSize(file.size)}</span>
                      <button type="button" onClick={() => { setFiles(files.filter((x) => x.key !== key)); setDirty(true); }} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${file.name}`}><X size={13} /></button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pb-4">
                <RecordLinker links={f.links} onChange={(v) => set("links", v)}
                  onPick={(item) => { if (item.email && !f.to.trim()) set("to", item.email); }} />
              </div>
            </div>

            {error && (
              <p className="flex items-start gap-2 px-5 py-2 text-sm text-red-700 border-t border-red-100 bg-red-50" role="alert">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-xs font-semibold">Dismiss</button>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={send} disabled={!!busy} className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60">
                {busy === "send" ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send</>}
              </button>
              <button onClick={() => saveDraft()} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save draft
              </button>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
              <button onClick={() => fileInput.current?.click()} disabled={!!busy || !canAttach} title={canAttach ? "Attach files" : `Attachments aren't supported for ${account?.providerName || "this mailbox"} yet`}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Attach files">
                <Paperclip size={17} />
              </button>
              <span className="text-xs text-slate-400">{attachCount > 0 && `${attachCount} file${attachCount > 1 ? "s" : ""} · ${fmtSize(totalBytes)} of ${fmtSize(limits.totalBytes)}`}</span>
              <div className="flex-1" />
              <button onClick={() => { if (!dirty || window.confirm("Discard this email?")) onClose(); }} disabled={!!busy} className="p-2 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Discard" title="Discard">
                <Trash2 size={17} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
