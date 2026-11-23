// Nodemailer v10 compatibility: drives the app's real SMTP service
// (services/mail/smtp.service.js) through real Nodemailer against a local,
// in-process fake SMTP server. Nothing leaves the machine.
// Run: node --test tests/smtpNodemailer10.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import nodemailer from "nodemailer";

const smtp = await import("../services/mail/smtp.service.js");

/* ---------------- minimal SMTP server ---------------- */
const GOOD_PASS = "right-pass";
const received = [];
let server, port, sawAuthLogin;

const startServer = () =>
  new Promise((resolve) => {
    server = net.createServer((sock) => {
      let buf = "", inData = false, data = "", msg = {};
      const say = (l) => sock.write(`${l}\r\n`);
      say("220 fake.test ESMTP");
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        let i;
        while ((i = buf.indexOf("\r\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (inData) {
            if (line === ".") { inData = false; received.push({ ...msg, data }); data = ""; say("250 2.0.0 queued"); }
            else data += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
            continue;
          }
          const cmd = line.toUpperCase();
          if (cmd.startsWith("EHLO")) { sock.write("250-fake.test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n"); }
          else if (cmd.startsWith("AUTH PLAIN")) {
            sawAuthLogin = true;
            const [, user, pass] = Buffer.from(line.split(" ")[2] || "", "base64").toString().split("\0");
            msg = { user };
            say(pass === GOOD_PASS ? "235 2.7.0 ok" : "535 5.7.8 bad credentials");
          }
          else if (cmd.startsWith("MAIL FROM")) { msg.from = line; say("250 ok"); }
          else if (cmd.startsWith("RCPT TO")) { (msg.rcpt ||= []).push(line); say("250 ok"); }
          else if (cmd === "DATA") { inData = true; say("354 go"); }
          else if (cmd === "QUIT") { say("221 bye"); sock.end(); }
          else if (cmd === "RSET" || cmd === "NOOP") say("250 ok");
          else say("502 unsupported");
        }
      });
      sock.on("error", () => {});
    });
    server.listen(0, "127.0.0.1", () => ((port = server.address().port), resolve()));
  });

let transportOpts;
before(async () => {
  await startServer();
  smtp.__setSmtpTestHooks({
    // Public-looking address so the SSRF guard (resolveSafeHost) still runs
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    // Real Nodemailer v10 with the app's exact options, redirected to the local
    // fake server in plain text (no real TLS endpoint is available offline)
    createTransport: (opts) => {
      transportOpts = opts;
      return nodemailer.createTransport({ ...opts, host: "127.0.0.1", port, secure: false, requireTLS: false, ignoreTLS: true, tls: {} });
    },
  });
});
after(() => server.close());

const cfg = { host: "smtp.example.com", port: 587, security: "starttls", username: "me@example.com" };

test("nodemailer is v10", async () => {
  const { createRequire } = await import("node:module");
  const v = createRequire(import.meta.url)("nodemailer/package.json").version;
  assert.match(v, /^10\./);
});

test("verifySmtp authenticates with Nodemailer v10", async () => {
  await smtp.verifySmtp(cfg, GOOD_PASS);
  assert.ok(sawAuthLogin);
  // app's hardening options are still passed through
  assert.equal(transportOpts.disableFileAccess, true);
  assert.equal(transportOpts.disableUrlAccess, true);
  assert.equal(transportOpts.tls.rejectUnauthorized, true);
  assert.equal(transportOpts.tls.minVersion, "TLSv1.2");
  assert.equal(transportOpts.requireTLS, true);
});

test("sendSmtp delivers html, cc, attachments and threading headers", async () => {
  received.length = 0;
  const out = await smtp.sendSmtp(cfg, GOOD_PASS, {
    from: "me@example.com", fromName: "Ready Tech", to: "client@example.org", cc: "cc@example.org",
    subject: "Invoice INV-1", text: "Hello", html: "<p>Hello</p>",
    attachments: [{ filename: "inv.pdf", contentType: "application/pdf", content: Buffer.from("%PDF-1.4 test") }],
    messageId: "<m1@example.com>", inReplyTo: "<p0@example.com>", references: "<p0@example.com>",
  });
  assert.equal(out.id, "<m1@example.com>");
  assert.equal(received.length, 1);
  const { data, rcpt, from } = received[0];
  assert.match(from, /me@example\.com/);
  assert.equal(rcpt.length, 2);
  for (const h of [/^From: Ready Tech <me@example\.com>/m, /^To: client@example\.org/m, /^Cc: cc@example\.org/m,
    /^Subject: Invoice INV-1/m, /^Message-ID: <m1@example\.com>/mi, /^In-Reply-To: <p0@example\.com>/m,
    /^References: <p0@example\.com>/m, /filename="?inv\.pdf"?/, /text\/html/]) {
    assert.match(data, h);
  }
});

test("wrong password maps to the friendly auth error (no secrets)", async () => {
  await assert.rejects(smtp.verifySmtp(cfg, "wrong-pass"), (err) => {
    assert.equal(err.authFailed, true);
    assert.equal(err.status, 422);
    assert.ok(!String(err.message).includes("wrong-pass"));
    return true;
  });
});

test("header injection via subject/recipient is neutralised", async () => {
  received.length = 0;
  await smtp.sendSmtp(cfg, GOOD_PASS, {
    from: "me@example.com", to: "client@example.org", subject: "Hi\r\nBcc: victim@evil.test", text: "x",
  });
  assert.equal(received[0].rcpt.length, 1);
  assert.doesNotMatch(received[0].data, /^Bcc: victim@evil\.test/m);
});

test("SSRF guard still blocks private mail hosts", async () => {
  smtp.__setSmtpTestHooks({ lookup: async () => [{ address: "127.0.0.1", family: 4 }] });
  await assert.rejects(smtp.verifySmtp(cfg, GOOD_PASS), /isn't allowed/);
  smtp.__setSmtpTestHooks({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
});
