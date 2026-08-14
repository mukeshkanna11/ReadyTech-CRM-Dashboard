// services/chat.service.js

import Chat from "../models/Chat.js";
import Lead from "../models/Lead.js";
import User from "../models/User.js";

import {
  sendLeadNotification,
  sendLeadAutoReply,
} from "./email.service.js";

/* =========================================================
   CREATE WEBSITE CHAT ENQUIRY

   FLOW:

   Website / Chat Form
          ↓
        Chat
          ↓
        Lead
          ↓
   Auto Assign Lead Owner
          ↓
   Link Chat → Lead
          ↓
   Company Email
          ↓
   Customer Auto Reply
========================================================= */

export const createChat = async (chatData) => {
  try {
    /* =====================================================
       1. BASIC VALIDATION
    ===================================================== */

    if (!chatData) {
      throw new Error("Enquiry data is required.");
    }

    const name = chatData.name?.trim();
    const email = chatData.email?.trim().toLowerCase();
    const phone = chatData.phone?.trim() || "";
    const company = chatData.company?.trim() || "";
    const message = chatData.message?.trim();

    const category =
      chatData.category?.trim() || "General Enquiry";

    const subject =
      chatData.subject?.trim() || "";

    const priority =
      chatData.priority || "Medium";

    if (!name) {
      throw new Error("Name is required.");
    }

    if (!email) {
      throw new Error("Email is required.");
    }

    if (!message) {
      throw new Error("Message is required.");
    }

    /* =====================================================
       2. DUPLICATE PROTECTION
    ===================================================== */

    const fiveMinutesAgo = new Date(
      Date.now() - 5 * 60 * 1000
    );

    const existingChat = await Chat.findOne({
      email,
      message,
      createdAt: {
        $gte: fiveMinutesAgo,
      },
      isDeleted: false,
    });

    if (existingChat) {
      throw new Error(
        "Duplicate enquiry detected. Please wait before sending again."
      );
    }

    /* =====================================================
       3. CREATE WEBSITE CHAT
    ===================================================== */

    const chat = await Chat.create({
      ...chatData,

      name,
      email,
      phone,
      company,
      category,
      subject,
      message,
      priority,

      status: "New",

      source: "Website",

      isRead: false,
      isDeleted: false,
    });

    console.log(
      "✅ Website chat created:",
      chat._id
    );

    /* =====================================================
       4. FIND LEAD OWNER
    ===================================================== */

    let leadOwner = null;

    try {
      /* -----------------------------------------------------
         First priority:
         Admin + Active
      ----------------------------------------------------- */

      leadOwner = await User.findOne({
        role: "admin",
        isActive: true,
      }).sort({
        createdAt: 1,
      });

      /* -----------------------------------------------------
         Second priority:
         Any Active User
      ----------------------------------------------------- */

      if (!leadOwner) {
        leadOwner = await User.findOne({
          isActive: true,
        }).sort({
          createdAt: 1,
        });
      }

      /* -----------------------------------------------------
         Final fallback:
         Any User
      ----------------------------------------------------- */

      if (!leadOwner) {
        leadOwner = await User.findOne({})
          .sort({
            createdAt: 1,
          });
      }

      if (!leadOwner) {
        throw new Error(
          "No user found in the database to assign as lead owner."
        );
      }

      console.log(
        "✅ Lead owner selected:",
        leadOwner.name,
        leadOwner._id
      );

    } catch (ownerError) {
      console.error(
        "❌ Lead owner lookup failed:",
        ownerError
      );

      throw new Error(
        "Unable to assign lead owner. Please make sure at least one user exists."
      );
    }

    /* =====================================================
       5. CREATE CRM LEAD
    ===================================================== */

    let lead;

    try {
      lead = await Lead.create({

        /* -------------------------------------------------
           PERSONAL INFORMATION
        ------------------------------------------------- */

        name,

        designation:
          chatData.designation?.trim() || "",

        email,

        phone,

        /* -------------------------------------------------
           COMPANY INFORMATION
        ------------------------------------------------- */

        company,

        industry:
          chatData.industry?.trim() || "",

        website:
          chatData.website?.trim() || "",

        companySize:
          chatData.companySize || "",

        /* -------------------------------------------------
           ENQUIRY INFORMATION
        ------------------------------------------------- */

        requirement:
          category ||
          subject ||
          "",

        message,

        /* -------------------------------------------------
           LEAD SOURCE
        ------------------------------------------------- */

        source: "Website",

        /* -------------------------------------------------
           OWNER
        ------------------------------------------------- */

        owner: leadOwner._id,

        /* -------------------------------------------------
           STATUS
        ------------------------------------------------- */

        status: "New",

        /* -------------------------------------------------
           PRIORITY
        ------------------------------------------------- */

        priority,

        /* -------------------------------------------------
           ASSIGNMENT
        -------------------------------------------------

           Do NOT send empty string here.
           Lead.assignedTo is String in your schema,
           so empty string is acceptable, but default
           already handles it.
        */

        assignedTo: "",

        /* -------------------------------------------------
           SALES
        ------------------------------------------------- */

        value: 0,

        expectedValue: 0,

        /* -------------------------------------------------
           FOLLOW UP
        ------------------------------------------------- */

        followUpDate: null,

        /* -------------------------------------------------
           DEPARTMENT
        ------------------------------------------------- */

        department:
          chatData.department || "Sales",

        /* -------------------------------------------------
           NOTES
        ------------------------------------------------- */

        notes: message,

        /* -------------------------------------------------
           CONVERSION
        ------------------------------------------------- */

        isConverted: false,

        convertedAt: null,

        convertedOpportunity: null,
      });

      console.log(
        "✅ CRM Lead created:",
        lead._id
      );

      console.log(
        "👤 Lead owner:",
        leadOwner.name,
        leadOwner._id
      );

    } catch (leadError) {

      console.error(
        "❌ Lead creation failed:",
        leadError
      );

      throw new Error(
        `Enquiry received but lead creation failed: ${leadError.message}`
      );
    }

    /* =====================================================
       6. LINK CHAT WITH LEAD
    ===================================================== */

    try {
      chat.lead = lead._id;

      await chat.save();

      console.log(
        "✅ Chat linked to Lead:",
        lead._id
      );

    } catch (linkError) {

      console.error(
        "⚠️ Failed to link chat with lead:",
        linkError.message
      );

      /*
       * Chat and Lead already exist.
       * Don't fail the enquiry.
       */
    }

    /* =====================================================
       7. COMPANY EMAIL

       IMPORTANT:
       sendLeadNotification() uses:

       COMPANY_EMAIL

       from .env.

       Set:

       COMPANY_EMAIL=quries.readytechsolutions@gmail.com
    ===================================================== */

    try {

      await sendLeadNotification(lead);

      console.log(
        `✅ Lead notification sent to company email`
      );

      console.log(
        `📧 Company email: ${process.env.COMPANY_EMAIL}`
      );

    } catch (emailError) {

      console.error(
        "⚠️ Lead notification email failed:",
        emailError.message
      );

      /*
       * Email failure must NOT delete
       * the Chat or Lead.
       */
    }

    /* =====================================================
       8. CUSTOMER AUTO REPLY
    ===================================================== */

    if (lead.email) {

      try {

        await sendLeadAutoReply(lead);

        console.log(
          `✅ Lead auto-reply sent to ${lead.email}`
        );

      } catch (emailError) {

        console.error(
          "⚠️ Lead auto-reply failed:",
          emailError.message
        );
      }
    }

    /* =====================================================
       9. RETURN SUCCESS
    ===================================================== */

    return {

      success: true,

      message:
        "Your enquiry has been submitted successfully.",

      data: {
        chat,
        lead,
      },
    };

  } catch (error) {

    console.error(
      "❌ CREATE CHAT ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to create chat enquiry."
    );
  }
};


/* =========================================================
   GET ALL CHATS
========================================================= */

export const getAllChats = async (
  filters = {}
) => {

  try {

    const query = {
      isDeleted: false,
    };

    /* =====================================================
       STATUS
    ===================================================== */

    if (filters.status) {
      query.status = filters.status;
    }

    /* =====================================================
       CATEGORY
    ===================================================== */

    if (filters.category) {
      query.category = filters.category;
    }

    /* =====================================================
       PRIORITY
    ===================================================== */

    if (filters.priority) {
      query.priority = filters.priority;
    }

    /* =====================================================
       SEARCH
    ===================================================== */

    if (filters.search) {

      const search =
        String(filters.search).trim();

      if (search) {

        query.$or = [

          {
            name: {
              $regex: search,
              $options: "i",
            },
          },

          {
            email: {
              $regex: search,
              $options: "i",
            },
          },

          {
            company: {
              $regex: search,
              $options: "i",
            },
          },

          {
            message: {
              $regex: search,
              $options: "i",
            },
          },

          {
            subject: {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }
    }

    /* =====================================================
       PAGINATION
    ===================================================== */

    const page = Math.max(
      Number(filters.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number(filters.limit) || 10,
        1
      ),
      100
    );

    const skip =
      (page - 1) * limit;

    /* =====================================================
       TOTAL
    ===================================================== */

    const total =
      await Chat.countDocuments(query);

    /* =====================================================
       FETCH
    ===================================================== */

    const chats =
      await Chat.find(query)

        .populate(
          "assignedTo",
          "name email"
        )

        .populate(
          "lead",
          "name email company status source owner assignedTo"
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(limit)

        .lean();

    return {

      success: true,

      total,

      page,

      pages:
        Math.ceil(
          total / limit
        ),

      count:
        chats.length,

      data: chats,
    };

  } catch (error) {

    console.error(
      "❌ GET ALL CHATS ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to fetch chats."
    );
  }
};


/* =========================================================
   GET CHAT BY ID
========================================================= */

export const getChatById = async (
  id
) => {

  try {

    const chat =
      await Chat.findOne({
        _id: id,
        isDeleted: false,
      })

        .populate(
          "assignedTo",
          "name email"
        )

        .populate(
          "lead",
          "name email company status source owner assignedTo"
        )

        .lean();

    if (!chat) {
      throw new Error(
        "Chat enquiry not found."
      );
    }

    return {

      success: true,

      data: chat,
    };

  } catch (error) {

    console.error(
      "❌ GET CHAT BY ID ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to fetch chat."
    );
  }
};


/* =========================================================
   UPDATE CHAT STATUS
========================================================= */

export const updateChatStatus = async (
  id,
  status
) => {

  try {

    const allowedStatus = [

      "New",
      "Viewed",
      "Assigned",
      "In Progress",
      "Contacted",
      "Qualified",
      "Closed",

    ];

    if (
      !allowedStatus.includes(status)
    ) {

      throw new Error(
        "Invalid chat status."
      );
    }

    const chat =
      await Chat.findOneAndUpdate(

        {
          _id: id,
          isDeleted: false,
        },

        {
          status,
          isRead: true,
        },

        {
          new: true,
          runValidators: true,
        }

      )

        .populate(
          "assignedTo",
          "name email"
        )

        .populate(
          "lead",
          "name email company status source owner assignedTo"
        );

    if (!chat) {

      throw new Error(
        "Chat enquiry not found."
      );
    }

    return {

      success: true,

      message:
        "Chat status updated successfully.",

      data: chat,
    };

  } catch (error) {

    console.error(
      "❌ UPDATE CHAT STATUS ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to update chat status."
    );
  }
};


/* =========================================================
   ASSIGN CHAT TO USER
========================================================= */

export const assignChatToUser = async (
  id,
  userId
) => {

  try {

    if (!userId) {
      throw new Error(
        "User ID is required."
      );
    }

    const chat =
      await Chat.findOneAndUpdate(

        {
          _id: id,
          isDeleted: false,
        },

        {
          assignedTo: userId,
          status: "Assigned",
          isRead: true,
        },

        {
          new: true,
          runValidators: true,
        }

      )

        .populate(
          "assignedTo",
          "name email"
        )

        .populate(
          "lead",
          "name email company status source owner assignedTo"
        );

    if (!chat) {

      throw new Error(
        "Chat enquiry not found."
      );
    }

    /* =====================================================
       SYNC LINKED LEAD ASSIGNMENT
    ===================================================== */

    if (chat.lead?._id) {

      try {

        await Lead.findByIdAndUpdate(

          chat.lead._id,

          {
            assignedTo: userId,
          },

          {
            runValidators: true,
          }
        );

        console.log(
          "✅ Linked Lead assignment updated"
        );

      } catch (leadError) {

        console.error(
          "⚠️ Lead assignment sync failed:",
          leadError.message
        );
      }
    }

    return {

      success: true,

      message:
        "Chat assigned successfully.",

      data: chat,
    };

  } catch (error) {

    console.error(
      "❌ ASSIGN CHAT ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to assign chat."
    );
  }
};


/* =========================================================
   ADD ADMIN NOTE
========================================================= */

export const addAdminNote = async (
  id,
  note,
  userId
) => {

  try {

    if (!note?.trim()) {

      throw new Error(
        "Note is required."
      );
    }

    const chat =
      await Chat.findOneAndUpdate(

        {
          _id: id,
          isDeleted: false,
        },

        {
          $push: {

            notes: {

              note: note.trim(),

              addedBy: userId,
            },
          },
        },

        {
          new: true,
          runValidators: true,
        }
      );

    if (!chat) {

      throw new Error(
        "Chat enquiry not found."
      );
    }

    return {

      success: true,

      message:
        "Admin note added successfully.",

      data: chat,
    };

  } catch (error) {

    console.error(
      "❌ ADD ADMIN NOTE ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to add admin note."
    );
  }
};


/* =========================================================
   MARK CHAT AS READ
========================================================= */

export const markAsRead = async (
  id
) => {

  try {

    const chat =
      await Chat.findOneAndUpdate(

        {
          _id: id,
          isDeleted: false,
        },

        {
          isRead: true,
        },

        {
          new: true,
        }
      );

    if (!chat) {

      throw new Error(
        "Chat enquiry not found."
      );
    }

    return {

      success: true,

      message:
        "Chat marked as read.",

      data: chat,
    };

  } catch (error) {

    console.error(
      "❌ MARK CHAT READ ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to mark chat as read."
    );
  }
};


/* =========================================================
   SOFT DELETE CHAT
========================================================= */

export const deleteChat = async (
  id
) => {

  try {

    const chat =
      await Chat.findOneAndUpdate(

        {
          _id: id,
          isDeleted: false,
        },

        {
          isDeleted: true,
        },

        {
          new: true,
        }
      );

    if (!chat) {

      throw new Error(
        "Chat enquiry not found."
      );
    }

    return {

      success: true,

      message:
        "Chat enquiry deleted successfully.",
    };

  } catch (error) {

    console.error(
      "❌ DELETE CHAT ERROR:",
      error
    );

    throw new Error(
      error.message ||
      "Failed to delete chat."
    );
  }
};