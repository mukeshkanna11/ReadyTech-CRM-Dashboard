// services/mail/htmlSanitizer.js — allowlist email-HTML sanitiser (server side).
//
// Defence in depth: the browser re-sanitises with DOMPurify before rendering
// (Frontend/src/pages/Integrations/mail/sanitize.js) and shows email bodies in
// a sandboxed, script-less iframe. This module makes sure nothing executable
// is ever STORED or SENT: the input is tokenised the way browsers split tags
// and attributes, and the output is rebuilt from allowed tags / attributes
// only, with every attribute value decoded and re-escaped by us. Raw input
// markup is never copied through.
//
// No dependency: the backend has no HTML parser installed, and two lockfiles
// (npm + yarn) make adding one risky. Kept deliberately small and strict.

const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "big", "blockquote", "br", "caption", "center",
  "cite", "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure",
  "font", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "li", "main",
  "mark", "nav", "ol", "p", "pre", "q", "s", "samp", "section", "small", "span", "strike", "strong", "sub",
  "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "tt", "u", "ul", "var", "wbr",
]);
const VOID_TAGS = new Set(["br", "col", "hr", "img", "wbr"]);
// Raw-text / dangerous containers: the tag AND everything inside is removed
const DROP_WITH_CONTENT = new Set([
  "script", "iframe", "frame", "frameset", "object", "embed", "applet", "noscript", "noembed", "noframes",
  "template", "xmp", "plaintext", "textarea", "title", "svg", "math", "select", "option", "form", "button", "input",
]);
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);

const GLOBAL_ATTRS = new Set(["align", "dir", "lang", "style", "title", "class", "valign", "bgcolor", "width", "height"]);
const TAG_ATTRS = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "border", "hspace", "vspace"]),
  table: new Set(["border", "cellpadding", "cellspacing", "background", "summary", "frame", "rules"]),
  td: new Set(["colspan", "rowspan", "background", "nowrap", "abbr", "axis", "headers", "scope"]),
  th: new Set(["colspan", "rowspan", "background", "nowrap", "abbr", "axis", "headers", "scope"]),
  tr: new Set(["background"]),
  tbody: new Set(["background"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  font: new Set(["color", "face", "size"]),
  ol: new Set(["start", "type", "reversed"]),
  ul: new Set(["type"]),
  li: new Set(["value", "type"]),
  blockquote: new Set(["cite"]),
  q: new Set(["cite"]),
  del: new Set(["cite", "datetime"]),
  ins: new Set(["cite", "datetime"]),
  time: new Set(["datetime"]),
  details: new Set(["open"]),
  div: new Set(["background"]),
};
const URL_ATTRS = new Set(["href", "src", "background", "cite"]);
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel", "cid"]);
const SAFE_DATA_IMAGE = /^data:image\/(png|gif|jpe?g|webp|bmp);base64,[a-z0-9+/=\s]+$/i;

/* ---------- entity decoding (attribute values / CSS checks) ---------- */
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", colon: ":", tab: "\t", newline: "\n",
  sol: "/", lpar: "(", rpar: ")", comma: ",", period: ".", semi: ";", equals: "=", num: "#", excl: "!",
  bsol: "\\", lowbar: "_", hyphen: "-", dash: "-", quest: "?", percnt: "%", plus: "+", commat: "@",
};
// Legacy names browsers also accept without ";" — but, inside attribute values,
// not when followed by a letter, digit or "=" (so "?id=1&num=5" stays a query string)
const LEGACY = new Set(["amp", "lt", "gt", "quot", "nbsp"]);
export const decodeEntities = (s) =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*)(;?)/gi, (m, e, semi, offset, all) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    const v = NAMED[e.toLowerCase()];
    if (v === undefined) return m;
    if (semi) return v;
    const next = all[offset + m.length] || "";
    return LEGACY.has(e.toLowerCase()) && !/[a-z0-9=]/i.test(next) ? v : m;
  });

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* URL is allowed when it has no scheme (relative / fragment) or a safe one.
   Control characters and whitespace are removed first, as browsers do. */
export const safeUrl = (raw, attr) => {
  const v = decodeEntities(raw).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "");
  if (!v) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)?.[1]?.toLowerCase();
  if (!scheme) {
    // Relative / fragment links only; nothing that could be read as markup or a new token
    const rel = decodeEntities(raw).trim();
    return /^[/?#.\w-]/.test(v) && !/[<>"'`\s\\]/.test(rel) ? rel : null;
  }
  if (scheme === "data") return attr === "src" && SAFE_DATA_IMAGE.test(v) ? v : null;
  return SAFE_SCHEMES.has(scheme) ? decodeEntities(raw).trim() : null;
};

/* CSS: decode entities + CSS escapes, then refuse anything that can run code,
   load non-http(s) resources or change behaviour */
const decodeCss = (s) =>
  decodeEntities(s)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h) => {
      const c = parseInt(h, 16);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(/\\(.)/g, "$1");
const CSS_DANGER = /expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|-moz-binding|@import|@charset|<\s*\/|url\s*\(\s*['"]?\s*(?!https?:|data:image\/(png|gif|jpe?g|webp);|cid:)[a-z0-9+.-]+:/i;
export const safeCss = (css) => {
  const text = String(css);
  return CSS_DANGER.test(decodeCss(text).replace(/[\u0000-\u0020]+/g, " ")) ? null : text.replace(/[<>]/g, "");
};

/* ---------- tokenizer (mirrors how browsers split a tag) ---------- */
const WS = /[\t\n\f\r ]/;
const parseTag = (s, start) => {
  let j = start + 1;
  let closing = false;
  if (s[j] === "/") {
    closing = true;
    j++;
  }
  if (!/[a-z]/i.test(s[j] || "")) return null; // not a tag: "<" is text
  let k = j;
  while (k < s.length && !WS.test(s[k]) && s[k] !== "/" && s[k] !== ">") k++;
  const name = s.slice(j, k).toLowerCase();
  j = k;
  const attrs = [];
  for (;;) {
    while (j < s.length && (WS.test(s[j]) || s[j] === "/")) j++;
    if (j >= s.length) return { closing, name, attrs, end: s.length, unterminated: true };
    if (s[j] === ">") return { closing, name, attrs, end: j + 1 };
    // attribute name: up to whitespace, "/", ">" or "=" (a leading "=" belongs to the name)
    k = j + (s[j] === "=" ? 1 : 0);
    while (k < s.length && !WS.test(s[k]) && s[k] !== "/" && s[k] !== ">" && s[k] !== "=") k++;
    const attr = s.slice(j, k).toLowerCase();
    j = k;
    while (j < s.length && WS.test(s[j])) j++;
    let value = "";
    if (s[j] === "=") {
      j++;
      while (j < s.length && WS.test(s[j])) j++;
      if (s[j] === '"' || s[j] === "'") {
        const q = s[j];
        const e = s.indexOf(q, j + 1);
        value = s.slice(j + 1, e === -1 ? s.length : e);
        j = e === -1 ? s.length : e + 1;
      } else {
        k = j;
        while (k < s.length && !WS.test(s[k]) && s[k] !== ">") k++;
        value = s.slice(j, k);
        j = k;
      }
    }
    attrs.push([attr, value]);
  }
};

const buildAttrs = (tag, attrs) => {
  const out = [];
  const seen = new Set();
  for (const [name, raw] of attrs) {
    if (seen.has(name)) continue; // browsers keep the first occurrence
    seen.add(name);
    if (!(GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name))) continue;
    let value = raw;
    if (URL_ATTRS.has(name)) {
      value = safeUrl(raw, name);
      if (value == null) continue;
    } else if (name === "style") {
      value = safeCss(decodeEntities(raw));
      if (value == null) continue;
    } else {
      value = decodeEntities(raw);
    }
    out.push(` ${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a") out.push(' target="_blank" rel="noopener noreferrer"');
  return out.join("");
};

/* Text between tags never contains "<" (we split on it); ">" is escaped too */
const text = (s) => s.replace(/>/g, "&gt;");

export const sanitizeEmailHtml = (input) => {
  const s = String(input ?? "");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out.push(text(s.slice(i)));
      break;
    }
    out.push(text(s.slice(i, lt)));
    // Comments, doctype, CDATA, processing instructions → dropped
    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt + 4);
      i = end === -1 ? s.length : end + 3;
      continue;
    }
    if (s[lt + 1] === "!" || s[lt + 1] === "?") {
      const end = s.indexOf(">", lt);
      i = end === -1 ? s.length : end + 1;
      continue;
    }
    const tag = parseTag(s, lt);
    if (!tag) {
      out.push("&lt;");
      i = lt + 1;
      continue;
    }
    i = tag.end;
    if (tag.unterminated) break; // a half tag at the end is discarded

    const { name } = tag;
    // Raw-text elements: their content is not markup — skip to the closing tag
    if (!tag.closing && RAW_TEXT.has(name)) {
      const close = s.toLowerCase().indexOf(`</${name}`, i);
      const body = s.slice(i, close === -1 ? s.length : close);
      i = close === -1 ? s.length : (s.indexOf(">", close) === -1 ? s.length : s.indexOf(">", close) + 1);
      if (name === "style") {
        const css = safeCss(body);
        if (css != null && css.trim()) out.push(`<style>${css}</style>`);
      }
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!tag.closing) {
        // Non raw-text dangerous containers (svg, math, object, …): skip to their end
        const close = s.toLowerCase().indexOf(`</${name}`, i);
        i = close === -1 ? s.length : (s.indexOf(">", close) === -1 ? s.length : s.indexOf(">", close) + 1);
      }
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue; // unknown / disallowed tag: dropped, its text content stays
    if (tag.closing) {
      if (!VOID_TAGS.has(name)) out.push(`</${name}>`);
      continue;
    }
    out.push(`<${name}${buildAttrs(name, tag.attrs)}>`);
  }
  return out.join("");
};
