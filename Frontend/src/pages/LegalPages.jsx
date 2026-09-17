import { Link } from "react-router-dom";
import { ShieldCheck, FileText, Trash2 } from "lucide-react";

/* ======================================================
   SHARED PUBLIC LEGAL PAGE SHELL
   Publicly accessible – no authentication required.
====================================================== */

const COMPANY = "Ready Tech Solutions";
const OWNER = "SIVASHANKAR";
const DOMAIN = "crmreadytechsolutions.in";
const SITE = "https://crmreadytechsolutions.in";
const SUPPORT_EMAIL = "quries.readytechsolutions@gmail.com";
const LAST_UPDATED = "17 September 2026";

function LegalLayout({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 leading-tight">
                {COMPANY}
              </p>
              <p className="text-xs text-gray-500">{DOMAIN}</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium text-gray-600">
            <Link to="/privacy-policy" className="hover:text-indigo-600">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-indigo-600">
              Terms
            </Link>
            <Link to="/data-deletion" className="hover:text-indigo-600">
              Data Deletion
            </Link>
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        <p className="mt-1 text-sm text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 space-y-7 leading-relaxed">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6 text-sm text-gray-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {COMPANY} ({OWNER}). All rights
            reserved.
          </span>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{heading}</h2>
      <div className="text-gray-700 space-y-3">{children}</div>
    </section>
  );
}

const List = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-gray-700">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/* ======================================================
   1. PRIVACY POLICY  →  /privacy-policy
====================================================== */
export function PrivacyPolicy() {
  return (
    <LegalLayout
      icon={ShieldCheck}
      title="Privacy Policy"
      subtitle={`How ${COMPANY} collects, uses, stores and protects information in the Ready Tech CRM + ERP platform.`}
    >
      <Section heading="1. Introduction">
        <p>
          {COMPANY}, operated by {OWNER} ("we", "us", "our"), provides the Ready
          Tech CRM + ERP platform available at{" "}
          <a href={SITE} className="text-indigo-600 hover:underline">
            {DOMAIN}
          </a>{" "}
          (the "Service"). This Privacy Policy explains what information we
          collect, why we collect it, how we use it, and the choices available
          to you. By using the Service you agree to this Policy.
        </p>
      </Section>

      <Section heading="2. Information We Collect">
        <p>
          <strong>Account information.</strong> Name, business name, email
          address, phone number, role and password (stored only in hashed form)
          supplied when an account is created for you by your organisation.
        </p>
        <p>
          <strong>Business data you enter.</strong> Customer and lead records,
          contacts, products, inventory and warehouse data, quotations,
          invoices, payments, HR and payroll records, notes, tasks and files
          that you or your organisation upload to the Service.
        </p>
        <p>
          <strong>Integration data.</strong> Where you choose to connect a
          third-party service (for example Meta/Facebook Lead Ads, Facebook
          Pages, Instagram or WhatsApp Business), we receive only the data that
          the platform's permissions you have granted allow — such as lead form
          submissions, page and message metadata, and the message content of
          conversations with your business. We use access tokens issued by the
          provider solely to deliver the features you enabled, and never to
          access personal profiles beyond the scope you approved.
        </p>
        <p>
          <strong>Technical data.</strong> IP address, browser and device type,
          log timestamps, pages accessed and audit-trail entries used for
          security, troubleshooting and abuse prevention.
        </p>
        <p>
          We do not knowingly collect information from children under the age of
          16, and the Service is not directed to them.
        </p>
      </Section>

      <Section heading="3. How We Use Information">
        <List
          items={[
            "To provide, operate, secure and maintain the CRM and ERP features you use.",
            "To authenticate users, assign roles and permissions, and keep audit logs.",
            "To sync leads, messages and conversations from integrations you have explicitly connected.",
            "To send transactional notifications such as invoices, reminders and system alerts.",
            "To provide customer support and respond to your requests.",
            "To detect, prevent and investigate fraud, abuse or security incidents.",
            "To comply with applicable legal, tax and accounting obligations.",
          ]}
        />
        <p>
          We do not sell your personal information, and we do not use your
          business data or integration data to serve third-party advertising.
        </p>
      </Section>

      <Section heading="4. Sharing and Disclosure">
        <p>
          We share information only as needed to run the Service: with
          infrastructure, hosting, database, email and messaging providers
          acting as our processors under confidentiality obligations; with
          third-party platforms you have connected, to the extent required to
          deliver that integration; with professional advisers; and where
          required by law, legal process or to protect our rights and the safety
          of users. If our business is transferred, information may pass to the
          successor entity subject to this Policy.
        </p>
      </Section>

      <Section heading="5. Data Retention">
        <p>
          We retain account and business data for as long as your organisation's
          account remains active, and afterwards only as long as necessary for
          legitimate business or legal purposes. Integration data is retained
          while the integration remains connected. Upon a verified deletion
          request we remove the relevant data as described on our{" "}
          <Link to="/data-deletion" className="text-indigo-600 hover:underline">
            User Data Deletion
          </Link>{" "}
          page. Backup copies are purged on our standard backup rotation cycle,
          normally within 30 days.
        </p>
      </Section>

      <Section heading="6. Security">
        <p>
          We apply industry-standard safeguards including encryption of data in
          transit over HTTPS/TLS, hashed password storage, role-based access
          control, token-based authenticated APIs, activity and audit logging,
          and restricted administrative access. No method of transmission or
          storage is completely secure, so we cannot guarantee absolute
          security, but we work to protect your data and to notify affected
          users of material incidents where required.
        </p>
      </Section>

      <Section heading="7. Your Rights">
        <p>
          Subject to applicable law, you may request access to the personal
          information we hold about you, correction of inaccurate data, a copy
          of your data, restriction of processing, withdrawal of consent, or
          deletion of your data. Contact us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          . We respond to verified requests within 30 days. You may also
          disconnect any integration at any time from the integrations settings
          of the application, which stops further data collection from that
          platform.
        </p>
      </Section>

      <Section heading="8. Cookies and Local Storage">
        <p>
          The Service uses cookies and browser local storage only for essential
          purposes such as keeping you signed in, remembering your interface
          preferences and protecting session security. We do not use
          advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section heading="9. Changes to This Policy">
        <p>
          We may update this Policy from time to time. The revised version will
          be posted on this page with a new "Last updated" date, and material
          changes will be communicated through the Service or by email.
        </p>
      </Section>

      <Section heading="10. Contact Us">
        <p>
          {COMPANY} ({OWNER})
          <br />
          Website:{" "}
          <a href={SITE} className="text-indigo-600 hover:underline">
            {DOMAIN}
          </a>
          <br />
          Email:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </Section>
    </LegalLayout>
  );
}

/* ======================================================
   2. TERMS OF SERVICE  →  /terms
====================================================== */
export function TermsOfService() {
  return (
    <LegalLayout
      icon={FileText}
      title="Terms of Service"
      subtitle={`The terms that govern your use of the Ready Tech CRM + ERP platform provided by ${COMPANY}.`}
    >
      <Section heading="1. Agreement">
        <p>
          These Terms of Service ("Terms") form a binding agreement between{" "}
          {COMPANY}, operated by {OWNER} ("we", "us"), and the organisation or
          individual accessing the Ready Tech CRM + ERP platform at{" "}
          <a href={SITE} className="text-indigo-600 hover:underline">
            {DOMAIN}
          </a>{" "}
          ("you"). By creating an account or using the Service you accept these
          Terms. If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section heading="2. The Service">
        <p>
          The Service is a cloud-based business management platform providing
          CRM, sales, lead management, inventory and warehouse management,
          purchase and sales orders, invoicing, HR and payroll, automation,
          reporting and optional third-party integrations. Features may be
          added, modified or discontinued as the product evolves.
        </p>
      </Section>

      <Section heading="3. Accounts and Eligibility">
        <List
          items={[
            "You must be at least 18 years old and able to enter into a binding contract.",
            "You are responsible for the accuracy of registration information and for keeping credentials confidential.",
            "You are responsible for all activity carried out under your account and by users you invite.",
            "You must notify us promptly of any suspected unauthorised access.",
          ]}
        />
      </Section>

      <Section heading="4. Acceptable Use">
        <p>You agree not to:</p>
        <List
          items={[
            "Use the Service for any unlawful, fraudulent, deceptive or infringing purpose.",
            "Send unsolicited bulk messages or communications that violate applicable anti-spam or messaging-platform rules.",
            "Upload malware, attempt to gain unauthorised access, or disrupt or overload the Service or its infrastructure.",
            "Reverse engineer, copy, resell or sublicense the Service except as permitted by law.",
            "Store personal data of third parties without a lawful basis, notice or consent as required by law.",
          ]}
        />
      </Section>

      <Section heading="5. Your Data and Ownership">
        <p>
          You retain all rights to the business data you submit to the Service.
          You grant us a limited licence to host, process, transmit and display
          that data solely to provide and support the Service. You are the
          controller of personal data you upload and are responsible for having
          a lawful basis to process it. Our handling of data is described in our{" "}
          <Link to="/privacy-policy" className="text-indigo-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="6. Third-Party Integrations">
        <p>
          Integrations such as Meta/Facebook, Instagram, WhatsApp Business,
          email and payment providers are optional and operate under the terms
          and policies of those providers. You are responsible for holding the
          required accounts, permissions and consents. We are not liable for
          the availability, changes or acts of third-party platforms, and a
          provider's change may affect or interrupt an integration.
        </p>
      </Section>

      <Section heading="7. Fees and Subscriptions">
        <p>
          Paid plans are billed in advance on the cycle stated at purchase. Fees
          are exclusive of applicable taxes unless stated otherwise. Unless
          required by law, fees are non-refundable for periods already served.
          We may revise pricing with prior notice, effective from your next
          billing cycle.
        </p>
      </Section>

      <Section heading="8. Availability and Support">
        <p>
          We aim to keep the Service available at all times but do not warrant
          uninterrupted or error-free operation. Scheduled maintenance,
          upgrades or factors outside our control may cause downtime. Support is
          provided by email during normal business hours.
        </p>
      </Section>

      <Section heading="9. Suspension and Termination">
        <p>
          You may stop using the Service and request account closure at any
          time. We may suspend or terminate access if you breach these Terms,
          fail to pay fees, or if required for security or legal reasons.
          Following termination, data is handled as set out in our{" "}
          <Link to="/data-deletion" className="text-indigo-600 hover:underline">
            User Data Deletion
          </Link>{" "}
          policy.
        </p>
      </Section>

      <Section heading="10. Disclaimers and Limitation of Liability">
        <p>
          The Service is provided "as is" and "as available" without warranties
          of any kind, whether express or implied, to the maximum extent
          permitted by law. We are not liable for indirect, incidental, special
          or consequential damages, or for loss of profits, revenue, goodwill or
          data. Our total aggregate liability arising out of or relating to the
          Service will not exceed the amount you paid to us in the twelve months
          preceding the claim.
        </p>
      </Section>

      <Section heading="11. Indemnity">
        <p>
          You agree to indemnify and hold harmless {COMPANY} and {OWNER} against
          claims, damages and reasonable costs arising from your data, your use
          of the Service, or your breach of these Terms or applicable law.
        </p>
      </Section>

      <Section heading="12. Governing Law">
        <p>
          These Terms are governed by the laws of India, and the courts of
          Tamil Nadu, India shall have exclusive jurisdiction over any dispute,
          without prejudice to mandatory consumer protections in your
          jurisdiction.
        </p>
      </Section>

      <Section heading="13. Changes and Contact">
        <p>
          We may update these Terms; the updated version will be posted on this
          page with a revised date and continued use constitutes acceptance. For
          questions, contact{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}

/* ======================================================
   3. USER DATA DELETION  →  /data-deletion
====================================================== */
export function DataDeletion() {
  return (
    <LegalLayout
      icon={Trash2}
      title="User Data Deletion"
      subtitle={`How to request deletion of your data from the Ready Tech CRM + ERP platform, including data received through Meta (Facebook, Instagram, WhatsApp) integrations.`}
    >
      <Section heading="1. Your Right to Deletion">
        <p>
          You can ask {COMPANY} ({OWNER}) to delete the personal information and
          business data we hold about you at any time. This includes any data we
          received on your behalf through connected platforms such as Facebook
          Lead Ads, Facebook Pages, Instagram or WhatsApp Business.
        </p>
      </Section>

      <Section heading="2. Delete Data From Within the Application">
        <p>
          If you have an account, the fastest route is from inside the
          application:
        </p>
        <List
          items={[
            "Sign in to the CRM and open Settings → Integrations to disconnect any connected platform. Disconnecting immediately revokes our access tokens and stops all further data collection from that platform.",
            "Delete individual records (leads, clients, contacts, conversations or documents) directly from the relevant module.",
            "To delete an entire account and all of its data, email us the request as described below — account-level deletion is performed by our team so we can verify ownership.",
          ]}
        />
      </Section>

      <Section heading="3. Request Deletion by Email">
        <p>
          Send a deletion request to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=User%20Data%20Deletion%20Request`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          with the subject line <strong>"User Data Deletion Request"</strong>,
          and include:
        </p>
        <List
          items={[
            "Your full name and the business or organisation name.",
            "The email address or phone number registered with the account.",
            "The connected platform and page/profile name, if the request relates to Facebook, Instagram or WhatsApp data.",
            "Whether you want your entire account deleted or only specific data removed.",
          ]}
        />
        <p>
          We verify each request to protect against unauthorised deletion, and
          may ask for additional confirmation of ownership.
        </p>
      </Section>

      <Section heading="4. What Gets Deleted">
        <List
          items={[
            "Your user profile, login credentials and access tokens.",
            "Leads, contacts, clients and conversation history synced from connected platforms.",
            "Uploaded files, notes, tasks and activity history linked to your account.",
            "Any stored third-party integration tokens and integration configuration.",
          ]}
        />
      </Section>

      <Section heading="5. What We May Retain">
        <p>
          We may retain a limited set of records where law requires it — for
          example invoices, payment and tax records under applicable accounting
          and tax legislation, and minimal security or audit logs needed to
          evidence lawful processing or prevent fraud. Such records are kept
          only for the statutory period and are not used for any other purpose.
          Data held by a third-party platform itself must be deleted through
          that platform's own settings.
        </p>
      </Section>

      <Section heading="6. Timeline">
        <List
          items={[
            "Acknowledgement: within 3 business days of receiving your request.",
            "Deletion from live production systems: within 30 days of verification.",
            "Removal from encrypted backups: within a further 30 days, as backups rotate.",
            "Confirmation: we email you once deletion is complete.",
          ]}
        />
      </Section>

      <Section heading="7. Contact">
        <p>
          {COMPANY} ({OWNER})
          <br />
          Website:{" "}
          <a href={SITE} className="text-indigo-600 hover:underline">
            {DOMAIN}
          </a>
          <br />
          Data deletion requests:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=User%20Data%20Deletion%20Request`}
            className="text-indigo-600 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p>
          See also our{" "}
          <Link to="/privacy-policy" className="text-indigo-600 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/terms" className="text-indigo-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
