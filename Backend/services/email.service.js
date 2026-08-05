// services/email.service.js

import { Resend } from "resend";


// Validate Resend Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY missing");
}
if (!process.env.RESEND_FROM_EMAIL) {
  throw new Error("RESEND_FROM_EMAIL is missing in environment variables");
}

if (!process.env.COMPANY_EMAIL) {
  throw new Error("COMPANY_EMAIL is missing in environment variables");
}


const resend = new Resend(process.env.RESEND_API_KEY);



/* =========================================================
   Send Website Chat Enquiry To Company
========================================================= */

export const sendChatEnquiry = async (chat) => {
  try {

    const response = await resend.emails.send({

      from: process.env.RESEND_FROM_EMAIL,

      to: process.env.COMPANY_EMAIL,

      // Reply directly to customer
      replyTo: chat.email,

      subject:
        `[ReadyTech Website] ${chat.category || "General Enquiry"} - ${chat.name}`,

      html: `

      <div style="
        font-family: Arial, sans-serif;
        background:#f6f8fb;
        padding:20px;
      ">

        <div style="
          max-width:600px;
          margin:auto;
          background:white;
          padding:25px;
          border-radius:10px;
        ">

          <h2 style="margin-bottom:20px;">
            🚀 New Website Enquiry
          </h2>


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
              <td><b>Name</b></td>
              <td>${chat.name}</td>
            </tr>


            <tr>
              <td><b>Email</b></td>
              <td>${chat.email}</td>
            </tr>


            <tr>
              <td><b>Phone</b></td>
              <td>${chat.phone || "-"}</td>
            </tr>


            <tr>
              <td><b>Company</b></td>
              <td>${chat.company || "-"}</td>
            </tr>


            <tr>
              <td><b>Category</b></td>
              <td>${chat.category || "General Enquiry"}</td>
            </tr>


            <tr>
              <td><b>Subject</b></td>
              <td>${chat.subject || "-"}</td>
            </tr>


            <tr>
              <td><b>Priority</b></td>
              <td>${chat.priority || "Medium"}</td>
            </tr>


            <tr>
              <td><b>Source</b></td>
              <td>${chat.source || "Website"}</td>
            </tr>


          </table>


          <h3>
            Message
          </h3>


          <p style="
            background:#f1f5f9;
            padding:15px;
            border-radius:8px;
          ">
            ${chat.message}
          </p>



          <hr>


          <p style="
            color:#666;
            font-size:12px;
          ">

            Received:
            ${new Date().toLocaleString()}

            <br/>

            Generated from
            ReadyTech CRM & ERP Website

          </p>


        </div>

      </div>

      `,
    });


    return response;


  } catch (error) {

    console.error(
      "Send Chat Enquiry Email Error:",
      error
    );

    throw error;

  }
};





/* =========================================================
   Send Auto Reply To Customer
========================================================= */

export const sendAutoReply = async (chat) => {

  try {


    const response = await resend.emails.send({

      from: process.env.RESEND_FROM_EMAIL,

      to: chat.email,


      subject:
        "Thank you for contacting ReadyTech Solutions",


      html: `


      <div style="
        font-family:Arial,sans-serif;
        background:#f6f8fb;
        padding:20px;
      ">


        <div style="
          max-width:600px;
          margin:auto;
          background:white;
          padding:25px;
          border-radius:10px;
        ">


          <h2>
            Hello ${chat.name} 👋
          </h2>



          <p>
            Thank you for contacting
            <b>ReadyTech Solutions.</b>
          </p>



          <p>
            We have successfully received your enquiry
            regarding:

            <b>
              ${chat.category || "General Enquiry"}
            </b>
          </p>



          <p>
            Our CRM & ERP team will review your request
            and contact you shortly.
          </p>



          <br/>


          <p>
            Regards,
            <br/>

            <b>
              ReadyTech Solutions
            </b>

            <br/>

            CRM | ERP | AI | Web | Mobile Solutions

          </p>



        </div>


      </div>


      `,
    });



    return response;



  } catch (error) {


    console.error(
      "Auto Reply Email Error:",
      error
    );


    throw error;


  }

};