import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Quote, RemoveFormatting } from "lucide-react";
import { sanitizeForCompose } from "./sanitize";

/* Lightweight rich-text editor (contentEditable). The server sanitises the
   HTML again before storing / sending it. */
const TOOLS = [
  { cmd: "bold", icon: Bold, label: "Bold (Ctrl+B)" },
  { cmd: "italic", icon: Italic, label: "Italic (Ctrl+I)" },
  { cmd: "underline", icon: Underline, label: "Underline (Ctrl+U)" },
  { cmd: "insertUnorderedList", icon: List, label: "Bulleted list" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { cmd: "formatBlock", arg: "blockquote", icon: Quote, label: "Quote" },
  { cmd: "createLink", icon: Link2, label: "Insert link" },
  { cmd: "removeFormat", icon: RemoveFormatting, label: "Clear formatting" },
];

export default function RichTextEditor({ initialHtml, onChange, disabled, autoFocus, placeholder = "Write your message…" }) {
  const ref = useRef(null);

  // Uncontrolled after mount: the caret must not jump on every keystroke
  useEffect(() => {
    // The only place email HTML enters the CRM page DOM: always DOMPurify first
    if (ref.current) ref.current.innerHTML = sanitizeForCompose(initialHtml);
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange?.(ref.current?.innerHTML || "");

  const run = (t) => {
    ref.current?.focus();
    if (t.cmd === "createLink") {
      const url = window.prompt("Link URL (https://…)");
      if (!url) return;
      if (!/^(https?:|mailto:)/i.test(url.trim())) return window.alert("Links must start with https://, http:// or mailto:");
      document.execCommand("createLink", false, url.trim());
    } else {
      document.execCommand(t.cmd, false, t.arg);
    }
    emit();
  };

  // Paste as plain text: keeps foreign styles / scripts out of the message
  const onPaste = (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  };

  return (
    <div className={`flex flex-col min-h-0 border rounded-xl border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/60 rounded-t-xl" role="toolbar" aria-label="Formatting">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" title={t.label} aria-label={t.label} disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={() => run(t)}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50">
            <t.icon size={15} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        data-placeholder={placeholder}
        className="flex-1 min-h-[180px] max-h-[45vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-800 focus:outline-none prose-sm
          [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500
          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-indigo-600 [&_a]:underline
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
    </div>
  );
}
