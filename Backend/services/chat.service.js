// services/chat.service.js

import Chat from "../models/Chat.js";
import {
  sendChatEnquiry,
  sendAutoReply,
} from "./email.service.js";

/* =========================================================
   Create Chat Enquiry
========================================================= */
export const createChat = async (chatData) => {
  try {
    // Prevent duplicate spam (same email + message within 5 mins)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const existingChat = await Chat.findOne({
      email: chatData.email,
      message: chatData.message,
      createdAt: { $gte: fiveMinutesAgo },
      isDeleted: false,
    });

    if (existingChat) {
      throw new Error(
        "Duplicate enquiry detected. Please wait before sending again."
      );
    }

    // Create chat
    const chat = await Chat.create({
      ...chatData,
      status: "New",
      isRead: false,
    });

    // Send company email
    try {
      await sendChatEnquiry(chat);
    } catch (emailError) {
      console.error("Company Email Error:", emailError.message);
    }

    // Send customer auto reply
    try {
      await sendAutoReply(chat);
    } catch (emailError) {
      console.error("Auto Reply Error:", emailError.message);
    }

    return {
      success: true,
      message: "Your enquiry has been submitted successfully.",
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message || "Failed to create chat enquiry.");
  }
};

/* =========================================================
   Get All Chats
========================================================= */
export const getAllChats = async (filters = {}) => {
  try {
    const query = {
      isDeleted: false,
    };

    // Status Filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Category Filter
    if (filters.category) {
      query.category = filters.category;
    }

    // Priority Filter
    if (filters.priority) {
      query.priority = filters.priority;
    }

    // Search
    if (filters.search) {
      query.$or = [
        {
          name: {
            $regex: filters.search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: filters.search,
            $options: "i",
          },
        },
        {
          company: {
            $regex: filters.search,
            $options: "i",
          },
        },
        {
          message: {
            $regex: filters.search,
            $options: "i",
          },
        },
      ];
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Chat.countDocuments(query);

    const chats = await Chat.find(query)
      .populate("assignedTo", "name email")
      .populate("lead", "name email company")
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
      pages: Math.ceil(total / limit),
      count: chats.length,
      data: chats,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};/* =========================================================
   Get Chat By ID
========================================================= */

export const getChatById = async (id) => {
  try {
    const chat = await Chat.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("assignedTo", "name email")
      .populate("lead", "name email company")
      .lean();

    if (!chat) {
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/* =========================================================
   Update Chat Status
========================================================= */

export const updateChatStatus = async (id, status) => {
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

    if (!allowedStatus.includes(status)) {
      throw new Error("Invalid chat status.");
    }

    const chat = await Chat.findOneAndUpdate(
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
      .populate("assignedTo", "name email")
      .populate("lead", "name email company");

    if (!chat) {
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      message: "Chat status updated successfully.",
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/* =========================================================
   Assign Chat
========================================================= */

export const assignChatToUser = async (id, userId) => {
  try {
    const chat = await Chat.findOneAndUpdate(
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
      }
    );

    if (!chat) {
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      message: "Chat assigned successfully.",
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/* =========================================================
   Add Admin Note
========================================================= */

export const addAdminNote = async (
  id,
  note,
  userId
) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      {
        _id: id,
        isDeleted: false,
      },
      {
        $push: {
          notes: {
            note,
            addedBy: userId,
          },
        },
      },
      {
        new: true,
      }
    );

    if (!chat) {
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      message: "Admin note added.",
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/* =========================================================
   Mark As Read
========================================================= */

export const markAsRead = async (id) => {
  try {
    const chat = await Chat.findOneAndUpdate(
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
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      data: chat,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

/* =========================================================
   Soft Delete Chat
========================================================= */

export const deleteChat = async (id) => {
  try {
    const chat = await Chat.findOneAndUpdate(
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
      throw new Error("Chat enquiry not found.");
    }

    return {
      success: true,
      message: "Chat enquiry deleted successfully.",
    };
  } catch (error) {
    throw new Error(error.message);
  }
};