// services/mail/smtp.service.js — custom-domain SMTP (Hostinger, cPanel, …)
// via Nodemailer. Hostnames only; every connection resolves DNS itself,
// refuses private / internal addresses (SSRF) and pins the vetted IP while
// still validating the TLS certificate against the hostname.
import net from "node:net";
import dns from "node:dns/promises";
import nodemailer from "nodemailer";

export const SMTP_PORTS = { ssl: [465], starttls: [587, 25, 2525] };
const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Private, loopback, link-local, CGNAT, multicast, reserved and documentation ranges */
const blocked = new net.BlockList();
[
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
].forEach(([a, p]) => blocked.addSubnet(a, p, "ipv4"));
[
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32],
  ["64:ff9b::", 96], ["100::", 64], ["2002::", 16],
].forEach(([a, p]) => blocked.addSubnet(a, p, "ipv6"));

export const isBlockedIp = (ip) => {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isBlockedIp(mapped[1]);
  const type = net.isIP(ip);
  if (!type) return true;
  return blocked.check(ip, type === 4 ? "ipv4" : "ipv6");
};

/* Test seams (DNS + transport) — never used in production code paths */
let lookup = (host) => dns.lookup(host, { all: true, verbatim: true });
let createTransport = (opts) => nodemailer.createTransport(opts);
export const __setSmtpTestHooks = (h = {}) => {
  if (h.lookup) lookup = h.lookup;
  if (h.createTransport) createTransport = h.createTransport;
};

const fail = (message, status = 422, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const clean = (v, max) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

/* Validates admin input. `password` may be omitted on update (keeps existing). */
export const validateSmtpInput = (body = {}, { requirePassword = true } = {}) => {
  const email = clean(body.email, 254).toLowerCase();
  const host = clean(body.host, 253).toLowerCase().replace(/\.$/, "");
  const security = String(body.security || "").toLowerCase();
  const port = Number(body.port);
  const username = clean(body.username, 254) || email;
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = clean(body.displayName, 100);

  if (!EMAIL_RE.test(email)) throw fail("Enter a valid email address");
  if (!HOST_RE.test(host)) throw fail("Enter the SMTP server hostname (for example smtp.hostinger.com) — IP addresses aren't accepted");
  if (!SMTP_PORTS[security]) throw fail("Choose SSL or STARTTLS");
  if (!SMTP_PORTS[security].includes(port)) {
    throw fail(security === "ssl" ? "SSL uses port 465" : "STARTTLS uses port 587 (or 25 / 2525)");
  }
  if (requirePassword && !password) throw fail("Enter the mailbox password");
  if (password.length > 512) throw fail("Password is too long");
  return { email, host, port, security, username, password, displayName };
};

/* Resolve and vet every address; returns the first public one */
export const resolveSafeHost = async (host) => {
  let addrs;
  try {
    addrs = await Promise.race([
      lookup(host),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
    ]);
  } catch {
    throw fail(`We couldn't find the mail server "${host}". Check the SMTP host.`);
  }
  const list = (Array.isArray(addrs) ? addrs : [addrs]).map((a) => a.address || a).filter(Boolean);
  if (!list.length) throw fail(`We couldn't find the mail server "${host}". Check the SMTP host.`);
  if (list.some(isBlockedIp)) throw fail("This mail server address isn't allowed. Use your provider's public SMTP hostname.");
  return list[0];
};

const transportFor = (cfg, password, ip) =>
  createTransport({
    host: ip,
    port: cfg.port,
    secure: cfg.security === "ssl",
    requireTLS: cfg.security === "starttls",
    ignoreTLS: false,
    servername: cfg.host,
    auth: { user: cfg.username, pass: password },
    tls: { servername: cfg.host, minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });

/* Friendly, secret-free messages for Nodemailer errors */
const friendly = (err, cfg) => {
  const code = String(err.code || "");
  const msg = String(err.message || "");
  if (code === "EAUTH" || err.responseCode === 535 || err.responseCode === 534) {
    return fail("The mail server rejected the username or password. Check them (some providers need an app password).", 422, { authFailed: true });
  }
  if (/CERT|certificate|self.signed|altname/i.test(code + msg)) {
    return fail(`The SSL certificate of ${cfg.host} isn't valid for that hostname. Use the SMTP hostname from your email provider.`);
  }
  if (/ETIMEDOUT|ECONNECTION|ECONNREFUSED|ESOCKET|ECONNRESET|EHOSTUNREACH|ENETUNREACH|timeout/i.test(code + msg)) {
    return fail(`We couldn't reach ${cfg.host}:${cfg.port}. Check the host, port and SSL/STARTTLS setting.`);
  }
  if (code === "EENVELOPE") return fail("The mail server refused this recipient or sender address.", 502);
  return fail("The mail server didn't accept the connection. Check your SMTP settings.");
};

/* Connect + authenticate without sending anything */
export const verifySmtp = async (cfg, password) => {
  const ip = await resolveSafeHost(cfg.host);
  const t = transportFor(cfg, password, ip);
  try {
    await t.verify();
  } catch (err) {
    console.error(`SMTP verify failed for ${cfg.host}:${cfg.port}:`, err.code || err.message);
    throw friendly(err, cfg);
  } finally {
    t.close?.();
  }
};

/* Optional rich fields (cc, bcc, html, attachments as Buffers, threading
   headers) are only passed to Nodemailer when present. File / URL access is
   disabled on the transport, so attachment content must be a Buffer. */
export const sendSmtp = async (cfg, password, { from, fromName, to, subject, text, cc, bcc, html, attachments, messageId, inReplyTo, references }) => {
  const ip = await resolveSafeHost(cfg.host);
  const t = transportFor(cfg, password, ip);
  try {
    const info = await t.sendMail({
      from: fromName ? { name: fromName, address: from } : from, to, subject, text,
      ...(cc && { cc }), ...(bcc && { bcc }), ...(html && { html }),
      ...(attachments?.length && {
        attachments: attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.content) })),
      }),
      ...(messageId && { messageId }), ...(inReplyTo && { inReplyTo }), ...(references && { references }),
    });
    return { id: info?.messageId || null };
  } catch (err) {
    console.error(`SMTP send failed for ${cfg.host}:${cfg.port}:`, err.code || err.message);
    throw friendly(err, cfg);
  } finally {
    t.close?.();
  }
};
