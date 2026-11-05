// Browser-side email-HTML sanitising with DOMPurify (render-time boundary).
// The server already stores only allowlisted HTML (Backend/services/mail/
// htmlSanitizer.js); this runs again right before HTML reaches the DOM, using
// the browser's own parser, so stored or legacy content can never execute.
//
//  - sanitizeForView:    email reader (sandboxed, script-less iframe). Keeps the
//                        email's own <style> blocks, scoped to that frame.
//  - sanitizeForCompose: reply / forward quotes and drafts inside the editor,
//                        which is part of the CRM page itself — so CSS, class
//                        and id are removed too (no restyling / overlaying the CRM).
import createDOMPurify from "dompurify";

// Own instance: hooks don't leak into other DOMPurify users (jsPDF)
const purify = createDOMPurify(window);

const FORBID_TAGS = [
  "script", "iframe", "frame", "frameset", "object", "embed", "applet", "form", "input", "button", "textarea",
  "select", "option", "base", "meta", "link", "svg", "math", "template", "noscript", "portal", "dialog",
  "video", "audio", "source", "track",
];
const FORBID_ATTR = ["srcset", "formaction", "action", "ping", "srcdoc", "xmlns", "autofocus", "name"];
// http(s), mailto, tel, cid and relative links only (data: images are handled by DOMPurify for <img src>)
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const BASE = { FORBID_TAGS, FORBID_ATTR, ALLOWED_URI_REGEXP, ALLOW_DATA_ATTR: false, ALLOW_UNKNOWN_PROTOCOLS: false };

purify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export const sanitizeForView = (html) => {
  if (!html) return "";
  const root = purify.sanitize(String(html), { ...BASE, WHOLE_DOCUMENT: true, RETURN_DOM: true });
  const headStyles = [...(root.querySelector("head")?.querySelectorAll("style") || [])].map((s) => s.outerHTML).join("");
  return headStyles + (root.querySelector("body")?.innerHTML || "");
};

export const sanitizeForCompose = (html) =>
  html
    ? purify.sanitize(String(html), {
        ...BASE,
        FORBID_TAGS: [...FORBID_TAGS, "style"],
        FORBID_ATTR: [...FORBID_ATTR, "style", "class", "id"],
      })
    : "";
