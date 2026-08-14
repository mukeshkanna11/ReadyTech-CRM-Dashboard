// services/email.service.js

import { Resend } from "resend";

/* =========================================================
   RESEND CONFIGURATION
========================================================= */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const COMPANY_EMAIL = process.env.COMPANY_EMAIL;

if (!RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY missing");
}

if (!RESEND_FROM_EMAIL) {
  throw new Error("RESEND_FROM_EMAIL is missing in environment variables");
}

if (!COMPANY_EMAIL) {
  throw new Error("COMPANY_EMAIL is missing in environment variables");
}

const resend = new Resend(RESEND_API_KEY);


/* =========================================================
   HELPER
   Escape HTML values before inserting into email
========================================================= */

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};


/* =========================================================
   1. SEND WEBSITE CHAT ENQUIRY TO COMPANY
========================================================= */

export const sendChatEnquiry = async (chat) => {
  try {
    const response = await resend.emails.send({
      from: RESEND_FROM_EMAIL,

      to: COMPANY_EMAIL,

      // Company can directly reply to customer
      ...(chat.email
        ? {
            replyTo: chat.email,
          }
        : {}),

      subject:
        `[ReadyTech Website] ${
          chat.category || "General Enquiry"
        } - ${chat.name || "Website Visitor"}`,

      html: `
        <div style="
          font-family: Arial, sans-serif;
          background:#f6f8fb;
          padding:30px;
        ">

          <div style="
            max-width:650px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
          ">

            <div style="
              padding-bottom:20px;
              margin-bottom:20px;
              border-bottom:1px solid #e5e7eb;
            ">

              <h2 style="
                margin:0;
                color:#111827;
              ">
                🚀 New Website Enquiry
              </h2>

              <p style="
                margin:8px 0 0;
                color:#6b7280;
              ">
                A new enquiry was received from the ReadyTech website.
              </p>

            </div>


            <table
              width="100%"
              cellpadding="10"
              cellspacing="0"
              style="
                border-collapse:collapse;
                font-size:14px;
              "
            >

              <tr>
                <td style="font-weight:600;">Name</td>
                <td>${escapeHtml(chat.name || "-")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Email</td>
                <td>${escapeHtml(chat.email || "-")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Phone</td>
                <td>${escapeHtml(chat.phone || "-")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Company</td>
                <td>${escapeHtml(chat.company || "-")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Category</td>
                <td>
                  ${escapeHtml(
                    chat.category || "General Enquiry"
                  )}
                </td>
              </tr>

              <tr>
                <td style="font-weight:600;">Subject</td>
                <td>${escapeHtml(chat.subject || "-")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Priority</td>
                <td>${escapeHtml(chat.priority || "Medium")}</td>
              </tr>

              <tr>
                <td style="font-weight:600;">Source</td>
                <td>${escapeHtml(chat.source || "Website")}</td>
              </tr>

            </table>


            <div style="margin-top:25px;">

              <h3 style="
                margin-bottom:10px;
                color:#111827;
              ">
                Message
              </h3>

              <div style="
                background:#f8fafc;
                padding:16px;
                border-radius:10px;
                color:#374151;
                line-height:1.6;
              ">
                ${escapeHtml(chat.message || "-")}
              </div>

            </div>


            <div style="
              margin-top:30px;
              padding-top:18px;
              border-top:1px solid #e5e7eb;
              color:#6b7280;
              font-size:12px;
            ">

              Received:
              ${new Date().toLocaleString()}

              <br />

              Generated from ReadyTech CRM & ERP Website

            </div>

          </div>

        </div>
      `,
    });

    console.log("✅ Website chat enquiry email sent");

    return response;

  } catch (error) {
    console.error(
      "❌ Send Chat Enquiry Email Error:",
      error
    );

    throw error;
  }
};


/* =========================================================
   2. SEND CHAT AUTO REPLY TO CUSTOMER
========================================================= */

export const sendAutoReply = async (chat) => {
  try {
    if (!chat?.email) {
      console.log(
        "⚠️ Chat has no email. Auto reply skipped."
      );

      return null;
    }

    const response = await resend.emails.send({
      from: RESEND_FROM_EMAIL,

      to: chat.email,

      subject:
        "Thank you for contacting ReadyTech Solutions",

      html: `
        <div style="
          font-family:Arial,sans-serif;
          background:#f6f8fb;
          padding:30px;
        ">

          <div style="
            max-width:600px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
          ">

            <h2 style="
              color:#111827;
              margin-top:0;
            ">
              Hello ${escapeHtml(chat.name || "there")} 👋
            </h2>

            <p>
              Thank you for contacting
              <strong>ReadyTech Solutions.</strong>
            </p>

            <p>
              We have successfully received your enquiry.
            </p>

            ${
              chat.category
                ? `
                  <div style="
                    background:#f8fafc;
                    padding:15px;
                    border-radius:10px;
                    margin:20px 0;
                  ">

                    <strong>Category:</strong>

                    <p style="
                      margin:8px 0 0;
                    ">
                      ${escapeHtml(chat.category)}
                    </p>

                  </div>
                `
                : ""
            }

            ${
              chat.message
                ? `
                  <div style="
                    background:#f8fafc;
                    padding:15px;
                    border-radius:10px;
                    margin:20px 0;
                  ">

                    <strong>Your Message:</strong>

                    <p style="
                      margin:8px 0 0;
                      line-height:1.6;
                    ">
                      ${escapeHtml(chat.message)}
                    </p>

                  </div>
                `
                : ""
            }

            <p>
              Our team will review your request
              and contact you shortly.
            </p>

            <br />

            <p>
              Regards,<br />

              <strong>
                ReadyTech Solutions
              </strong>

              <br />

              CRM | ERP | AI | Web | Mobile Solutions
            </p>

          </div>

        </div>
      `,
    });

    console.log(
      `✅ Chat auto-reply sent to ${chat.email}`
    );

    return response;

  } catch (error) {
    console.error(
      "❌ Chat Auto Reply Error:",
      error
    );

    throw error;
  }
};


/* =========================================================
   3. SEND NEW LEAD NOTIFICATION TO COMPANY
========================================================= */

export const sendLeadNotification = async (lead) => {
  try {
    const response = await resend.emails.send({
      from: RESEND_FROM_EMAIL,

      to: COMPANY_EMAIL,

      // Company can directly reply to lead
      ...(lead.email
        ? {
            replyTo: lead.email,
          }
        : {}),

      subject:
        `[ReadyTech CRM] New Lead - ${
          lead.name || "New Enquiry"
        }`,

      html: `
        <div style="
          font-family:Arial,sans-serif;
          background:#f6f8fb;
          padding:30px;
        ">

          <div style="
            max-width:680px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
          ">


            <div style="
              margin-bottom:25px;
              padding-bottom:18px;
              border-bottom:1px solid #e5e7eb;
            ">

              <h2 style="
                margin:0;
                color:#111827;
              ">
                🚀 New Lead Received
              </h2>

              <p style="
                margin:8px 0 0;
                color:#6b7280;
              ">
                A new lead has been created in ReadyTech CRM.
              </p>

            </div>


            <table
              width="100%"
              cellpadding="10"
              cellspacing="0"
              style="
                border-collapse:collapse;
                font-size:14px;
              "
            >

              <tr>
                <td style="font-weight:600;">
                  Name
                </td>

                <td>
                  ${escapeHtml(lead.name || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Designation
                </td>

                <td>
                  ${escapeHtml(lead.designation || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Email
                </td>

                <td>
                  ${escapeHtml(lead.email || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Phone
                </td>

                <td>
                  ${escapeHtml(lead.phone || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Company
                </td>

                <td>
                  ${escapeHtml(lead.company || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Industry
                </td>

                <td>
                  ${escapeHtml(lead.industry || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Website
                </td>

                <td>
                  ${escapeHtml(lead.website || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Company Size
                </td>

                <td>
                  ${escapeHtml(lead.companySize || "-")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Source
                </td>

                <td>
                  ${escapeHtml(lead.source || "Website")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Status
                </td>

                <td>
                  ${escapeHtml(lead.status || "New")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Priority
                </td>

                <td>
                  ${escapeHtml(lead.priority || "Medium")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Department
                </td>

                <td>
                  ${escapeHtml(lead.department || "Sales")}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Expected Value
                </td>

                <td>
                  ${Number(lead.expectedValue || lead.value || 0)}
                </td>
              </tr>


              <tr>
                <td style="font-weight:600;">
                  Follow-up Date
                </td>

                <td>
                  ${
                    lead.followUpDate
                      ? new Date(
                          lead.followUpDate
                        ).toLocaleString()
                      : "-"
                  }
                </td>
              </tr>

            </table>


            ${
              lead.requirement
                ? `
                  <div style="
                    margin-top:25px;
                  ">

                    <h3 style="
                      margin-bottom:10px;
                      color:#111827;
                    ">
                      Requirement
                    </h3>

                    <div style="
                      background:#f8fafc;
                      padding:16px;
                      border-radius:10px;
                      color:#374151;
                      line-height:1.6;
                    ">
                      ${escapeHtml(lead.requirement)}
                    </div>

                  </div>
                `
                : ""
            }


            ${
              lead.message
                ? `
                  <div style="
                    margin-top:25px;
                  ">

                    <h3 style="
                      margin-bottom:10px;
                      color:#111827;
                    ">
                      Customer Message
                    </h3>

                    <div style="
                      background:#f8fafc;
                      padding:16px;
                      border-radius:10px;
                      color:#374151;
                      line-height:1.6;
                    ">
                      ${escapeHtml(lead.message)}
                    </div>

                  </div>
                `
                : ""
            }


            <div style="
              margin-top:30px;
              padding-top:18px;
              border-top:1px solid #e5e7eb;
              color:#6b7280;
              font-size:12px;
            ">

              Received:
              ${new Date().toLocaleString()}

              <br />

              Source:
              ReadyTech CRM & ERP Website

            </div>

          </div>

        </div>
      `,
    });

    console.log(
      `✅ Lead notification email sent for ${lead.name || lead._id}`
    );

    return response;

  } catch (error) {
    console.error(
      "❌ Send Lead Notification Email Error:",
      error
    );

    throw error;
  }
};


/* =========================================================
   4. SEND LEAD AUTO REPLY TO CUSTOMER
========================================================= */

export const sendLeadAutoReply = async (lead) => {
  try {
    if (!lead?.email) {
      console.log(
        "⚠️ Lead has no email. Auto reply skipped."
      );

      return null;
    }

    const response = await resend.emails.send({
      from: RESEND_FROM_EMAIL,

      to: lead.email,

      subject:
        "Thank you for contacting ReadyTech Solutions",

      html: `
        <div style="
          font-family:Arial,sans-serif;
          background:#f6f8fb;
          padding:30px;
        ">

          <div style="
            max-width:600px;
            margin:auto;
            background:#ffffff;
            padding:30px;
            border-radius:14px;
            border:1px solid #e5e7eb;
          ">

            <h2 style="
              margin-top:0;
              color:#111827;
            ">
              Hello ${escapeHtml(lead.name || "there")} 👋
            </h2>


            <p>
              Thank you for contacting
              <strong>ReadyTech Solutions.</strong>
            </p>


            <p>
              We have successfully received your enquiry.
            </p>


            ${
              lead.requirement
                ? `
                  <div style="
                    background:#f8fafc;
                    padding:15px;
                    border-radius:10px;
                    margin:20px 0;
                  ">

                    <strong>
                      Your Requirement:
                    </strong>

                    <p style="
                      margin:8px 0 0;
                      line-height:1.6;
                    ">
                      ${escapeHtml(lead.requirement)}
                    </p>

                  </div>
                `
                : ""
            }


            ${
              lead.message
                ? `
                  <div style="
                    background:#f8fafc;
                    padding:15px;
                    border-radius:10px;
                    margin:20px 0;
                  ">

                    <strong>
                      Your Message:
                    </strong>

                    <p style="
                      margin:8px 0 0;
                      line-height:1.6;
                    ">
                      ${escapeHtml(lead.message)}
                    </p>

                  </div>
                `
                : ""
            }


            <p>
              Our team will review your requirement
              and contact you shortly.
            </p>


            <p>
              If you need to provide any additional
              information, simply reply to this email.
            </p>


            <br />


            <p>
              Regards,<br />

              <strong>
                ReadyTech Solutions
              </strong>

              <br />

              CRM | ERP | AI | Web | Mobile Solutions
            </p>

          </div>

        </div>
      `,
    });

    console.log(
      `✅ Lead auto-reply sent to ${lead.email}`
    );

    return response;

  } catch (error) {
    console.error(
      "❌ Lead Auto Reply Error:",
      error
    );

    throw error;
  }
};