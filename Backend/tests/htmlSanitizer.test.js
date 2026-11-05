// Security tests for the email-HTML sanitiser with malicious samples
// (OWASP XSS filter-evasion style + mutation-XSS shapes) and real email markup.
// Run: node --test tests/htmlSanitizer.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml as clean, decodeEntities, safeUrl } from "../services/mail/htmlSanitizer.js";

const ALLOWED = new Set(
  ("a abbr address article aside b bdi bdo big blockquote br caption center cite code col colgroup dd del details dfn div dl dt em " +
   "figcaption figure font footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li main mark nav ol p pre q s samp section small span " +
   "strike strong sub summary sup table tbody td tfoot th thead time tr tt u ul var wbr style").split(" ")
);
const URL_ATTRS = new Set(["href", "src", "background", "cite"]);
const TAG_RE = /<\/?([a-z0-9]+)((?:\s[a-z-]+="[^"<>]*")*)>/g;

/* Structural proof that output is inert: only our own well-formed tags remain */
const assertSafe = (input) => {
  const out = clean(input);
  const ctx = `input: ${input}\noutput: ${out}`;
  const withoutStyle = out.replace(/<style>[^<>]*<\/style>/g, "");
  assert.doesNotMatch(withoutStyle.replace(TAG_RE, ""), /</, `stray markup\n${ctx}`);
  for (const [, name, attrs] of withoutStyle.matchAll(TAG_RE)) {
    assert.ok(ALLOWED.has(name), `tag <${name}> not allowed\n${ctx}`);
    for (const [, attr, raw] of attrs.matchAll(/\s([a-z-]+)="([^"]*)"/g)) {
      assert.doesNotMatch(attr, /^on/, `event handler ${attr}\n${ctx}`);
      assert.notEqual(attr, "srcdoc", ctx);
      const value = decodeEntities(raw).replace(/[\u0000- ]/g, "").toLowerCase();
      if (URL_ATTRS.has(attr)) {
        const scheme = /^([a-z][a-z0-9+.-]*):/.exec(value)?.[1];
        assert.ok(!scheme || ["http", "https", "mailto", "tel", "cid"].includes(scheme) || /^data:image\/(png|gif|jpe?g|webp|bmp);/.test(value), `unsafe URL ${attr}\n${ctx}`);
      }
      if (attr === "style") assert.doesNotMatch(value, /expression\(|javascript:|vbscript:|behavior:|-moz-binding|@import/, ctx);
    }
  }
  assert.doesNotMatch(out, /javascript:|vbscript:|<script|<iframe|<object|<embed|<svg|<math|<form|<meta|<base|<link|srcdoc|expression\(/i, ctx);
  return out;
};

const MALICIOUS = [
  // scripts
  `<script>alert(1)</script>`,
  `<SCRIPT SRC=//evil.example/x.js></SCRIPT>`,
  `<scr<script>ipt>alert(1)</script>`,
  `<script>/*</script><img src=x onerror=alert(1)>*/</script>`,
  // event handlers in every spelling
  `<img src=x onerror=alert(1)>`,
  `<img/src=x/onerror=alert(1)>`,
  `<img/onerror=alert(1)/src=x>`,
  `<img src=x alt="a"onerror=alert(1)>`,
  `<img src="x" onerror  =  "alert(1)">`,
  `<img src=x onerror=&#97;lert(1)>`,
  `<IMG SRC=x ONERROR=alert(1)>`,
  `<img src="https://x.example/a.png" onload="alert(1)">`,
  `<img src=x:alert(alt) onerror=eval(src) alt=0>`,
  `<body onload=alert(1)>`,
  `<details open ontoggle=alert(1)>`,
  `<input onfocus=alert(1) autofocus>`,
  `<video><source onerror=alert(1)></video>`,
  `<audio src=x onerror=alert(1)>`,
  `<marquee onstart=alert(1)>x</marquee>`,
  `<x onclick=alert(1)>click</x>`,
  `<a href="#" onclick="alert(1)">x</a>`,
  `<a href='x' onmouseover='alert(1)'>x</a>`,
  `<div =onclick=alert(1)>x</div>`,
  `<isindex type=image src=1 onerror=alert(1)>`,
  // javascript: / vbscript: / data: URLs
  `<a href="javascript:alert(1)">x</a>`,
  `<a href="JaVaScRiPt:alert(1)">x</a>`,
  `<a href="java&#115;cript:alert(1)">x</a>`,
  `<a href="java&#x09;script:alert(1)">x</a>`,
  `<a href="jav\tascript:alert(1)">x</a>`,
  `<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>`,
  `<a href="&#0000106avascript:alert(1)">x</a>`,
  `<a href="&#x6A;avascript&#x3A;alert(1)">x</a>`,
  `<a href=" javascript:alert(1)">x</a>`,
  `<a href="javascript&colon;alert(1)">x</a>`,
  `<a href="\u0001javascript:alert(1)">x</a>`,
  `<a href="vbscript:msgbox(1)">x</a>`,
  `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`,
  `<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">`,
  `<table background="javascript:alert(1)"><tr><td background="javascript:alert(1)">x</td></tr></table>`,
  `<blockquote cite="javascript:alert(1)">q</blockquote>`,
  // embeds / frames / forms / document-level tags
  `<iframe src="javascript:alert(1)"></iframe>`,
  `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  `<object data="javascript:alert(1)"></object>`,
  `<embed src="data:text/html,<script>alert(1)</script>">`,
  `<form action="javascript:alert(1)"><button>x</button></form>`,
  `<button formaction=javascript:alert(1)>x</button>`,
  `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`,
  `<base href="javascript:alert(1)//">`,
  `<link rel=stylesheet href="javascript:alert(1)">`,
  `<svg onload=alert(1)>`,
  `<svg><script>alert(1)</script></svg>`,
  `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
  `<template><img src=x onerror=alert(1)></template>`,
  // CSS
  `<div style="background:url(javascript:alert(1))">x</div>`,
  `<div style="width: expression(alert(1))">x</div>`,
  `<div style="background:url(&#106;avascript:alert(1))">x</div>`,
  `<div style="background:url(\\6a avascript:alert(1))">x</div>`,
  `<div style="behavior: url(x.htc)">x</div>`,
  `<div style="-moz-binding:url(http://x/x.xml#xss)">x</div>`,
  `<style>@import 'javascript:alert(1)';</style>`,
  `<style>body{background:url("javascript:alert(1)")}</style>`,
  `<style></style><img src=x onerror=alert(1)>`,
  `<style><img src=x onerror=alert(1)></style>`,
  `<style>x{}</style ><script>alert(1)</script>`,
  // comments / CDATA / raw-text mutation shapes
  `<!--<img src=x onerror=alert(1)>-->`,
  `<!--><img src=x onerror=alert(1)>-->`,
  `<![CDATA[<img src=x onerror=alert(1)>]]>`,
  `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
  `<textarea><img src=x onerror=alert(1)></textarea>`,
  `<title><img src=x onerror=alert(1)></title>`,
  `<xmp><img src=x onerror=alert(1)></xmp>`,
  `<div><img src=x onerror=alert(1)//`,
  `<a href="https://ok.example"<script>alert(1)</script>`,
  `<a title="a>b" href="javascript:alert(1)">x</a>`,
  `<img src="x\` \`<script>alert(1)</script>"\` \`>`,
  `"><script>alert(1)</script>`,
  `<<script>script>alert(1)<</script>/script>`,
];

test(`malicious samples (${MALICIOUS.length}) are all neutralised`, () => {
  for (const sample of MALICIOUS) assertSafe(sample);
});

test("handlers and unsafe URLs are removed while the element and its text survive", () => {
  // Spec: an unquoted value runs to whitespace or ">" — browsers see src="x/onerror=alert(1)", no handler
  assert.equal(clean(`<img/src=x/onerror=alert(1)>`), `<img src="x/onerror=alert(1)">`);
  assert.equal(clean(`<img/onerror=alert(1)/src=x>`), `<img>`);
  assert.equal(clean(`<img src=x alt="a"onerror=alert(1)>`), `<img src="x" alt="a">`);
  assert.equal(clean(`<a href="java&#115;cript:alert(1)">Click</a>`), `<a target="_blank" rel="noopener noreferrer">Click</a>`);
  assert.equal(clean(`<x onclick=alert(1)>click</x>`), `click`);
  assert.equal(clean(`<iframe srcdoc="<script>alert(1)</script>"></iframe>after`), `after`);
  assert.equal(clean(`<p>2 < 3 & 4 > 1</p>`), `<p>2 &lt; 3 & 4 &gt; 1</p>`);
  assert.equal(clean(`<div style="width: expression(alert(1))">x</div>`), `<div>x</div>`);
});

test("legitimate email formatting, links and images are preserved", () => {
  const email = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title>
<style>.btn{color:#fff;background:#4f46e5;padding:8px 12px}@media (max-width:600px){.w{width:100%!important}}</style></head>
<body style="margin:0"><table width="600" cellpadding="0" cellspacing="0" border="0" class="w" style="border:1px solid #eee">
<tr><td align="center" valign="top" bgcolor="#f8fafc"><h1 style="font-family:Arial,sans-serif;color:#0f172a">Invoice</h1>
<p>Hi <b>Mukesh</b>, <i>thanks</i> &amp; <u>regards</u>.</p>
<a href="https://readytech.in/pay?id=1&amp;x=2" class="btn" target="_top">Pay now</a><br>
<img src="https://cdn.readytech.in/logo.png" alt="Logo" width="120" height="40" style="display:block">
<img src="cid:logo123@readytech" alt="inline"><img src="data:image/png;base64,iVBORw0KGgo=" alt="dot">
<ul><li>One</li><li>Two</li></ul><ol start="3"><li>Three</li></ol>
<blockquote cite="https://example.com/q" style="border-left:2px solid #ccc">Quoted</blockquote>
<a href="mailto:sales@readytech.in?subject=Hi">mail</a> <a href="tel:+911234567890">call</a> <a href="#top">top</a> <a href="/relative/path">rel</a>
<font color="#ff0000" face="Arial" size="2">red</font><hr><pre>code  block</pre>
<div class="gmail_quote"><div class="gmail_attr">On Thu, ReadyTech &lt;owner@readytech.in&gt; wrote:</div></div>
</td></tr></table></body></html>`;
  const out = assertSafe(email);
  for (const keep of [
    `<style>.btn{color:#fff;background:#4f46e5;padding:8px 12px}@media (max-width:600px){.w{width:100%!important}}</style>`,
    `<table width="600" cellpadding="0" cellspacing="0" border="0" class="w" style="border:1px solid #eee">`,
    `<td align="center" valign="top" bgcolor="#f8fafc">`,
    `<h1 style="font-family:Arial,sans-serif;color:#0f172a">Invoice</h1>`,
    `<p>Hi <b>Mukesh</b>, <i>thanks</i> &amp; <u>regards</u>.</p>`,
    `<a href="https://readytech.in/pay?id=1&amp;x=2" class="btn" target="_blank" rel="noopener noreferrer">Pay now</a>`,
    `<img src="https://cdn.readytech.in/logo.png" alt="Logo" width="120" height="40" style="display:block">`,
    `<img src="cid:logo123@readytech" alt="inline">`,
    `<img src="data:image/png;base64,iVBORw0KGgo=" alt="dot">`,
    `<ol start="3"><li>Three</li></ol>`,
    `<blockquote cite="https://example.com/q" style="border-left:2px solid #ccc">Quoted</blockquote>`,
    `<a href="mailto:sales@readytech.in?subject=Hi" target="_blank" rel="noopener noreferrer">mail</a>`,
    `<a href="tel:+911234567890" target="_blank" rel="noopener noreferrer">call</a>`,
    `<a href="#top" target="_blank" rel="noopener noreferrer">top</a>`,
    `<a href="/relative/path" target="_blank" rel="noopener noreferrer">rel</a>`,
    `<font color="#ff0000" face="Arial" size="2">red</font>`,
    `<pre>code  block</pre>`,
    `<div class="gmail_quote"><div class="gmail_attr">On Thu, ReadyTech &lt;owner@readytech.in&gt; wrote:</div></div>`,
  ]) assert.ok(out.includes(keep), `missing: ${keep}\n---\n${out}`);
  // document-level wrappers and metadata are dropped (we render inside our own document)
  assert.doesNotMatch(out, /<html|<head|<body|<meta|<title|Invoice<\/title|DOCTYPE/i);
});

test("composer output (b/i/u, lists, quotes, links) round-trips unchanged", () => {
  const composed = `<div>Hello <b>bold</b> <i>it</i> <u>u</u></div><ul><li>a</li></ul><ol><li>b</li></ol><blockquote>q</blockquote><div><a href="https://x.example/p?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">link</a><br></div>`;
  assert.equal(clean(composed), composed);
  assert.equal(clean(clean(composed)), composed); // idempotent
});

test("URL helper: scheme detection after decoding and stripping control characters", () => {
  for (const bad of ["javascript:x", " JAVASCRIPT:x", "java\nscript:x", "jav&#x0A;ascript:x", "&#x6a;avascript:x", "vbscript:x", "data:text/html,x", "file:///etc/passwd", "ms-settings:x"]) {
    assert.equal(safeUrl(bad, "href"), null, bad);
  }
  assert.equal(safeUrl("data:image/png;base64,AAAA", "href"), null, "data images only in src");
  assert.equal(safeUrl("data:image/png;base64,AAAA", "src"), "data:image/png;base64,AAAA");
  assert.equal(safeUrl("x` `<script>", "src"), null);
  for (const ok of ["https://a.example/x?y=1&z=2", "http://a.example", "mailto:a@b.co", "tel:+91", "cid:img1", "#frag", "/path", "page.html?x=a:b"]) {
    assert.ok(safeUrl(ok, "href"), ok);
  }
});

test("query strings with &name= parameters are preserved (attribute entity rules)", () => {
  assert.equal(clean(`<a href="https://shop.example/item?id=3&num=5">x</a>`), `<a href="https://shop.example/item?id=3&amp;num=5" target="_blank" rel="noopener noreferrer">x</a>`);
  assert.equal(clean(`<a href="https://x.example/?a=1&lt=2&quest=3&plus=4&tab=5&copy=6">x</a>`), `<a href="https://x.example/?a=1&amp;lt=2&amp;quest=3&amp;plus=4&amp;tab=5&amp;copy=6" target="_blank" rel="noopener noreferrer">x</a>`);
  assert.equal(clean(`<a href="https://x.example/?q=a&amp;b=2">x</a>`), `<a href="https://x.example/?q=a&amp;b=2" target="_blank" rel="noopener noreferrer">x</a>`);
  assert.equal(clean(`<img src="x.png" alt="Tom &amp Jerry &nbspok &quot;hi&quot;">`), `<img src="x.png" alt="Tom &amp; Jerry &amp;nbspok &quot;hi&quot;">`);
  // still decoded exactly where browsers decode → obfuscated schemes stay blocked
  assert.equal(decodeEntities("java&#115cript&colon;x"), "javascript:x");
  assert.equal(decodeEntities("javascript&colonx"), "javascript&colonx"); // browsers don't decode this either → no scheme
  assertSafe(`<a href="javascript&colonalert(1)">x</a>`);
});
