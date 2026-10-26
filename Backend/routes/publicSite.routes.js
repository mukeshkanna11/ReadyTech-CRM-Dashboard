// routes/publicSite.routes.js — public, login-free homepage and privacy
// policy and terms served as static HTML on the API domain (crmreadytechsolutions.in),
// which is the domain of the Google OAuth redirect URI. Required for Google
// OAuth branding verification. Non-HTML requests to "/" keep the JSON
// status response (monitors / API clients are unaffected).
import express from "express";

const router = express.Router();

const COMPANY = "Ready Tech Solutions";
const PRODUCT = "ReadyTech CRM + ERP";
const OWNER = "SIVASHANKAR";
const SUPPORT_EMAIL = "quries.readytechsolutions@gmail.com";
const LAST_UPDATED = "26 October 2026";
const appUrl = () => (process.env.CLIENT_URL || "https://readytech-crm-site.netlify.app").replace(/\/+$/, "");

const page = (title, description, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b;background:#f8fafc;line-height:1.65}
  a{color:#4f46e5}header,footer{background:#fff;border-bottom:1px solid #e2e8f0}footer{border-top:1px solid #e2e8f0;border-bottom:0;margin-top:48px}
  .wrap{max-width:960px;margin:0 auto;padding:0 20px}.bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:16px 0}
  .brand{font-weight:700;color:#0f172a;text-decoration:none;font-size:18px}nav a{margin-left:16px;text-decoration:none;font-weight:600;font-size:14px}
  .btn{display:inline-block;background:#4f46e5;color:#fff!important;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:600}
  .hero{padding:56px 0 24px}.hero h1{font-size:clamp(28px,5vw,42px);line-height:1.2;margin:0 0 12px;color:#0f172a}.hero p{font-size:18px;color:#475569;max-width:720px}
  .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px}
  .card h3{margin:0 0 8px;color:#0f172a}.card ul{margin:0;padding-left:18px;color:#475569}
  main.doc{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px 28px;margin-top:32px}main.doc h1{margin-top:0;color:#0f172a}
  main.doc h2{font-size:20px;margin-top:32px;color:#0f172a}main.doc h3{font-size:16px;margin-bottom:4px}.muted{color:#64748b;font-size:14px}
  .note{background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:12px 16px}
  .foot{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding:20px 0;font-size:14px;color:#64748b}.foot a{margin-right:16px}
</style>
</head>
<body>
<header><div class="wrap bar">
  <a class="brand" href="/">${PRODUCT}</a>
  <nav><a href="/">Home</a><a href="/privacy-policy">Privacy Policy</a><a href="/terms">Terms</a><a href="${appUrl()}/login">Sign in</a></nav>
</div></header>
${body}
<footer><div class="wrap foot">
  <div>&copy; ${new Date().getFullYear()} ${COMPANY}. All rights reserved.</div>
  <div><a href="/privacy-policy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="${appUrl()}/data-deletion">Data Deletion</a><a href="mailto:${SUPPORT_EMAIL}">Contact</a></div>
</div></footer>
</body>
</html>`;

const homepage = () => page(
  `${PRODUCT} — Business management by ${COMPANY}`,
  `${PRODUCT} is a combined CRM and ERP platform for managing leads, clients, invoices, inventory, HR and customer communication.`,
  `<div class="wrap">
<section class="hero">
  <h1>${PRODUCT}</h1>
  <p>One workspace for your sales pipeline, customers, invoicing, inventory and HR — built by ${COMPANY}. Each business gets its own isolated workspace, and only users of that workspace can access its data.</p>
  <p><a class="btn" href="${appUrl()}/login">Sign in to your workspace</a></p>
</section>
<section class="grid">
  <div class="card"><h3>CRM</h3><ul><li>Lead management and follow-ups</li><li>Client records</li><li>Invoices and payments</li><li>Workflow automations</li><li>Users, roles and audit logs</li></ul></div>
  <div class="card"><h3>ERP</h3><ul><li>Products, warehouses and vendors</li><li>Purchase and sales orders</li><li>Inventory, stock adjustments and transfers</li><li>Human resources: employees, attendance, leave, payroll and payslips</li></ul></div>
  <div class="card"><h3>Communication &amp; integrations</h3><ul><li>Email leads and customers from your own connected Gmail or Microsoft 365 mailbox</li><li>Meta lead ads, WhatsApp and Instagram inboxes</li><li>SMS and WhatsApp messages to leads</li></ul></div>
  <div class="card"><h3>AI assistance</h3><ul><li>Lead analysis and client insights</li><li>Content, SEO and email drafting tools</li><li>Sales recommendations</li></ul></div>
</section>
<section class="card" style="margin-top:16px">
  <h3>Connecting Google (Gmail)</h3>
  <p class="muted">A workspace admin can optionally connect a Google account so emails written in the CRM are sent from that address. ${PRODUCT} asks Google only for your basic account identity (email address) and permission to <strong>send</strong> email on your behalf. It cannot read, search or delete the emails in your mailbox. See our <a href="/privacy-policy">Privacy Policy</a> for details.</p>
</section>
</div>`
);

const privacyPolicy = () => page(
  `Privacy Policy — ${PRODUCT}`,
  `How ${COMPANY} collects, uses, stores, shares and protects information in ${PRODUCT}, including data received from Google APIs.`,
  `<div class="wrap"><main class="doc">
<h1>Privacy Policy</h1>
<p class="muted">Last updated: ${LAST_UPDATED}</p>
<p>${COMPANY}, operated by ${OWNER} ("we", "us", "our"), provides ${PRODUCT} (the "Service"), available at crmreadytechsolutions.in and the ReadyTech web application. This policy explains what information we collect, how we use it, and the choices you have. It applies to all users of the Service, including users who connect a Google account.</p>

<h2>1. Information we collect</h2>
<h3>Account information</h3>
<p>Name, business name, email address, phone number, role and password. Passwords are stored only in hashed form.</p>
<h3>Business data you enter</h3>
<p>Leads, clients, products, inventory and warehouse data, purchase and sales orders, invoices and payments, HR and payroll records, notes, activities and files that you or your organisation add to the Service. Each organisation's data is kept in its own workspace.</p>
<h3>Integration data</h3>
<p>If you choose to connect a third-party service, we receive only the data allowed by the permissions you grant. For Meta (Facebook Lead Ads, Instagram, WhatsApp Business) this can include lead form submissions and conversation messages with your business. Google data is described in section 2.</p>
<h3>Technical data</h3>
<p>IP address, browser and device information, timestamps and audit-log entries used for security, troubleshooting and abuse prevention.</p>

<h2>2. Google user data (Gmail integration)</h2>
<p>Connecting a Google account is optional and can only be done by a workspace admin, who signs in on Google's own page. We never see or store your Google password.</p>
<h3>Permissions we request</h3>
<ul>
  <li><strong>openid</strong> and <strong>email</strong> — to identify the Google account you connected and show its email address in the Service.</li>
  <li><strong>https://www.googleapis.com/auth/gmail.send</strong> — to send email on your behalf. It lets us send messages only; it does not let us read, search, modify or delete the emails in your mailbox, and we do not request any permission that would.</li>
</ul>
<h3>How we use Google user data</h3>
<ul>
  <li>Emails are sent through your Gmail account only when a user of your workspace sends one: emails to leads and customers written in the Service, and the "Test Email" sent to the admin's own address.</li>
  <li>Your connected Google email address is shown to users of your workspace on the Email Integration page and as the sender of emails.</li>
  <li>We do not read your mailbox, and we do not use Google user data for advertising, to build user profiles, or to train artificial-intelligence or machine-learning models.</li>
</ul>
<h3>What we store</h3>
<ul>
  <li>The connected Google email address, an OAuth access token and refresh token, token expiry time, the permissions granted, connection status and the time the connection was last used.</li>
  <li>For emails sent to a lead, the subject, message and sender are saved in that lead's activity history in your workspace, so your team can see what was sent. The emails themselves are stored by Google in your Gmail "Sent" folder, under Google's own policies.</li>
</ul>
<h3>Token security</h3>
<ul>
  <li>Access and refresh tokens are encrypted (AES-256-GCM) before they are stored in our database, and they are never sent to your browser or included in API responses.</li>
  <li>Tokens are kept separately for each workspace. A workspace can only send email through its own connected account; no other workspace can use it.</li>
  <li>Access tokens expire after a short time and are renewed using the refresh token. If Google rejects the refresh (for example because you removed access), the connection is marked as needing reconnection.</li>
</ul>
<h3>Sharing of Google user data</h3>
<p>We do not sell Google user data or share it with third parties. Email content is transmitted only to Google's Gmail API so the message can be delivered to its recipients. We do not transfer Google user data to anyone except as necessary to provide this feature, for security purposes, to comply with applicable law, or as part of a merger or acquisition with your notice.</p>
<h3>Retention and deletion</h3>
<ul>
  <li>Tokens are kept only while the Google account remains connected.</li>
  <li>When an admin clicks <strong>Disconnect</strong>, we delete the stored tokens and connection record and ask Google to revoke our access. Switching to a different Google account removes and revokes the previous account's access.</li>
  <li>You can also remove access at any time from your Google Account at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>; the Service will then stop sending from that account.</li>
  <li>Lead activity history is kept with your workspace's business data and deleted as described in section 6.</li>
</ul>
<h3>Limited Use</h3>
<p class="note">${PRODUCT}'s use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

<h2>3. How we use information</h2>
<ul>
  <li>To provide, operate, secure and maintain the CRM and ERP features you use.</li>
  <li>To authenticate users, apply roles and permissions, and keep audit logs.</li>
  <li>To sync leads and messages from integrations you have connected, and to send the emails and messages you choose to send.</li>
  <li>To provide support, prevent abuse and meet legal, tax and accounting obligations.</li>
</ul>
<p>We do not sell personal information and do not use your business data or integration data for third-party advertising.</p>

<h2>4. Service providers and sharing</h2>
<p>We share information only as needed to run the Service, with providers acting on our behalf: database and hosting infrastructure; Resend (default email sender when no mailbox is connected); Twilio (SMS and WhatsApp messages you send); Meta (when you connect Meta integrations); and Anthropic (Claude), which processes the text you submit to the AI tools to generate a response. Google user data described in section 2 is not sent to these AI tools. We may also disclose information where required by law or to protect the rights and safety of users.</p>

<h2>5. Security</h2>
<p>We use HTTPS/TLS for data in transit, hashed passwords, encrypted OAuth tokens, role-based access control, workspace isolation, authenticated APIs and audit logging. No method of transmission or storage is completely secure, so we cannot guarantee absolute security.</p>

<h2>6. Retention and deletion</h2>
<p>Account and business data is kept while your organisation's account is active, and afterwards only as long as needed for legitimate business or legal purposes. Integration data is kept while the integration remains connected. You can request deletion of your data by emailing <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or by following the steps on our <a href="${appUrl()}/data-deletion">Data Deletion</a> page.</p>

<h2>7. Your choices and consent</h2>
<p>Connecting Google, Microsoft or Meta is optional and happens only after you approve the requested permissions on that provider's own sign-in page. You can disconnect any integration at any time from the Integrations section of the Service. Subject to applicable law, you may request access to, correction of, a copy of, or deletion of your personal information; we respond to verified requests within 30 days.</p>

<h2>8. Cookies and local storage</h2>
<p>We use browser storage only for essential purposes such as keeping you signed in and remembering interface preferences. We do not use advertising or cross-site tracking cookies.</p>

<h2>9. Children</h2>
<p>The Service is intended for businesses and is not directed to children under 16.</p>

<h2>10. Changes to this policy</h2>
<p>We may update this policy. The revised version will be posted on this page with a new "Last updated" date.</p>

<h2>11. Contact</h2>
<p>${COMPANY} (${OWNER})<br>Email: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br>Website: <a href="https://crmreadytechsolutions.in/">crmreadytechsolutions.in</a></p>
</main></div>`
);

const terms = () => page(
  `Terms of Service — ${PRODUCT}`,
  `The terms that govern your use of ${PRODUCT}, provided by ${COMPANY}.`,
  `<div class="wrap"><main class="doc">
<h1>Terms of Service</h1>
<p class="muted">Last updated: ${LAST_UPDATED}</p>

<h2>1. Agreement</h2>
<p>These Terms of Service ("Terms") form a binding agreement between ${COMPANY}, operated by ${OWNER} ("we", "us"), and the organisation or individual accessing ${PRODUCT} (the "Service") at crmreadytechsolutions.in or the ReadyTech web application ("you"). By creating an account or using the Service you accept these Terms. If you do not agree, do not use the Service.</p>

<h2>2. The Service</h2>
<p>The Service is a cloud-based business management platform providing CRM, lead management, inventory and warehouse management, purchase and sales orders, invoicing, HR and payroll, automation, reporting and optional third-party integrations. Features may be added, modified or discontinued as the product evolves.</p>

<h2>3. Accounts and eligibility</h2>
<ul>
  <li>You must be at least 18 years old and able to enter into a binding contract.</li>
  <li>You are responsible for the accuracy of registration information and for keeping credentials confidential.</li>
  <li>You are responsible for all activity carried out under your account and by users you invite.</li>
  <li>You must notify us promptly of any suspected unauthorised access.</li>
</ul>

<h2>4. Acceptable use</h2>
<p>You agree not to:</p>
<ul>
  <li>Use the Service for any unlawful, fraudulent, deceptive or infringing purpose.</li>
  <li>Send unsolicited bulk messages or communications that violate applicable anti-spam or messaging-platform rules, including through a connected Gmail account.</li>
  <li>Upload malware, attempt to gain unauthorised access, or disrupt or overload the Service or its infrastructure.</li>
  <li>Reverse engineer, copy, resell or sublicense the Service except as permitted by law.</li>
  <li>Store personal data of third parties without a lawful basis, notice or consent as required by law.</li>
</ul>

<h2>5. Your data and ownership</h2>
<p>You retain all rights to the business data you submit to the Service. You grant us a limited licence to host, process, transmit and display that data solely to provide and support the Service. You are the controller of personal data you upload and are responsible for having a lawful basis to process it. Our handling of data is described in our <a href="/privacy-policy">Privacy Policy</a>.</p>

<h2>6. Third-party integrations</h2>
<p>Integrations such as Google (Gmail), Microsoft 365, Meta/Facebook, Instagram and WhatsApp Business are optional and operate under the terms and policies of those providers. When you connect Google, the Service only sends email on your behalf using the Gmail send permission, as described in our <a href="/privacy-policy">Privacy Policy</a>. You are responsible for holding the required accounts, permissions and consents, and you can disconnect an integration at any time. We are not liable for the availability, changes or acts of third-party platforms, and a provider's change may affect or interrupt an integration.</p>

<h2>7. Fees and subscriptions</h2>
<p>Paid plans are billed in advance on the cycle stated at purchase. Fees are exclusive of applicable taxes unless stated otherwise. Unless required by law, fees are non-refundable for periods already served. We may revise pricing with prior notice, effective from your next billing cycle.</p>

<h2>8. Availability and support</h2>
<p>We aim to keep the Service available at all times but do not warrant uninterrupted or error-free operation. Scheduled maintenance, upgrades or factors outside our control may cause downtime. Support is provided by email during normal business hours.</p>

<h2>9. Suspension and termination</h2>
<p>You may stop using the Service and request account closure at any time. We may suspend or terminate access if you breach these Terms, fail to pay fees, or if required for security or legal reasons. Following termination, data is handled as set out in our <a href="${appUrl()}/data-deletion">Data Deletion</a> policy.</p>

<h2>10. Disclaimers and limitation of liability</h2>
<p>The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied, to the maximum extent permitted by law. We are not liable for indirect, incidental, special or consequential damages, or for loss of profits, revenue, goodwill or data. Our total aggregate liability arising out of or relating to the Service will not exceed the amount you paid to us in the twelve months preceding the claim.</p>

<h2>11. Indemnity</h2>
<p>You agree to indemnify and hold harmless ${COMPANY} and ${OWNER} against claims, damages and reasonable costs arising from your data, your use of the Service, or your breach of these Terms or applicable law.</p>

<h2>12. Governing law</h2>
<p>These Terms are governed by the laws of India, and the courts of Tamil Nadu, India shall have exclusive jurisdiction over any dispute, without prejudice to mandatory consumer protections in your jurisdiction.</p>

<h2>13. Changes and contact</h2>
<p>We may update these Terms; the updated version will be posted on this page with a revised date, and continued use constitutes acceptance. For questions, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</main></div>`
);

const sendHtml = (render) => (req, res) => res.type("html").set("Cache-Control", "public, max-age=300").send(render());

// "/" — HTML for browsers and crawlers (including "Accept: */*"); JSON status
// only for clients that explicitly prefer application/json
router.get("/", (req, res, next) => (req.accepts(["html", "json"]) === "html" ? sendHtml(homepage)(req, res) : next()));
router.get(["/privacy-policy", "/privacy"], sendHtml(privacyPolicy));
router.get(["/terms", "/terms-of-service"], sendHtml(terms));

export default router;
